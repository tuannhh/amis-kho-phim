import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index, CreateDateColumn } from 'typeorm'
import { Film } from './film.entity'

/**
 * Lịch sử URL công khai của MỖI phim (2026-08-13, yêu cầu chủ dự án) — cấu trúc
 * `ten-chuyen-muc/ten-phim-ngay-phat-hanh-version`, ví dụ
 * `phim-gioi-thieu-cong-ty/gioi-thieu-tap-doan-misa-13082026-1`.
 *
 * MỖI LẦN phim được tạo/sửa/xác nhận bản mới (`FilmsService.create/update/confirmVersion`),
 * một dòng MỚI được thêm vào đây với `is_current=true`, dòng CŨ của phim đó chuyển
 * `is_current=false` — KHÔNG BAO GIỜ xoá. Lý do: yêu cầu "giống Youtube — sửa/thêm bản mới
 * sinh link mới, link cũ vẫn phải còn dùng được", vì `published_at`/`version_no` (2 thành
 * phần nằm trong `slug_segment`) đổi theo thời gian nên URL của MỘT phim không cố định.
 *
 * `path` (= `category_slug/slug_segment`) là UNIQUE toàn cục — chốt chặn cuối chống 2 phim
 * khác nhau vô tình sinh trùng URL (trùng chuyên mục + trùng tên + trùng ngày + trùng version,
 * xem `FilmUrlSlugsService.assignCurrent`).
 */
@Entity({ name: 'film_url_slugs' })
export class FilmUrlSlug {
  @PrimaryGeneratedColumn()
  id!: number

  @Index('IDX_film_url_slugs_film_current')
  @Column({ name: 'film_id', type: 'int' })
  filmId!: number

  @ManyToOne(() => Film, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'film_id' })
  film?: Film

  /** Slug chuyên mục TẠI THỜI ĐIỂM sinh URL này — snapshot, không join động qua `categories`. */
  @Column({ name: 'category_slug', type: 'varchar', length: 190 })
  categorySlug!: string

  /** Phần `ten-phim-ngay-phat-hanh-version`, vd `gioi-thieu-tap-doan-misa-13082026-1`. */
  @Column({ name: 'slug_segment', type: 'varchar', length: 280 })
  slugSegment!: string

  /** `category_slug/slug_segment` — chuỗi FE dùng thẳng làm route, BE dùng để tra cứu ngược. */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 470 })
  path!: string

  /** Đúng MỘT dòng `true` cho mỗi `film_id` tại một thời điểm — là URL hiện đang hiển thị/chia sẻ. */
  @Column({ name: 'is_current', type: 'boolean', default: false })
  isCurrent!: boolean

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date
}
