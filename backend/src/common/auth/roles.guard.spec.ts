import { ExecutionContext, ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { RolesGuard } from './roles.guard'
import type { AuthUser } from './auth-user'
import { FILM_WRITE_ROLES, type RoleCode } from '../../modules/users/entities/role.entity'

/**
 * RolesGuard là chốt phân quyền theo vai trò cho /users, /reports, /departments, /categories
 * và MỌI route ghi của /films (RBAC 3 cấp phẳng — ADR-045). Nếu guard này sai, Cấp 1 tạo được
 * phim và Cấp 2 đọc được báo cáo toàn công ty.
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
    const guard = guardRequiring(['employee', 'super_admin'])
    expect(guard.canActivate(contextWith(userWith('employee')))).toBe(true)
    expect(guard.canActivate(contextWith(userWith('super_admin')))).toBe(true)
  })

  it('CẤP 2 gọi route chỉ dành cho quản trị → 403 (không phải 200)', () => {
    const guard = guardRequiring(['super_admin'])
    expect(() => guard.canActivate(contextWith(userWith('employee')))).toThrow(ForbiddenException)
  })

  it('CẤP 1 bị chặn khỏi mọi route ghi phim (FILM_WRITE_ROLES)', () => {
    const guard = guardRequiring(FILM_WRITE_ROLES)
    expect(() => guard.canActivate(contextWith(userWith('viewer')))).toThrow(ForbiddenException)
    expect(guard.canActivate(contextWith(userWith('employee')))).toBe(true)
    expect(guard.canActivate(contextWith(userWith('super_admin')))).toBe(true)
  })

  it('Cấp 1/Cấp 2 KHÔNG vào được route chỉ dành riêng Cấp 3 (/users, /reports, /departments)', () => {
    const guard = guardRequiring(['super_admin'])
    expect(() => guard.canActivate(contextWith(userWith('viewer')))).toThrow(ForbiddenException)
    expect(() => guard.canActivate(contextWith(userWith('employee')))).toThrow(ForbiddenException)
  })

  it('không có req.user (guard xác thực bị bỏ qua) → từ chối, KHÔNG mặc định cho qua', () => {
    const guard = guardRequiring(['super_admin'])
    expect(() => guard.canActivate(contextWith(undefined))).toThrow(ForbiddenException)
  })

  it('vai trò lạ/giả mạo trong token → từ chối (kể cả tên vai trò cũ đã bị loại bỏ)', () => {
    const guard = guardRequiring(['super_admin'])
    // `dept_manager` là vai trò của NHÁNH 4 CẤP — ở bản này nó phải bị coi như vai trò lạ.
    for (const bad of ['root', 'admin', 'dept_manager']) {
      const fake = { id: 1, email: 'x@y.z', roleCode: bad as unknown as RoleCode }
      expect(() => guard.canActivate(contextWith(fake))).toThrow(ForbiddenException)
    }
  })
})
