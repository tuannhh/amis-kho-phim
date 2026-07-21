import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm'

/**
 * GĐ1 — khởi tạo bảng auth: roles + users (utf8mb4_unicode_ci cho tiếng Việt).
 * Chạy tự động khi khởi động (migrationsRun=true) hoặc qua `npm run migration:run`.
 */
export class InitAuth1721500000000 implements MigrationInterface {
  name = 'InitAuth1721500000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'roles',
        columns: [
          { name: 'code', type: 'varchar', length: '20', isPrimary: true },
          { name: 'name', type: 'varchar', length: '50' },
        ],
      }),
      true,
    )

    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'email', type: 'varchar', length: '190' },
          { name: 'full_name', type: 'varchar', length: '150' },
          { name: 'password_hash', type: 'varchar', length: '100' },
          { name: 'role_code', type: 'varchar', length: '20' },
          { name: 'created_by', type: 'int', isNullable: true },
          { name: 'is_active', type: 'tinyint', width: 1, default: 1 },
          { name: 'must_change_password', type: 'tinyint', width: 1, default: 0 },
          { name: 'created_at', type: 'datetime', precision: 6, default: 'CURRENT_TIMESTAMP(6)' },
          {
            name: 'updated_at',
            type: 'datetime',
            precision: 6,
            default: 'CURRENT_TIMESTAMP(6)',
            onUpdate: 'CURRENT_TIMESTAMP(6)',
          },
        ],
      }),
      true,
    )

    await queryRunner.createIndex(
      'users',
      new TableIndex({ name: 'UQ_users_email', columnNames: ['email'], isUnique: true }),
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('users', true)
    await queryRunner.dropTable('roles', true)
  }
}
