/**
 * GĐ6.1 — AMIS Mobile Embed Readiness (scaffold, chờ DevOps).
 *
 * Module trừu tượng hoá "cầu nối" (bridge) với app khung AMIS Mobile khi Kho phim chạy
 * nhúng trong WebView của app mẹ, thay vì mở độc lập trên trình duyệt/PWA cài riêng.
 *
 * ⚠️ PLACEHOLDER — chưa có spec bridge chính thức từ đội AMIS Mobile lúc viết module này.
 * Toàn bộ cơ chế lấy `embedded`/token dưới đây là GIẢ ĐỊNH TẠM cho mục đích scaffold, để
 * FE/BE có chỗ "cắm" sẵn. DevOps PHẢI xác nhận lại với đội AMIS Mobile trước khi dùng thật:
 *   1. Cách app mẹ báo "đang nhúng" — hiện dùng query param `?embedded=1` (đơn giản, đáng tin
 *      cậy nhất khi chưa có bridge thật). Thực tế AMIS Mobile có thể có cách khác (User-Agent
 *      riêng, custom scheme, v.v.).
 *   2. Cách app mẹ truyền token đăng nhập — hiện thử `window.AMISBridge?.getToken?.()` (native
 *      tiêm sẵn object toàn cục) trước, fallback về query param `?ssoToken=...` CHỈ TRONG BUILD
 *      DEV (xem `getBridgeToken` — Tier A retrofit 2026-08-12, Production Compatibility Gate).
 *      ‼️ CẢNH BÁO BẢO MẬT: query param sẽ lộ token trong URL (lịch sử trình duyệt, log server,
 *      referrer...). Fallback này CHỈ để scaffold chạy được lúc dev cục bộ khi chưa có
 *      `window.AMISBridge` thật — build production (`import.meta.env.PROD`) KHÔNG BAO GIỜ đọc
 *      query param này, dù URL có mang theo. Khi có spec bridge thật, cơ chế đúng nhiều khả
 *      năng là `postMessage`/native bridge, không phải query param — xoá hẳn fallback này khi
 *      đó, không chỉ giữ nguyên trạng "vì đã có guard".
 */

let embeddedCache: boolean | null = null

/**
 * Phát hiện đang chạy trong WebView AMIS Mobile hay không. Đọc `location.search` MỘT LẦN lúc
 * gọi đầu tiên (thường lúc app khởi động) rồi cache lại — không đọc lại mỗi lần gọi, vì
 * router điều hướng sau đó có thể làm mất query param khỏi URL hiện tại.
 */
export function isEmbedded(): boolean {
  if (embeddedCache === null) {
    embeddedCache = new URLSearchParams(location.search).get('embedded') === '1'
  }
  return embeddedCache
}

declare global {
  interface Window {
    /** TODO(AMIS Mobile): object native tiêm vào WebView — hình dạng thật chưa xác nhận. */
    AMISBridge?: {
      getToken?: () => string | null | undefined
      closeWebview?: () => void
    }
    /** Hàm app mẹ gọi khi người dùng bấm nút back cứng (Android) hoặc vuốt back. */
    __khoPhimHandleNativeBack?: () => void
  }
}

/**
 * Lấy token SSO app mẹ truyền qua bridge để đổi lấy JWT nội bộ (POST /auth/sso/amis-mobile).
 * Thử object native tiêm sẵn trước; fallback query param `?ssoToken=` CHỈ hoạt động ở build
 * dev (`import.meta.env.DEV`) — build production loại bỏ nhánh này hoàn toàn (Vite fold hằng
 * số `import.meta.env.PROD/DEV` lúc build, không phải kiểm tra runtime có thể bị qua mặt).
 * TODO(DevOps/AMIS Mobile): thay bằng cách lấy token đúng theo spec bridge thật (có thể
 * postMessage bất đồng bộ chứ không phải đọc đồng bộ như dưới đây), rồi xoá hẳn fallback dev.
 */
export function getBridgeToken(): string | null {
  const fromNative = window.AMISBridge?.getToken?.()
  if (fromNative) return fromNative

  // Fail-closed theo Production Compatibility Gate (Tier A, 2026-08-12): query param lộ
  // token qua URL (lịch sử trình duyệt, log server, referrer) — KHÔNG được đọc ở production
  // dù URL có mang theo `?ssoToken=...`.
  if (import.meta.env.DEV) {
    const fromQuery = new URLSearchParams(location.search).get('ssoToken')
    return fromQuery || null
  }
  return null
}

let backHandler: (() => void) | null = null

/**
 * Đăng ký hàm xử lý khi app mẹ báo người dùng bấm nút back cứng. Chỉ 1 handler tại 1 thời
 * điểm (đủ dùng cho router điều hướng toàn cục ở App.vue).
 */
export function registerBackHandler(fn: () => void): void {
  backHandler = fn
  window.__khoPhimHandleNativeBack = notifyBackPressed
}

/**
 * Gọi bởi app mẹ (qua `window.__khoPhimHandleNativeBack()`) hoặc trực tiếp để mô phỏng khi
 * test. Không tự điều hướng ở đây — logic điều hướng thật (router.back() hay đóng WebView)
 * do handler đăng ký qua `registerBackHandler` quyết định, vì cần truy cập router instance.
 */
export function notifyBackPressed(): void {
  backHandler?.()
}
