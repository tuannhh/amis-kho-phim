import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, MoreThan, Repository } from 'typeorm'
import { createHash } from 'node:crypto'
import { Film } from './entities/film.entity'
import { FilmLink, type ExternalFilmPlatform } from './entities/film-link.entity'
import { Hashtag } from './entities/hashtag.entity'
import { FilmVersion } from './entities/film-version.entity'
import { FilmView } from './entities/film-view.entity'
import { UpsertFilmDto, ConfirmVersionDto, CreateUploadUrlDto } from './dto/film.dto'
import type { AuthUser } from '../../common/auth/auth-user'
import { slugify } from '../../common/slugify'
import { StorageService } from '../storage/storage.service'
import { NotificationsService } from '../notifications/notifications.service'
import { UsersService } from '../users/users.service'
import type { RoleCode } from '../users/entities/role.entity'
import imageSize from 'image-size'
import { auditLog } from '../../common/audit/audit-log'

/** Nguồn phát gồm cả 'storage' (MinIO) — GĐ3 có link thật. */
type FilmSourceKey = ExternalFilmPlatform | 'storage'

export interface PublicFilm {
  id: number
  slug: string
  title: string
  description: string | null
  categoryId: number | null
  categoryName: string | null
  uploaderId: number
  uploaderName: string
  /**
   * Hai trường TRUY VẾT (ADR-046): phim thuộc phòng ban nào lúc tạo, và vai trò hiện tại của
   * người tạo. Ở bản RBAC 3 CẤP PHẲNG chúng KHÔNG tham gia quyết định quyền — FE chỉ cần
   * `uploaderId` để ẩn/hiện nút. Giữ lại để hiển thị/đối soát; chốt chặn thật vẫn là
   * `assertCanManage` ở BE.
   */
  departmentId: number | null
  uploaderRoleCode: RoleCode | null
  viewCount: number
  duration: string
  hashtags: string[]
  links: Partial<Record<FilmSourceKey, string>>
  thumbnailUrl: string | null
  publishedAt: string
}

const LINK_FIELDS: Array<{ field: keyof UpsertFilmDto; platform: ExternalFilmPlatform }> = [
  { field: 'youtubeUrl', platform: 'youtube' },
  { field: 'vimeoUrl', platform: 'vimeo' },
  { field: 'gdriveUrl', platform: 'gdrive' },
  { field: 'misadriveUrl', platform: 'misadrive' },
]

@Injectable()
export class FilmsService {
  constructor(
    @InjectRepository(Film) private readonly films: Repository<Film>,
    @InjectRepository(FilmLink) private readonly filmLinks: Repository<FilmLink>,
    @InjectRepository(Hashtag) private readonly hashtags: Repository<Hashtag>,
    @InjectRepository(FilmVersion) private readonly versions: Repository<FilmVersion>,
    @InjectRepository(FilmView) private readonly filmViews: Repository<FilmView>,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
    private readonly users: UsersService,
  ) {}

  /** Bản mới nhất (version_no lớn nhất) — nguồn của storage_key/thumbnail_key/duration. */
  private latestVersion(f: Film): FilmVersion | undefined {
    if (!f.versions?.length) return undefined
    return f.versions.reduce((a, b) => (b.versionNo > a.versionNo ? b : a))
  }

  private toPublic(f: Film): PublicFilm {
    const links: Partial<Record<FilmSourceKey, string>> = {}
    for (const l of f.links || []) links[l.platform] = l.url

    const current = this.latestVersion(f)
    if (current?.storageKey) links.storage = `/media/${current.storageKey}`
    const thumbnailUrl = current?.thumbnailKey ? `/media/${current.thumbnailKey}` : null

    return {
      id: f.id,
      slug: f.slug,
      title: f.title,
      description: f.description,
      categoryId: f.categoryId,
      categoryName: f.category?.name ?? null,
      uploaderId: f.uploaderId,
      uploaderName: f.uploader?.fullName ?? '—',
      departmentId: f.departmentId,
      uploaderRoleCode: f.uploader?.roleCode ?? null,
      viewCount: f.viewCount,
      duration: current?.duration || f.duration,
      hashtags: (f.hashtags || []).map((h) => h.name),
      links,
      thumbnailUrl,
      publishedAt: f.publishedAt,
    }
  }

  private relations = ['category', 'uploader', 'links', 'hashtags', 'versions']

