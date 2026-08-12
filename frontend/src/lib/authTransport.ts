/**
 * Seam Tier B (2026-08-12, Production Compatibility Gate) — nơi DUY NHẤT token được đọc/ghi.
 * `authStore.ts` không biết token nằm ở localStorage/cookie/native bridge, chỉ gọi qua
 * interface này. Khi cần đổi sang cookie HttpOnly + CSRF hoặc lưu trữ phía native bridge cho
 * production thật, chỉ viết implementation mới rồi gọi `setAuthTransport(...)` ở bootstrap —
 * không phải sửa lại `authStore.ts`.
 */
export interface AuthTransport {
  getAccessToken(): string | null
  getRefreshToken(): string | null
  setTokens(access: string, refresh: string): void
  clear(): void
}

const LS_ACCESS = 'kp.accessToken'
const LS_REFRESH = 'kp.refreshToken'

/**
 * Adapter PROTOTYPE DUY NHẤT hiện có — lưu token thẳng vào `localStorage` (hành vi y hệt
 * `authStore.ts` trước khi tách seam này, KHÔNG đổi cách lưu).
 *
 * ‼️ CẢNH BÁO chưa xử lý, ghi rõ để không bị coi là "đã an toàn": localStorage lộ token cho
 * BẤT KỲ script nào chạy được trên trang (XSS) — chấp nhận được ở mức PROTOTYPE, KHÔNG phải
 * khuyến nghị cho production thật có dữ liệu nhạy cảm. Trước khi bật Gate 2 (browser/PWA
 * production — xem skill `production-compatibility-gate`), phải quyết định rõ: chuyển sang
 * cookie HttpOnly + CSRF, hay giữ localStorage kèm risk-acceptance có chủ (owner + hạn xử lý).
 */
export const localStorageAuthTransport: AuthTransport = {
  getAccessToken: () => localStorage.getItem(LS_ACCESS),
  getRefreshToken: () => localStorage.getItem(LS_REFRESH),
  setTokens(access, refresh) {
    localStorage.setItem(LS_ACCESS, access)
    localStorage.setItem(LS_REFRESH, refresh)
  },
  clear() {
    localStorage.removeItem(LS_ACCESS)
    localStorage.removeItem(LS_REFRESH)
  },
}

/** In-memory — dùng cho test (không đụng `localStorage` thật, không rò trạng thái giữa các ca test). */
export function createMemoryAuthTransport(): AuthTransport {
  let access: string | null = null
  let refresh: string | null = null
  return {
    getAccessToken: () => access,
    getRefreshToken: () => refresh,
    setTokens(a, r) {
      access = a
      refresh = r
    },
    clear() {
      access = null
      refresh = null
    },
  }
}

let current: AuthTransport = localStorageAuthTransport

/** Transport đang dùng trong toàn app — `authStore.ts` CHỈ được gọi qua đây. */
export function getAuthTransport(): AuthTransport {
  return current
}

/**
 * CHỈ dùng để test hoặc lúc bootstrap thay transport thật (khi đã quyết định chuyển khỏi
 * localStorage) — KHÔNG gọi từ domain/page code. Trả về transport cũ để test tự khôi phục.
 */
export function setAuthTransport(transport: AuthTransport): AuthTransport {
  const previous = current
  current = transport
  return previous
}
