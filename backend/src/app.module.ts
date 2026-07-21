import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ConfigModule } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { HealthController } from './common/health.controller'
import { dbOptions } from './database/db-options'
import { DatabaseModule } from './database/database.module'
import { UsersModule } from './modules/users/users.module'
import { AuthModule } from './modules/auth/auth.module'
import { JwtAuthGuard } from './common/auth/jwt-auth.guard'
import { RolesGuard } from './common/auth/roles.guard'

/**
 * AppModule — gốc lắp ráp các module domain (kiến trúc module hoá, 01-architecture.md).
 * GĐ1: thêm Auth + Users + RBAC. Guard toàn cục: JwtAuthGuard (xác thực) chạy TRƯỚC
 * RolesGuard (phân quyền). Route công khai gắn @Public (login/refresh/health).
 */
const dbEnabled = process.env.DB_ENABLED !== 'false'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Kết nối MySQL utf8mb4 (config dùng chung với CLI migration). Tắt bằng DB_ENABLED=false.
    ...(dbEnabled
      ? [
          // retryAttempts/retryDelay là mở rộng riêng của Nest (chờ MySQL sẵn sàng lúc up).
          TypeOrmModule.forRoot({ ...dbOptions, retryAttempts: 10, retryDelay: 3000 }),
          DatabaseModule,
          UsersModule,
          AuthModule,
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
