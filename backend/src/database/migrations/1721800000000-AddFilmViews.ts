import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm'

/**
 * GĐ4 — bảng film_views (đếm lượt xem, dedupe theo user_id trong cửa sổ 30' —
 * ADR-023). Không đụng tới films/film_versions hiện có (chỉ CREATE bảng mới +
 * FK trỏ vào films/users).
 */
export class AddFilmViews1721800000000 implements MigrationInterface {
  name = 'AddFilmViews1721800000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'film_views',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'film_id', type: 'int' },
          { name: 'user_id', type: 'int', isNullable: true },
          { name: 'session_hash', type: 'varchar', length: '64' },
          { name: 'viewed_at', type: 'datetime', precision: 6, default: 'CURRENT_TIMESTAMP(6)' },
        ],
      }),
      true,
    )
    await queryRunner.createIndex(
      'film_views',
      new TableIndex({ name: 'IDX_film_views_film_user', columnNames: ['film_id', 'user_id'] }),
    )
    await queryRunner.createForeignKey(
      'film_views',
      new TableForeignKey({
        name: 'FK_film_views_film',
        columnNames: ['film_id'],
        referencedTableName: 'films',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    )
    await queryRunner.createForeignKey(
      'film_views',
      new TableForeignKey({
        name: 'FK_film_views_user',
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('film_views', true)
  }
}
