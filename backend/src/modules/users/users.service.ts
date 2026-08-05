import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import * as bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import { User } from './entities/user.entity'
import type { RoleCode } from './entities/role.entity'
import type { AuthUser } from '../../common/auth/auth-user'
import { CreateUserDto, UpdateUserDto } from './dto/create-user.dto'
import { auditLog } from '../../common/audit/audit-log'
import { DepartmentsService } from '../departments/departments.service'

/** Hình dạng user trả ra API — KHÔNG bao giờ kèm password_hash. */
export interface PublicUser {
  id: number
  email: string
  fullName: string
  roleCode: RoleCode
  departmentId: number | null
  createdBy: number | null
  isActive: boolean
  mustChangePassword: boolean
  createdAt: Date
}

const BCRYPT_ROUNDS = 10

/**
 * Vai trò mà `byRole` được phép GÁN (tạo mới hoặc đổi vai trò) — ma trận RBAC 4 cấp (ADR-040).
 * Nguồn sự thật ở BE.
 *
 * CHỈ Cấp 4 (`super_admin`) quản lý người dùng. Cấp 3 (`dept_manager`) KHÔNG có quyền này:
 * đặc tả Cấp 3 chỉ mở rộng phạm vi sửa/xoá PHIM cùng phòng ban, không nhắc quyền quản trị
 * tài khoản — và quyền tạo tài khoản của `admin` cũ đã theo mapping sang Cấp 4 (ADR-041).
 * Không ai gán được `super_admin` qua API (giữ nguyên chốt chặn từ GĐ1).
 */
