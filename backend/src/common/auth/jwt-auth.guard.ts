import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { IS_PUBLIC_KEY } from './public.decorator'
import { JWT_ALGORITHM, jwtAccessSecret } from '../config/security.config'
import type { AuthUser, JwtPayload } from './auth-user'

/**
 * Guard toàn cục: xác minh access token (Bearer). Route gắn @Public thì bỏ qua.
 * Chỉ chấp nhận token type='access' (không cho dùng refresh token gọi API thường).
 * Đây là seam để sau này thay bằng xác thực OIDC AMIS (GĐ7) mà không đụng controller.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const req = context.switchToHttp().getRequest()
    const header: string | undefined = req.headers?.authorization
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Thiếu access token')
    }
    const token = header.slice('Bearer '.length).trim()

    let payload: JwtPayload
    try {
      payload = this.jwt.verify<JwtPayload>(token, {
        secret: jwtAccessSecret(),
        // Ép cứng thuật toán — không đọc `alg` từ chính token rồi tin theo
        // (chống token khai `alg: none` / đổi thuật toán). Chuẩn MISA 02 §1.
        algorithms: [JWT_ALGORITHM],
      })
    } catch {
      throw new UnauthorizedException('Access token không hợp lệ hoặc đã hết hạn')
    }
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Sai loại token')
    }

    const user: AuthUser = { id: payload.sub, email: payload.email, roleCode: payload.role }
    req.user = user
    return true
  }
}
