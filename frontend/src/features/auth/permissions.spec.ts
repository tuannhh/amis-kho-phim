import { describe, it, expect } from 'vitest'
import {
  ROLE_LABEL,
  ROLE_LEVEL,
  FILM_WRITE_ROLES,
  ADMIN_ROLES,
  canCreateFilm,
  canManageFilm,
  isAtLeastLevel,
  isSystemAdmin,
  type FilmOwnership,
} from './permissions'
import type { AuthUser, UserRole } from './authStore'

/**
 * `canManageFilm` là BẢN SAO logic `FilmsService.assertCanManage` của backend. Nếu hai bên lệch
 * nhau, người dùng sẽ thấy nút rồi bấm vào nhận 403 (hoặc mất nút dù có quyền) — nên bộ test
 * này phủ ĐỦ 3 cấp, kèm ca chứng minh phòng ban KHÔNG còn ảnh hưởng kết quả.
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

const film = (uploaderId: number): FilmOwnership => ({ uploaderId })

describe('Bảng vai trò 3 cấp phẳng', () => {
  it('đúng 3 cấp, không còn `admin` cũ lẫn `dept_manager` của nhánh 4 cấp', () => {
    expect(Object.keys(ROLE_LEVEL).sort()).toEqual(['employee', 'super_admin', 'viewer'])
    expect(Object.keys(ROLE_LABEL)).not.toContain('admin')
    expect(Object.keys(ROLE_LABEL)).not.toContain('dept_manager')
  })

  it('thứ tự cấp tăng dần đúng nghiệp vụ', () => {
    expect(ROLE_LEVEL.viewer).toBeLessThan(ROLE_LEVEL.employee)
    expect(ROLE_LEVEL.employee).toBeLessThan(ROLE_LEVEL.super_admin)
  })

  it('FILM_WRITE_ROLES là Cấp 2 trở lên; ADMIN_ROLES chỉ Cấp 3', () => {
    expect(FILM_WRITE_ROLES).toEqual(['employee', 'super_admin'])
    expect(ADMIN_ROLES).toEqual(['super_admin'])
  })

  it('isAtLeastLevel xử lý đúng cả khi chưa đăng nhập (null)', () => {
    expect(isAtLeastLevel(null, 1)).toBe(false)
    expect(isAtLeastLevel('viewer', 1)).toBe(true)
    expect(isAtLeastLevel('viewer', 2)).toBe(false)
    expect(isAtLeastLevel('employee', 2)).toBe(true)
    expect(isAtLeastLevel('employee', 3)).toBe(false)
    expect(isAtLeastLevel('super_admin', 3)).toBe(true)
  })
})

describe('canCreateFilm — ai thấy nút "Thêm phim"', () => {
  it('Cấp 1 KHÔNG thấy; Cấp 2/Cấp 3 thấy', () => {
    expect(canCreateFilm('viewer')).toBe(false)
    expect(canCreateFilm('employee')).toBe(true)
    expect(canCreateFilm('super_admin')).toBe(true)
  })
  it('chưa đăng nhập → false', () => {
    expect(canCreateFilm(null)).toBe(false)
  })
})

describe('isSystemAdmin — ai thấy menu quản trị', () => {
  it('chỉ Cấp 3', () => {
    expect(isSystemAdmin('super_admin')).toBe(true)
    for (const r of ['viewer', 'employee'] as UserRole[]) {
      expect(isSystemAdmin(r)).toBe(false)
    }
  })
})

describe('canManageFilm — ẩn/hiện nút Sửa/Xoá (3 cấp phẳng: chính chủ HOẶC Cấp 3)', () => {
  it('thiếu dữ liệu (chưa đăng nhập hoặc chưa tải phim) → false, không mặc định cho phép', () => {
    expect(canManageFilm(null, film(1))).toBe(false)
    expect(canManageFilm(user(1, 'super_admin'), null)).toBe(false)
  })

  it('CẤP 1 không quản được phim nào, kể cả phim mang uploaderId của chính mình', () => {
    expect(canManageFilm(user(5, 'viewer'), film(5))).toBe(false)
    expect(canManageFilm(user(5, 'viewer'), film(9))).toBe(false)
  })

  it('CẤP 2 chỉ quản phim của chính mình', () => {
    const emp = user(10, 'employee', DEPT_A)
    expect(canManageFilm(emp, film(10))).toBe(true)
    expect(canManageFilm(emp, film(11))).toBe(false)
  })

  it('CẤP 3 quản được MỌI phim, của bất kỳ ai', () => {
    const sa = user(40, 'super_admin', null)
    for (const uploaderId of [10, 30, 21, 40]) {
      expect(canManageFilm(sa, film(uploaderId))).toBe(true)
    }
  })

  it('PHẲNG: phòng ban của actor KHÔNG làm đổi kết quả ở bất kỳ cấp nào', () => {
    // Cấp 3 dù thuộc phòng B vẫn quản được phim của người phòng A.
    expect(canManageFilm(user(40, 'super_admin', DEPT_B), film(10))).toBe(true)
    // Cấp 2 dù đổi phòng ban thế nào cũng chỉ quản phim của chính mình.
    for (const dept of [DEPT_A, DEPT_B, null]) {
      expect(canManageFilm(user(10, 'employee', dept), film(10))).toBe(true)
      expect(canManageFilm(user(10, 'employee', dept), film(11))).toBe(false)
    }
  })
})
