import type { DataSourceOptions } from 'typeorm'
import { User } from '../modules/users/entities/user.entity'
import { Role } from '../modules/users/entities/role.entity'
import { InitAuth1721500000000 } from './migrations/1721500000000-InitAuth'

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
  entities: [User, Role],
  migrations: [InitAuth1721500000000],
  synchronize: false,
  migrationsRun: true,
}
