import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ConfigModule } from '@nestjs/config'
import { ThrottlerModule } from '@nestjs/throttler'
import { TypeOrmModule } from '@nestjs/typeorm'
import { HealthController } from './common/health.controller'
import { dbOptions } from './database/db-options'
import { DatabaseModule } from './database/database.module'
import { UsersModule } from './modules/users/users.module'
import { AuthModule } from './modules/auth/auth.module'
import { CategoriesModule } from './modules/categories/categories.module'
import { DepartmentsModule } from './modules/departments/departments.module'
import { FilmsModule } from './modules/films/films.module'
import { NotificationsModule } from './modules/notifications/notifications.module'
import { ReportsModule } from './modules/reports/reports.module'
import { JwtAuthGuard } from './common/auth/jwt-auth.guard'
import { RolesGuard } from './common/auth/roles.guard'

/**
 * AppModule — gốc lắp ráp các module domain (kiến trúc module hoá, 01-architecture.md).
 * GĐ1: Auth + Users + RBAC. GĐ2: Categories + Films (metadata). Guard toàn cục:
 * JwtAuthGuard (xác thực) chạy TRƯỚC RolesGuard (phân quyền). Route công khai gắn @Public.
 */
const dbEnabled = process.env.DB_ENABLED !== 'false'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // GĐ7 — hạ tầng rate limit. CỐ Ý KHÔNG đăng ký ThrottlerGuard toàn cục: route
    // /media/:key phát video sinh rất nhiều request Range khi tua, giới hạn toàn cục
    // sẽ làm gãy trình phát. Chỉ AuthController bật guard này (chống dò mật khẩu).
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 60 }]),
    // Kết nối MySQL utf8mb4 (config dùng chung với CLI migration). Tắt bằng DB_ENABLED=false.
    ...(dbEnabled
      ? [
          // retryAttempts/retryDelay là mở rộng riêng của Nest (chờ MySQL sẵn sàng lúc up).
          TypeOrmModule.forRoot({ ...dbOptions, retryAttempts: 10, retryDelay: 3000 }),
          DatabaseModule,
          DepartmentsModule,
          UsersModule,
          AuthModule,
          CategoriesModule,
          FilmsModule,
          NotificationsModule,
          ReportsModule,
        ]
      : []),
  ],
  controllers: [HealthController],
  providers: dbEnabled
    ? [
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ]
    : [],
})
export class AppModule {}
