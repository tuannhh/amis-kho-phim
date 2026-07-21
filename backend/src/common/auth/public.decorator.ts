import { SetMetadata } from '@nestjs/common'

/** Đánh dấu route KHÔNG cần đăng nhập (bỏ qua JwtAuthGuard toàn cục). VD: login, health. */
export const IS_PUBLIC_KEY = 'isPublic'
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)
