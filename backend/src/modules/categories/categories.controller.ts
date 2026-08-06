import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, HttpCode } from '@nestjs/common'
import { CategoriesService } from './categories.service'
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto'
import { Roles } from '../../common/auth/roles.decorator'
import { CurrentUser } from '../../common/auth/current-user.decorator'
import type { AuthUser } from '../../common/auth/auth-user'
import { FILM_WRITE_ROLES } from '../users/entities/role.entity'

/**
 * Xem: ai đăng nhập cũng được (kể cả Cấp 1).
 *
 * Ghi (tạo/sửa/xoá) phân theo TẦNG của chuyên mục (ADR-051, thay ADR-044 cũ vốn giữ mọi thao
 * tác ghi ở Cấp 4):
 *   - chuyên mục GỐC (`parentId == null`) → chỉ Cấp 4 `super_admin`
 *   - chuyên mục CON (`parentId != null`) → Cấp 2 trở lên
 *
 * Guard ở đây chỉ chặn được phần CHUNG cho mọi thao tác ghi (Cấp 1 bị loại ngay), vì tầng của
 * bản ghi phụ thuộc `parentId` trong body/DB nên không biểu diễn được bằng `@Roles`. Chốt chặn
 * thật theo tầng nằm ở `CategoriesService.assertCanWrite` — guard là lớp một, không phải lớp
 * duy nhất (cùng mô hình với `FilmsService.assertCanManage`).
 */
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  tree() {
    return this.categories.tree()
  }

  @Post()
  @Roles(...FILM_WRITE_ROLES)
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreateCategoryDto) {
    return this.categories.create(actor, dto)
  }

  @Patch(':id')
  @Roles(...FILM_WRITE_ROLES)
  update(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categories.update(actor, id, dto)
  }

  @Delete(':id')
  @Roles(...FILM_WRITE_ROLES)
  @HttpCode(204)
  async remove(@CurrentUser() actor: AuthUser, @Param('id', ParseIntPipe) id: number) {
    await this.categories.remove(actor, id)
  }
}
