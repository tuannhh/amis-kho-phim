import { useAuthStore } from '@/features/auth/authStore'

const API = (import.meta.env.VITE_API_BASE as string) || '/api'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/**
 * Gọi API có xác thực: tự gắn Bearer access token, tự refresh 1 lần khi gặp 401
 * rồi thử lại. Refresh thất bại → logout (router guard sẽ đẩy về /login).
 * Feature modules (users, films...) dùng hàm này thay vì fetch trực tiếp.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
  _retried = false,
): Promise<T> {
  const auth = useAuthStore()

  const headers = new Headers(options.headers || {})
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json')
  }
  if (auth.accessToken) headers.set('Authorization', `Bearer ${auth.accessToken}`)

  const res = await fetch(`${API}${path}`, { ...options, headers })

  if (res.status === 401 && !_retried) {
    const ok = await auth.refresh()
    if (ok) return apiFetch<T>(path, options, true)
    auth.logout()
    throw new ApiError(401, 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại')
  }

  if (res.status === 204) return undefined as T

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = (data as any)?.message
    throw new ApiError(res.status, Array.isArray(msg) ? msg.join(', ') : msg || 'Có lỗi xảy ra')
  }
  return data as T
}
