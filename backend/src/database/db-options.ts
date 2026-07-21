import type { DataSourceOptions } from 'typeorm'
import { User } from '../modules/users/entities/user.entity'
import { Role } from '../modules/users/entities/role.entity'
import { Category } from '../modules/categories/entities/category.entity'
import { Film } from '../modules/films/entities/film.entity'
import { FilmLink } from '../modules/films/entities/film-link.entity'
import { Hashtag } from '../modules/films/entities/hashtag.entity'
import { FilmVersion } from '../modules/films/entities/film-version.entity'
import { FilmView } from '../modules/films/entities/film-view.entity'
import { Notification } from '../modules/notifications/entities/notification.entity'
import { UserNotification } from '../modules/notifications/entities/user-notification.entity'
import { InitAuth1721500000000 } from './migrations/1721500000000-InitAuth'
import { InitCatalog1721600000000 } from './migrations/1721600000000-InitCatalog'
import { AddFilmVersions1721700000000 } from './migrations/1721700000000-AddFilmVersions'
import { AddFilmViews1721800000000 } from './migrations/1721800000000-AddFilmViews'
import { AddNotifications1721900000000 } from './migrations/1721900000000-AddNotifications'

/**
 * Cấu hình kết nối MySQL DÙNG CHUNG cho AppModule (runtime) và DataSource CLI (migration).
 * synchronize=false: chỉ tạo/đổi schema qua migration (ADR — không auto-sync).
 * migrationsRun=true: tự chạy migration khi khởi động → Docker không cần bước thủ công.
 * Đăng ký entity/migration TƯỜNG MINH (không glob) để chạy đúng cả ở dist (.js) lẫn dev (.ts).
 */
export const dbOptions: DataSourceOptions = {
  type: 'mysql',
  host: process.env.DB_HOST || 'mysql',
  port: Number(process.env.DB_PORT || 3306),
  username: process.env.DB_USER || 'khophim',
  password: process.env.DB_PASSWORD || 'khophim',
  database: process.env.DB_NAME || 'kho_phim',
  charset: 'utf8mb4',
  entities: [User, Role, Category, Film, FilmLink, Hashtag, FilmVersion, FilmView, Notification, UserNotification],
  migrations: [
    InitAuth1721500000000,
    InitCatalog1721600000000,
    AddFilmVersions1721700000000,
    AddFilmViews1721800000000,
    AddNotifications1721900000000,
  ],
  synchronize: false,
  migrationsRun: true,
}
