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
  Query,
  Req,
} from '@nestjs/common'
import type { Request } from 'express'
import { FilmsService } from './films.service'
import {
  UpsertFilmDto,
  CreateUploadUrlDto,
  CreateThumbnailUploadUrlDto,
  ConfirmVersionDto,
} from './dto/film.dto'
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

  /**
   * Danh sách phim. `?scope=managed` trả về đúng tập phim người gọi có quyền sửa/xoá — dùng
   * cho màn "Phim tôi quản lý" (việc 6).
   *
   * Thêm query param thay vì tạo endpoint mới `/films/managed`: đường dẫn đó sẽ đụng route
   * `GET /films/:slug` ngay bên dưới (một phim có slug "managed" là bịa được), và hợp đồng
   * `GET /films` hiện tại không đổi khi thiếu tham số.
   */
  @Get()
  list(@CurrentUser() actor: AuthUser, @Query('scope') scope?: string) {
    return scope === 'managed' ? this.films.listManaged(actor) : this.films.list()
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

  // ─── Đợt 2 việc 8: Đếm lượt tải về ─────────────────────────────────────

  /**
   * Ghi nhận 1 lượt tải về. Quyền giống `:id/view` — ai đã đăng nhập cũng gọi được, KHÔNG gắn
   * `@Roles`: người xem (Cấp 1) hoàn toàn có quyền tải phim, chỉ không có quyền sửa/xoá.
   * Endpoint này CHỈ đếm; việc trả bytes vẫn là `/media/:key` có sẵn từ GĐ3.
   */
  @Post(':id/download')
  recordDownload(@CurrentUser() actor: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.films.recordDownload(actor, id)
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

  /**
   * Xin presigned PUT URL để upload ẢNH BÌA thẳng lên MinIO (ADR-055).
   *
   * THAY THẾ `POST :id/thumbnail` (multipart) cũ. Endpoint cũ đã bị GỠ BỎ chứ không giữ lại
   * song song: nó dùng multer `memoryStorage`, tức vẫn còn nguyên đường buffer cả file trong
   * RAM Node — để lại thì điểm nghẽn vẫn còn, chỉ là không ai gọi tới nữa cho tới khi có
   * người gọi lại. Kiểm ảnh thật (16:9 + magic bytes) chuyển sang bước `POST :id/versions`.
   */
  @Post(':id/thumbnail-url')
  @Roles(...FILM_WRITE_ROLES)
  createThumbnailUploadUrl(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateThumbnailUploadUrlDto,
  ) {
    return this.films.createThumbnailUploadUrl(actor, id, dto)
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
