import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm'

/**
 * Retrofit Tier A (Production Compatibility Gate, 2026-08-12) — bảng `upload_intents` ghi
 * chủ sở hữu mỗi presigned upload URL đã ký (xem chú thích đầy đủ ở
 * `modules/uploads/entities/upload-intent.entity.ts`). Trước đây key sinh ra lúc ký URL
 * không được lưu vết ở đâu cả — object bị bỏ dở trên MinIO (FE đóng tab/mất mạng trước khi
 * gọi confirmVersion) không cách nào dọn có chủ đích.
 */
export class AddUploadIntents1722300000000 implements MigrationInterface {
  name = 'AddUploadIntents1722300000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'upload_intents',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'storage_key', type: 'varchar', length: '200' },
          { name: 'kind', type: 'varchar', length: '20' },
          { name: 'film_id', type: 'int' },
          { name: 'actor_id', type: 'int', isNullable: true },
          { name: 'status', type: 'varchar', length: '20', default: "'pending'" },
          { name: 'expires_at', type: 'datetime', precision: 6 },
          { name: 'consumed_at', type: 'datetime', precision: 6, isNullable: true },
          { name: 'created_at', type: 'datetime', precision: 6, default: 'CURRENT_TIMESTAMP(6)' },
        ],
      }),
      true,
    )
    await queryRunner.createIndex(
      'upload_intents',
      new TableIndex({ name: 'IDX_upload_intents_storage_key', columnNames: ['storage_key'], isUnique: true }),
    )
    await queryRunner.createIndex(
      'upload_intents',
      new TableIndex({
        name: 'IDX_upload_intents_status_expires',
        columnNames: ['status', 'expires_at'],
      }),
    )
    await queryRunner.createForeignKey(
      'upload_intents',
      new TableForeignKey({
        name: 'FK_upload_intents_film',
        columnNames: ['film_id'],
        referencedTableName: 'films',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    )
    await queryRunner.createForeignKey(
      'upload_intents',
      new TableForeignKey({
        name: 'FK_upload_intents_actor',
        columnNames: ['actor_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('upload_intents', true)
  }
}
