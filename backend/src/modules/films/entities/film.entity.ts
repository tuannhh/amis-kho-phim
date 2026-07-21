import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  ManyToMany,
  OneToMany,
  JoinColumn,
  JoinTable,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm'
import { Category } from '../../categories/entities/category.entity'
import { User } from '../../users/entities/user.entity'
import { FilmLink } from './film-link.entity'
import { Hashtag } from './hashtag.entity'

/**
 * Metadata phim (01-architecture.md §4). GĐ2: chưa có storage/thumbnail thật
 * (MinIO) — đó là GĐ3. `duration` là placeholder cho tới khi có probing thật.
 */
@Entity({ name: 'films' })
export class Film {
  @PrimaryGeneratedColumn()
  id!: number

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 220 })
  slug!: string

  @Column({ type: 'varchar', length: 255 })
  title!: string

  @Column({ type: 'text', nullable: true })
  description!: string | null

  @Column({ name: 'category_id', type: 'int', nullable: true })
  categoryId!: number | null

  @ManyToOne(() => Category, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'category_id' })
  category?: Category | null

  @Column({ name: 'uploader_id', type: 'int' })
  uploaderId!: number

  @ManyToOne(() => User)
  @JoinColumn({ name: 'uploader_id' })
  uploader?: User

  @Column({ name: 'view_count', type: 'int', default: 0 })
  viewCount!: number

  @Column({ type: 'varchar', length: 20, default: '--:--' })
  duration!: string

  @Column({ name: 'published_at', type: 'date' })
  publishedAt!: string

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date

  @OneToMany(() => FilmLink, (l) => l.film)
  links?: FilmLink[]

  @ManyToMany(() => Hashtag)
  @JoinTable({
    name: 'film_hashtags',
    joinColumn: { name: 'film_id' },
    inverseJoinColumn: { name: 'hashtag_id' },
  })
  hashtags?: Hashtag[]
}