  async list(): Promise<PublicFilm[]> {
    const rows = await this.films.find({ relations: this.relations, order: { publishedAt: 'DESC', id: 'DESC' } })
    return rows.map((f) => this.toPublic(f))
  }

  async getBySlug(slug: string): Promise<PublicFilm> {
    const f = await this.films.findOne({ where: { slug }, relations: this.relations })
    if (!f) throw new NotFoundException('Không tìm thấy phim')
    return this.toPublic(f)
  }

  private async findOrCreateHashtags(names: string[]): Promise<Hashtag[]> {
    const uniqueNames = Array.from(new Set(names.map((n) => n.trim()).filter(Boolean)))
    if (!uniqueNames.length) return []
    const slugs = uniqueNames.map((n) => slugify(n))
    const existed = await this.hashtags.find({ where: { slug: In(slugs) } })
    const bySlug = new Map(existed.map((h) => [h.slug, h]))
    const result: Hashtag[] = []
    for (let i = 0; i < uniqueNames.length; i++) {
      const slug = slugs[i]
      let h = bySlug.get(slug)
      if (!h) {
        h = await this.hashtags.save(this.hashtags.create({ name: uniqueNames[i], slug }))
        bySlug.set(slug, h)
      }
      result.push(h)
    }
    return result
  }

  private linksFromDto(dto: UpsertFilmDto): Array<{ platform: ExternalFilmPlatform; url: string }> {
    const out: Array<{ platform: ExternalFilmPlatform; url: string }> = []
    for (const { field, platform } of LINK_FIELDS) {
      const url = (dto[field] as string | undefined)?.trim()
      if (url) out.push({ platform, url })
    }
    return out
  }

