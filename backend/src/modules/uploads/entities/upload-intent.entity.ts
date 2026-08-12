import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index, CreateDateColumn } from 'typeorm'
import { Film } from '../../films/entities/film.entity'
import { User } from '../../users/entities/user.entity'

/** Loại object đang chờ upload — khớp 2 luồng presigned PUT hiện có (video/ảnh bìa). */
export type UploadIntentKind = 'video' | 'thumbnail'

/**
 * `pending`  — đã ký URL, FE chưa gọi `confirmVersion` xác nhận xong (hoặc đang upload dở).
 * `consumed` — đã được `confirmVersion` dùng để tạo `film_versions` (thành công, có chủ).
 * `cleaning` — worker đã reserve object quá hạn để dọn; không request confirm nào được lấy lại.
 * `expired`  — quá hạn mà chưa consume; object trên MinIO (nếu có) đã bị dọn bởi
 *              `UploadIntentsService.sweepExpired`.
 */
export type UploadIntentStatus = 'pending' | 'cleaning' | 'consumed' | 'expired'

/**
 * Ghi lại CHỦ SỞ HỮU của mỗi presigned upload URL đã ký — Tier A retrofit (2026-08-12,
 * Production Compatibility Gate mục "Upload/object ownership").
 *
 * VẤN ĐỀ TRƯỚC ĐÂY: `createUploadUrl`/`createThumbnailUploadUrl` ký URL rồi KHÔNG lưu vết gì
 * ở DB — key sinh ra (`video-<uuid>.mp4`) chỉ tồn tại trong response trả về FE. Nếu FE ký URL
 * xong nhưng không bao giờ gọi `confirmVersion` (đóng tab, mất mạng, người dùng đổi ý), object
 * có thể đã được PUT lên MinIO nhưng KHÔNG CÓ BẢN GHI NÀO trong hệ thống biết nó tồn tại, ai
 * tạo ra, cho phim nào — rác tích luỹ vô thời hạn, không cách nào dọn có chủ đích ngoài quét
 * thủ công toàn bộ bucket.
 *
 * Bảng này biến mỗi lần ký URL thành MỘT BẢN GHI CÓ CHỦ (actor/film/type/TTL/trạng thái), để:
 *  1. `confirmVersion` đánh dấu `consumed` khi dùng key đó tạo version thật.
 *  2. `sweepExpired` xoá object mồ côi quá hạn chưa consume — dọn rác có chủ đích thay vì để
 *     tích luỹ, và biết CHÍNH XÁC ai/khi nào đã xin ký URL đó (audit trail).
 */
@Entity({ name: 'upload_intents' })
@Index('IDX_upload_intents_status_expires', ['status', 'expiresAt'])
export class UploadIntent {
  @PrimaryGeneratedColumn()
  id!: number

  /** Key sinh server-side lúc ký URL (`video-<uuid>.mp4` / `thumb-<uuid>.jpg`) — duy nhất. */
  @Index({ unique: true })
  @Column({ name: 'storage_key', type: 'varchar', length: 200 })
  storageKey!: string

  @Column({ type: 'varchar', length: 20 })
  kind!: UploadIntentKind

  @Column({ name: 'film_id', type: 'int' })
  filmId!: number

  @ManyToOne(() => Film, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'film_id' })
  film?: Film

  /** Người xin ký URL (từ `actor.id` ở tầng service — KHÔNG nhận từ client). */
  @Column({ name: 'actor_id', type: 'int', nullable: true })
  actorId!: number | null

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'actor_id' })
  actor?: User | null

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: UploadIntentStatus

  /** Hết hạn = thời điểm presigned URL hết hiệu lực (khớp `expiresIn` lúc ký). */
  @Column({ name: 'expires_at', type: 'datetime', precision: 6 })
  expiresAt!: Date

  @Column({ name: 'consumed_at', type: 'datetime', precision: 6, nullable: true })
  consumedAt!: Date | null

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date
}
