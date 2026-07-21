import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
  CreateDateColumn,
} from 'typeorm'

/** Chuyên mục phim, cây cha-con (01-architecture.md §4). parent_id null = gốc. */
@Entity({ name: 'categories' })
export class Category {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ type: 'varchar', length: 150 })
  name!: string

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 190 })
  slug!: string

  @Column({ type: 'text', nullable: true })
  description!: string | null

  @Column({ name: 'parent_id', type: 'int', nullable: true })
  parentId!: number | null

  @ManyToOne(() => Category, (c) => c.children, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parent_id' })
  parent?: Category | null

  @OneToMany(() => Category, (c) => c.parent)
  children?: Category[]

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date
}
