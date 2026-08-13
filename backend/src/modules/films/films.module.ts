import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Film } from './entities/film.entity'
import { FilmLink } from './entities/film-link.entity'
import { Hashtag } from './entities/hashtag.entity'
import { FilmVersion } from './entities/film-version.entity'
import { FilmView } from './entities/film-view.entity'
import { FilmUrlSlug } from './entities/film-url-slug.entity'
import { Category } from '../categories/entities/category.entity'
import { FilmsService } from './films.service'
import { FilmUrlSlugsService } from './film-url-slugs.service'
import { FilmsController } from './films.controller'
import { StorageModule } from '../storage/storage.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { UsersModule } from '../users/users.module'
import { UploadsModule } from '../uploads/uploads.module'

/**
 * UsersModule được import để `FilmsService.assertCanManage` đọc được vai trò/phòng ban THẬT
 * từ DB (scope quyền Cấp 3) thay vì tin JWT — xem ADR-043.
 *
 * `Category` đăng ký thẳng ở đây (không import `CategoriesModule`) — `FilmsService` chỉ cần
 * ĐỌC `slug` của chuyên mục để sinh URL (`categorySlugOf`), không cần các use-case ghi/cây
 * cha-con của `CategoriesService`. Đăng ký cùng entity ở nhiều module là an toàn với TypeORM
 * (cùng dùng chung DataSource, không có state hay migration nào bị nhân đôi).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Film, FilmLink, Hashtag, FilmVersion, FilmView, FilmUrlSlug, Category]),
    StorageModule,
    NotificationsModule,
    UsersModule,
    UploadsModule,
  ],
  providers: [FilmsService, FilmUrlSlugsService],
  controllers: [FilmsController],
})
export class FilmsModule {}
