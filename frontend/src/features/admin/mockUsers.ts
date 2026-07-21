import { reactive } from 'vue'

export type UserRole = 'super_admin' | 'admin' | 'employee'

export interface MockAppUser {
  id: number
  name: string
  email: string
  role: UserRole
  createdBy: string
  createdAt: string
  isActive: boolean
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

/** Vai trò mà một role được phép TẠO, theo ma trận phân quyền (01-architecture.md §5). */
export function creatableRoles(byRole: UserRole): UserRole[] {
  if (byRole === 'super_admin') return ['admin', 'employee']
  if (byRole === 'admin') return ['employee']
  return []
}

/** Mock danh sách người dùng GĐ 0.5 — thay bằng API thật ở GĐ 1 (auth/users module). */
export const mockUsers: MockAppUser[] = reactive([
  {
    id: 1,
    name: 'Super Admin',
    email: 'superadmin@misa.com.vn',
    role: 'super_admin',
    createdBy: 'Hệ thống',
    createdAt: '01/01/2026',
    isActive: true,
  },
  {
    id: 2,
    name: 'Nguyễn Thị Hồng Nhung',
    email: 'nhung.nth@misa.com.vn',
    role: 'admin',
    createdBy: 'Super Admin',
    createdAt: '15/03/2026',
    isActive: true,
  },
  {
    id: 3,
    name: 'Trần Văn Khoa',
    email: 'khoa.tv@misa.com.vn',
    role: 'employee',
    createdBy: 'Nguyễn Thị Hồng Nhung',
    createdAt: '02/04/2026',
    isActive: true,
  },
  {
    id: 4,
    name: 'Ban Công đoàn',
    email: 'congdoan@misa.com.vn',
    role: 'employee',
    createdBy: 'Super Admin',
    createdAt: '10/04/2026',
    isActive: true,
  },
  {
    id: 5,
    name: 'Lê Thị Thu Trang',
    email: 'trang.ltt@misa.com.vn',
    role: 'employee',
    createdBy: 'Nguyễn Thị Hồng Nhung',
    createdAt: '20/05/2026',
    isActive: false,
  },
  {
    id: 6,
    name: 'Ban Nhân sự',
    email: 'nhansu@misa.com.vn',
    role: 'employee',
    createdBy: 'Super Admin',
    createdAt: '01/06/2026',
    isActive: true,
  },
])
