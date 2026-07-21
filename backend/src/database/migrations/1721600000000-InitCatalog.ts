import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm'

/** GĐ2 — categories (cây cha-con) + films (metadata) + film_links + hashtags + film_hashtags. */
export class InitCatalog1721600000000 implements MigrationInterface {
  name = 'InitCatalog1721600000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'categories',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'name', type: 'varchar', length: '150' },
          { name: 'slug', type: 'varchar', length: '190' },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'parent_id', type: 'int', isNullable: true },
          { name: 'created_at', type: 'datetime', precision: 6, default: 'CURRENT_TIMESTAMP(6)' },
        ],
      }),
      true,
    )
    await queryRunner.createIndex(
      'categories',
      new TableIndex({ name: 'UQ_categories_slug', columnNames: ['slug'], isUnique: true }),
    )
    await queryRunner.createForeignKey(
      'categories',
      new TableForeignKey({
        name: 'FK_categories_parent',
        columnNames: ['parent_id'],
        referencedTableName: 'categories',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    )

    await queryRunner.createTable(
      new Table({
        name: 'films',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'slug', type: 'varchar', length: '220' },
          { name: 'title', type: 'varchar', length: '255' },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'category_id', type: 'int', isNullable: true },
          { name: 'uploader_id', type: 'int' },
          { name: 'view_count', type: 'int', default: 0 },
          { name: 'duration', type: 'varchar', length: '20', default: "'--:--'" },
          { name: 'published_at', type: 'date' },
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
      'films',
      new TableIndex({ name: 'UQ_films_slug', columnNames: ['slug'], isUnique: true }),
    )
    await queryRunner.createForeignKey(
      'films',
      new TableForeignKey({
        name: 'FK_films_category',
        columnNames: ['category_id'],
        referencedTableName: 'categories',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    )
    await queryRunner.createForeignKey(
      'films',
      new TableForeignKey({
        name: 'FK_films_uploader',
        columnNames: ['uploader_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    )

    await queryRunner.createTable(
      new Table({
        name: 'film_links',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'film_id', type: 'int' },
          { name: 'platform', type: 'varchar', length: '20' },
          { name: 'url', type: 'varchar', length: '500' },
        ],
      }),
      true,
    )
    await queryRunner.createForeignKey(
      'film_links',
      new TableForeignKey({
        name: 'FK_film_links_film',
        columnNames: ['film_id'],
        referencedTableName: 'films',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    )

    await queryRunner.createTable(
      new Table({
        name: 'hashtags',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'name', type: 'varchar', length: '100' },
          { name: 'slug', type: 'varchar', length: '120' },
        ],
      }),
      true,
    )
    await queryRunner.createIndex(
      'hashtags',
      new TableIndex({ name: 'UQ_hashtags_slug', columnNames: ['slug'], isUnique: true }),
    )

    await queryRunner.createTable(
      new Table({
        name: 'film_hashtags',
        columns: [
          { name: 'film_id', type: 'int', isPrimary: true },
          { name: 'hashtag_id', type: 'int', isPrimary: true },
        ],
      }),
      true,
    )
    await queryRunner.createForeignKey(
      'film_hashtags',
      new TableForeignKey({
        name: 'FK_film_hashtags_film',
        columnNames: ['film_id'],
        referencedTableName: 'films',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    )
    await queryRunner.createForeignKey(
      'film_hashtags',
      new TableForeignKey({
        name: 'FK_film_hashtags_hashtag',
        columnNames: ['hashtag_id'],
        referencedTableName: 'hashtags',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('film_hashtags', true)
    await queryRunner.dropTable('hashtags', true)
    await queryRunner.dropTable('film_links', true)
    await queryRunner.dropTable('films', true)
    await queryRunner.dropTable('categories', true)
  }
}
