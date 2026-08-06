import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm'

/**
 * RBAC 3 CẤP PHẲNG (ADR-045/046/047) — thay thế hoàn toàn 3 vai trò cũ
 * `super_admin`/`admin`/`employee`.
 *
 * Migration này làm 3 việc, theo đúng thứ tự:
 *  1. LƯỢC ĐỒ — bảng `departments`; `users.department_id`; `films.department_id`;
 *     `categories.created_by` + `categories.department_id`. GIỮ NGUYÊN như bản 4 cấp: các cột
 *     này vẫn cần cho TRUY VẾT, chỉ khác là không dùng để giới hạn quyền (ADR-046).
 *  2. DỮ LIỆU VAI TRÒ — map vai trò cũ sang mới (xem `LEGACY_ROLE_MAP` bên dưới) rồi đồng bộ
 *     lại bảng danh mục `roles` về đúng 3 dòng.
 *  3. BACKFILL `films.department_id` từ phòng ban của uploader (thuần truy vết).
 *
 * IDEMPOTENT (`05-database-rules.md` §1): mọi bước đều kiểm tra tồn tại trước khi tạo, mọi
 * UPDATE đều có điều kiện thu hẹp nên chạy lại không đổi thêm gì.
 */

/**
 * Bản đồ vai trò CŨ → MỚI. Xuất ra ngoài để kiểm thử được bằng dữ liệu thật (xem
 * `test/app.e2e-spec.ts`), không chỉ nằm trong chuỗi SQL.
 *
 * `admin` cũ → `super_admin`: ở bản 3 CẤP PHẲNG mapping này KHÔNG còn chỗ nào mơ hồ. Hành vi
 * thật của `admin` cũ là sửa/xoá được MỌI phim toàn công ty cộng quyền tạo tài khoản; bản này
 * chỉ có ĐÚNG MỘT cấp mang hành vi đó (`super_admin`), nên không tồn tại lựa chọn thứ hai để
 * phải cân nhắc — khác bản 4 cấp, nơi phải chứng minh vì sao KHÔNG hạ `admin` xuống
 * `dept_manager` (mất quyền âm thầm).
 *
 * `dept_manager` → `employee`: vai trò này KHÔNG tồn tại ở bản 3 cấp. Nó chỉ xuất hiện trên DB
 * nào đã từng chạy nhánh `phan-quyen-4-cap`. Hạ về Cấp 2 (KHÔNG nâng lên `super_admin`) theo
 * nguyên tắc 1 — thà thu hẹp quyền và để quản trị gán lại tường minh, còn hơn im lặng trao
 * quyền sửa toàn bộ kho phim cho một tài khoản chưa được duyệt ở mức đó.
 */
export const LEGACY_ROLE_MAP: Record<string, string> = {
  super_admin: 'super_admin',
  admin: 'super_admin',
  employee: 'employee',
  dept_manager: 'employee',
}

/** 3 dòng danh mục `roles` sau migration (khớp `ROLE_NAME` trong `role.entity.ts`). */
export const RBAC3_ROLES: Array<{ code: string; name: string }> = [
  { code: 'viewer', name: 'Người xem' },
  { code: 'employee', name: 'Nhân viên văn phòng' },
  { code: 'super_admin', name: 'Quản trị cao nhất' },
]

/**
 * Bước 2 tách riêng thành hàm xuất ra ngoài để kiểm thử tích hợp gọi lại được trên MySQL
 * THẬT (chèn một tài khoản `admin` cũ rồi chạy lại đúng câu SQL này và kiểm kết quả) — thay vì
 * chỉ khẳng định trên giấy rằng chuỗi SQL đúng.
 */
export async function migrateLegacyRoles(queryRunner: QueryRunner): Promise<void> {
  for (const [from, to] of Object.entries(LEGACY_ROLE_MAP)) {
    if (from === to) continue
    await queryRunner.query('UPDATE `users` SET `role_code` = ? WHERE `role_code` = ?', [to, from])
  }

  // Đồng bộ danh mục `roles` về đúng 3 dòng. `users.role_code` KHÔNG có khoá ngoại tới
  // `roles.code` (xem migration InitAuth) nên thứ tự ở đây không gây lỗi ràng buộc; vẫn cập
  // nhật users TRƯỚC khi xoá các dòng thừa để không có khoảnh khắc nào users trỏ tới vai trò
  // đã bị xoá khỏi danh mục.
  for (const r of RBAC3_ROLES) {
    await queryRunner.query(
      'INSERT INTO `roles` (`code`, `name`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `name` = VALUES(`name`)',
      [r.code, r.name],
    )
  }
  await queryRunner.query('DELETE FROM `roles` WHERE `code` IN (?, ?)', ['admin', 'dept_manager'])
}

