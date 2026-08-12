import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Seam Tier B (2026-08-12, Production Compatibility Gate) — `authStore.ts` không được biết
 * token nằm ở đâu, chỉ gọi qua `AuthTransport`. Ba điều kiểm ở đây:
 *  1. `localStorageAuthTransport` giữ ĐÚNG hành vi cũ (key `kp.accessToken`/`kp.refreshToken`)
 *     — retrofit KHÔNG được đổi cách lưu, chỉ đổi CHỖ gọi.
 *  2. `setAuthTransport` swap được toàn bộ implementation (chứng minh seam thật).
 *  3. `createMemoryAuthTransport` cô lập hoàn toàn với `localStorage` thật (dùng cho test).
 */

async function freshModule() {
  vi.resetModules()
  return import('./authTransport')
}

beforeEach(() => {
  localStorage.clear()
})

describe('localStorageAuthTransport', () => {
  it('setTokens ghi đúng key kp.accessToken/kp.refreshToken (giữ nguyên hành vi cũ)', async () => {
    const { localStorageAuthTransport } = await freshModule()
    localStorageAuthTransport.setTokens('acc-1', 'ref-1')
    expect(localStorage.getItem('kp.accessToken')).toBe('acc-1')
    expect(localStorage.getItem('kp.refreshToken')).toBe('ref-1')
  })

  it('getAccessToken/getRefreshToken đọc lại đúng giá trị vừa ghi', async () => {
    const { localStorageAuthTransport } = await freshModule()
    localStorageAuthTransport.setTokens('acc-2', 'ref-2')
    expect(localStorageAuthTransport.getAccessToken()).toBe('acc-2')
    expect(localStorageAuthTransport.getRefreshToken()).toBe('ref-2')
  })

  it('clear() xoá cả hai key', async () => {
    const { localStorageAuthTransport } = await freshModule()
    localStorageAuthTransport.setTokens('acc-3', 'ref-3')
    localStorageAuthTransport.clear()
    expect(localStorageAuthTransport.getAccessToken()).toBeNull()
    expect(localStorageAuthTransport.getRefreshToken()).toBeNull()
  })

  it('chưa từng đăng nhập → getAccessToken/getRefreshToken trả null (không bịa giá trị)', async () => {
    const { localStorageAuthTransport } = await freshModule()
    expect(localStorageAuthTransport.getAccessToken()).toBeNull()
    expect(localStorageAuthTransport.getRefreshToken()).toBeNull()
  })
})

describe('createMemoryAuthTransport', () => {
  it('hoạt động độc lập, không đụng localStorage thật', async () => {
    const { createMemoryAuthTransport } = await freshModule()
    const mem = createMemoryAuthTransport()
    mem.setTokens('mem-acc', 'mem-ref')
    expect(mem.getAccessToken()).toBe('mem-acc')
    expect(localStorage.getItem('kp.accessToken')).toBeNull()
  })

  it('mỗi lần gọi createMemoryAuthTransport() là một instance RIÊNG (không rò giữa các test/store)', async () => {
    const { createMemoryAuthTransport } = await freshModule()
    const a = createMemoryAuthTransport()
    const b = createMemoryAuthTransport()
    a.setTokens('acc-a', 'ref-a')
    expect(b.getAccessToken()).toBeNull()
  })
})

describe('getAuthTransport / setAuthTransport', () => {
  it('mặc định là localStorageAuthTransport', async () => {
    const { getAuthTransport, localStorageAuthTransport } = await freshModule()
    expect(getAuthTransport()).toBe(localStorageAuthTransport)
  })

  it('setAuthTransport thay được TOÀN BỘ implementation và trả về transport cũ', async () => {
    const { getAuthTransport, setAuthTransport, localStorageAuthTransport, createMemoryAuthTransport } =
      await freshModule()
    const mem = createMemoryAuthTransport()
    const previous = setAuthTransport(mem)
    expect(previous).toBe(localStorageAuthTransport)
    expect(getAuthTransport()).toBe(mem)
  })
})
