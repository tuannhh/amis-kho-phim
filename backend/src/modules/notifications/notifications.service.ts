import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Notification, type NotificationType } from './entities/notification.entity'
import { UserNotification } from './entities/user-notification.entity'
import { Film } from '../films/entities/film.entity'
import { UsersService } from '../users/users.service'

export interface PublicNotification {
  id: number
  notificationId: number
  type: NotificationType
  filmId: number
  filmSlug: string | null
  filmTitle: string
  isRead: boolean
  createdAt: Date
}

/**
 * Sinh + đọc thông báo phim mới/cập nhật bản mới (GĐ5, 01-architecture.md §4).
 * Fan-out: 1 `notifications` (sự kiện) → N `user_notifications` (mọi user
 * đang active TRỪ chính người upload), is_read=false ban đầu.
 */
@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification) private readonly notifications: Repository<Notification>,
    @InjectRepository(UserNotification) private readonly userNotifications: Repository<UserNotification>,
    @InjectRepository(Film) private readonly films: Repository<Film>,
    private readonly usersService: UsersService,
  ) {}

  /** Gọi từ FilmsService khi phim mới published hoặc khi cập nhật bản mới. */
  async notify(filmId: number, type: NotificationType, actorId: number): Promise<void> {
    const notification = await this.notifications.save(this.notifications.create({ filmId, type }))

    const allUsers = await this.usersService.list()
    const recipients = allUsers.filter((u) => u.isActive && u.id !== actorId)
    if (!recipients.length) return

    await this.userNotifications.save(
      recipients.map((u) =>
        this.userNotifications.create({ userId: u.id, notificationId: notification.id, isRead: false }),
      ),
    )
  }

  async listForUser(userId: number): Promise<PublicNotification[]> {
    const rows = await this.userNotifications.find({
      where: { userId },
      relations: ['notification', 'notification.film'],
      order: { createdAt: 'DESC' },
      take: 50,
    })
    return rows
      .filter((r) => r.notification)
      .map((r) => ({
        id: r.id,
        notificationId: r.notificationId,
        type: r.notification!.type,
        filmId: r.notification!.filmId,
        filmSlug: r.notification!.film?.slug ?? null,
        filmTitle: r.notification!.film?.title ?? '(Phim đã bị xoá)',
        isRead: r.isRead,
        createdAt: r.createdAt,
      }))
  }

  async unreadCount(userId: number): Promise<number> {
    return this.userNotifications.count({ where: { userId, isRead: false } })
  }

  async markRead(userId: number, id: number): Promise<void> {
    const row = await this.userNotifications.findOne({ where: { id } })
    if (!row) throw new NotFoundException('Không tìm thấy thông báo')
    if (row.userId !== userId) throw new ForbiddenException('Không phải thông báo của bạn')
    if (!row.isRead) {
      row.isRead = true
      await this.userNotifications.save(row)
    }
  }

  async markAllRead(userId: number): Promise<void> {
    await this.userNotifications.update({ userId, isRead: false }, { isRead: true })
  }
}
