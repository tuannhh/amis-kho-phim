import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm'

/**
 * GĐ3 — bảng film_versions (lịch sử bản phim + key MinIO). Không đụng tới
 * films/categories hiện có (chỉ CREATE bảng mới + FK trỏ vào films/users).
 */
export class AddFilmVersions1721700000000 implements MigrationInterface {
  name = 'AddFilmVersions1721700000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'film_versions',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'film_id', type: 'int' },
          { name: 'version_no', type: 'int' },
          { name: 'storage_key', type: 'varchar', length: '200', isNullable: true },
          { name: 'file_size', type: 'bigint', isNullable: true },
          { name: 'duration', type: 'varchar', length: '20', isNullable: true },
          { name: 'thumbnail_key', type: 'varchar', length: '200', isNullable: true },
          { name: 'note', type: 'varchar', length: '255', isNullable: true },
          { name: 'created_by', type: 'int', isNullable: true },
          { name: 'created_at', type: 'datetime', precision: 6, default: 'CURRENT_TIMESTAMP(6)' },
        ],
      }),
      true,
    )
    await queryRunner.createIndex(
      'film_versions',
      new TableIndex({ name: 'IDX_film_versions_film', columnNames: ['film_id'] }),
    )
    await queryRunner.createForeignKey(
      'film_versions',
      new TableForeignKey({
        name: 'FK_film_versions_film',
        columnNames: ['film_id'],
        referencedTableName: 'films',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    )
    await queryRunner.createForeignKey(
      'film_versions',
      new TableForeignKey({
        name: 'FK_film_versions_creator',
        columnNames: ['created_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('film_versions', true)
  }
}