  private async uniqueSlug(base: string): Promise<string> {
    const root = slugify(base) || 'phim'
    let candidate = root
    let n = 2
    for (;;) {
      const existed = await this.films.findOne({ where: { slug: candidate } })
      if (!existed) return candidate
      candidate = `${root}-${n++}`
    }
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10)
  }

  async create(actor: AuthUser, dto: UpsertFilmDto): Promise<PublicFilm> {
    const slug = await this.uniqueSlug(dto.title)
    const hashtags = await this.findOrCreateHashtags(dto.hashtags || [])

    // SNAPSHOT phòng ban của người tạo, lấy từ DB — KHÔNG nhận từ DTO. Ở bản 3 cấp phẳng đây
    // là dữ liệu TRUY VẾT (không quyết định quyền), nhưng vẫn không để client tự khai: một
    // trường truy vết bị client bịa thì mọi báo cáo/đối soát dựa trên nó đều vô nghĩa.
    const departmentId = await this.users.getDepartmentId(actor.id)

    const film = await this.films.save(
      this.films.create({
        slug,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        categoryId: dto.categoryId,
        uploaderId: actor.id,
        departmentId,
        viewCount: 0,
        duration: '--:--',
        publishedAt: this.today(),
        hashtags,
      }),
    )

    const links = this.linksFromDto(dto)
    if (links.length) {
      await this.filmLinks.save(links.map((l) => this.filmLinks.create({ filmId: film.id, ...l })))
    }

    // Thông báo "phim mới" tạm TẮT (2026-07-22, quyết định người dùng): thực tế sẽ có rất
    // nhiều phim đăng lên, bắn thông báo cho mọi user mỗi lần sẽ gây spam. Hạ tầng
    // (bảng notifications/user_notifications, endpoint, panel FE) vẫn giữ nguyên để bật
    // lại sau với điều kiện phù hợp hơn (vd digest định kỳ, hoặc chọn lọc theo chuyên mục).
    // await this.notifications.notify(film.id, 'new_film', actor.id)

    return this.getBySlug(slug)
  }

  /**
   * Quyền sửa/xoá phim theo RBAC 3 CẤP PHẲNG (ADR-045) — thay thế quy tắc
   * `super_admin`/`admin` sửa mọi phim của ADR-002/014.
   *
   *  - Cấp 1 `viewer`      → LUÔN từ chối (đã bị chặn trước ở `@Roles` tại controller; đây là
   *                          lớp phòng thủ thứ hai, không phải chốt duy nhất).
   *  - Cấp 2 `employee`    → CHỈ phim do CHÍNH MÌNH tạo. Không sửa được phim người khác, kể
   *                          cả người cùng phòng ban.
   *  - Cấp 3 `super_admin` → MỌI phim, KHÔNG phụ thuộc phòng ban.
   *
   * KHÔNG có nhánh nào so sánh `department_id`: bản này cố ý PHẲNG (ADR-046). Cột
   * `films.department_id` vẫn được ghi khi tạo phim nhưng chỉ để truy vết, không quyết định
   * quyền. Dữ liệu quyết định vẫn lấy từ bản ghi đã lưu ở DB, không nhận từ client
   * (`02-security-baseline.md` §2).
   */
  private async assertCanManage(actor: AuthUser, film: Film): Promise<void> {
    if (actor.roleCode === 'super_admin') return

    if (actor.roleCode === 'viewer') {
      throw new ForbiddenException('Bạn chỉ có quyền xem, không được sửa/xoá phim')
    }

    if (film.uploaderId === actor.id) return

    throw new ForbiddenException('Bạn chỉ có thể sửa/xoá phim của chính mình')
  }

  async update(actor: AuthUser, id: number, dto: UpsertFilmDto): Promise<PublicFilm> {
    const film = await this.films.findOne({ where: { id } })
    if (!film) throw new NotFoundException('Không tìm thấy phim')
    await this.assertCanManage(actor, film)

    film.title = dto.title.trim()
    film.categoryId = dto.categoryId
    film.description = dto.description?.trim() || null
    // Sửa phim → coi như cập nhật bản mới, gắn lại tag "Phim mới" (khớp hành vi GĐ0.5;
    // lịch sử phiên bản đầy đủ film_versions là GĐ5).
    film.publishedAt = this.today()
    film.hashtags = await this.findOrCreateHashtags(dto.hashtags || [])
    await this.films.save(film)

    await this.filmLinks.delete({ filmId: film.id })
    const links = this.linksFromDto(dto)
    if (links.length) {
      await this.filmLinks.save(links.map((l) => this.filmLinks.create({ filmId: film.id, ...l })))
    }

    // Thông báo "cập nhật" tạm TẮT — xem ghi chú ở create() (2026-07-22).
    // await this.notifications.notify(film.id, 'updated', actor.id)

    return this.getBySlug(film.slug)
  }

  async remove(actor: AuthUser, id: number): Promise<void> {
    const film = await this.films.findOne({ where: { id } })
    if (!film) throw new NotFoundException('Không tìm thấy phim')
    await this.assertCanManage(actor, film)
    await this.films.remove(film)
    auditLog({ action: 'film.delete', actorId: actor.id, targetId: id, outcome: 'success', detail: { slug: film.slug } })
  }

  // ─── GĐ4: Đếm lượt xem ──────────────────────────────────────────────────

  /** Cửa sổ dedupe lượt xem (phút) — ADR-023. */
  private static readonly VIEW_DEDUPE_MINUTES = 30

  /**
   * session_hash dự phòng: hash(IP + User-Agent) — không dùng trong dedupe hiện
   * tại (mọi người dùng đều đã đăng nhập, dedupe theo user_id là đủ — ADR-023),
   * chỉ ghi lại để dự phòng mở rộng sau này (khách ẩn danh nhiều thiết bị).
   */
  static sessionHashOf(ip: string | undefined, userAgent: string | undefined): string {
    return createHash('sha256').update(`${ip || ''}|${userAgent || ''}`).digest('hex').slice(0, 64)
  }

  /**
   * Ghi nhận 1 lượt xem khi vào trang xem phim. Dedupe: nếu user này đã có bản
   * ghi film_views cho phim này trong 30' gần nhất → bỏ qua (không tăng view_count).
   *
   * TOÀN BỘ nằm trong MỘT GIAO DỊCH có KHOÁ DÒNG phim (`pessimistic_write`).
   *
   * VÌ SAO PHẢI KHOÁ — race condition CÓ THẬT, đã đo được (GĐ7 bổ sung):
   * Bản trước đây đọc `film_views` để quyết định có ghi hay không, nhưng câu đọc đó nằm
   * NGOÀI giao dịch và không khoá gì cả. Khi cùng một người dùng gửi nhiều request song
   * song, tất cả đều vượt qua bước kiểm trùng trước khi bất kỳ request nào kịp ghi bản ghi
   * đầu tiên → cùng một lượt xem bị tính nhiều lần. Đo thực tế bằng
   * `test/concurrency/record-view.concurrency.mjs`: 1 người dùng mới gửi 20 request song
   * song làm `view_count` tăng **4** thay vì **1**. Test tuần tự KHÔNG BAO GIỜ lộ ra lỗi này.
   * Đây đúng mẫu lỗi mô tả ở chuẩn Backend MISA `05-database-rules.md` §3, và cách sửa
   * dưới đây là cách chuẩn đó quy định: đưa câu đọc quyết định vào trong giao dịch + khoá
   * dòng đang đọc.
   *
   * Đánh đổi đã cân nhắc: khoá theo dòng PHIM nên các lượt xem cùng một phim bị tuần tự
   * hoá. Chấp nhận được vì giao dịch rất ngắn (2 câu đọc + 2 câu ghi) và mỗi người dùng chỉ
   * ghi 1 lần/30 phút cho mỗi phim. Đúng thứ tự ưu tiên của quy chuẩn: đúng đắn dữ liệu
   * đứng trước tối ưu hiệu năng.
   */
  async recordView(actor: AuthUser, id: number, sessionHash: string): Promise<{ viewCount: number }> {
    const windowStart = new Date(Date.now() - FilmsService.VIEW_DEDUPE_MINUTES * 60 * 1000)

    return this.films.manager.transaction(async (em) => {
      // Khoá dòng phim TRƯỚC khi đọc quyết định → request khác cho cùng phim phải chờ
      // tới khi giao dịch này commit/rollback xong.
      const film = await em.findOne(Film, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      })
      if (!film) throw new NotFoundException('Không tìm thấy phim')

      const dup = await em.findOne(FilmView, {
        where: { filmId: id, userId: actor.id, viewedAt: MoreThan(windowStart) },
        order: { viewedAt: 'DESC' },
      })
      if (dup) return { viewCount: film.viewCount }

      await em.save(em.create(FilmView, { filmId: id, userId: actor.id, sessionHash }))
      // Vẫn dùng increment (UPDATE ... SET x = x + 1) thay vì đọc-rồi-ghi — giữ nguyên
      // biện pháp chống mất lượt tăng của ADR-023, khoá dòng là lớp bảo vệ bổ sung.
      await em.increment(Film, { id }, 'viewCount', 1)
      return { viewCount: film.viewCount + 1 }
    })
  }

  // ─── GĐ3: Storage (MinIO) ──────────────────────────────────────────────

  /** Lấy phim + kiểm quyền quản lý (dùng chung cho các thao tác storage). */
  private async findManageableFilm(actor: AuthUser, id: number): Promise<Film> {
    const film = await this.films.findOne({ where: { id } })
    if (!film) throw new NotFoundException('Không tìm thấy phim')
    await this.assertCanManage(actor, film)
    return film
  }

  /**
   * Xin presigned PUT URL cho file video — FE upload thẳng lên MinIO, không qua
   * Node (tránh buffer file lớn). RBAC: chỉ người quản lý được phim đó. Validate
   * MIME + size (MAX_UPLOAD_MB) ở SERVER, key sinh server-side.
   */
  async createUploadUrl(actor: AuthUser, id: number, dto: CreateUploadUrlDto) {
    await this.findManageableFilm(actor, id)
    if (!this.storage.isAllowedVideoType(dto.contentType)) {
      throw new BadRequestException('Định dạng video không được hỗ trợ (mp4/webm/ogg/mov/mkv)')
    }
    if (!this.storage.isWithinLimit(dto.size)) {
      const maxMb = process.env.MAX_UPLOAD_MB || '2048'
      throw new BadRequestException(`Kích thước tệp vượt giới hạn ${maxMb}MB`)
    }
    return this.storage.createVideoUploadUrl(dto.contentType)
  }

  /**
   * Upload ảnh bìa nhỏ qua backend (multipart). Validate MIME thật bằng magic
   * bytes (image-size) + tỷ lệ 16:9 — không tin content-type client gửi. Trả
   * thumbnail_key để FE gộp vào confirmVersion.
   */
  async saveThumbnail(actor: AuthUser, id: number, buffer: Buffer): Promise<{ thumbnailKey: string }> {
    await this.findManageableFilm(actor, id)
    if (!buffer?.length) throw new BadRequestException('Tệp ảnh rỗng')

    let dim: { width?: number; height?: number; type?: string }
    try {
      dim = imageSize(buffer)
    } catch {
      throw new BadRequestException('Tệp không phải ảnh hợp lệ')
    }
    const type = dim.type || ''
    if (!['jpg', 'jpeg', 'png', 'webp'].includes(type)) {
      throw new BadRequestException('Ảnh bìa phải là JPG, PNG hoặc WebP')
    }
    const w = dim.width || 0
    const h = dim.height || 0
    if (!w || !h) throw new BadRequestException('Không đọc được kích thước ảnh')
    // Tỷ lệ 16:9 (dung sai ~5%)
    if (Math.abs(w / h - 16 / 9) > 16 / 9 * 0.05) {
      throw new BadRequestException(`Ảnh bìa phải tỷ lệ 16:9 (ảnh hiện tại ${w}×${h})`)
    }
    const contentType = type === 'png' ? 'image/png' : type === 'webp' ? 'image/webp' : 'image/jpeg'
    const thumbnailKey = await this.storage.putThumbnail(buffer, type, contentType)
    return { thumbnailKey }
  }

  /**
   * Xác nhận tạo bản mới sau khi FE upload xong file/ảnh. Head-check lại key
   * trong MinIO (chống client bịa key/size), lấy size thật, tạo film_versions
   * (version_no tăng dần), cập nhật duration + gắn lại "Phim mới" (publishedAt).
   */
  async confirmVersion(actor: AuthUser, id: number, dto: ConfirmVersionDto): Promise<PublicFilm> {
    const film = await this.findManageableFilm(actor, id)
    if (!dto.storageKey && !dto.thumbnailKey) {
      throw new BadRequestException('Cần ít nhất file video hoặc ảnh bìa để tạo bản mới')
    }

    const last = await this.versions.findOne({
      where: { filmId: film.id },
      order: { versionNo: 'DESC' },
    })

    // Chỉ thay asset được upload mới; asset kia kế thừa từ bản trước (không để
    // thêm mỗi ảnh bìa lại làm mất video cũ, vì toPublic chỉ dùng bản mới nhất).
    let storageKey = dto.storageKey ?? last?.storageKey ?? null
    let fileSize: string | null = last?.fileSize ?? null
    let duration: string | null = dto.duration ?? last?.duration ?? null
    if (dto.storageKey) {
      const stat = await this.storage.stat(dto.storageKey)
      if (!stat) throw new BadRequestException('Không tìm thấy file đã upload trên storage')
      // GĐ7 — presigned PUT KHÔNG ràng buộc dung lượng: client xin URL cho file 10MB rồi
      // vẫn PUT được 50GB lên MinIO. Đây là chốt chặn thật duy nhất — kiểm size THẬT do
      // MinIO báo, vượt hạn thì từ chối và dọn luôn object rác.
      if (!this.storage.isWithinLimit(stat.size)) {
        await this.storage.delete(dto.storageKey)
        const maxMb = process.env.MAX_UPLOAD_MB || '2048'
        throw new BadRequestException(
          `File đã upload vượt giới hạn ${maxMb}MB (thực tế ${Math.round(stat.size / 1024 / 1024)}MB) — đã huỷ`,
        )
      }
      storageKey = dto.storageKey
      fileSize = String(stat.size)
    }

    let thumbnailKey = dto.thumbnailKey ?? last?.thumbnailKey ?? null
    if (dto.thumbnailKey) {
      const stat = await this.storage.stat(dto.thumbnailKey)
      if (!stat) throw new BadRequestException('Không tìm thấy ảnh bìa đã upload trên storage')
      thumbnailKey = dto.thumbnailKey
    }

    const versionNo = (last?.versionNo || 0) + 1
    await this.versions.save(
      this.versions.create({
        filmId: film.id,
        versionNo,
        storageKey,
        fileSize,
        duration,
        thumbnailKey,
        note: dto.note ?? null,
        createdBy: actor.id,
      }),
    )

    // Cập nhật bản mới → gắn lại tag "Phim mới"; đồng bộ duration ra films (fallback).
    film.publishedAt = this.today()
    if (duration) film.duration = duration
    await this.films.save(film)

    // Thông báo "cập nhật bản mới" tạm TẮT — xem ghi chú ở create() (2026-07-22).
    // if (versionNo > 1) {
    //   await this.notifications.notify(film.id, 'updated', actor.id)
    // }

    return this.getBySlug(film.slug)
  }
}
