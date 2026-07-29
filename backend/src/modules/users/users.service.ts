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
import { CreateUserDto } from './dto/create-user.dto'
import { auditLog } from '../../common/audit/audit-log'

/** Hình dạng user trả ra API — KHÔNG bao giờ kèm password_hash. */
export interface PublicUser {
  id: number
  email: string
  fullName: string
  roleCode: RoleCode
  createdBy: number | null
  isActive: boolean
  mustChangePassword: boolean
  createdAt: Date
}

const BCRYPT_ROUNDS = 10

/** Vai trò mà `byRole` được phép TẠO (ma trận 01-architecture.md §5). Nguồn sự thật ở BE. */
export function creatableRoles(byRole: RoleCode): RoleCode[] {
  if (byRole === 'super_admin') return ['admin', 'employee']
  if (byRole === 'admin') return ['employee']
  return []
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
  ) {}

  private toPublic(u: User): PublicUser {
    return {
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      roleCode: u.roleCode,
      createdBy: u.createdBy,
      isActive: u.isActive,
      mustChangePassword: u.mustChangePassword,
      createdAt: u.createdAt,
    }
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

  /** Ai được quản lý (khoá/xoá) target — kiểm ở BE, không tin FE. */
  private assertCanManage(actor: AuthUser, target: User) {
    if (actor.id === target.id) {
      throw new ForbiddenException('Không thể tự khoá/xoá chính mình')
    }
    if (actor.roleCode === 'super_admin') {
      if (target.roleCode === 'super_admin') {
        throw new ForbiddenException('Không thể tác động tài khoản Super Admin khác')
      }
      return
    }
    if (actor.roleCode === 'admin') {
      if (target.roleCode !== 'employee') {
        throw new ForbiddenException('Admin chỉ quản lý được tài khoản Nhân viên')
      }
      return
    }
    throw new ForbiddenException('Bạn không có quyền quản lý người dùng')
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

    const generated = dto.password ? undefined : this.randomPassword()
    const plain = dto.password ?? generated!
    const passwordHash = await bcrypt.hash(plain, BCRYPT_ROUNDS)

    const entity = this.repo.create({
      email,
      fullName: dto.fullName.trim(),
      passwordHash,
      roleCode: dto.roleCode,
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
      detail: { role: saved.roleCode },
    })
    return { user: this.toPublic(saved), generatedPassword: generated }
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
