import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, Index } from 'typeorm'
import { Film } from '../../films/entities/film.entity'

export type NotificationType = 'new_film' | 'updated'

/**
 * 1 sự kiện phim mới/cập nhật bản mới (01-architecture.md §4). Fan-out cho từng
 * user qua `user_notifications` (ADR mới GĐ5 — xem 05-decisions.md).
 */
@Entity({ name: 'notifications' })
export class Notification {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ name: 'film_id', type: 'int' })
  filmId!: number

  @ManyToOne(() => Film, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'film_id' })
  film?: Film

  @Column({ type: 'varchar', length: 20 })
  type!: NotificationType

  @Index('IDX_notifications_created_at')
  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date
}
