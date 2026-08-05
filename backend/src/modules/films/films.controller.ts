import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import type { Request } from 'express'
import { FilmsService } from './films.service'
import { UpsertFilmDto, CreateUploadUrlDto, ConfirmVersionDto } from './dto/film.dto'
import { CurrentUser } from '../../common/auth/current-user.decorator'
import type { AuthUser } from '../../common/auth/auth-user'
import { Roles } from '../../common/auth/roles.decorator'
import { FILM_WRITE_ROLES } from '../users/entities/role.entity'

/**
 * CRUD phim + storage (GĐ3). Phân quyền theo RBAC 4 cấp (ADR-040):
 *
 *  - ĐỌC (`GET /films`, `GET /films/:slug`) + ghi nhận lượt xem: ai đăng nhập cũng được,
 *    kể cả Cấp 1 (`viewer`).
 *  - MỌI route GHI (tạo, sửa, xoá, xin upload URL, upload ảnh bìa, xác nhận bản mới) gắn
 *    `@Roles(...FILM_WRITE_ROLES)` — Cấp 1 bị chặn NGAY Ở GUARD, trả 403 trước khi vào service.
 *    Trước đây các route này KHÔNG có `@Roles` nào (mọi tài khoản đã đăng nhập đều tạo được
 *    phim) — đó là khoảng trống phân quyền thật, nay đã bịt.
 *  - Phạm vi chi tiết trong nhóm được ghi (của mình / cùng phòng ban / mọi phòng ban) kiểm
 *    tiếp ở `FilmsService.assertCanManage` — guard là lớp một, không phải lớp duy nhất.
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
  @Roles(...FILM_WRITE_ROLES)
  create(@CurrentUser() actor: AuthUser, @Body() dto: UpsertFilmDto) {
    return this.films.create(actor, dto)
  }

  @Patch(':id')
  @Roles(...FILM_WRITE_ROLES)
  update(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpsertFilmDto,
  ) {
    return this.films.update(actor, id, dto)
  }

  @Delete(':id')
  @Roles(...FILM_WRITE_ROLES)
  @HttpCode(204)
  async remove(@CurrentUser() actor: AuthUser, @Param('id', ParseIntPipe) id: number) {
    await this.films.remove(actor, id)
  }

  // ─── GĐ4: Đếm lượt xem ──────────────────────────────────────────────────

  /** Ghi nhận 1 lượt xem khi vào trang xem phim (ai đã đăng nhập cũng gọi được). */
  @Post(':id/view')
  recordView(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ) {
    const sessionHash = FilmsService.sessionHashOf(req.ip, req.headers['user-agent'])
    return this.films.recordView(actor, id, sessionHash)
  }

  // ─── GĐ3: Storage (MinIO) ──────────────────────────────────────────────

  /** Xin presigned PUT URL để upload thẳng file video lên MinIO. */
  @Post(':id/upload-url')
  @Roles(...FILM_WRITE_ROLES)
  createUploadUrl(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateUploadUrlDto,
  ) {
    return this.films.createUploadUrl(actor, id, dto)
  }

  /** Upload ảnh bìa (multipart, nhỏ) qua backend — validate 16:9 + MIME thật. */
  @Post(':id/thumbnail')
  @Roles(...FILM_WRITE_ROLES)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 15 * 1024 * 1024 } }), // ảnh bìa <= 15MB
  )
  uploadThumbnail(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: { buffer: Buffer } | undefined,
  ) {
    return this.films.saveThumbnail(actor, id, file?.buffer as Buffer)
  }

  /** Xác nhận tạo bản mới (film_versions) sau khi upload file/ảnh xong. */
  @Post(':id/versions')
  @Roles(...FILM_WRITE_ROLES)
  confirmVersion(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ConfirmVersionDto,
  ) {
    return this.films.confirmVersion(actor, id, dto)
  }
}
