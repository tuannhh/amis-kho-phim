import type { DataSourceOptions } from 'typeorm'
import { User } from '../modules/users/entities/user.entity'
import { Role } from '../modules/users/entities/role.entity'
import { Category } from '../modules/categories/entities/category.entity'
import { Film } from '../modules/films/entities/film.entity'
import { FilmLink } from '../modules/films/entities/film-link.entity'
import { Hashtag } from '../modules/films/entities/hashtag.entity'
import { FilmVersion } from '../modules/films/entities/film-version.entity'
import { FilmView } from '../modules/films/entities/film-view.entity'
import { Department } from '../modules/departments/entities/department.entity'
import { Notification } from '../modules/notifications/entities/notification.entity'
import { UserNotification } from '../modules/notifications/entities/user-notification.entity'
import { UploadIntent } from '../modules/uploads/entities/upload-intent.entity'
import { FilmUrlSlug } from '../modules/films/entities/film-url-slug.entity'
import { InitAuth1721500000000 } from './migrations/1721500000000-InitAuth'
import { InitCatalog1721600000000 } from './migrations/1721600000000-InitCatalog'
import { AddFilmVersions1721700000000 } from './migrations/1721700000000-AddFilmVersions'
import { AddFilmViews1721800000000 } from './migrations/1721800000000-AddFilmViews'
import { AddNotifications1721900000000 } from './migrations/1721900000000-AddNotifications'
import { AddDepartmentsAndRbac4Levels1722000000000 } from './migrations/1722000000000-AddDepartmentsAndRbac4Levels'
import { AddDownloadCountAndTitleIndex1722100000000 } from './migrations/1722100000000-AddDownloadCountAndTitleIndex'
import { AddFilmVersionsUniqueIndex1722200000000 } from './migrations/1722200000000-AddFilmVersionsUniqueIndex'
import { AddUploadIntents1722300000000 } from './migrations/1722300000000-AddUploadIntents'
import { AddFilmUrlSlugs1722400000000 } from './migrations/1722400000000-AddFilmUrlSlugs'
import { runMigrationsOnBoot } from '../common/config/security.config'

/**
 * Cấu hình kết nối MySQL DÙNG CHUNG cho AppModule (runtime) và DataSource CLI (migration).
 * synchronize=false: chỉ tạo/đổi schema qua migration (ADR — không auto-sync).
 * migrationsRun: mặc định tự chạy migration khi khởi động (giữ hành vi cũ, Docker không cần
 * bước thủ công) — TẮT ĐƯỢC bằng `RUN_MIGRATIONS_ON_BOOT=false`, BẮT BUỘC tắt khi
 * `MULTI_REPLICA=true` (chặn ở `assertSecureConfig`, xem `security.config.ts` — Tier A/Gate-4
 * retrofit 2026-08-12, Production Compatibility Gate).
 * Đăng ký entity/migration TƯỜNG MINH (không glob) để chạy đúng cả ở dist (.js) lẫn dev (.ts).
 */
export const dbOptions: DataSourceOptions = {
  type: 'mysql',
  // Cloud Run + Cloud SQL: nối qua Unix socket (/cloudsql/PROJECT:REGION:INSTANCE, tự mount
  // khi deploy có --add-cloudsql-instances) thay vì host:port TCP. Đặt DB_SOCKET_PATH thì ưu
  // tiên dùng — không đổi hành vi Docker Compose cục bộ (không set biến này).
  ...(process.env.DB_SOCKET_PATH
    ? { socketPath: process.env.DB_SOCKET_PATH }
    : { host: process.env.DB_HOST || 'mysql', port: Number(process.env.DB_PORT || 3306) }),
  username: process.env.DB_USER || 'khophim',
  password: process.env.DB_PASSWORD || 'khophim',
  database: process.env.DB_NAME || 'kho_phim',
  charset: 'utf8mb4',
  /**
   * GĐ7 — ÉP MÚI GIỜ KẾT NỐI VỀ UTC. Bắt buộc theo chuẩn Backend MISA
   * `05-database-rules.md` §5 ("luôn lưu trữ thời gian theo UTC, không dựa vào múi giờ
   * mặc định của máy chủ").
   *
   * LỖI THẬT ĐÃ PHÁT HIỆN nhờ kiểm thử tích hợp (GĐ7): trước đây driver mysql2 dùng múi
   * giờ CỤC BỘ của tiến trình Node để chuyển đổi giá trị DATETIME. Trong Docker thì cả
   * backend lẫn MySQL đều chạy UTC nên trùng nhau và mọi thứ có vẻ đúng — nhưng khi tiến
   * trình Node chạy ở múi giờ khác (máy dev Việt Nam +07, hoặc một container cấu hình
   * TZ khác), giá trị ghi/đọc lệch đúng 7 tiếng. Hậu quả cụ thể: cửa sổ dedupe 30 phút của
   * `recordView` so sánh `viewed_at > now - 30 phút` bị lệch → cùng một người dùng bị tính
   * lượt xem nhiều lần. Lỗi này KHÔNG lộ ra trong unit test (repository bị mock) và cũng
   * không lộ ra khi chạy trong Docker — chỉ kiểm thử tích hợp thật mới bắt được.
   */
  timezone: 'Z',
  entities: [
    User,
    Role,
    Department,
    Category,
    Film,
    FilmLink,
    Hashtag,
    FilmVersion,
    FilmView,
    Notification,
    UserNotification,
    UploadIntent,
    FilmUrlSlug,
  ],
  migrations: [
    InitAuth1721500000000,
    InitCatalog1721600000000,
    AddFilmVersions1721700000000,
    AddFilmViews1721800000000,
    AddNotifications1721900000000,
    AddDepartmentsAndRbac4Levels1722000000000,
    AddDownloadCountAndTitleIndex1722100000000,
    AddFilmVersionsUniqueIndex1722200000000,
    AddUploadIntents1722300000000,
    AddFilmUrlSlugs1722400000000,
  ],
  synchronize: false,
  migrationsRun: runMigrationsOnBoot(),
}
