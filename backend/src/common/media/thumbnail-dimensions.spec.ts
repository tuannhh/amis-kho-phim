import { readThumbnailDimensions } from './thumbnail-dimensions'

describe('readThumbnailDimensions', () => {
  it('đọc PNG từ IHDR mà không giải mã toàn bộ ảnh', () => {
    const png = Buffer.alloc(24)
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png)
    png.write('IHDR', 12, 'ascii')
    png.writeUInt32BE(1920, 16)
    png.writeUInt32BE(1080, 20)
    expect(readThumbnailDimensions(png)).toEqual({ type: 'png', width: 1920, height: 1080 })
  })

  it('đọc JPEG SOF0 và bỏ qua marker đứng một mình', () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x02, 0xff, 0xc0, 0x00, 0x08, 0x08, 0x04, 0x38, 0x07, 0x80, 0x03])
    expect(readThumbnailDimensions(jpeg)).toEqual({ type: 'jpg', width: 1920, height: 1080 })
  })

  it('đọc WebP VP8X với byte thứ tự little-endian', () => {
    const webp = Buffer.alloc(30)
    webp.write('RIFF', 0, 'ascii')
    webp.write('WEBP', 8, 'ascii')
    webp.write('VP8X', 12, 'ascii')
    webp.writeUInt32LE(10, 16)
    webp.writeUIntLE(1919, 24, 3)
    webp.writeUIntLE(1079, 27, 3)
    expect(readThumbnailDimensions(webp)).toEqual({ type: 'webp', width: 1920, height: 1080 })
  })

  it('từ chối header bị cắt ngắn hoặc không phải ảnh', () => {
    expect(readThumbnailDimensions(Buffer.from('RIFF'))).toBeNull()
    expect(readThumbnailDimensions(Buffer.from('not-an-image'))).toBeNull()
  })
})
