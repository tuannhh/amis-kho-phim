import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ROLES_KEY } from './roles.decorator'
import type { AuthUser } from './auth-user'
import type { RoleCode } from '../../modules/users/entities/role.entity'

/**
 * Chặn theo vai trò dựa trên @Roles. Chạy SAU JwtAuthGuard (đã có req.user).
 * Không có @Roles → cho qua (chỉ cần đăng nhập). OwnerGuard/kiểm chủ sở hữu
 * xử lý ở tầng service (nhân viên chỉ tác động resource của mình).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<RoleCode[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (!required || required.length === 0) return true

    const req = context.switchToHttp().getRequest()
    const user = req.user as AuthUser | undefined
    if (!user || !required.includes(user.roleCode)) {
      throw new ForbiddenException('Bạn không có quyền thực hiện thao tác này')
    }
    return true
  }
}
