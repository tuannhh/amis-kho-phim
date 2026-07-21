import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
} from 'typeorm'
import { Film } from './film.entity'
import { User } from '../../users/entities/user.entity'

/**
 * Lịch sử bản phim (01-architecture.md §4, ADR-005). Mỗi lần upload file/ảnh bìa
 * mới tạo 1 version_no tăng dần; `films` trỏ bản mới nhất (version_no lớn nhất).
 * storage_key/thumbnail_key là key trong MinIO (server sinh, không nhận từ client).
 */
@Entity({ name: 'film_versions' })
@Index('IDX_film_versions_film', ['filmId'])
export class FilmVersion {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ name: 'film_id', type: 'int' })
  filmId!: number

  @ManyToOne(() => Film, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'film_id' })
  film?: Film

  @Column({ name: 'version_no', type: 'int' })
  versionNo!: number

  @Column({ name: 'storage_key', type: 'varchar', length: 200, nullable: true })
  storageKey!: string | null

  @Column({ name: 'file_size', type: 'bigint', nullable: true })
  fileSize!: string | null

  @Column({ type: 'varchar', length: 20, nullable: true })
  duration!: string | null

  @Column({ name: 'thumbnail_key', type: 'varchar', length: 200, nullable: true })
  thumbnailKey!: string | null

  @Column({ type: 'varchar', length: 255, nullable: true })
  note!: string | null

  @Column({ name: 'created_by', type: 'int', nullable: true })
  createdBy!: number | null

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  creator?: User | null

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date
}
