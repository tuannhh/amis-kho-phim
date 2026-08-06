import { apiFetch } from '@/lib/http'

/** Phòng ban trả từ API (khớp `PublicDepartment` của backend). */
export interface ApiDepartment {
  id: number
  name: string
  createdAt: string
  /** Số người dùng đang thuộc phòng ban — dùng để cảnh báo trước khi bấm xoá. */
  userCount: number
}

export interface UpsertDepartmentPayload {
  name: string
}

/** Toàn bộ endpoint /departments chỉ Cấp 3 gọi được (backend `@Roles('super_admin')`). */
export const departmentsApi = {
  list: () => apiFetch<ApiDepartment[]>('/departments'),
  create: (payload: UpsertDepartmentPayload) =>
    apiFetch<ApiDepartment>('/departments', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id: number, payload: UpsertDepartmentPayload) =>
    apiFetch<ApiDepartment>(`/departments/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  remove: (id: number) => apiFetch<void>(`/departments/${id}`, { method: 'DELETE' }),
}
