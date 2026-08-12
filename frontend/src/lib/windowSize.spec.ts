import { describe, expect, it } from 'vitest'
import { isNativeMobileSurface, isNativeMobileWidth } from './windowSize'

describe('isNativeMobileWidth', () => {
  it.each([320, 600, 768, 1024, 1199])('phone/tablet %ipx dùng native mini-app', (width) => {
    expect(isNativeMobileWidth(width)).toBe(true)
  })

  it.each([1200, 1440])('desktop %ipx dùng Platform desktop shell', (width) => {
    expect(isNativeMobileWidth(width)).toBe(false)
  })

  it('AMIS Mobile host vẫn giữ native shell ở tablet rộng/landscape', () => {
    expect(isNativeMobileSurface(1366, true)).toBe(true)
    expect(isNativeMobileSurface(1366, false)).toBe(false)
  })
})
