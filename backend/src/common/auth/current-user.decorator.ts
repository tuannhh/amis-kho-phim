import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import type { AuthUser } from './auth-user'

/** Lấy user đã xác thực từ request. VD: myProfile(@CurrentUser() user: AuthUser). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx.switchToHttp().getRequest()
    return req.user as AuthUser
  },
)
