import { ExecutionContext, ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { RolesGuard } from './roles.guard'
import type { AuthUser } from './auth-user'
import type { RoleCode } from '../../modules/users/entities/role.entity'

/**
 * GĐ7 — RolesGuard là chốt phân quyền theo vai trò cho /users và /reports.
 * Nếu guard này sai, nhân viên thường đọc được báo cáo toàn công ty và quản trị tài khoản.
 */

function contextWith(user: AuthUser | undefined): ExecutionContext {
  const req: Record<string, unknown> = user ? { user } : {}
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
  } as unknown as ExecutionContext
}

function guardRequiring(required: RoleCode[] | undefined): RolesGuard {
  const reflector = { getAllAndOverride: () => required } as unknown as Reflector
  return new RolesGuard(reflector)
}

const userWith = (roleCode: RoleCode): AuthUser => ({ id: 7, email: 'a@misa.com.vn', roleCode })

describe('RolesGuard', () => {
  it('route không gắn @Roles → chỉ cần đăng nhập là qua', () => {
    expect(guardRequiring(undefined).canActivate(contextWith(userWith('employee')))).toBe(true)
  })

  it('@Roles rỗng cũng coi như không giới hạn vai trò', () => {
    expect(guardRequiring([]).canActivate(contextWith(userWith('employee')))).toBe(true)
  })

  it('đúng vai trò → cho qua', () => {
    const guard = guardRequiring(['super_admin', 'admin'])
    expect(guard.canActivate(contextWith(userWith('admin')))).toBe(true)
    expect(guard.canActivate(contextWith(userWith('super_admin')))).toBe(true)
  })

  it('NHÂN VIÊN gọi route chỉ dành cho quản trị → 403 (không phải 200)', () => {
    const guard = guardRequiring(['super_admin', 'admin'])
    expect(() => guard.canActivate(contextWith(userWith('employee')))).toThrow(ForbiddenException)
  })

  it('admin KHÔNG vào được route chỉ dành riêng super_admin', () => {
    const guard = guardRequiring(['super_admin'])
    expect(() => guard.canActivate(contextWith(userWith('admin')))).toThrow(ForbiddenException)
  })

  it('không có req.user (guard xác thực bị bỏ qua) → từ chối, KHÔNG mặc định cho qua', () => {
    const guard = guardRequiring(['admin'])
    expect(() => guard.canActivate(contextWith(undefined))).toThrow(ForbiddenException)
  })

  it('vai trò lạ/giả mạo trong token → từ chối', () => {
    const guard = guardRequiring(['admin'])
    const fake = { id: 1, email: 'x@y.z', roleCode: 'root' as unknown as RoleCode }
    expect(() => guard.canActivate(contextWith(fake))).toThrow(ForbiddenException)
  })
})
