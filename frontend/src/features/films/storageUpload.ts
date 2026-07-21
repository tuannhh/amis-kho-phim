/**
 * Upload file thẳng lên MinIO qua presigned PUT URL (GĐ3). Dùng XHR (không phải
 * fetch) để lấy tiến trình upload thật (progress %). KHÔNG gắn Authorization —
 * URL đã ký sẵn; header lạ có thể phá chữ ký SigV4.
 */
export function putToStorage(
  uploadUrl: string,
  file: File,
  contentType: string,
  onProgress?: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', uploadUrl, true)
    xhr.setRequestHeader('Content-Type', contentType)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(`Upload lên storage thất bại (mã ${xhr.status})`))
    }
    xhr.onerror = () =>
      reject(new Error('Không kết nối được tới storage. Kiểm tra MinIO đang chạy và CORS.'))
    xhr.send(file)
  })
}

/**
 * Đọc thời lượng video (giây) từ file cục bộ để hiển thị duration mm:ss.
 * Có timeout để KHÔNG bao giờ chặn luồng xuất bản nếu metadata không load được
 * (một số môi trường/định dạng không phát sự kiện loadedmetadata) → trả null.
 */
export function readVideoDuration(file: File, timeoutMs = 4000): Promise<number | null> {
  return new Promise((resolve) => {
    let done = false
    const finish = (v: number | null) => {
      if (done) return
      done = true
      resolve(v)
    }
    try {
      const url = URL.createObjectURL(file)
      const video = document.createElement('video')
      video.preload = 'metadata'
      const cleanup = () => URL.revokeObjectURL(url)
      video.onloadedmetadata = () => {
        cleanup()
        finish(Number.isFinite(video.duration) ? video.duration : null)
      }
      video.onerror = () => {
        cleanup()
        finish(null)
      }
      video.src = url
      setTimeout(() => {
        cleanup()
        finish(null)
      }, timeoutMs)
    } catch {
      finish(null)
    }
  })
}

/** Định dạng giây → 'm:ss' hoặc 'h:mm:ss'. */
export function formatDuration(seconds: number): string {
  const s = Math.round(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`
}
