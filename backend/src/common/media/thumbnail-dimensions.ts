export type ThumbnailFormat = 'jpg' | 'png' | 'webp'

export interface ThumbnailDimensions {
  type: ThumbnailFormat
  width: number
  height: number
}

/**
 * Đọc kích thước từ header, không giải mã ảnh và không duyệt cấu trúc không bị giới hạn.
 * `StorageService.readHeadBytes()` chỉ đưa tối đa 64 KB vào đây; mọi offset đều được kiểm tra
 * trước khi đọc. Đây là cố ý thay cho image-size vì ảnh đến từ người dùng không được phép làm
 * parser nặng chạy vô hạn hoặc yêu cầu nạp toàn bộ file vào RAM backend.
 */
export function readThumbnailDimensions(input: Buffer): ThumbnailDimensions | null {
  return readPng(input) ?? readJpeg(input) ?? readWebp(input)
}

function hasBytes(input: Buffer, offset: number, length: number): boolean {
  return Number.isSafeInteger(offset) && Number.isSafeInteger(length) && offset >= 0 && length >= 0 && offset + length <= input.length
}

function readPng(input: Buffer): ThumbnailDimensions | null {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (!hasBytes(input, 0, 24) || !signature.every((value, index) => input[index] === value)) return null
  if (input.toString('ascii', 12, 16) !== 'IHDR') return null
  const width = input.readUInt32BE(16)
  const height = input.readUInt32BE(20)
  return width && height ? { type: 'png', width, height } : null
}

function readJpeg(input: Buffer): ThumbnailDimensions | null {
  if (!hasBytes(input, 0, 2) || input[0] !== 0xff || input[1] !== 0xd8) return null

  let offset = 2
  while (hasBytes(input, offset, 1)) {
    while (hasBytes(input, offset, 1) && input[offset] === 0xff) offset += 1
    if (!hasBytes(input, offset, 1)) return null
    const marker = input[offset]
    offset += 1
    // Các marker không có segment length.
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue
    if (!hasBytes(input, offset, 2)) return null
    const segmentLength = input.readUInt16BE(offset)
    if (segmentLength < 2 || !hasBytes(input, offset, segmentLength)) return null
    if (isStartOfFrame(marker)) {
      if (segmentLength < 8) return null
      const height = input.readUInt16BE(offset + 3)
      const width = input.readUInt16BE(offset + 5)
      return width && height ? { type: 'jpg', width, height } : null
    }
    offset += segmentLength
  }
  return null
}

function isStartOfFrame(marker: number): boolean {
  return (marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)
}

function readWebp(input: Buffer): ThumbnailDimensions | null {
  if (!hasBytes(input, 0, 12) || input.toString('ascii', 0, 4) !== 'RIFF' || input.toString('ascii', 8, 12) !== 'WEBP') return null

  let offset = 12
  while (hasBytes(input, offset, 8)) {
    const chunkType = input.toString('ascii', offset, offset + 4)
    const chunkLength = input.readUInt32LE(offset + 4)
    const payload = offset + 8
    if (!hasBytes(input, payload, chunkLength)) return null
    if (chunkType === 'VP8X' && chunkLength >= 10) {
      const width = 1 + input.readUIntLE(payload + 4, 3)
      const height = 1 + input.readUIntLE(payload + 7, 3)
      return { type: 'webp', width, height }
    }
    if (chunkType === 'VP8 ' && chunkLength >= 10 && input[payload + 6] === 0x9d && input[payload + 7] === 0x01 && input[payload + 8] === 0x2a) {
      const width = input.readUInt16LE(payload + 9) & 0x3fff
      const height = input.readUInt16LE(payload + 11) & 0x3fff
      return width && height ? { type: 'webp', width, height } : null
    }
    if (chunkType === 'VP8L' && chunkLength >= 5 && input[payload] === 0x2f) {
      const width = 1 + ((input[payload + 1] & 0x3f) | (input[payload + 2] << 6))
      const height = 1 + ((input[payload + 2] >> 6) | (input[payload + 3] << 2) | ((input[payload + 4] & 0x0f) << 10))
      return { type: 'webp', width, height }
    }
    offset = payload + chunkLength + (chunkLength % 2)
  }
  return null
}
