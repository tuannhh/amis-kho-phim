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
import imageSize from 'image-size'

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

    const film = await this.films.save(
      this.films.create({
        slug,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        categoryId: dto.categoryId,
        uploaderId: actor.id,
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

    return this.getBySlug(slug)
  }

  /** Nhân viên chỉ sửa/xoá phim của mình; super_admin/admin sửa/xoá bất kỳ (ADR-002/014). */
  private assertCanManage(actor: AuthUser, film: Film) {
    if (actor.roleCode === 'super_admin' || actor.roleCode === 'admin') return
    if (film.uploaderId === actor.id) return
    throw new ForbiddenException('Bạn chỉ có thể sửa/xoá phim của chính mình')
  }

  async update(actor: AuthUser, id: number, dto: UpsertFilmDto): Promise<PublicFilm> {
    const film = await this.films.findOne({ where: { id } })
    if (!film) throw new NotFoundException('Không tìm thấy phim')
    this.assertCanManage(actor, film)

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

    return this.getBySlug(film.slug)
  }

  async remove(actor: AuthUser, id: number): Promise<void> {
    const film = await this.films.findOne({ where: { id } })
    if (!film) throw new NotFoundException('Không tìm thấy phim')
    this.assertCanManage(actor, film)
    await this.films.remove(film)
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
   * Ngược lại: insert bản ghi mới + tăng `films.view_count` ATOMIC (increment,
   * không đọc-rồi-ghi, tránh race condition khi nhiều request cùng lúc).
   */
  async recordView(actor: AuthUser, id: number, sessionHash: string): Promise<{ viewCount: number }> {
    const film = await this.films.findOne({ where: { id } })
    if (!film) throw new NotFoundException('Không tìm thấy phim')

    const windowStart = new Date(Date.now() - FilmsService.VIEW_DEDUPE_MINUTES * 60 * 1000)
    const dup = await this.filmViews.findOne({
      where: { filmId: id, userId: actor.id, viewedAt: MoreThan(windowStart) },
      order: { viewedAt: 'DESC' },
    })
    if (dup) return { viewCount: film.viewCount }

    await this.filmViews.save(
      this.filmViews.create({ filmId: id, userId: actor.id, sessionHash }),
    )
    await this.films.increment({ id }, 'viewCount', 1)
    return { viewCount: film.viewCount + 1 }
  }

  // ─── GĐ3: Storage (MinIO) ──────────────────────────────────────────────

  /** Lấy phim + kiểm quyền quản lý (dùng chung cho các thao tác storage). */
  private async findManageableFilm(actor: AuthUser, id: number): Promise<Film> {
    const film = await this.films.findOne({ where: { id } })
    if (!film) throw new NotFoundException('Không tìm thấy phim')
    this.assertCanManage(actor, film)
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

    return this.getBySlug(film.slug)
  }
}
