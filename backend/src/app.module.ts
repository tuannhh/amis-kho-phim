import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { HealthController } from './common/health.controller'

/**
 * AppModule — gốc lắp ráp các module domain.
 * Kiến trúc module hoá (xem memory-bank/01-architecture.md):
 * mỗi domain (auth, users, rbac, categories, films, film-links, hashtags,
 * storage, thumbnails, notifications, search) là 1 module độc lập, thêm dần
 * theo từng giai đoạn (roadmap). GĐ 0 mới có ConfigModule + kết nối DB + health.
 */
const dbEnabled = process.env.DB_ENABLED !== 'false'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Kết nối MySQL utf8mb4. Tắt bằng DB_ENABLED=false để chạy skeleton không cần DB.
    ...(dbEnabled
      ? [
          TypeOrmModule.forRoot({
            type: 'mysql',
            host: process.env.DB_HOST || 'mysql',
            port: Number(process.env.DB_PORT || 3306),
            username: process.env.DB_USER || 'khophim',
            password: process.env.DB_PASSWORD || 'khophim',
            database: process.env.DB_NAME || 'kho_phim',
            charset: 'utf8mb4',
            autoLoadEntities: true,
            synchronize: false, // dùng migration, không auto-sync
            retryAttempts: 10,
            retryDelay: 3000,
          }),
        ]
      : []),
    // TODO GĐ1+: AuthModule, UsersModule, RbacModule, CategoriesModule, FilmsModule, ...
  ],
  controllers: [HealthController],
})
export class AppModule {}
