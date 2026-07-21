import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { Film } from './entities/film.entity'
import { FilmLink, type ExternalFilmPlatform } from './entities/film-link.entity'
import { Hashtag } from './entities/hashtag.entity'
import { UpsertFilmDto } from './dto/film.dto'
import type { AuthUser } from '../../common/auth/auth-user'
import { slugify } from '../../common/slugify'

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
  links: Partial<Record<ExternalFilmPlatform, string>>
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
  ) {}

  private toPublic(f: Film): PublicFilm {
    const links: Partial<Record<ExternalFilmPlatform, string>> = {}
    for (const l of f.links || []) links[l.platform] = l.url
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
      duration: f.duration,
      hashtags: (f.hashtags || []).map((h) => h.name),
      links,
      publishedAt: f.publishedAt,
    }
  }

  private relations = ['category', 'uploader', 'links', 'hashtags']

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
}