export function creatableRoles(byRole: RoleCode): RoleCode[] {
  if (byRole === 'super_admin') return ['viewer', 'employee', 'dept_manager']
  return []
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
    private readonly departments: DepartmentsService,
  ) {}

  private toPublic(u: User): PublicUser {
    return {
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      roleCode: u.roleCode,
      departmentId: u.departmentId,
      createdBy: u.createdBy,
      isActive: u.isActive,
      mustChangePassword: u.mustChangePassword,
      createdAt: u.createdAt,
    }
  }

  /**
   * Phòng ban HIỆN TẠI của một tài khoản, đọc từ DB.
   *
   * CỐ Ý không nhét `departmentId` vào JWT payload (ADR-043): access token sống 15 phút, nếu
   * mang theo phòng ban thì sau khi Cấp 4 chuyển một Trưởng phòng sang phòng khác, token cũ
   * vẫn cho họ quản lý phim của phòng cũ tới khi token hết hạn. Với dữ liệu quyết định phạm
   * vi phân quyền, đọc lại DB mỗi lần là đánh đổi đúng (nguyên tắc 1: bảo mật > hiệu năng).
   */
  async getDepartmentId(userId: number): Promise<number | null> {
    const u = await this.repo.findOne({ where: { id: userId }, select: { id: true, departmentId: true } })
    return u?.departmentId ?? null
  }

  /** Vai trò + phòng ban hiện tại (đọc DB) — dùng cho scope quyền ở FilmsService. */
  async getRoleAndDepartment(
    userId: number,
  ): Promise<{ roleCode: RoleCode; departmentId: number | null } | null> {
    const u = await this.repo.findOne({
      where: { id: userId },
      select: { id: true, roleCode: true, departmentId: true },
    })
    return u ? { roleCode: u.roleCode, departmentId: u.departmentId } : null
  }

  /** Chuẩn hoá + kiểm tra phòng ban do client gửi lên có tồn tại thật. */
  private async resolveDepartmentId(departmentId: number | null | undefined): Promise<number | null> {
    if (departmentId == null) return null
    if (!(await this.departments.exists(departmentId))) {
      throw new BadRequestException('Phòng ban không tồn tại')
    }
    return departmentId
  }

  /** Dùng khi đăng nhập: lấy kèm password_hash (cột select:false). */
  findByEmailWithHash(email: string): Promise<User | null> {
    return this.repo
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.email = :email', { email: email.toLowerCase() })
      .getOne()
  }

  async findByIdPublic(id: number): Promise<PublicUser | null> {
    const u = await this.repo.findOne({ where: { id } })
    return u ? this.toPublic(u) : null
  }

  async findActiveEntity(id: number): Promise<User | null> {
    return this.repo.findOne({ where: { id, isActive: true } })
  }

  async list(): Promise<PublicUser[]> {
    const rows = await this.repo.find({ order: { createdAt: 'ASC' } })
    return rows.map((u) => this.toPublic(u))
  }

  /**
   * Ai được quản lý (sửa/khoá/xoá) target — kiểm ở BE, không tin FE.
   * RBAC 4 cấp: CHỈ Cấp 4 quản lý người dùng, và không đụng được Cấp 4 khác.
   */
  private assertCanManage(actor: AuthUser, target: User) {
    if (actor.id === target.id) {
      throw new ForbiddenException('Không thể tự sửa/khoá/xoá chính mình')
    }
    if (actor.roleCode !== 'super_admin') {
      throw new ForbiddenException('Bạn không có quyền quản lý người dùng')
    }
    if (target.roleCode === 'super_admin') {
      throw new ForbiddenException('Không thể tác động tài khoản Quản trị cao nhất khác')
    }
  }

  async create(
    actor: AuthUser,
    dto: CreateUserDto,
  ): Promise<{ user: PublicUser; generatedPassword?: string }> {
    if (!creatableRoles(actor.roleCode).includes(dto.roleCode)) {
      throw new ForbiddenException(`Bạn không có quyền tạo tài khoản vai trò "${dto.roleCode}"`)
    }

    const email = dto.email.trim().toLowerCase()
    const existed = await this.repo.findOne({ where: { email } })
    if (existed) throw new ConflictException('Email đã tồn tại trong hệ thống')

    const departmentId = await this.resolveDepartmentId(dto.departmentId)

    const generated = dto.password ? undefined : this.randomPassword()
    const plain = dto.password ?? generated!
    const passwordHash = await bcrypt.hash(plain, BCRYPT_ROUNDS)

    const entity = this.repo.create({
      email,
      fullName: dto.fullName.trim(),
      passwordHash,
      roleCode: dto.roleCode,
      departmentId,
      createdBy: actor.id,
      isActive: true,
      mustChangePassword: true, // buộc đổi mật khẩu lần đăng nhập đầu
    })
    const saved = await this.repo.save(entity)
    auditLog({
      action: 'user.create',
      actorId: actor.id,
      targetId: saved.id,
      outcome: 'success',
      detail: { role: saved.roleCode, departmentId: saved.departmentId },
    })
    return { user: this.toPublic(saved), generatedPassword: generated }
  }

  /**
   * Sửa vai trò và/hoặc phòng ban của tài khoản (chỉ Cấp 4). Đổi vai trò và đổi phòng ban đều
   * là thay đổi RANH GIỚI PHÂN QUYỀN → ghi nhật ký kiểm toán bắt buộc
   * (`02-security-baseline.md` §7).
   */
  async update(actor: AuthUser, targetId: number, dto: UpdateUserDto): Promise<PublicUser> {
    const target = await this.repo.findOne({ where: { id: targetId } })
    if (!target) throw new NotFoundException('Không tìm thấy người dùng')
    this.assertCanManage(actor, target)

    const before = { role: target.roleCode, departmentId: target.departmentId }

    if (dto.roleCode !== undefined) {
      if (!creatableRoles(actor.roleCode).includes(dto.roleCode)) {
        throw new ForbiddenException(`Bạn không có quyền gán vai trò "${dto.roleCode}"`)
      }
      target.roleCode = dto.roleCode
    }
    // Phân biệt "thiếu trường" (không đổi) với `null` (bỏ gán phòng ban).
    if (dto.departmentId !== undefined) {
      target.departmentId = await this.resolveDepartmentId(dto.departmentId)
    }

    const saved = await this.repo.save(target)
    auditLog({
      action: 'user.update',
      actorId: actor.id,
      targetId: saved.id,
      outcome: 'success',
      detail: {
        roleBefore: before.role,
        roleAfter: saved.roleCode,
        departmentBefore: before.departmentId,
        departmentAfter: saved.departmentId,
      },
    })
    return this.toPublic(saved)
  }

  async setActive(actor: AuthUser, targetId: number, isActive: boolean): Promise<PublicUser> {
    const target = await this.repo.findOne({ where: { id: targetId } })
    if (!target) throw new NotFoundException('Không tìm thấy người dùng')
    this.assertCanManage(actor, target)
    target.isActive = isActive
    const saved = await this.repo.save(target)
    auditLog({
      action: 'user.status_change',
      actorId: actor.id,
      targetId: saved.id,
      outcome: 'success',
      detail: { isActive },
    })
    return this.toPublic(saved)
  }

  async remove(actor: AuthUser, targetId: number): Promise<void> {
    const target = await this.repo.findOne({ where: { id: targetId } })
    if (!target) throw new NotFoundException('Không tìm thấy người dùng')
    this.assertCanManage(actor, target)
    await this.repo.remove(target)
    auditLog({ action: 'user.delete', actorId: actor.id, targetId, outcome: 'success' })
  }

  /** Đổi mật khẩu của chính người dùng (dùng ở AuthModule). */
  async changePassword(userId: number, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.repo
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.id = :id', { id: userId })
      .getOne()
    if (!user) throw new NotFoundException('Không tìm thấy người dùng')

    const ok = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!ok) throw new BadRequestException('Mật khẩu hiện tại không đúng')
    if (newPassword.length < 8) throw new BadRequestException('Mật khẩu mới tối thiểu 8 ký tự')

    user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS)
    user.mustChangePassword = false
    await this.repo.save(user)
  }

  private randomPassword(): string {
    // Mật khẩu tạm 12 ký tự an toàn (không dùng Math.random cho bảo mật).
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#$%'
    const bytes = randomBytes(12)
    let out = ''
    for (let i = 0; i < 12; i++) out += chars[bytes[i] % chars.length]
    return out
  }
}
