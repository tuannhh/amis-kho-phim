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
import { FilmVersion } from './film-version.entity'

/**
 * Metadata phim (01-architecture.md §4). Storage/thumbnail thật (MinIO) nằm ở
 * `film_versions` (GĐ3): bản mới nhất giữ storage_key/thumbnail_key/duration.
 * Cột `duration` ở đây là fallback khi phim chưa có version nào.
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

  /**
   * SNAPSHOT phòng ban của người tạo TẠI THỜI ĐIỂM tạo phim (ADR-046) — KHÔNG join động
   * qua `uploader.departmentId`: uploader có thể chuyển phòng ban sau này, phim vẫn phải
   * giữ đúng ngữ cảnh phòng ban lúc được tạo.
   * Ở bản RBAC 3 CẤP PHẲNG cột này thuần TRUY VẾT/báo cáo, KHÔNG tham gia kiểm quyền.
   * Nullable: phim cũ trước migration, hoặc người tạo chưa được gán phòng ban.
   */
  @Column({ name: 'department_id', type: 'int', nullable: true })
  departmentId!: number | null

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

  @OneToMany(() => FilmVersion, (v) => v.film)
  versions?: FilmVersion[]
}
