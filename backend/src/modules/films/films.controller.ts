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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { FilmsService } from './films.service'
import { UpsertFilmDto, CreateUploadUrlDto, ConfirmVersionDto } from './dto/film.dto'
import { CurrentUser } from '../../common/auth/current-user.decorator'
import type { AuthUser } from '../../common/auth/auth-user'

/**
 * CRUD phim + storage (GĐ3). Xem: ai đăng nhập cũng được. Tạo: ai cũng upload
 * được (§5). Sửa/xoá + xin upload URL / thumbnail / xác nhận version: kiểm quyền
 * owner ở service (assertCanManage) — nhân viên chỉ thao tác phim của mình.
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

  // ─── GĐ3: Storage (MinIO) ──────────────────────────────────────────────

  /** Xin presigned PUT URL để upload thẳng file video lên MinIO. */
  @Post(':id/upload-url')
  createUploadUrl(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateUploadUrlDto,
  ) {
    return this.films.createUploadUrl(actor, id, dto)
  }

  /** Upload ảnh bìa (multipart, nhỏ) qua backend — validate 16:9 + MIME thật. */
  @Post(':id/thumbnail')
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
  confirmVersion(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ConfirmVersionDto,
  ) {
    return this.films.confirmVersion(actor, id, dto)
  }
}
