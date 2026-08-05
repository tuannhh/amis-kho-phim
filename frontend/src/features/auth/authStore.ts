import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { isEmbedded, getBridgeToken } from '@/lib/amisBridge'

/**
 * RBAC 4 CẤP CÓ SCOPE PHÒNG BAN (ADR-040) — khớp `RoleCode` của backend
 * (`backend/src/modules/users/entities/role.entity.ts`). Vai trò `admin` cũ đã bị loại bỏ.
 *
 *   viewer       Cấp 1 — chỉ xem
 *   employee     Cấp 2 — tạo phim + sửa/xoá phim của chính mình
 *   dept_manager Cấp 3 — thêm: sửa/xoá phim của Cấp 2 cùng phòng ban
 *   super_admin  Cấp 4 — mọi phim + toàn bộ quyền quản trị hệ thống
 */
export type UserRole = 'viewer' | 'employee' | 'dept_manager' | 'super_admin'

export interface AuthUser {
  id: number
  email: string
  fullName: string
  roleCode: UserRole
  /** Phòng ban (null = chưa gán). Chỉ dùng để ẩn/hiện nút; quyền thật do backend kiểm. */
  departmentId: number | null
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
  // GĐ6.1 — true trong lúc đang thử đăng nhập qua bridge AMIS Mobile lúc khởi động
  // (router guard/App.vue dùng để hiện màn "Đang xác thực...", tránh nháy sang /login).
  const bridgeAuthPending = ref(false)
  const bridgeAuthError = ref<string | null>(null)

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

  /**
   * GĐ6.1 — SSO placeholder cho chế độ nhúng AMIS Mobile: đổi token bridge lấy JWT nội bộ
   * qua endpoint mới, TÁI DÙNG luồng cấp token y hệt login thường (không có JWT song song).
   * Nếu thất bại thì KHÔNG khoá chết người dùng — chỉ ghi lỗi để UI fallback hiện LoginView
   * thường (đăng nhập email/mật khẩu vẫn hoạt động bình thường).
   */
  async function loginViaBridge(token: string): Promise<boolean> {
    bridgeAuthPending.value = true
    bridgeAuthError.value = null
    try {
      const res = await fetch(`${API}/auth/sso/amis-mobile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        bridgeAuthError.value = data?.message || 'Đăng nhập qua AMIS Mobile không thành công'
        return false
      }
      setTokens(data.accessToken, data.refreshToken)
      user.value = data.user
      return true
    } catch {
      bridgeAuthError.value = 'Không kết nối được máy chủ để xác thực qua AMIS Mobile'
      return false
    } finally {
      bridgeAuthPending.value = false
    }
  }

  /**
   * Khôi phục phiên lúc mở app: có refresh token thì lấy /me. Nếu chưa có phiên và đang
   * chạy nhúng trong AMIS Mobile (GĐ6.1, xem lib/amisBridge.ts) có token bridge → thử SSO
   * trước khi coi như "chưa đăng nhập" (tránh nháy màn login rồi lại vào app).
   */
  async function restore() {
    if (accessToken.value && refreshToken.value) {
      const ok = await refresh()
      if (!ok) clear()
    } else if (isEmbedded()) {
      const bridgeToken = getBridgeToken()
      if (bridgeToken) await loginViaBridge(bridgeToken)
      // Thất bại/không có token bridge → rơi xuống, ready=true, router cho hiện LoginView
      // thường (embedded vẫn chấp nhận đăng nhập email/mật khẩu làm phương án dự phòng).
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
    bridgeAuthPending,
    bridgeAuthError,
    setTokens,
    clear,
    login,
    loginViaBridge,
    refresh,
    restore,
    logout,
  }
})
