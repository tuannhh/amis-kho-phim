import { isEmbedded, getBridgeToken, registerBackHandler as registerNativeBackHandler } from './amisBridge'

/**
 * Seam Tier B (2026-08-12, Production Compatibility Gate) — TOÀN BỘ capability của "app chủ"
 * (AMIS Mobile WebView hay trình duyệt độc lập) phải đi qua interface này. Trước đây
 * `App.vue`/`authStore.ts` gọi thẳng `isEmbedded()`/`getBridgeToken()`/`window.AMISBridge?...`
 * rải rác ở nhiều chỗ — đúng cách audit + phản hồi Codex mô tả "app tự đoán host thay vì qua
 * adapter". Khi có spec bridge thật từ đội AMIS Mobile, chỉ cần viết MỘT implementation mới
 * (`HostAdapter`) và đổi `setHostAdapter(...)` ở bootstrap — không phải sửa lại từng nơi gọi.
 *
 * CHƯA CÓ (cố ý, chờ Gate 3 — bridge contract chính thức từ đội AMIS Mobile):
 * safe-area, lifecycle (pause/resume), permission, deep-link. Interface này KHÔNG khai các
 * capability đó — thêm khi có spec thật, tránh bịa hình dạng API không có nguồn xác thực.
 */
export interface HostAdapter {
  /** Đang chạy nhúng trong WebView AMIS Mobile hay mở độc lập trên trình duyệt/PWA cài riêng. */
  isEmbedded(): boolean
  /** Token SSO app mẹ truyền qua bridge (native object; fallback query param CHỈ ở build dev). */
  getBridgeToken(): string | null
  /** Đăng ký xử lý khi người dùng bấm nút back cứng/vuốt back của app mẹ (Android). */
  registerBackHandler(fn: () => void): void
  /** Đóng WebView — dùng khi đang ở màn gốc và back cứng nên thoát hẳn thay vì back vô nghĩa. */
  closeApp(): void
}

/**
 * Adapter THẬT DUY NHẤT hiện có — bọc lại `amisBridge.ts` (scaffold GĐ6.1, PLACEHOLDER chờ
 * spec bridge chính thức, xem cảnh báo bảo mật/TODO ở đầu file đó). `closeApp()` gọi
 * `window.AMISBridge?.closeWebview?.()` — tên hàm CHƯA xác nhận với đội AMIS Mobile.
 */
export const browserHostAdapter: HostAdapter = {
  isEmbedded,
  getBridgeToken,
  registerBackHandler: registerNativeBackHandler,
  closeApp() {
    window.AMISBridge?.closeWebview?.()
  },
}

/** Adapter no-op — mặc định an toàn cho test/SSR, hoặc khi chưa xác định được host nào. */
export function createNoopHostAdapter(): HostAdapter {
  return {
    isEmbedded: () => false,
    getBridgeToken: () => null,
    registerBackHandler: () => undefined,
    closeApp: () => undefined,
  }
}

let current: HostAdapter = browserHostAdapter

/** Adapter đang dùng trong toàn app — domain/page code CHỈ được gọi qua đây. */
export function getHostAdapter(): HostAdapter {
  return current
}

/**
 * CHỈ dùng để test hoặc lúc bootstrap thay adapter thật (khi có bridge contract chính thức) —
 * KHÔNG gọi từ domain/page code. Trả về adapter cũ để test tự khôi phục sau khi xong.
 */
export function setHostAdapter(adapter: HostAdapter): HostAdapter {
  const previous = current
  current = adapter
  return previous
}
