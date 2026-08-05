import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  HttpCode,
} from '@nestjs/common'
import { UsersService } from './users.service'
import { CreateUserDto, UpdateUserDto, UpdateUserStatusDto } from './dto/create-user.dto'
import { Roles } from '../../common/auth/roles.decorator'
import { CurrentUser } from '../../common/auth/current-user.decorator'
import type { AuthUser } from '../../common/auth/auth-user'

/**
 * Quản trị người dùng. Toàn bộ route yêu cầu đăng nhập (JwtAuthGuard toàn cục) và chỉ
 * Cấp 4 (`super_admin`) — RBAC 4 cấp (ADR-040). Chi tiết quyền (ai tác động được ai, gán
 * được vai trò nào) kiểm lại ở service, không chỉ dựa vào guard.
 */
@Controller('users')
@Roles('super_admin')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list() {
    return this.users.list()
  }

  @Post()
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreateUserDto) {
    return this.users.create(actor, dto)
  }

  /** Sửa vai trò / phòng ban của tài khoản (gán lại Cấp 1/Cấp 3 sau migration RBAC). */
  @Patch(':id')
  update(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
  ) {
    return this.users.update(actor, id, dto)
  }

  @Patch(':id/status')
  setStatus(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.users.setActive(actor, id, dto.isActive)
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() actor: AuthUser, @Param('id', ParseIntPipe) id: number) {
    await this.users.remove(actor, id)
  }
}