export class AddDepartmentsAndRbac3Levels1722000000000 implements MigrationInterface {
  name = 'AddDepartmentsAndRbac3Levels1722000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. Lược đồ ───────────────────────────────────────────────────────────
    if (!(await queryRunner.hasTable('departments'))) {
      await queryRunner.createTable(
        new Table({
          name: 'departments',
          columns: [
            { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
            { name: 'name', type: 'varchar', length: '150' },
            { name: 'created_at', type: 'datetime', precision: 6, default: 'CURRENT_TIMESTAMP(6)' },
          ],
        }),
        true,
      )
      await queryRunner.createIndex(
        'departments',
        new TableIndex({ name: 'UQ_departments_name', columnNames: ['name'], isUnique: true }),
      )
    }

    await this.addNullableFk(queryRunner, 'users', 'department_id', {
      fkName: 'FK_users_department',
      referencedTableName: 'departments',
    })

    await this.addNullableFk(queryRunner, 'films', 'department_id', {
      fkName: 'FK_films_department',
      referencedTableName: 'departments',
      // Index phục vụ tra cứu/báo cáo "phim của phòng ban X" (truy vết). Ở bản 3 cấp phẳng cột
      // này KHÔNG tham gia kiểm quyền, nên index là chuyện hiệu năng đọc, không phải bảo mật.
      indexName: 'IDX_films_department',
    })

    await this.addNullableFk(queryRunner, 'categories', 'created_by', {
      fkName: 'FK_categories_created_by',
      referencedTableName: 'users',
    })
    await this.addNullableFk(queryRunner, 'categories', 'department_id', {
      fkName: 'FK_categories_department',
      referencedTableName: 'departments',
    })

    // ── 2. Dữ liệu vai trò cũ → mới ─────────────────────────────────────────
    await migrateLegacyRoles(queryRunner)

    // ── 3. Backfill films.department_id ─────────────────────────────────────
    // Lấy phòng ban của uploader TẠI THỜI ĐIỂM CHẠY MIGRATION.
    // GIỚI HẠN ĐÃ BIẾT, ghi rõ ở đây và trong ADR-046: khi migration chạy lần đầu trên DB hiện
    // có, cột `users.department_id` vừa được thêm nên toàn bộ đang NULL và bảng `departments`
    // còn trống → mọi phim cũ sẽ có `department_id = NULL`. Ở bản 3 CẤP PHẲNG điều này KHÔNG
    // ảnh hưởng quyền hạn của bất kỳ ai (phòng ban không tham gia kiểm quyền); hệ quả duy nhất
    // là phim cũ chưa có dữ liệu truy vết phòng ban cho tới khi được gán lại tường minh.
    await queryRunner.query(
      'UPDATE `films` f JOIN `users` u ON u.`id` = f.`uploader_id` ' +
        'SET f.`department_id` = u.`department_id` ' +
        'WHERE f.`department_id` IS NULL AND u.`department_id` IS NOT NULL',
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Trả lại danh mục vai trò cũ. KHÔNG thể phục hồi chính xác tài khoản nào từng là `admin`
    // (thông tin đó đã bị ghi đè ở up()) — nêu rõ giới hạn thay vì giả vờ down() là đối xứng.
    await queryRunner.query('DELETE FROM `roles` WHERE `code` = ?', ['viewer'])
    await queryRunner.query(
      'INSERT INTO `roles` (`code`, `name`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `name` = VALUES(`name`)',
      ['admin', 'Admin'],
    )
    await queryRunner.query('UPDATE `roles` SET `name` = ? WHERE `code` = ?', ['Super Admin', 'super_admin'])
    await queryRunner.query('UPDATE `roles` SET `name` = ? WHERE `code` = ?', ['Nhân viên', 'employee'])
    // Vai trò `viewer` không còn trong danh mục → hạ về `employee` để không có tài khoản nào
    // mang vai trò không tồn tại.
    await queryRunner.query('UPDATE `users` SET `role_code` = ? WHERE `role_code` = ?', [
      'employee',
      'viewer',
    ])

    await this.dropNullableFk(queryRunner, 'categories', 'department_id', 'FK_categories_department')
    await this.dropNullableFk(queryRunner, 'categories', 'created_by', 'FK_categories_created_by')
    await this.dropNullableFk(queryRunner, 'films', 'department_id', 'FK_films_department', 'IDX_films_department')
    await this.dropNullableFk(queryRunner, 'users', 'department_id', 'FK_users_department')
    await queryRunner.dropTable('departments', true)
  }

  /**
   * Thêm 1 cột int nullable + khoá ngoại `ON DELETE SET NULL` (+ index tuỳ chọn), bỏ qua nếu
   * cột đã tồn tại. Gom thành helper vì lặp lại 4 lần trong cùng migration (nguyên tắc 6).
   */
  private async addNullableFk(
    queryRunner: QueryRunner,
    table: string,
    column: string,
    opts: { fkName: string; referencedTableName: string; indexName?: string },
  ): Promise<void> {
    if (await queryRunner.hasColumn(table, column)) return

    await queryRunner.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` int NULL`)
    if (opts.indexName) {
      await queryRunner.createIndex(table, new TableIndex({ name: opts.indexName, columnNames: [column] }))
    }
    await queryRunner.createForeignKey(
      table,
      new TableForeignKey({
        name: opts.fkName,
        columnNames: [column],
        referencedTableName: opts.referencedTableName,
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    )
  }

  private async dropNullableFk(
    queryRunner: QueryRunner,
    table: string,
    column: string,
    fkName: string,
    indexName?: string,
  ): Promise<void> {
    if (!(await queryRunner.hasColumn(table, column))) return
    const t = await queryRunner.getTable(table)
    if (t?.foreignKeys.some((fk) => fk.name === fkName)) {
      await queryRunner.query(`ALTER TABLE \`${table}\` DROP FOREIGN KEY \`${fkName}\``)
    }
    if (indexName && t?.indices.some((i) => i.name === indexName)) {
      await queryRunner.dropIndex(table, indexName)
    }
    await queryRunner.query(`ALTER TABLE \`${table}\` DROP COLUMN \`${column}\``)
  }
}
