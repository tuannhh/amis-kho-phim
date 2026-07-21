import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Category } from './entities/category.entity'
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto'
import { slugify } from '../../common/slugify'

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

  async create(dto: CreateCategoryDto): Promise<CategoryNode> {
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
    })
    const saved = await this.repo.save(entity)
    return this.toNode(saved)
  }

  async update(id: number, dto: UpdateCategoryDto): Promise<CategoryNode> {
    const entity = await this.repo.findOne({ where: { id } })
    if (!entity) throw new NotFoundException('Không tìm thấy chuyên mục')
    entity.name = dto.name.trim()
    entity.description = dto.description?.trim() || null
    const saved = await this.repo.save(entity)
    return this.toNode(saved)
  }

  async remove(id: number): Promise<void> {
    const entity = await this.repo.findOne({ where: { id } })
    if (!entity) throw new NotFoundException('Không tìm thấy chuyên mục')
    // Xoá cascade chuyên mục con (FK parent_id ON DELETE CASCADE); phim thuộc chuyên mục
    // này/con của nó chỉ mất liên kết (films.category_id ON DELETE SET NULL), không bị xoá.
    await this.repo.remove(entity)
  }
}
