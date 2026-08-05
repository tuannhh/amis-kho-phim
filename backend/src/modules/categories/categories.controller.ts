import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, HttpCode } from '@nestjs/common'
import { CategoriesService } from './categories.service'
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto'
import { Roles } from '../../common/auth/roles.decorator'
import { CurrentUser } from '../../common/auth/current-user.decorator'
import type { AuthUser } from '../../common/auth/auth-user'

/**
 * Xem: ai đăng nhập cũng được (kể cả Cấp 1). Ghi (tạo/sửa/xoá): CHỈ Cấp 4 (`super_admin`).
 *
 * Giữ nguyên nguyên tắc cũ "danh mục dùng chung chỉ cấp cao nhất được ghi"
 * (`02-security-baseline.md` §2) — chỉ đổi tên vai trò do `admin` cũ đã bị loại bỏ và
 * migrate sang Cấp 4 (ADR-041). Cấp 3 KHÔNG được ghi: chuyên mục là danh mục toàn công ty,
 * không thuộc phạm vi phòng ban nào.
 */
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  tree() {
    return this.categories.tree()
  }

  @Post()
  @Roles('super_admin')
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreateCategoryDto) {
    return this.categories.create(actor, dto)
  }

  @Patch(':id')
  @Roles('super_admin')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCategoryDto) {
    return this.categories.update(id, dto)
  }

  @Delete(':id')
  @Roles('super_admin')
  @HttpCode(204)
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.categories.remove(id)
  }
}
