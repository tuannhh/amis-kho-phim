import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index, CreateDateColumn } from 'typeorm'
import { Film } from './film.entity'
import { User } from '../../users/entities/user.entity'

/**
 * Đếm lượt xem (01-architecture.md §4, ADR-023). Mỗi lần vào trang xem phim ghi
 * 1 dòng (nếu không trùng cửa sổ dedupe) rồi tăng `films.view_count` atomic.
 * `userId` là khoá dedupe chính (mọi người dùng đều đã đăng nhập — ADR-023).
 * `sessionHash` là cột dự phòng cho tương lai (khách ẩn danh/nhiều thiết bị),
 * không dùng trong logic dedupe hiện tại.
 */
@Entity({ name: 'film_views' })
@Index('IDX_film_views_film_user', ['filmId', 'userId'])
export class FilmView {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ name: 'film_id', type: 'int' })
  filmId!: number

  @ManyToOne(() => Film, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'film_id' })
  film?: Film

  @Column({ name: 'user_id', type: 'int', nullable: true })
  userId!: number | null

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user?: User | null

  @Column({ name: 'session_hash', type: 'varchar', length: 64 })
  sessionHash!: string

  @CreateDateColumn({ name: 'viewed_at' })
  viewedAt!: Date
}
