import type { RoleCode } from '../../modules/users/entities/role.entity'

/** Danh tính đã xác thực, gắn vào request.user sau khi JwtAuthGuard xác minh access token. */
export interface AuthUser {
  id: number
  email: string
  roleCode: RoleCode
}

/** Payload nhét trong JWT (access & refresh). sub = user id. */
export interface JwtPayload {
  sub: number
  email: string
  role: RoleCode
  type: 'access' | 'refresh'
}
