import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm'

/**
 * Feature 2026-08-13 (yêu cầu chủ dự án) — mỗi phim có 1 URL riêng cấu trúc
 * `ten-chuyen-muc/ten-phim-ngay-phat-hanh-version` (xem chú thích đầy đủ ở
 * `modules/films/entities/film-url-slug.entity.ts`).
 *
 * BACKFILL: mọi phim ĐANG CÓ trước migration này được gán 1 dòng `is_current=true` ngay
 * lập tức dựa trên category/slug/published_at/version_no HIỆN TẠI của chúng — không phim
 * nào bị "treo" không có URL sau khi deploy. Version dùng version_no LỚN NHẤT trong
 * `film_versions` của phim đó, hoặc 1 nếu phim chưa có version nào (chỉ có link ngoài).
 *
 * Backfill KHÔNG tự xử lý trùng `path` (không lặp lại vòng lặp thêm hậu tố `-2/-3` như tầng
 * service) — cố ý: dữ liệu lịch sử đã qua `uniqueSlug()` (film.slug toàn cục duy nhất) nên
 * 2 phim trùng category + trùng slug + trùng ngày + trùng version là gần như không thể xảy
 * ra trong dữ liệu thật; nếu vẫn xảy ra, UNIQUE INDEX bên dưới sẽ làm INSERT lỗi và dừng
 * migration (fail-closed) thay vì âm thầm bỏ qua một dòng — vận hành phải xử lý thủ công.
 */
export class AddFilmUrlSlugs1722400000000 implements MigrationInterface {
  name = 'AddFilmUrlSlugs1722400000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'film_url_slugs',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'film_id', type: 'int' },
          { name: 'category_slug', type: 'varchar', length: '190' },
          { name: 'slug_segment', type: 'varchar', length: '280' },
          { name: 'path', type: 'varchar', length: '470' },
          { name: 'is_current', type: 'boolean', default: false },
          { name: 'created_at', type: 'datetime', precision: 6, default: 'CURRENT_TIMESTAMP(6)' },
        ],
      }),
      true,
    )
    await queryRunner.createIndex(
      'film_url_slugs',
      new TableIndex({ name: 'IDX_film_url_slugs_path', columnNames: ['path'], isUnique: true }),
    )
    await queryRunner.createIndex(
      'film_url_slugs',
      new TableIndex({ name: 'IDX_film_url_slugs_film_current', columnNames: ['film_id', 'is_current'] }),
    )
    await queryRunner.createForeignKey(
      'film_url_slugs',
      new TableForeignKey({
        name: 'FK_film_url_slugs_film',
        columnNames: ['film_id'],
        referencedTableName: 'films',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    )

    await queryRunner.query(`
      INSERT INTO film_url_slugs (film_id, category_slug, slug_segment, path, is_current, created_at)
      SELECT
        f.id,
        COALESCE(c.slug, 'chua-phan-loai') AS category_slug,
        CONCAT(f.slug, '-', DATE_FORMAT(f.published_at, '%d%m%Y'), '-', COALESCE(v.max_version_no, 1)) AS slug_segment,
        CONCAT(COALESCE(c.slug, 'chua-phan-loai'), '/', f.slug, '-', DATE_FORMAT(f.published_at, '%d%m%Y'), '-', COALESCE(v.max_version_no, 1)) AS path,
        1,
        NOW()
      FROM films f
      LEFT JOIN categories c ON c.id = f.category_id
      LEFT JOIN (
        SELECT film_id, MAX(version_no) AS max_version_no FROM film_versions GROUP BY film_id
      ) v ON v.film_id = f.id
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('film_url_slugs', true)
  }
}
