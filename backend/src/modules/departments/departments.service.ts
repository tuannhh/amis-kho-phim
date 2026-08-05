import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { QueryFailedError, Repository } from 'typeorm'
import { Department } from './entities/department.entity'
import { UpsertDepartmentDto } from './dto/department.dto'
import { User } from '../users/entities/user.entity'
import { Film } from '../films/entities/film.entity'
import { Category } from '../categories/entities/category.entity'
import type { AuthUser } from '../../common/auth/auth-user'
import { auditLog } from '../../common/audit/audit-log'

export interface PublicDepartment {
  id: number
  name: string
  createdAt: Date
  /** Số người dùng đang thuộc phòng ban — để UI biết trước là không xoá được. */
  userCount: number
}

/** Mã lỗi MySQL cho vi phạm ràng buộc duy nhất. */
const ER_DUP_ENTRY = 'ER_DUP_ENTRY'

@Injectable()
export class DepartmentsService {
  constructor(@InjectRepository(Department) private readonly repo: Repository<Department>) {}

  private toPublic(d: Department, userCount: number): PublicDepartment {
    return { id: d.id, name: d.name, createdAt: d.createdAt, userCount }
  }

  /**
   * Danh sách phòng ban kèm số người dùng. Đếm bằng MỘT câu group-by rồi ghép ở tầng ứng
   * dụng — không đếm trong vòng lặp (tránh N+1, `05-database-rules.md` §6).
   */
  async list(): Promise<PublicDepartment[]> {
    const rows = await this.repo.find({ order: { name: 'ASC' } })
    if (!rows.length) return []

    const counts = await this.repo.manager
      .createQueryBuilder(User, 'u')
      .select('u.department_id', 'departmentId')
      .addSelect('COUNT(*)', 'total')
      .where('u.department_id IS NOT NULL')
      .groupBy('u.department_id')
      .getRawMany<{ departmentId: number; total: string }>()
    const byId = new Map(counts.map((c) => [Number(c.departmentId), Number(c.total)]))

    return rows.map((d) => this.toPublic(d, byId.get(d.id) ?? 0))
  }

  /** Kiểm tra id phòng ban do client gửi lên có thật — dùng chung khi gán cho tài khoản. */
  async exists(id: number): Promise<boolean> {
    return (await this.repo.count({ where: { id } })) > 0
  }

  async create(actor: AuthUser, dto: UpsertDepartmentDto): Promise<PublicDepartment> {
    const name = dto.name.trim()
    try {
      const saved = await this.repo.save(this.repo.create({ name }))
      auditLog({
        action: 'department.create',
        actorId: actor.id,
        targetId: saved.id,
        outcome: 'success',
        detail: { name: saved.name },
      })
      return this.toPublic(saved, 0)
    } catch (e) {
      throw this.translateDuplicate(e, name)
    }
  }

  async update(actor: AuthUser, id: number, dto: UpsertDepartmentDto): Promise<PublicDepartment> {
    const entity = await this.repo.findOne({ where: { id } })
    if (!entity) throw new NotFoundException('Không tìm thấy phòng ban')

    const name = dto.name.trim()
    entity.name = name
    let saved: Department
    try {
      saved = await this.repo.save(entity)
    } catch (e) {
      throw this.translateDuplicate(e, name)
    }
    auditLog({
      action: 'department.update',
      actorId: actor.id,
      targetId: saved.id,
      outcome: 'success',
      detail: { name: saved.name },
    })
    const userCount = await this.repo.manager.count(User, { where: { departmentId: id } })
    return this.toPublic(saved, userCount)
  }

  /**
   * Xoá phòng ban — CHẶN nếu còn bản ghi tham chiếu (người dùng, phim, chuyên mục).
   *
   * Cố ý KHÔNG dựa vào `ON DELETE SET NULL` của khoá ngoại ở đây: xoá âm thầm sẽ làm
   * `films.department_id` về NULL, tức là phim mất ngữ cảnh phòng ban lúc tạo và Cấp 3
   * lặng lẽ mất quyền quản lý chúng. Với dữ liệu quyết định phân quyền, thà từ chối rõ
   * ràng còn hơn thay đổi phạm vi quyền mà không ai biết (nguyên tắc 1: bảo mật trước
   * tiện lợi). `ON DELETE SET NULL` giữ lại chỉ như lưới an toàn ở tầng DB.
   */
  async remove(actor: AuthUser, id: number): Promise<void> {
    const entity = await this.repo.findOne({ where: { id } })
    if (!entity) throw new NotFoundException('Không tìm thấy phòng ban')

    const [users, films, categories] = await Promise.all([
      this.repo.manager.count(User, { where: { departmentId: id } }),
      this.repo.manager.count(Film, { where: { departmentId: id } }),
      this.repo.manager.count(Category, { where: { departmentId: id } }),
    ])
    if (users || films || categories) {
      throw new ConflictException(
        `Không thể xoá phòng ban đang được tham chiếu (${users} người dùng, ${films} phim, ${categories} chuyên mục). Hãy chuyển các bản ghi này sang phòng ban khác trước.`,
      )
    }

    await this.repo.remove(entity)
    auditLog({
      action: 'department.delete',
      actorId: actor.id,
      targetId: id,
      outcome: 'success',
      detail: { name: entity.name },
    })
  }

  /**
   * Ràng buộc duy nhất được thực thi ở TẦNG DB (unique index) — đây là chốt chặn thật, đúng
   * `05-database-rules.md` §3: không đọc-rồi-ghi để kiểm trùng (2 request song song cùng
   * vượt qua bước đọc). Ở đây chỉ dịch lỗi DB sang thông báo nghiệp vụ.
   */
  private translateDuplicate(e: unknown, name: string): unknown {
    const driverCode = (e as QueryFailedError & { driverError?: { code?: string } })?.driverError?.code
    if (e instanceof QueryFailedError && driverCode === ER_DUP_ENTRY) {
      return new ConflictException(`Phòng ban "${name}" đã tồn tại`)
    }
    return e
  }
}
