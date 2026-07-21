import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { UsersModule } from '../users/users.module'
import { AuthService } from './auth.service'
import { AuthController } from './auth.controller'

/**
 * AuthModule: login/refresh/me/change-password + cấp JWT.
 * JwtModule đăng ký global để JwtAuthGuard toàn cục dùng JwtService verify được.
 */
@Module({
  imports: [UsersModule, JwtModule.register({ global: true })],
  providers: [AuthService],
  controllers: [AuthController],
})
export class AuthModule {}
