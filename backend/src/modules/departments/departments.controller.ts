import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post } from '@nestjs/common'
import { DepartmentsService } from './departments.service'
import { UpsertDepartmentDto } from './dto/department.dto'
import { Roles } from '../../common/auth/roles.decorator'
import { CurrentUser } from '../../common/auth/current-user.decorator'
import type { AuthUser } from '../../common/auth/auth-user'

/**
 * Danh mục phòng ban — TOÀN BỘ route (kể cả đọc) giới hạn Cấp 4 (`super_admin`).
 *
 * Vì sao khoá cả quyền đọc: danh sách phòng ban chỉ được dùng ở màn quản trị (dropdown gán
 * phòng ban cho tài khoản + màn Quản lý phòng ban), đều là màn Cấp 4. Không có nhu cầu thật
 * nào cần Cấp 1/2/3 đọc danh mục này, nên áp nguyên tắc quyền tối thiểu thay vì mở sẵn.
 */
@Controller('departments')
@Roles('super_admin')
export class DepartmentsController {
  constructor(private readonly departments: DepartmentsService) {}

  @Get()
  list() {
    return this.departments.list()
  }

  @Post()
  create(@CurrentUser() actor: AuthUser, @Body() dto: UpsertDepartmentDto) {
    return this.departments.create(actor, dto)
  }

  @Patch(':id')
  update(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpsertDepartmentDto,
  ) {
    return this.departments.update(actor, id, dto)
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() actor: AuthUser, @Param('id', ParseIntPipe) id: number) {
    await this.departments.remove(actor, id)
  }
}
