import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post } from '@nestjs/common'
import { FilmsService } from './films.service'
import { UpsertFilmDto } from './dto/film.dto'
import { CurrentUser } from '../../common/auth/current-user.decorator'
import type { AuthUser } from '../../common/auth/auth-user'

/**
 * CRUD phim (metadata GĐ2). Xem: ai đăng nhập cũng được. Tạo: ai cũng upload được
 * (§5 "Upload phim" ✔✔✔). Sửa/xoá: kiểm quyền owner ở service (assertCanManage).
 */
@Controller('films')
export class FilmsController {
  constructor(private readonly films: FilmsService) {}

  @Get()
  list() {
    return this.films.list()
  }

  @Get(':slug')
  getBySlug(@Param('slug') slug: string) {
    return this.films.getBySlug(slug)
  }

  @Post()
  create(@CurrentUser() actor: AuthUser, @Body() dto: UpsertFilmDto) {
    return this.films.create(actor, dto)
  }

  @Patch(':id')
  update(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpsertFilmDto,
  ) {
    return this.films.update(actor, id, dto)
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() actor: AuthUser, @Param('id', ParseIntPipe) id: number) {
    await this.films.remove(actor, id)
  }
}
