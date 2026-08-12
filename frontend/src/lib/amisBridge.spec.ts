import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * GĐ7 — kiểm tra scaffold nhúng AMIS Mobile (GĐ6.1). Hai điều quan trọng nhất:
 *  1. MẶC ĐỊNH (mở trình duyệt bình thường) phải KHÔNG coi là nhúng — nếu sai, header/
 *     sidebar bị ẩn với toàn bộ người dùng web.
 *  2. Ưu tiên lấy token từ object native, chỉ fallback query param (`?ssoToken=` là cơ chế
 *     tạm, lộ token trong URL — ADR-029).
 * Module cache `embedded` ở cấp module nên mỗi ca test phải resetModules + nạp lại.
 */

/** Đặt URL rồi nạp lại module (bỏ cache) để mô phỏng một lần khởi động app. */
async function loadWith(search: string) {
  window.history.replaceState({}, '', `/${search}`)
  vi.resetModules()
  return import('./amisBridge')
}

beforeEach(() => {
  delete (window as unknown as Record<string, unknown>).AMISBridge
  delete (window as unknown as Record<string, unknown>).__khoPhimHandleNativeBack
})

describe('isEmbedded', () => {
  it('mở bình thường (không query param) → KHÔNG phải chế độ nhúng', async () => {
    const { isEmbedded } = await loadWith('')
    expect(isEmbedded()).toBe(false)
  })

  it('?embedded=1 → chế độ nhúng', async () => {
    const { isEmbedded } = await loadWith('?embedded=1')
    expect(isEmbedded()).toBe(true)
  })

  it('giá trị khác 1 không kích hoạt chế độ nhúng', async () => {
    const { isEmbedded } = await loadWith('?embedded=true')
    expect(isEmbedded()).toBe(false)
  })

  it('kết quả được cache — router xoá query param sau đó vẫn giữ đúng trạng thái', async () => {
    const { isEmbedded } = await loadWith('?embedded=1')
    expect(isEmbedded()).toBe(true)
    window.history.replaceState({}, '', '/films') // router điều hướng, mất query
    expect(isEmbedded()).toBe(true)
  })
})

describe('getBridgeToken', () => {
  it('không có gì → null (app rơi về màn đăng nhập thường, không khoá chết)', async () => {
    const { getBridgeToken } = await loadWith('')
    expect(getBridgeToken()).toBeNull()
  })

  it('lấy token từ object native khi app mẹ tiêm sẵn', async () => {
    const { getBridgeToken } = await loadWith('')
    window.AMISBridge = { getToken: () => 'token-tu-native' }
    expect(getBridgeToken()).toBe('token-tu-native')
  })

  it('ƯU TIÊN native hơn query param (query param là cơ chế tạm, kém an toàn)', async () => {
    const { getBridgeToken } = await loadWith('?ssoToken=token-tu-url')
    window.AMISBridge = { getToken: () => 'token-tu-native' }
    expect(getBridgeToken()).toBe('token-tu-native')
  })

  it('fallback query param khi chưa có object native', async () => {
    const { getBridgeToken } = await loadWith('?ssoToken=token-tu-url')
    expect(getBridgeToken()).toBe('token-tu-url')
  })

  it('object native tồn tại nhưng trả rỗng → vẫn fallback được, không crash', async () => {
    const { getBridgeToken } = await loadWith('?ssoToken=token-tu-url')
    window.AMISBridge = { getToken: () => null }
    expect(getBridgeToken()).toBe('token-tu-url')
  })

  it('object native không có hàm getToken → không ném lỗi', async () => {
    const { getBridgeToken } = await loadWith('')
    window.AMISBridge = {}
    expect(() => getBridgeToken()).not.toThrow()
    expect(getBridgeToken()).toBeNull()
  })

  it('BUILD PRODUCTION không bao giờ đọc ?ssoToken= — fail-closed (Tier A retrofit, 2026-08-12, Production Compatibility Gate)', async () => {
    const wasDev = import.meta.env.DEV
    // Mô phỏng build production: các bài test khác trong file này chạy dưới mode dev mặc
    // định của Vitest — ca này ép DEV=false để chứng minh nhánh production KHÔNG đọc query
    // param dù URL có mang theo (khác thử nghiệm trước đây từng để lộ token qua URL).
    ;(import.meta.env as { DEV: boolean }).DEV = false
    try {
      const { getBridgeToken } = await loadWith('?ssoToken=token-tu-url')
      window.AMISBridge = {}
      expect(getBridgeToken()).toBeNull()
    } finally {
      ;(import.meta.env as { DEV: boolean }).DEV = wasDev
    }
  })
})

describe('nút back cứng của app mẹ', () => {
  it('registerBackHandler expose hàm toàn cục cho native gọi', async () => {
    const { registerBackHandler } = await loadWith('')
    const spy = vi.fn()
    registerBackHandler(spy)

    expect(typeof window.__khoPhimHandleNativeBack).toBe('function')
    window.__khoPhimHandleNativeBack!()
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('chưa đăng ký handler mà native gọi → không crash', async () => {
    const { notifyBackPressed } = await loadWith('')
    expect(() => notifyBackPressed()).not.toThrow()
  })

  it('đăng ký handler mới thay thế handler cũ (chỉ 1 handler tại 1 thời điểm)', async () => {
    const { registerBackHandler, notifyBackPressed } = await loadWith('')
    const first = vi.fn()
    const second = vi.fn()
    registerBackHandler(first)
    registerBackHandler(second)
    notifyBackPressed()
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })
})
