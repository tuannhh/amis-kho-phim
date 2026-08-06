import { describe, it, expect } from 'vitest'
import {
  ROLE_LABEL,
  ROLE_LEVEL,
  FILM_WRITE_ROLES,
  ADMIN_ROLES,
  canCreateFilm,
  canManageFilm,
  canWriteCategory,
  canCreateAnyCategory,
  isAtLeastLevel,
  isSystemAdmin,
  type FilmOwnership,
} from './permissions'
import type { AuthUser, UserRole } from './authStore'

/**
 * `canManageFilm` là BẢN SAO logic `FilmsService.assertCanManage` của backend. Nếu hai bên lệch
 * nhau, người dùng sẽ thấy nút rồi bấm vào nhận 403 (hoặc mất nút dù có quyền) — nên bộ test
 * này phủ ĐỦ 4 cấp × các tổ hợp phòng ban, đúng thứ tự ưu tiên theo rủi ro của quy chuẩn.
 *
 * Lưu ý: đây KHÔNG phải test bảo mật. Chốt chặn thật nằm ở backend và đã có bộ e2e riêng
 * chứng minh backend tự trả 403 dù FE có gọi thẳng API.
 */

const DEPT_A = 1
const DEPT_B = 2

const user = (id: number, roleCode: UserRole, departmentId: number | null = null): AuthUser => ({
  id,
  email: `u${id}@misa.com.vn`,
  fullName: `U${id}`,
  roleCode,
  departmentId,
  createdBy: null,
  isActive: true,
  mustChangePassword: false,
  createdAt: '2026-01-01T00:00:00.000Z',
})

const film = (
  uploaderId: number,
  departmentId: number | null,
  uploaderRoleCode: UserRole | null,
): FilmOwnership => ({ uploaderId, departmentId, uploaderRoleCode })

describe('Bảng vai trò 4 cấp', () => {
  it('đúng 4 cấp, không còn vai trò `admin` cũ', () => {
    expect(Object.keys(ROLE_LEVEL).sort()).toEqual(['dept_manager', 'employee', 'super_admin', 'viewer'])
    expect(Object.keys(ROLE_LABEL)).not.toContain('admin')
  })

  it('thứ tự cấp tăng dần đúng nghiệp vụ', () => {
    expect(ROLE_LEVEL.viewer).toBeLessThan(ROLE_LEVEL.employee)
    expect(ROLE_LEVEL.employee).toBeLessThan(ROLE_LEVEL.dept_manager)
    expect(ROLE_LEVEL.dept_manager).toBeLessThan(ROLE_LEVEL.super_admin)
  })

  it('FILM_WRITE_ROLES là Cấp 2 trở lên; ADMIN_ROLES chỉ Cấp 4', () => {
    expect(FILM_WRITE_ROLES).toEqual(['employee', 'dept_manager', 'super_admin'])
    expect(ADMIN_ROLES).toEqual(['super_admin'])
  })

  it('isAtLeastLevel xử lý đúng cả khi chưa đăng nhập (null)', () => {
    expect(isAtLeastLevel(null, 1)).toBe(false)
    expect(isAtLeastLevel('viewer', 1)).toBe(true)
    expect(isAtLeastLevel('viewer', 2)).toBe(false)
    expect(isAtLeastLevel('dept_manager', 3)).toBe(true)
    expect(isAtLeastLevel('dept_manager', 4)).toBe(false)
  })
})

describe('canCreateFilm — ai thấy nút "Thêm phim"', () => {
  it('Cấp 1 KHÔNG thấy; Cấp 2/3/4 thấy', () => {
    expect(canCreateFilm('viewer')).toBe(false)
    expect(canCreateFilm('employee')).toBe(true)
    expect(canCreateFilm('dept_manager')).toBe(true)
    expect(canCreateFilm('super_admin')).toBe(true)
  })
  it('chưa đăng nhập → false', () => {
    expect(canCreateFilm(null)).toBe(false)
  })
})

describe('isSystemAdmin — ai thấy menu quản trị', () => {
  it('chỉ Cấp 4', () => {
    expect(isSystemAdmin('super_admin')).toBe(true)
    for (const r of ['viewer', 'employee', 'dept_manager'] as UserRole[]) {
      expect(isSystemAdmin(r)).toBe(false)
    }
  })
})

