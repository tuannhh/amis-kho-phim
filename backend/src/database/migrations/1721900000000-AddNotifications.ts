import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm'

/**
 * GĐ5 — bảng notifications + user_notifications (thông báo phim mới/cập nhật
 * bản mới, 01-architecture.md §4). Không đụng tới bảng hiện có (chỉ CREATE mới).
 */
export class AddNotifications1721900000000 implements MigrationInterface {
  name = 'AddNotifications1721900000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'notifications',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'film_id', type: 'int' },
          { name: 'type', type: 'varchar', length: '20' },
          { name: 'created_at', type: 'datetime', precision: 6, default: 'CURRENT_TIMESTAMP(6)' },
        ],
      }),
      true,
    )
    await queryRunner.createIndex(
      'notifications',
      new TableIndex({ name: 'IDX_notifications_created_at', columnNames: ['created_at'] }),
    )
    await queryRunner.createForeignKey(
      'notifications',
      new TableForeignKey({
        name: 'FK_notifications_film',
        columnNames: ['film_id'],
        referencedTableName: 'films',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    )

    await queryRunner.createTable(
      new Table({
        name: 'user_notifications',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'user_id', type: 'int' },
          { name: 'notification_id', type: 'int' },
          { name: 'is_read', type: 'boolean', default: false },
          { name: 'created_at', type: 'datetime', precision: 6, default: 'CURRENT_TIMESTAMP(6)' },
        ],
      }),
      true,
    )
    await queryRunner.createIndex(
      'user_notifications',
      new TableIndex({ name: 'IDX_user_notifications_user', columnNames: ['user_id', 'is_read'] }),
    )
    await queryRunner.createForeignKey(
      'user_notifications',
      new TableForeignKey({
        name: 'FK_user_notifications_user',
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    )
    await queryRunner.createForeignKey(
      'user_notifications',
      new TableForeignKey({
        name: 'FK_user_notifications_notification',
        columnNames: ['notification_id'],
        referencedTableName: 'notifications',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('user_notifications', true)
    await queryRunner.dropTable('notifications', true)
  }
}
