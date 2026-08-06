import { SetMetadata } from '@nestjs/common'
import type { RoleCode } from '../../modules/users/entities/role.entity'

/** Giới hạn route theo vai trò. VD: @Roles('employee', 'super_admin'). RolesGuard đọc metadata này. */
export const ROLES_KEY = 'roles'
export const Roles = (...roles: RoleCode[]) => SetMetadata(ROLES_KEY, roles)
