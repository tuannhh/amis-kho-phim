import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Category } from './entities/category.entity'
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto'
import { slugify } from '../../common/slugify'
import { UsersService } from '../users/users.service'
import type { AuthUser } from '../../common/auth/auth-user'

export interface CategoryNode {
  id: number
  name: string
  slug: string
  description: string | null
  parentId: number | null
  children?: CategoryNode[]
}

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category) private readonly repo: Repository<Category>,
    private readonly users: UsersService,
  ) {}

  private toNode(c: Category): CategoryNode {
    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      parentId: c.parentId,
    }
  }

  /** Cây cha-con dựng từ danh sách phẳng (đủ sâu, không giới hạn 1 cấp). */
  async tree(): Promise<CategoryNode[]> {
    const all = await this.repo.find({ order: { id: 'ASC' } })
    const nodes = new Map<number, CategoryNode>(all.map((c) => [c.id, this.toNode(c)]))
    const roots: CategoryNode[] = []
    for (const c of all) {
      const node = nodes.get(c.id)!
      if (c.parentId != null && nodes.has(c.parentId)) {
        const parent = nodes.get(c.parentId)!
        parent.children = parent.children || []
        parent.children.push(node)
      } else {
        roots.push(node)
      }
    }
    return roots
  }

  /**
   * `categoryId` + TOÀN BỘ chuyên mục con cháu của nó (đệ quy, không giới hạn một cấp).
   *
   * Dùng cho bộ lọc báo cáo và cho "kệ theo chuyên mục" ở Kho phim: chọn một chuyên mục CHA
   * thì phải thấy cả phim nằm trong các chuyên mục CON — nếu chỉ so `category_id = :id` thì
   * chọn cha sẽ ra rỗng trong khi mắt người dùng thấy rõ bên dưới có phim.
   *
   * Trả về mảng luôn chứa chính `categoryId`, kể cả khi chuyên mục đó không tồn tại — người
   * gọi lọc theo `IN (...)` nên kết quả rỗng là đúng, không cần ném lỗi.
   */
  async idsWithDescendants(categoryId: number): Promise<number[]> {
    const all = await this.repo.find({ select: { id: true, parentId: true } })
    const childrenOf = new Map<number, number[]>()
    for (const c of all) {
      if (c.parentId == null) continue
      const list = childrenOf.get(c.parentId) || []
      list.push(c.id)
      childrenOf.set(c.parentId, list)
    }
    const out: number[] = []
    const stack = [categoryId]
    // `seen` chống lặp vô hạn nếu dữ liệu lỡ có vòng cha-con (không nên có, nhưng một truy vấn
    // báo cáo không được phép treo tiến trình vì dữ liệu bẩn).
    const seen = new Set<number>()
    while (stack.length) {
      const id = stack.pop()!
      if (seen.has(id)) continue
      seen.add(id)
      out.push(id)
      for (const child of childrenOf.get(id) || []) stack.push(child)
    }
    return out
  }

  private async uniqueSlug(base: string, excludeId?: number): Promise<string> {
    const root = slugify(base) || 'chuyen-muc'
    let candidate = root
    let n = 2
    for (;;) {
      const existed = await this.repo.findOne({ where: { slug: candidate } })
      if (!existed || existed.id === excludeId) return candidate
      candidate = `${root}-${n++}`
    }
  }

  /**
   * Quyền ghi chuyên mục phân theo TẦNG của bản ghi (ADR-051), thay cho quy tắc cũ "mọi thao
   * tác ghi đều chỉ Cấp 4" (ADR-044):
   *
   *  - Chuyên mục GỐC (`parentId == null`) — khung phân loại chung của cả công ty, đổi một cái
   *    là ảnh hưởng toàn kho phim → CHỈ Cấp 4 `super_admin`.
   *  - Chuyên mục CON (`parentId != null`) — nằm gọn trong khung sẵn có, rủi ro thấp → Cấp 2
   *    trở lên (`employee`/`dept_manager`/`super_admin`).
   *
   * Cấp 1 `viewer` đã bị `@Roles(...FILM_WRITE_ROLES)` ở controller chặn từ vòng ngoài; kiểm
   * lại ở đây là lớp phòng thủ thứ hai, không phải chốt duy nhất.
   *
   * `isRoot` LUÔN được suy ra từ dữ liệu server tin được — DTO khi tạo, bản ghi đã lưu khi
   * sửa/xoá — không nhận cờ "đây là chuyên mục con" do client tự khai.
   */
  private assertCanWrite(actor: AuthUser, isRoot: boolean): void {
    if (actor.roleCode === 'super_admin') return
    if (isRoot) {
      throw new ForbiddenException(
        'Chỉ Quản trị cao nhất mới được tạo/sửa/xoá chuyên mục gốc. Bạn có thể tạo chuyên mục con bên trong một chuyên mục gốc có sẵn.',
      )
    }
    if (actor.roleCode === 'viewer') {
      throw new ForbiddenException('Bạn chỉ có quyền xem, không được tạo/sửa/xoá chuyên mục')
    }
  }

  /**
   * `created_by` + `department_id` là cột TRUY VẾT (ADR-042) — snapshot người tạo và phòng ban
   * của người đó lúc tạo, lấy từ danh tính đã xác thực + DB, không nhận từ DTO. KHÔNG dùng để
   * scope quyền: chuyên mục vẫn là danh mục dùng chung.
   */
  async create(actor: AuthUser, dto: CreateCategoryDto): Promise<CategoryNode> {
    this.assertCanWrite(actor, dto.parentId == null)
    if (dto.parentId != null) {
      const parent = await this.repo.findOne({ where: { id: dto.parentId } })
      if (!parent) throw new BadRequestException('Chuyên mục cha không tồn tại')
    }
    const slug = await this.uniqueSlug(dto.name)
    const entity = this.repo.create({
      name: dto.name.trim(),
      slug,
      description: dto.description?.trim() || null,
      parentId: dto.parentId ?? null,
      createdBy: actor.id,
      departmentId: await this.users.getDepartmentId(actor.id),
    })
    const saved = await this.repo.save(entity)
    return this.toNode(saved)
  }

  async update(actor: AuthUser, id: number, dto: UpdateCategoryDto): Promise<CategoryNode> {
    const entity = await this.repo.findOne({ where: { id } })
    if (!entity) throw new NotFoundException('Không tìm thấy chuyên mục')
    // Tầng lấy từ BẢN GHI ĐÃ LƯU, không từ payload (`UpdateCategoryDto` cũng không cho đổi cha).
    this.assertCanWrite(actor, entity.parentId == null)
    entity.name = dto.name.trim()
    entity.description = dto.description?.trim() || null
    const saved = await this.repo.save(entity)
    return this.toNode(saved)
  }

  async remove(actor: AuthUser, id: number): Promise<void> {
    const entity = await this.repo.findOne({ where: { id } })
    if (!entity) throw new NotFoundException('Không tìm thấy chuyên mục')
    // Xoá chuyên mục gốc kéo theo cascade toàn bộ con → giữ ở Cấp 4, giống lúc tạo/sửa.
    this.assertCanWrite(actor, entity.parentId == null)
    // Xoá cascade chuyên mục con (FK parent_id ON DELETE CASCADE); phim thuộc chuyên mục
    // này/con của nó chỉ mất liên kết (films.category_id ON DELETE SET NULL), không bị xoá.
    await this.repo.remove(entity)
  }
}
