import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm'

/**
 * Retrofit Tier A (Production Compatibility Gate, 2026-08-12) — `film_versions` có
 * `version_no` tính bằng "đọc max rồi +1" ở service (`confirmVersion`), KHÔNG có ràng buộc
 * gì ở DB ngăn hai version cùng film_id trùng version_no khi 2 request chạy song song
 * (vd. upload video xong trước, ảnh bìa xong sau, người dùng bấm xác nhận 2 lần). Theo
 * nguyên tắc "Database là source of truth cho uniqueness" — thêm unique compound index làm
 * lớp chặn cuối, độc lập với transaction/lock ở tầng service (xem cùng đợt sửa
 * `films.service.ts#confirmVersion`).
 *
 * Thay `IDX_film_versions_film` (chỉ film_id) bằng unique (film_id, version_no) — compound
 * index này vẫn phục vụ được truy vấn lọc theo film_id một mình (MySQL dùng prefix bên
 * trái), nên không cần giữ cả hai index.
 *
 * THỨ TỰ BẮT BUỘC — bug thật bắt được khi chạy e2e thật (2026-08-12): `IDX_film_versions_film`
 * đang được `FK_film_versions_film` dùng làm index hậu thuẫn. MySQL/InnoDB TỪ CHỐI drop một
 * index đang là chỗ dựa duy nhất của foreign key ("Cannot drop index ... needed in a foreign
 * key constraint") — phải TẠO index mới TRƯỚC (nó cũng phủ được film_id ở vị trí đầu nên FK
 * chuyển sang dùng được ngay), rồi mới DROP index cũ. Làm ngược thứ tự (như bản đầu tiên của
 * migration này) chạy được trên SQLite/test giả lập nhưng FAIL ngay trên MySQL thật — đúng
 * bài học "phải kiểm bằng DB thật, không chỉ tin logic đọc được" của chuẩn Backend MISA.
 */
export class AddFilmVersionsUniqueIndex1722200000000 implements MigrationInterface {
  name = 'AddFilmVersionsUniqueIndex1722200000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createIndex(
      'film_versions',
      new TableIndex({
        name: 'IDX_film_versions_film_version_no',
        columnNames: ['film_id', 'version_no'],
        isUnique: true,
      }),
    )
    await queryRunner.dropIndex('film_versions', 'IDX_film_versions_film')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createIndex(
      'film_versions',
      new TableIndex({ name: 'IDX_film_versions_film', columnNames: ['film_id'] }),
    )
    await queryRunner.dropIndex('film_versions', 'IDX_film_versions_film_version_no')
  }
}
