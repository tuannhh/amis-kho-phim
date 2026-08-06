import { apiFetch } from '@/lib/http'
import type { UserRole } from '@/features/auth/authStore'

/** Người dùng trả từ API (khớp PublicUser của backend — KHÔNG có password_hash). */
export interface ApiUser {
  id: number
  email: string
  fullName: string
  roleCode: UserRole
  /** Phòng ban (null = chưa gán) — thuần truy vết, KHÔNG ảnh hưởng quyền (ADR-046). */
  departmentId: number | null
  createdBy: number | null
  isActive: boolean
  mustChangePassword: boolean
  createdAt: string
}

/** Vai trò API cho phép GÁN — không ai gán được `super_admin` (chốt chặn giữ từ GĐ1). */
export type AssignableRole = Exclude<UserRole, 'super_admin'>

export interface CreateUserPayload {
  email: string
  fullName: string
  roleCode: AssignableRole
  /** Bỏ trống = chưa gán phòng ban. */
  departmentId?: number
  password?: string
}

/** Sửa tài khoản: thiếu trường = không đổi; `departmentId: null` = bỏ gán phòng ban. */
export interface UpdateUserPayload {
  roleCode?: AssignableRole
  departmentId?: number | null
}

export interface CreateUserResult {
  user: ApiUser
  generatedPassword?: string
}

// Nhãn/màu/mô tả vai trò dùng chung toàn app — nguồn sự thật ở `features/auth/permissions.ts`
// (re-export ở đây để các màn cũ đang import từ `usersApi` không phải đổi đường dẫn).
export { ROLE_LABEL, ROLE_COLOR, ROLE_HINT } from '@/features/auth/permissions'

/**
 * Vai trò mà `byRole` được phép gán (khớp `creatableRoles` của backend — chỉ để dựng UI).
 * RBAC 3 cấp phẳng: CHỈ Cấp 3 quản lý người dùng; không ai gán được Cấp 3.
 */
export function creatableRoles(byRole: UserRole | null): AssignableRole[] {
  if (byRole === 'super_admin') return ['viewer', 'employee']
  return []
}

export const usersApi = {
  list: () => apiFetch<ApiUser[]>('/users'),
  create: (payload: CreateUserPayload) =>
    apiFetch<CreateUserResult>('/users', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id: number, payload: UpdateUserPayload) =>
    apiFetch<ApiUser>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  setStatus: (id: number, isActive: boolean) =>
    apiFetch<ApiUser>(`/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({ isActive }) }),
  remove: (id: number) => apiFetch<void>(`/users/${id}`, { method: 'DELETE' }),
}
