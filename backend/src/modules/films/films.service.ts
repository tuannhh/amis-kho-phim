import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { EntityManager, In, MoreThan, Repository } from 'typeorm'
import { createHash } from 'node:crypto'
import { Film } from './entities/film.entity'
import { FilmLink, type ExternalFilmPlatform } from './entities/film-link.entity'
import { Hashtag } from './entities/hashtag.entity'
import { FilmVersion } from './entities/film-version.entity'
import { FilmView } from './entities/film-view.entity'
import {
  UpsertFilmDto,
  ConfirmVersionDto,
  CreateUploadUrlDto,
  CreateThumbnailUploadUrlDto,
} from './dto/film.dto'
import type { AuthUser } from '../../common/auth/auth-user'
import { slugify } from '../../common/slugify'
import { StorageService } from '../storage/storage.service'
import { NotificationsService } from '../notifications/notifications.service'
import { UsersService } from '../users/users.service'
import { UploadIntentsService } from '../uploads/upload-intents.service'
import type { RoleCode } from '../users/entities/role.entity'
import { readThumbnailDimensions } from '../../common/media/thumbnail-dimensions'
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
   * Hai trường dưới đây phục vụ FE ẩn/hiện nút Sửa/Xoá đúng theo RBAC 4 cấp (Cấp 3 cần biết
   * phim thuộc phòng ban nào và người tạo có phải Cấp 2 hay không). CHỈ là gợi ý hiển thị —
   * chốt chặn thật vẫn là `assertCanManage` ở BE.
   */
  departmentId: number | null
  uploaderRoleCode: RoleCode | null
  viewCount: number
  downloadCount: number
  duration: string
  hashtags: string[]
  links: Partial<Record<FilmSourceKey, string>>
  thumbnailUrl: string | null
  publishedAt: string
  /**
   * Có được gắn nhãn "Phim mới" hay không. TÍNH Ở BACKEND, không để FE tự suy từ `publishedAt`.
   *
   * Hai điều kiện phải thoả ĐỒNG THỜI:
   *  1. Còn trong hạn `NEW_FILM_TTL_DAYS` kể từ `publishedAt` (quy tắc cũ, giữ nguyên).
   *  2. Là bản MỚI NHẤT trong nhóm phim TRÙNG TIÊU ĐỀ. Khi một phim mới trùng tên được đăng,
   *     các phim cũ cùng tên mất nhãn NGAY, kể cả còn trong hạn (ADR-052).
   *
   * Vì sao tính ở BE chứ không ở FE: trang chi tiết chỉ tải đúng MỘT phim nên FE không có cách
   * nào biết trong kho còn phim nào trùng tên mới hơn hay không. Tính ở FE sẽ đúng ở trang
   * danh sách và SAI ở trang chi tiết — đúng loại lỗi khó phát hiện nhất.
   */
  isNew: boolean
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
    private readonly uploadIntents: UploadIntentsService,
  ) {}

  /** Bản mới nhất (version_no lớn nhất) — nguồn của storage_key/thumbnail_key/duration. */
  private latestVersion(f: Film): FilmVersion | undefined {
    if (!f.versions?.length) return undefined
    return f.versions.reduce((a, b) => (b.versionNo > a.versionNo ? b : a))
  }

  /** Số ngày một phim được coi là "mới" kể từ `publishedAt` (khớp `NEW_FILM_TTL_DAYS` ở .env). */
  private newFilmTtlDays(): number {
    const raw = Number(process.env.NEW_FILM_TTL_DAYS)
    return Number.isFinite(raw) && raw > 0 ? raw : 14
  }

  /** Khoá gộp nhóm "trùng tiêu đề": bỏ khoảng trắng thừa, không phân biệt hoa/thường (ADR-052). */
  private static titleKey(title: string): string {
    return title.trim().toLowerCase()
  }

  private withinNewTtl(publishedAt: string): boolean {
    const ageDays = (Date.now() - new Date(publishedAt).getTime()) / 86_400_000
    return ageDays >= 0 && ageDays <= this.newFilmTtlDays()
  }

  private toPublic(f: Film, isLatestOfTitle = true): PublicFilm {
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
      downloadCount: f.downloadCount,
      duration: current?.duration || f.duration,
      hashtags: (f.hashtags || []).map((h) => h.name),
      links,
      thumbnailUrl,
      publishedAt: f.publishedAt,
      isNew: isLatestOfTitle && this.withinNewTtl(f.publishedAt),
    }
  }

  private relations = ['category', 'uploader', 'links', 'hashtags', 'versions']

  /**
   * Thứ tự chuẩn "mới trước": `published_at` giảm dần, phá hoà bằng `id` giảm dần.
   * Cần phá hoà vì `published_at` là kiểu DATE (chỉ tới ngày) — hai phim trùng tên đăng
   * cùng ngày sẽ bằng nhau, khi đó phim có `id` lớn hơn là phim tạo sau.
   */
  private static readonly NEWEST_FIRST = { publishedAt: 'DESC', id: 'DESC' } as const

  async list(): Promise<PublicFilm[]> {
    const rows = await this.films.find({ relations: this.relations, order: FilmsService.NEWEST_FIRST })
    // Danh sách đã sắp "mới trước" nên phim ĐẦU TIÊN gặp trong mỗi nhóm tiêu đề chính là bản
    // mới nhất của nhóm đó. Không tốn thêm truy vấn nào (ADR-052).
    const seenTitles = new Set<string>()
    return rows.map((f) => {
      const key = FilmsService.titleKey(f.title)
      const isLatest = !seenTitles.has(key)
      seenTitles.add(key)
      return this.toPublic(f, isLatest)
    })
  }

  /**
   * Danh sách "Phim tôi quản lý" (đợt 2 việc 6) — đúng tập phim mà `assertCanManage` cho phép
   * người này sửa/xoá, không rộng hơn một phim nào.
   *
   *  - Cấp 1 `viewer`       → rỗng (không quản lý gì).
   *  - Cấp 2 `employee`     → phim do chính mình tạo.
   *  - Cấp 3 `dept_manager` → phim của mình + phim của Cấp 2 CÙNG phòng ban.
   *  - Cấp 4 `super_admin`  → mọi phim.
   *
   * Lọc TRÊN KẾT QUẢ của `list()` chứ không thêm điều kiện vào câu SQL, có chủ đích: nhãn
   * "Phim mới" phải tính trên TOÀN BỘ kho phim (ADR-052). Lọc trước rồi mới tính nhãn thì một
   * phim cũ sẽ hiện "Phim mới" chỉ vì bản mới hơn cùng tên nằm ngoài phạm vi quản lý của người
   * đang xem — sai lệch giữa hai màn hình cho cùng một phim. Kho phim nội bộ ở quy mô vài nghìn
   * bản ghi nên chi phí lọc trong bộ nhớ không đáng kể; nếu sau này cần phân trang thật thì
   * phải chuyển nhãn "Phim mới" sang cột được duy trì sẵn trước đã.
   */
  async listManaged(actor: AuthUser): Promise<PublicFilm[]> {
    if (actor.roleCode === 'viewer') return []

    const all = await this.list()
    if (actor.roleCode === 'super_admin') return all

    if (actor.roleCode === 'dept_manager') {
      const actorDepartmentId = await this.users.getDepartmentId(actor.id)
      return all.filter((f) => {
        if (f.uploaderId === actor.id) return true
        // `null` KHÔNG trùng `null` — Trưởng phòng chưa gán phòng ban không được vơ hết phim
        // cũ có department_id NULL (11-coding-rules §3b).
        if (actorDepartmentId == null || f.departmentId !== actorDepartmentId) return false
        return f.uploaderRoleCode === 'employee'
      })
    }

    return all.filter((f) => f.uploaderId === actor.id)
  }

  async getBySlug(slug: string): Promise<PublicFilm> {
    const f = await this.films.findOne({ where: { slug }, relations: this.relations })
    if (!f) throw new NotFoundException('Không tìm thấy phim')
    return this.toPublic(f, await this.isLatestOfTitle(f))
  }

  /**
   * Phim này có phải bản mới nhất trong nhóm trùng tiêu đề không (dùng cho trang chi tiết, nơi
   * chỉ tải đúng một phim). Một truy vấn lấy đúng 1 dòng, dựa vào index `idx_films_title`
   * thêm ở migration `AddDownloadCountAndTitleIndex`.
   *
   * So sánh tiêu đề để nguyên cho MySQL xử lý: collation mặc định của cột là *_ci nên `=` đã
   * KHÔNG phân biệt hoa/thường, đúng quy tắc gộp nhóm ở `titleKey`.
   */
  private async isLatestOfTitle(f: Film): Promise<boolean> {
    const newest = await this.films.findOne({
      where: { title: f.title.trim() },
      order: FilmsService.NEWEST_FIRST,
      select: { id: true },
    })
    return !newest || newest.id === f.id
  }

  /**
   * Nhận `manager` thay vì dùng thẳng `this.hashtags` — Tier A retrofit (2026-08-12): hàm
   * này được gọi TRONG transaction của `create()`/`update()`, phải dùng chung
   * EntityManager của transaction đó (nếu tự ý dùng repository ngoài transaction, việc tạo
   * hashtag mới sẽ commit ngay lập tức dù phần còn lại của giao dịch rollback sau đó —
   * đúng dạng "orphaned hashtag" đã nêu trong audit).
   */
  private async findOrCreateHashtags(names: string[], manager: EntityManager): Promise<Hashtag[]> {
    const uniqueNames = Array.from(new Set(names.map((n) => n.trim()).filter(Boolean)))
    if (!uniqueNames.length) return []
    const slugs = uniqueNames.map((n) => slugify(n))
    const existed = await manager.find(Hashtag, { where: { slug: In(slugs) } })
    const bySlug = new Map(existed.map((h) => [h.slug, h]))
    const result: Hashtag[] = []
    for (let i = 0; i < uniqueNames.length; i++) {
      const slug = slugs[i]
      let h = bySlug.get(slug)
      if (!h) {
        h = await manager.save(manager.create(Hashtag, { name: uniqueNames[i], slug }))
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

  /**
   * RETROFIT TIER A (2026-08-12) — trước đây ghi `film` xong mới ghi `film_links` ở một câu
   * lệnh tách rời: nếu bước 2 lỗi (mất kết nối DB, constraint vi phạm...), `film` vẫn tồn tại
   * hợp lệ theo schema nhưng sai bất biến nghiệp vụ "phim mới phải có nguồn hợp lệ" — đúng
   * "partial state" mà audit + phản hồi Codex (mục 1.1) chỉ ra. Bọc toàn bộ trong MỘT
   * transaction: lỗi ở bất kỳ bước nào (kể cả `findOrCreateHashtags`) đều rollback hết,
   * không để lại `film`/hashtag mồ côi.
   */
  async create(actor: AuthUser, dto: UpsertFilmDto): Promise<PublicFilm> {
    const slug = await this.uniqueSlug(dto.title)

    // SNAPSHOT phòng ban của người tạo, lấy từ DB — KHÔNG nhận từ DTO. Trường này quyết định
    // phạm vi quyền của Cấp 3 nên tuyệt đối không để client tự khai (`02-security-baseline`
    // §2: "không tin trường có ý nghĩa phân quyền do client gửi lên").
    const departmentId = await this.users.getDepartmentId(actor.id)

    await this.films.manager.transaction(async (em) => {
      const hashtags = await this.findOrCreateHashtags(dto.hashtags || [], em)

      const film = await em.save(
        em.create(Film, {
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
        await em.save(links.map((l) => em.create(FilmLink, { filmId: film.id, ...l })))
      }
    })

    // Thông báo "phim mới" tạm TẮT (2026-07-22, quyết định người dùng): thực tế sẽ có rất
    // nhiều phim đăng lên, bắn thông báo cho mọi user mỗi lần sẽ gây spam. Hạ tầng
    // (bảng notifications/user_notifications, endpoint, panel FE) vẫn giữ nguyên để bật
    // lại sau với điều kiện phù hợp hơn (vd digest định kỳ, hoặc chọn lọc theo chuyên mục).
    // await this.notifications.notify(film.id, 'new_film', actor.id)

    return this.getBySlug(slug)
  }

  /**
   * Quyền sửa/xoá phim theo RBAC 4 CẤP CÓ SCOPE PHÒNG BAN (ADR-040) — thay thế hoàn toàn
   * quy tắc `super_admin`/`admin` sửa mọi phim của ADR-002/014.
   *
   *  - Cấp 1 `viewer`       → LUÔN từ chối (đã bị chặn trước ở `@Roles` tại controller; đây là
   *                           lớp phòng thủ thứ hai, không phải chốt duy nhất).
   *  - Cấp 2 `employee`     → chỉ phim do CHÍNH MÌNH tạo. Không sửa được phim người khác kể
   *                           cả cùng phòng ban.
   *  - Cấp 3 `dept_manager` → phim của chính mình, HOẶC phim thoả cả hai: `department_id` của
   *                           phim TRÙNG phòng ban hiện tại của actor, VÀ người tạo phim đang
   *                           là Cấp 2. Cố ý KHÔNG mở rộng sang phim của Cấp 3 khác hay Cấp 4
   *                           cùng phòng — đặc tả chỉ nói "chỉnh sửa của tất cả mọi người được
   *                           phân quyền cấp 2".
   *  - Cấp 4 `super_admin`  → mọi phim, mọi phòng ban.
   *
   * MỌI dữ liệu dùng để quyết định đều đọc từ DB: phòng ban của actor và vai trò của người
   * tạo phim lấy qua `UsersService` (không lấy từ JWT — xem ADR-043), `department_id` của phim
   * lấy từ bản ghi đã lưu (không nhận từ client). Đúng `02-security-baseline.md` §2.
   */
  private async assertCanManage(actor: AuthUser, film: Film): Promise<void> {
    if (actor.roleCode === 'super_admin') return

    if (actor.roleCode === 'viewer') {
      throw new ForbiddenException('Bạn chỉ có quyền xem, không được sửa/xoá phim')
    }

    if (film.uploaderId === actor.id) return

    if (actor.roleCode === 'dept_manager') {
      const actorDepartmentId = await this.users.getDepartmentId(actor.id)
      // Phòng ban chưa gán (null) KHÔNG được coi là "trùng nhau" — nếu không, mọi Trưởng
      // phòng chưa gán phòng ban sẽ quản được toàn bộ phim cũ chưa có department_id.
      if (actorDepartmentId != null && film.departmentId === actorDepartmentId) {
        const uploader = await this.users.getRoleAndDepartment(film.uploaderId)
        if (uploader?.roleCode === 'employee') return
      }
      throw new ForbiddenException(
        'Trưởng phòng chỉ sửa/xoá được phim của nhân viên cùng phòng ban',
      )
    }

    throw new ForbiddenException('Bạn chỉ có thể sửa/xoá phim của chính mình')
  }

  /** RETROFIT TIER A (2026-08-12) — cùng lý do transaction ở `create()`: sửa phim + xoá/ghi
   * lại `film_links` + tạo hashtag mới đều phải cùng thành công hoặc cùng rollback. */
  async update(actor: AuthUser, id: number, dto: UpsertFilmDto): Promise<PublicFilm> {
    const film = await this.films.findOne({ where: { id } })
    if (!film) throw new NotFoundException('Không tìm thấy phim')
    await this.assertCanManage(actor, film)

    await this.films.manager.transaction(async (em) => {
      film.title = dto.title.trim()
      film.categoryId = dto.categoryId
      film.description = dto.description?.trim() || null
      // Sửa phim → coi như cập nhật bản mới, gắn lại tag "Phim mới" (khớp hành vi GĐ0.5;
      // lịch sử phiên bản đầy đủ film_versions là GĐ5).
      film.publishedAt = this.today()
      film.hashtags = await this.findOrCreateHashtags(dto.hashtags || [], em)
      await em.save(film)

      await em.delete(FilmLink, { filmId: film.id })
      const links = this.linksFromDto(dto)
      if (links.length) {
        await em.save(links.map((l) => em.create(FilmLink, { filmId: film.id, ...l })))
      }
    })

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

  // ─── Đợt 2 việc 8: Đếm lượt tải về ─────────────────────────────────────

  /**
   * Ghi nhận 1 lượt tải về. KHÁC HẲN `recordView`, cố ý đơn giản hơn nhiều (ADR-054):
   *
   *  - KHÔNG dedupe theo cửa sổ thời gian. Mở trang xem phim là hành động có thể lặp vô tình
   *    (F5, quay lại trang) nên lượt xem phải chống trùng; còn bấm "Tải xuống" là chủ đích rõ
   *    ràng — bấm hai lần nghĩa là tải hai lần, đó là con số nghiệp vụ muốn biết.
   *  - KHÔNG cần giao dịch + khoá dòng. Bẫy race condition ở `recordView` sinh ra từ mẫu
   *    "đọc để quyết định rồi mới ghi" (11-coding-rules §5b). Ở đây không có bước đọc quyết
   *    định nào cả, chỉ một câu `UPDATE ... SET download_count = download_count + 1` — bản
   *    thân câu đó đã atomic, gọi song song bao nhiêu lần cũng cộng đủ.
   *
   * Chống spam: dựa vào rate limit toàn cục sẵn có, không thêm hàng rào riêng. Kho phim là
   * ứng dụng NỘI BỘ, mọi người gọi đều đã đăng nhập và định danh được; thổi phồng số lượt tải
   * của chính mình không mang lại lợi ích gì. Nếu sau này số liệu bị nghi ngờ thì chuyển sang
   * bảng `film_downloads` chi tiết (giống `film_views`) để truy được ai tải, thay vì chỉ đếm.
   */
  async recordDownload(actor: AuthUser, id: number): Promise<{ downloadCount: number }> {
    const film = await this.films.findOne({ where: { id } })
    if (!film) throw new NotFoundException('Không tìm thấy phim')
    await this.films.increment({ id }, 'downloadCount', 1)
    return { downloadCount: film.downloadCount + 1 }
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
   *
   * RETROFIT TIER A (2026-08-12) — sau khi ký xong, ghi lại CHỦ SỞ HỮU của key này
   * (actor/film/loại/hạn) vào `upload_intents`. Trước đây key sinh ra không được lưu vết ở
   * đâu — object bỏ dở trên MinIO (đóng tab/mất mạng trước khi gọi `confirmVersion`) không
   * cách nào dọn có chủ đích. Xem `UploadIntentsService`.
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
    const result = await this.storage.createVideoUploadUrl(dto.contentType)
    await this.uploadIntents.record({
      kind: 'video',
      storageKey: result.storageKey,
      filmId: id,
      actorId: actor.id,
      expiresInSec: result.expiresIn,
    })
    return result
  }

  /** Ảnh bìa tối đa 15MB — bằng giới hạn cũ của multer, giữ nguyên để không đổi hành vi. */
  private static readonly MAX_THUMBNAIL_BYTES = 15 * 1024 * 1024

  /**
   * Xin presigned PUT URL cho ẢNH BÌA (ADR-055) — thay cho `POST :id/thumbnail` cũ vốn nhận
   * multipart và buffer cả file trong RAM Node. Backend nay không chạm byte ảnh nào; nó chỉ
   * ký URL, còn việc kiểm ảnh thật (magic bytes + tỷ lệ 16:9) diễn ra ở `confirmVersion` sau
   * khi file đã nằm trên MinIO — xem `assertValidThumbnail`.
   */
  async createThumbnailUploadUrl(actor: AuthUser, id: number, dto: CreateThumbnailUploadUrlDto) {
    await this.findManageableFilm(actor, id)
    if (!this.storage.isAllowedImageType(dto.contentType)) {
      throw new BadRequestException('Ảnh bìa phải là JPG, PNG hoặc WebP')
    }
    if (dto.size > FilmsService.MAX_THUMBNAIL_BYTES) {
      throw new BadRequestException('Ảnh bìa vượt giới hạn 15MB')
    }
    // Ghi ownership — cùng lý do đã ghi ở `createUploadUrl` (Tier A retrofit, 2026-08-12).
    const result = await this.storage.createThumbnailUploadUrl(dto.contentType)
    await this.uploadIntents.record({
      kind: 'thumbnail',
      storageKey: result.thumbnailKey,
      filmId: id,
      actorId: actor.id,
      expiresInSec: result.expiresIn,
    })
    return result
  }

  /**
   * Kiểm ảnh bìa ĐÃ nằm trên MinIO: đúng định dạng ảnh thật (header parser giới hạn,
   * KHÔNG tin content-type client khai) + đúng tỷ lệ 16:9 + không vượt 15MB.
   *
   * Chỉ tải về 64KB ĐẦU của file — quá đủ để đọc header JPEG/PNG/WebP, và đó là
   * lý do bỏ được luồng buffer toàn file trong RAM mà không hạ thấp mức kiểm tra nào.
   * Ảnh không hợp lệ bị XOÁ khỏi MinIO ngay, không để lại rác (cùng cách xử lý video quá cỡ).
   */
  private async assertValidThumbnail(key: string): Promise<void> {
    const stat = await this.storage.stat(key)
    if (!stat) throw new BadRequestException('Không tìm thấy ảnh bìa đã upload trên storage')
    if (stat.size > FilmsService.MAX_THUMBNAIL_BYTES) {
      await this.storage.delete(key)
      throw new BadRequestException('Ảnh bìa vượt giới hạn 15MB — đã huỷ')
    }

    const head = await this.storage.readHeadBytes(key)
    if (!head?.length) {
      await this.storage.delete(key)
      throw new BadRequestException('Tệp ảnh rỗng')
    }

    const dim = readThumbnailDimensions(head)
    if (!dim) {
      await this.storage.delete(key)
      throw new BadRequestException('Tệp không phải ảnh hợp lệ')
    }
    const w = dim.width
    const h = dim.height
    if (!w || !h) {
      await this.storage.delete(key)
      throw new BadRequestException('Không đọc được kích thước ảnh')
    }
    // Tỷ lệ 16:9 (dung sai ~5%)
    if (Math.abs(w / h - 16 / 9) > (16 / 9) * 0.05) {
      await this.storage.delete(key)
      throw new BadRequestException(`Ảnh bìa phải tỷ lệ 16:9 (ảnh hiện tại ${w}×${h})`)
    }
  }

  /**
   * Xác nhận tạo bản mới sau khi FE upload xong file/ảnh. Head-check lại key
   * trong MinIO (chống client bịa key/size), lấy size thật, tạo film_versions
   * (version_no tăng dần), cập nhật duration + gắn lại "Phim mới" (publishedAt).
   *
   * RETROFIT TIER A (2026-08-12) — trước đây đọc `last.versionNo` NGOÀI giao dịch rồi mới
   * ghi `version_no = last + 1`, cùng mẫu lỗi đã ghi ở `recordView`: 2 request confirmVersion
   * song song cho cùng phim (vd. video xong trước, ảnh bìa xong sau, hoặc người dùng bấm xác
   * nhận 2 lần) đều đọc được cùng `last.versionNo` trước khi request nào kịp ghi → trùng
   * version_no. Sửa theo đúng mẫu `05-database-rules.md` §3: đưa câu đọc quyết định
   * (`last`) vào TRONG giao dịch + khoá dòng phim đang đọc (`pessimistic_write`). Unique
   * index `(film_id, version_no)` (migration AddFilmVersionsUniqueIndex1722200000000) là lớp
   * chặn cuối nếu lock bị bỏ qua vì lý do nào đó.
   *
   * Các lệnh gọi MinIO (`storage.stat`, `assertValidThumbnail`) cố ý đứng NGOÀI giao dịch —
   * đây là I/O mạng, để trong transaction sẽ giữ khoá dòng phim quá lâu (đúng nguyên tắc
   * "giao dịch rất ngắn" đã áp dụng ở `recordView`).
   */
  async confirmVersion(actor: AuthUser, id: number, dto: ConfirmVersionDto): Promise<PublicFilm> {
    const film = await this.findManageableFilm(actor, id)
    if (!dto.storageKey && !dto.thumbnailKey) {
      throw new BadRequestException('Cần ít nhất file video hoặc ảnh bìa để tạo bản mới')
    }

    let uploadedFileSize: number | null = null
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
      uploadedFileSize = stat.size
    }
    if (dto.thumbnailKey) {
      // Ảnh bìa nay upload thẳng lên MinIO bằng presigned PUT, nên ĐÂY là chốt kiểm duy nhất
      // (trước kia kiểm ngay lúc nhận multipart). Không kiểm ở đây = nhận bừa mọi file client
      // đẩy lên dưới cái tên ảnh bìa.
      await this.assertValidThumbnail(dto.thumbnailKey)
    }

    await this.films.manager.transaction(async (em) => {
      // Khoá dòng phim TRƯỚC khi đọc version_no lớn nhất → request confirmVersion khác cho
      // cùng phim phải chờ tới khi giao dịch này commit/rollback xong.
      const lockedFilm = await em.findOne(Film, {
        where: { id: film.id },
        lock: { mode: 'pessimistic_write' },
      })
      if (!lockedFilm) throw new NotFoundException('Không tìm thấy phim')

      const last = await em.findOne(FilmVersion, {
        where: { filmId: film.id },
        order: { versionNo: 'DESC' },
      })

      // Chỉ thay asset được upload mới; asset kia kế thừa từ bản trước (không để
      // thêm mỗi ảnh bìa lại làm mất video cũ, vì toPublic chỉ dùng bản mới nhất).
      const storageKey = dto.storageKey ?? last?.storageKey ?? null
      const fileSize = dto.storageKey ? String(uploadedFileSize) : last?.fileSize ?? null
      const duration = dto.duration ?? last?.duration ?? null
      const thumbnailKey = dto.thumbnailKey ?? last?.thumbnailKey ?? null

      // Claim intent TRƯỚC khi ghi version. Claim có điều kiện actor+film+kind+pending+TTL
      // trong cùng transaction; nếu key bị replay, thuộc phim/người khác hoặc sweep đã reserve
      // thì ném lỗi và toàn bộ transaction rollback, không sinh FilmVersion mồ côi.
      if (dto.storageKey) {
        await this.uploadIntents.claimForVersion(
          { storageKey: dto.storageKey, kind: 'video', filmId: film.id, actorId: actor.id },
          em,
        )
      }
      if (dto.thumbnailKey) {
        await this.uploadIntents.claimForVersion(
          { storageKey: dto.thumbnailKey, kind: 'thumbnail', filmId: film.id, actorId: actor.id },
          em,
        )
      }

      const versionNo = (last?.versionNo || 0) + 1
      await em.save(
        em.create(FilmVersion, {
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
      lockedFilm.publishedAt = this.today()
      if (duration) lockedFilm.duration = duration
      await em.save(lockedFilm)
    })

    // Thông báo "cập nhật bản mới" tạm TẮT — xem ghi chú ở create() (2026-07-22).
    // if (versionNo > 1) {
    //   await this.notifications.notify(film.id, 'updated', actor.id)
    // }

    return this.getBySlug(film.slug)
  }
}
