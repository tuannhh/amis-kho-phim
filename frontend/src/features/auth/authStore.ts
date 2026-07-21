import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type UserRole = 'super_admin' | 'admin' | 'employee'

export interface AuthUser {
  id: number
  email: string
  fullName: string
  roleCode: UserRole
  createdBy: number | null
  isActive: boolean
  mustChangePassword: boolean
  createdAt: string
}

const API = (import.meta.env.VITE_API_BASE as string) || '/api'
const LS_ACCESS = 'kp.accessToken'
const LS_REFRESH = 'kp.refreshToken'

/**
 * Auth store — nguồn danh tính phía FE (thay CURRENT_MOCK_USER của GĐ0.5).
 * Token lưu localStorage để giữ phiên qua reload (mức prototype; GĐ7 chuyển OIDC).
 * LƯU Ý: FE chỉ để hiển thị/UX — quyền THỰC được backend kiểm (RolesGuard/service).
 */
export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string | null>(localStorage.getItem(LS_ACCESS))
  const refreshToken = ref<string | null>(localStorage.getItem(LS_REFRESH))
  const user = ref<AuthUser | null>(null)
  const ready = ref(false) // đã thử khôi phục phiên xong chưa (cho router guard chờ)

  const isAuthenticated = computed(() => !!accessToken.value && !!user.value)
  const role = computed<UserRole | null>(() => user.value?.roleCode ?? null)

  function setTokens(access: string, refresh: string) {
    accessToken.value = access
    refreshToken.value = refresh
    localStorage.setItem(LS_ACCESS, access)
    localStorage.setItem(LS_REFRESH, refresh)
  }

  function clear() {
    accessToken.value = null
    refreshToken.value = null
    user.value = null
    localStorage.removeItem(LS_ACCESS)
    localStorage.removeItem(LS_REFRESH)
  }

  async function login(email: string, password: string) {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(data?.message || 'Đăng nhập không thành công')
    }
    setTokens(data.accessToken, data.refreshToken)
    user.value = data.user
    return data.user as AuthUser
  }

  /** Dùng refresh token lấy cặp token mới. Trả về true nếu thành công. */
  async function refresh(): Promise<boolean> {
    if (!refreshToken.value) return false
    try {
      const res = await fetch(`${API}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refreshToken.value }),
      })
      if (!res.ok) return false
      const data = await res.json()
      setTokens(data.accessToken, data.refreshToken)
      user.value = data.user
      return true
    } catch {
      return false
    }
  }

  /** Khôi phục phiên lúc mở app: có refresh token thì lấy /me. */
  async function restore() {
    if (accessToken.value && refreshToken.value) {
      const ok = await refresh()
      if (!ok) clear()
    }
    ready.value = true
  }

  function logout() {
    clear()
  }

  return {
    accessToken,
    refreshToken,
    user,
    ready,
    isAuthenticated,
    role,
    setTokens,
    clear,
    login,
    refresh,
    restore,
    logout,
  }
})
