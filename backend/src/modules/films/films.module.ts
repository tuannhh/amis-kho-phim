import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Film } from './entities/film.entity'
import { FilmLink } from './entities/film-link.entity'
import { Hashtag } from './entities/hashtag.entity'
import { FilmVersion } from './entities/film-version.entity'
import { FilmView } from './entities/film-view.entity'
import { FilmsService } from './films.service'
import { FilmsController } from './films.controller'
import { StorageModule } from '../storage/storage.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { UsersModule } from '../users/users.module'
import { UploadsModule } from '../uploads/uploads.module'

/**
 * UsersModule được import để `FilmsService.assertCanManage` đọc được vai trò/phòng ban THẬT
 * từ DB (scope quyền Cấp 3) thay vì tin JWT — xem ADR-043.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Film, FilmLink, Hashtag, FilmVersion, FilmView]),
    StorageModule,
    NotificationsModule,
    UsersModule,
    UploadsModule,
  ],
  providers: [FilmsService],
  controllers: [FilmsController],
})
export class FilmsModule {}
