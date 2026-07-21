import { Controller, Get, Param, ParseIntPipe, Patch } from '@nestjs/common'
import { NotificationsService } from './notifications.service'
import { CurrentUser } from '../../common/auth/current-user.decorator'
import type { AuthUser } from '../../common/auth/auth-user'

/** Ai đăng nhập cũng xem được thông báo CỦA CHÍNH MÌNH (không cần @Roles). */
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() actor: AuthUser) {
    return this.notifications.listForUser(actor.id)
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() actor: AuthUser) {
    return { count: await this.notifications.unreadCount(actor.id) }
  }

  @Patch(':id/read')
  async markRead(@CurrentUser() actor: AuthUser, @Param('id', ParseIntPipe) id: number) {
    await this.notifications.markRead(actor.id, id)
    return { ok: true }
  }

  @Patch('read-all')
  async markAllRead(@CurrentUser() actor: AuthUser) {
    await this.notifications.markAllRead(actor.id)
    return { ok: true }
  }
}
