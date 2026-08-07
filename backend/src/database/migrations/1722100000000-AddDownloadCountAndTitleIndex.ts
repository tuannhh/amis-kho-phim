import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm'

/**
 * Đợt 2 — hai thay đổi nhỏ trên bảng `films`, gộp một migration vì cùng chạm một bảng:
 *
 *  1. `download_count` (việc 8) — đếm lượt tải về, cùng khuôn với `view_count` có từ GĐ4
 *     (int NOT NULL DEFAULT 0, cộng dồn bằng `increment()` để atomic — xem 11-coding-rules §3).
 *  2. Index `idx_films_title` (việc 9 / ADR-052) — nhãn "Phim mới" nay phụ thuộc việc phim có
 *     phải bản mới nhất trong nhóm TRÙNG TIÊU ĐỀ hay không. Trang chi tiết phải hỏi
 *     "phim mới nhất mang đúng tiêu đề này là phim nào" ở MỖI lần mở phim, nên cột `title`
 *     cần index để câu đó không quét toàn bảng khi kho phim lớn dần.
 *     Index KHÔNG unique — trùng tiêu đề là hợp lệ về nghiệp vụ, đó chính là tình huống
 *     tính năng này xử lý.
 */
export class AddDownloadCountAndTitleIndex1722100000000 implements MigrationInterface {
  name = 'AddDownloadCountAndTitleIndex1722100000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'films',
      new TableColumn({
        name: 'download_count',
        type: 'int',
        isNullable: false,
        default: 0,
      }),
    )
    await queryRunner.createIndex(
      'films',
      new TableIndex({ name: 'idx_films_title', columnNames: ['title'] }),
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('films', 'idx_films_title')
    await queryRunner.dropColumn('films', 'download_count')
  }
}