describe('canManageFilm — ẩn/hiện nút Sửa/Xoá theo scope phòng ban', () => {
  it('thiếu dữ liệu (chưa đăng nhập hoặc chưa tải phim) → false, không mặc định cho phép', () => {
    expect(canManageFilm(null, film(1, DEPT_A, 'employee'))).toBe(false)
    expect(canManageFilm(user(1, 'super_admin'), null)).toBe(false)
  })

  it('CẤP 1 không quản được phim nào, kể cả phim mình từng tạo', () => {
    expect(canManageFilm(user(5, 'viewer'), film(5, null, 'viewer'))).toBe(false)
    expect(canManageFilm(user(5, 'viewer'), film(9, DEPT_A, 'employee'))).toBe(false)
  })

  it('CẤP 2 chỉ quản phim của chính mình', () => {
    const emp = user(10, 'employee', DEPT_A)
    expect(canManageFilm(emp, film(10, DEPT_A, 'employee'))).toBe(true)
    // Cùng phòng ban nhưng của người khác → KHÔNG.
    expect(canManageFilm(emp, film(11, DEPT_A, 'employee'))).toBe(false)
  })

  it('CẤP 3 quản phim của Cấp 2 CÙNG phòng ban', () => {
    const mgr = user(20, 'dept_manager', DEPT_A)
    expect(canManageFilm(mgr, film(10, DEPT_A, 'employee'))).toBe(true)
  })

  it('CẤP 3 KHÔNG quản phim phòng ban khác', () => {
    const mgr = user(20, 'dept_manager', DEPT_A)
    expect(canManageFilm(mgr, film(30, DEPT_B, 'employee'))).toBe(false)
  })

  it('CẤP 3 KHÔNG quản phim của Cấp 3 khác hay Cấp 4, dù cùng phòng ban', () => {
    const mgr = user(20, 'dept_manager', DEPT_A)
    expect(canManageFilm(mgr, film(21, DEPT_A, 'dept_manager'))).toBe(false)
    expect(canManageFilm(mgr, film(40, DEPT_A, 'super_admin'))).toBe(false)
  })

  it('CẤP 3 vẫn quản phim của chính mình (kế thừa quyền Cấp 2)', () => {
    const mgr = user(20, 'dept_manager', DEPT_A)
    expect(canManageFilm(mgr, film(20, DEPT_A, 'dept_manager'))).toBe(true)
  })

  it('phòng ban null KHÔNG được coi là trùng null', () => {
    const mgrNoDept = user(20, 'dept_manager', null)
    expect(canManageFilm(mgrNoDept, film(10, null, 'employee'))).toBe(false)
    const mgr = user(20, 'dept_manager', DEPT_A)
    expect(canManageFilm(mgr, film(10, null, 'employee'))).toBe(false)
  })

  it('vai trò người tạo chưa biết (null) → Cấp 3 không quản được', () => {
    const mgr = user(20, 'dept_manager', DEPT_A)
    expect(canManageFilm(mgr, film(10, DEPT_A, null))).toBe(false)
  })

  it('CẤP 4 quản được mọi phim, mọi phòng ban', () => {
    const sa = user(40, 'super_admin', null)
    for (const f of [
      film(10, DEPT_A, 'employee'),
      film(30, DEPT_B, 'employee'),
      film(21, DEPT_A, 'dept_manager'),
      film(10, null, 'employee'),
    ]) {
      expect(canManageFilm(sa, f)).toBe(true)
    }
  })
})

/**
 * Quyền ghi chuyên mục theo TẦNG (ADR-051) — bản sao FE của `CategoriesService.assertCanWrite`.
 * Hai bên lệch nhau là người dùng thấy nút rồi bấm vào ăn 403, hoặc mất nút dù có quyền.
 */
describe('canWriteCategory — chuyên mục gốc vs chuyên mục con', () => {
  const ROLES = ['viewer', 'employee', 'dept_manager', 'super_admin'] as const

  it('chuyên mục GỐC: chỉ Cấp 4', () => {
    const allowed = ROLES.filter((r) => canWriteCategory(r, true))
    expect(allowed).toEqual(['super_admin'])
  })

  it('chuyên mục CON: Cấp 2 trở lên, Cấp 1 không', () => {
    const allowed = ROLES.filter((r) => canWriteCategory(r, false))
    expect(allowed).toEqual(['employee', 'dept_manager', 'super_admin'])
  })

  it('chưa đăng nhập (null) thì không ghi được gì', () => {
    expect(canWriteCategory(null, true)).toBe(false)
    expect(canWriteCategory(null, false)).toBe(false)
  })
})

describe('canCreateAnyCategory — hiện nút "Thêm chuyên mục"', () => {
  it('Cấp 2 trở lên thấy nút; Cấp 1 và khách không', () => {
    expect(canCreateAnyCategory('viewer')).toBe(false)
    expect(canCreateAnyCategory('employee')).toBe(true)
    expect(canCreateAnyCategory('dept_manager')).toBe(true)
    expect(canCreateAnyCategory('super_admin')).toBe(true)
    expect(canCreateAnyCategory(null)).toBe(false)
  })
})
