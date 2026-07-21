import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, HttpCode } from '@nestjs/common'
import { CategoriesService } from './categories.service'
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto'
import { Roles } from '../../common/auth/roles.decorator'

/** Xem: ai đăng nhập cũng được. Ghi (tạo/sửa/xoá): super_admin/admin (§5 ma trận phân quyền). */
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  tree() {
    return this.categories.tree()
  }

  @Post()
  @Roles('super_admin', 'admin')
  create(@Body() dto: CreateCategoryDto) {
    return this.categories.create(dto)
  }

  @Patch(':id')
  @Roles('super_admin', 'admin')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCategoryDto) {
    return this.categories.update(id, dto)
  }

  @Delete(':id')
  @Roles('super_admin', 'admin')
  @HttpCode(204)
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.categories.remove(id)
  }
}
