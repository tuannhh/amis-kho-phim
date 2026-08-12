import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Seam Tier B (2026-08-12, Production Compatibility Gate) — `HostAdapter` là điểm DUY NHẤT
 * domain/page code được gọi vào để hỏi "đang nhúng không / token bridge là gì / đóng app thế
 * nào". Ba điều quan trọng nhất kiểm ở đây:
 *  1. Mặc định dùng `browserHostAdapter` (bọc `amisBridge.ts` hiện có) — không đổi hành vi.
 *  2. `setHostAdapter` swap được toàn bộ implementation (chứng minh đây là SEAM thật, không
 *     phải chỉ đổi tên hàm) — đây là điều kiện "contract test chứng minh swap adapter được"
 *     mà skill `production-compatibility-gate` yêu cầu.
 *  3. `browserHostAdapter.closeApp()` gọi đúng `window.AMISBridge?.closeWebview?.()`, không
 *     crash khi vắng mặt.
 */

async function freshModule() {
  vi.resetModules()
  return import('./hostAdapter')
}

beforeEach(() => {
  delete (window as unknown as Record<string, unknown>).AMISBridge
})

describe('getHostAdapter / setHostAdapter', () => {
  it('mặc định là browserHostAdapter', async () => {
    const { getHostAdapter, browserHostAdapter } = await freshModule()
    expect(getHostAdapter()).toBe(browserHostAdapter)
  })

  it('setHostAdapter thay được TOÀN BỘ implementation (chứng minh seam swap được)', async () => {
    const { getHostAdapter, setHostAdapter } = await freshModule()
    const mock = {
      isEmbedded: () => true,
      getBridgeToken: () => 'mock-token',
      registerBackHandler: vi.fn(),
      closeApp: vi.fn(),
    }
    setHostAdapter(mock)
    expect(getHostAdapter()).toBe(mock)
    expect(getHostAdapter().isEmbedded()).toBe(true)
    expect(getHostAdapter().getBridgeToken()).toBe('mock-token')
  })

  it('setHostAdapter trả về adapter CŨ để test tự khôi phục', async () => {
    const { getHostAdapter, setHostAdapter, browserHostAdapter, createNoopHostAdapter } =
      await freshModule()
    const noop = createNoopHostAdapter()
    const previous = setHostAdapter(noop)
    expect(previous).toBe(browserHostAdapter)
    setHostAdapter(previous)
    expect(getHostAdapter()).toBe(browserHostAdapter)
  })
})

describe('createNoopHostAdapter', () => {
  it('an toàn mặc định — không nhúng, không token, không throw khi gọi bất kỳ hàm nào', async () => {
    const { createNoopHostAdapter } = await freshModule()
    const noop = createNoopHostAdapter()
    expect(noop.isEmbedded()).toBe(false)
    expect(noop.getBridgeToken()).toBeNull()
    expect(() => noop.registerBackHandler(() => undefined)).not.toThrow()
    expect(() => noop.closeApp()).not.toThrow()
  })
})

describe('browserHostAdapter.closeApp', () => {
  it('gọi window.AMISBridge.closeWebview khi app mẹ đã tiêm sẵn', async () => {
    const { browserHostAdapter } = await freshModule()
    const closeWebview = vi.fn()
    window.AMISBridge = { closeWebview }
    browserHostAdapter.closeApp()
    expect(closeWebview).toHaveBeenCalledTimes(1)
  })

  it('window.AMISBridge vắng mặt → không throw (mở bằng trình duyệt thường)', async () => {
    const { browserHostAdapter } = await freshModule()
    expect(() => browserHostAdapter.closeApp()).not.toThrow()
  })
})
