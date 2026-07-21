import { apiFetch } from '@/lib/http'
import type { UserRole } from '@/features/auth/authStore'

/** Người dùng trả từ API (khớp PublicUser của backend — KHÔNG có password_hash). */
export interface ApiUser {
  id: number
  email: string
  fullName: string
  roleCode: UserRole
  createdBy: number | null
  isActive: boolean
  mustChangePassword: boolean
  createdAt: string
}

export interface CreateUserPayload {
  email: string
  fullName: string
  roleCode: Exclude<UserRole, 'super_admin'>
  password?: string
}

export interface CreateUserResult {
  user: ApiUser
  generatedPassword?: string
}

export const ROLE_LABEL: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  employee: 'Nhân viên',
}

export const ROLE_COLOR: Record<UserRole, 'brand' | 'info' | 'neutral'> = {
  super_admin: 'brand',
  admin: 'info',
  employee: 'neutral',
}

/** Vai trò mà `byRole` được phép tạo (khớp ma trận backend — chỉ để dựng UI). */
export function creatableRoles(byRole: UserRole | null): UserRole[] {
  if (byRole === 'super_admin') return ['admin', 'employee']
  if (byRole === 'admin') return ['employee']
  return []
}

export const usersApi = {
  list: () => apiFetch<ApiUser[]>('/users'),
  create: (payload: CreateUserPayload) =>
    apiFetch<CreateUserResult>('/users', { method: 'POST', body: JSON.stringify(payload) }),
  setStatus: (id: number, isActive: boolean) =>
    apiFetch<ApiUser>(`/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({ isActive }) }),
  remove: (id: number) => apiFetch<void>(`/users/${id}`, { method: 'DELETE' }),
}
