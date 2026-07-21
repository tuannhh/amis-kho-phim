import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Notification } from './entities/notification.entity'
import { UserNotification } from './entities/user-notification.entity'
import { Film } from '../films/entities/film.entity'
import { NotificationsService } from './notifications.service'
import { NotificationsController } from './notifications.controller'
import { UsersModule } from '../users/users.module'

/** Export NotificationsService để FilmsModule gọi khi phim mới/cập nhật bản mới. */
@Module({
  imports: [TypeOrmModule.forFeature([Notification, UserNotification, Film]), UsersModule],
  providers: [NotificationsService],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
