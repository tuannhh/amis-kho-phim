import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm'

/**
 * RBAC 4 CẤP CÓ SCOPE PHÒNG BAN (ADR-040/041/042) — thay thế hoàn toàn 3 vai trò cũ
 * `super_admin`/`admin`/`employee`.
 *
 * Migration này làm 3 việc, theo đúng thứ tự:
 *  1. LƯỢC ĐỒ — bảng `departments`; `users.department_id`; `films.department_id`;
 *     `categories.created_by` + `categories.department_id`.
 *  2. DỮ LIỆU VAI TRÒ — map vai trò cũ sang mới (xem `LEGACY_ROLE_MAP` bên dưới) rồi đồng bộ
 *     lại bảng danh mục `roles` về đúng 4 dòng.
 *  3. BACKFILL `films.department_id` từ phòng ban của uploader.
 *
 * IDEMPOTENT (`05-database-rules.md` §1): mọi bước đều kiểm tra tồn tại trước khi tạo, mọi
 * UPDATE đều có điều kiện thu hẹp nên chạy lại không đổi thêm gì.
 */

/**
 * Bản đồ vai trò CŨ → MỚI. Xuất ra ngoài để kiểm thử được bằng dữ liệu thật (xem
 * `test/app.e2e-spec.ts`), không chỉ nằm trong chuỗi SQL.
 *
 * `admin` cũ → `super_admin` (Cấp 4), KHÔNG phải `dept_manager` (Cấp 3): hành vi thật của
 * `admin` cũ là sửa/xoá được MỌI phim TOÀN CÔNG TY (`films.service.ts` bản cũ) cộng quyền tạo
 * tài khoản — khớp Cấp 4. Cấp 3 chỉ sửa được phim cùng phòng ban nên hạ `admin` xuống Cấp 3
 * sẽ là THU HỒI quyền âm thầm. Đây là thay đổi quyền thật trên tài khoản đang tồn tại và đã
 * được nêu rõ trong báo cáo bàn giao để người dùng tự xác nhận lại.
 */
export const LEGACY_ROLE_MAP: Record<string, string> = {
  super_admin: 'super_admin',
  admin: 'super_admin',
  employee: 'employee',
}

/** 4 dòng danh mục `roles` sau migration (khớp `ROLE_NAME` trong `role.entity.ts`). */
export const RBAC4_ROLES: Array<{ code: string; name: string }> = [
  { code: 'viewer', name: 'Người xem' },
  { code: 'employee', name: 'Nhân viên văn phòng' },
  { code: 'dept_manager', name: 'Trưởng phòng' },
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

  // Đồng bộ danh mục `roles` về đúng 4 dòng. `users.role_code` KHÔNG có khoá ngoại tới
  // `roles.code` (xem migration InitAuth) nên thứ tự ở đây không gây lỗi ràng buộc; vẫn cập
  // nhật users TRƯỚC khi xoá dòng `admin` để không có khoảnh khắc nào users trỏ tới vai trò
  // đã bị xoá khỏi danh mục.
  for (const r of RBAC4_ROLES) {
    await queryRunner.query(
      'INSERT INTO `roles` (`code`, `name`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `name` = VALUES(`name`)',
      [r.code, r.name],
    )
  }
  await queryRunner.query('DELETE FROM `roles` WHERE `code` = ?', ['admin'])
}

export class AddDepartmentsAndRbac4Levels1722000000000 implements MigrationInterface {
  name = 'AddDepartmentsAndRbac4Levels1722000000000'

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
      // Cấp 3 lọc phim theo đúng cột này ở mọi lần kiểm quyền → có index riêng.
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
    // GIỚI HẠN ĐÃ BIẾT, ghi rõ ở đây và trong ADR-042: khi migration chạy lần đầu trên DB hiện
    // có, cột `users.department_id` vừa được thêm nên toàn bộ đang NULL và bảng `departments`
    // còn trống → mọi phim cũ sẽ có `department_id = NULL`, tức là Cấp 3 KHÔNG quản lý được
    // phim tạo trước khi phòng ban được gán. Đây là hành vi an toàn (mặc định từ chối, không
    // phải mặc định cho phép) và đúng ngữ nghĩa "snapshot lúc tạo". Muốn Cấp 3 quản lý phim cũ
    // thì Cấp 4 phải gán lại phòng ban cho phim đó một cách tường minh.
    await queryRunner.query(
      'UPDATE `films` f JOIN `users` u ON u.`id` = f.`uploader_id` ' +
        'SET f.`department_id` = u.`department_id` ' +
        'WHERE f.`department_id` IS NULL AND u.`department_id` IS NOT NULL',
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Trả lại danh mục vai trò cũ. KHÔNG thể phục hồi chính xác tài khoản nào từng là `admin`
    // (thông tin đó đã bị ghi đè ở up()) — nêu rõ giới hạn thay vì giả vờ down() là đối xứng.
    await queryRunner.query('DELETE FROM `roles` WHERE `code` IN (?, ?)', ['viewer', 'dept_manager'])
    await queryRunner.query(
      'INSERT INTO `roles` (`code`, `name`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `name` = VALUES(`name`)',
      ['admin', 'Admin'],
    )
    await queryRunner.query('UPDATE `roles` SET `name` = ? WHERE `code` = ?', ['Super Admin', 'super_admin'])
    await queryRunner.query('UPDATE `roles` SET `name` = ? WHERE `code` = ?', ['Nhân viên', 'employee'])
    // Vai trò `viewer`/`dept_manager` không còn trong danh mục → hạ về `employee` để không có
    // tài khoản nào mang vai trò không tồn tại.
    await queryRunner.query('UPDATE `users` SET `role_code` = ? WHERE `role_code` IN (?, ?)', [
      'employee',
      'viewer',
      'dept_manager',
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
