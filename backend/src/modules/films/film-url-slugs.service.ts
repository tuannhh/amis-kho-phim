import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { EntityManager, In, Repository } from 'typeorm'
import { FilmUrlSlug } from './entities/film-url-slug.entity'

/** Dùng khi phim không còn thuộc chuyên mục nào (đã bị xoá — `Film.categoryId` SET NULL). */
export const UNCATEGORIZED_URL_SEGMENT = 'chua-phan-loai'

/**
 * Sinh + tra cứu URL công khai của phim (`ten-chuyen-muc/ten-phim-ngay-phat-hanh-version`,
 * yêu cầu chủ dự án 2026-08-13). Tách module riêng vì đây là mối quan tâm độc lập với CRUD
 * phim (định danh công khai + lịch sử URL), đúng nguyên tắc module hoá của chuẩn Backend
 * MISA — cùng lý do đã tách `UploadIntentsService` khỏi `FilmsService`.
 */
@Injectable()
export class FilmUrlSlugsService {
  constructor(@InjectRepository(FilmUrlSlug) private readonly slugs: Repository<FilmUrlSlug>) {}

  /** `publishedAt` dạng 'YYYY-MM-DD' (cột DATE) → 'ddMMyyyy' dùng trong URL. */
  private formatDate(publishedAt: string): string {
    const [y, m, d] = publishedAt.split('-')
    return `${d}${m}${y}`
  }

  /**
   * Sinh URL canonical MỚI cho phim và kích hoạt nó (`is_current=true`), bên trong transaction
   * của `FilmsService.create/update/confirmVersion` — PHẢI truyền `em` của transaction đó,
   * không dùng repository ngoài transaction (cùng lý do Tier A đã áp dụng cho
   * `findOrCreateHashtags`/`UploadIntentsService.claimForVersion`: nếu phần còn lại của giao
   * dịch rollback mà bản ghi URL đã commit riêng, phim sẽ có URL trỏ tới dữ liệu không tồn tại).
   *
   * Dòng CŨ (nếu có) KHÔNG bị xoá, chỉ chuyển `is_current=false` — mọi URL đã từng phát sinh
   * cho phim này vẫn resolve được vĩnh viễn qua `findByPath` (yêu cầu chủ dự án: "giống
   * Youtube — sửa/thêm bản mới sinh link mới, link cũ vẫn giữ").
   *
   * Chống trùng `path` giữa 2 PHIM KHÁC NHAU (cùng chuyên mục + cùng tên + cùng ngày + cùng
   * version): tự thêm hậu tố `-2/-3...` như `uniqueSlug()` của `FilmsService`. Race hiếm giữa
   * 2 giao dịch của 2 phim khác nhau đọc cùng lúc "path chưa tồn tại" KHÔNG được chặn ở đây
   * (mỗi giao dịch chỉ khoá dòng PHIM của chính nó, không khoá dòng phim kia) — UNIQUE INDEX
   * `path` ở migration là chốt chặn cuối, chấp nhận để giao dịch thua thất bại (fail-closed)
   * thay vì âm thầm sinh URL trùng, cùng mức đánh đổi đã chấp nhận cho `film_versions`
   * (Tier A retrofit 2026-08-12) — xác suất trong dữ liệu thật gần như bằng 0.
   */
  async assignCurrent(
    em: EntityManager,
    params: {
      filmId: number
      filmSlug: string
      categorySlug: string | null
      publishedAt: string
      versionNo: number
    },
  ): Promise<FilmUrlSlug> {
    const categorySlug = params.categorySlug || UNCATEGORIZED_URL_SEGMENT
    const base = `${params.filmSlug}-${this.formatDate(params.publishedAt)}-${params.versionNo}`

    let segment = base
    let n = 2
    for (;;) {
      const path = `${categorySlug}/${segment}`
      const existed = await em.findOne(FilmUrlSlug, { where: { path } })
      if (!existed || existed.filmId === params.filmId) {
        await em.update(FilmUrlSlug, { filmId: params.filmId, isCurrent: true }, { isCurrent: false })
        if (existed) {
          existed.isCurrent = true
          return em.save(existed)
        }
        return em.save(
          em.create(FilmUrlSlug, { filmId: params.filmId, categorySlug, slugSegment: segment, path, isCurrent: true }),
        )
      }
      segment = `${base}-${n++}`
    }
  }

  /** URL đang hiển thị/chia sẻ hiện tại của phim — dùng cho trang chi tiết 1 phim. */
  async findCurrent(filmId: number): Promise<FilmUrlSlug | undefined> {
    return (await this.slugs.findOne({ where: { filmId, isCurrent: true } })) ?? undefined
  }

  /** Bản đồ filmId → URL hiện tại, MỘT câu truy vấn cho cả danh sách (tránh N+1 ở `list()`). */
  async findCurrentMap(filmIds: number[]): Promise<Map<number, FilmUrlSlug>> {
    if (!filmIds.length) return new Map()
    const rows = await this.slugs.find({ where: { filmId: In(filmIds), isCurrent: true } })
    return new Map(rows.map((r) => [r.filmId, r]))
  }

  /**
   * Tra cứu theo URL đã gõ (canonical hiện tại HOẶC alias lịch sử — bảng này không phân biệt,
   * cả hai loại đều là 1 dòng `film_url_slugs` hợp lệ trỏ tới đúng phim).
   */
  async findByPath(categorySlug: string, slugSegment: string): Promise<FilmUrlSlug | null> {
    return this.slugs.findOne({ where: { path: `${categorySlug}/${slugSegment}` } })
  }
}
