import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, Index } from 'typeorm'
import { User } from '../../users/entities/user.entity'
import { Notification } from './notification.entity'

/** Trạng thái đã đọc của 1 user với 1 notification (01-architecture.md §4). */
@Entity({ name: 'user_notifications' })
@Index('IDX_user_notifications_user', ['userId', 'isRead'])
export class UserNotification {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ name: 'user_id', type: 'int' })
  userId!: number

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User

  @Column({ name: 'notification_id', type: 'int' })
  notificationId!: number

  @ManyToOne(() => Notification, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'notification_id' })
  notification?: Notification

  @Column({ name: 'is_read', type: 'boolean', default: false })
  isRead!: boolean

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date
}
