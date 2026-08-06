import { Logger } from '@nestjs/common'

/**
 * Nhật ký KIỂM TOÁN BẢO MẬT — trả lời "ai đã làm gì, khi nào" khi cần điều tra sự cố.
 * Khác hẳn log gỡ lỗi kỹ thuật (chuẩn Backend MISA — 02-security-baseline §7).
 *
 * GIỚI HẠN CÓ CHỦ ĐÍCH (đọc kỹ trước khi tin tưởng vào nhật ký này):
 *  - Ghi ra **stdout** qua Logger của Nest, KHÔNG ghi vào bảng riêng trong DB. Nghĩa là
 *    nhật ký này chỉ có giá trị điều tra khi hạ tầng đã gom log tập trung và log đó không
 *    bị chính người bị điều tra sửa/xoá được. Baseline yêu cầu lưu trữ chống sửa đổi —
 *    phần đó thuộc về hạ tầng, không giải quyết được ở tầng ứng dụng.
 *  - Chưa có thời hạn lưu trữ riêng (baseline yêu cầu dài hơn log gỡ lỗi thông thường).
 *  Cả hai điểm trên đã ghi vào docs/danh-gia-an-ninh.md và docs/devops-handoff.md.
 *
 * Cố ý viết dạng HÀM MODULE thay vì service tiêm phụ thuộc (DI): đây là sink ghi log
 * thuần, không giữ trạng thái, không phụ thuộc gì. Làm service sẽ buộc phải đổi
 * constructor của hàng loạt service đang chạy ổn định — vi phạm nguyên tắc "phạm vi ảnh
 * hưởng nhỏ nhất" mà không đổi lại được lợi ích thực tế nào.
 */

const logger = new Logger('Audit')

/** Các sự kiện được coi là nhạy cảm về bảo mật, theo 02-security-baseline §7. */
export type AuditAction =
  | 'login.success'
  | 'login.failure'
  | 'password.change'
  | 'sso.success'
  | 'sso.failure'
  | 'user.create'
  // Đổi vai trò / phòng ban của tài khoản = đổi RANH GIỚI PHÂN QUYỀN → baseline §7 bắt buộc ghi.
  | 'user.update'
  | 'user.status_change'
  | 'user.delete'
  | 'film.delete'
  // Phòng ban là danh mục dùng chung toàn hệ thống và là dữ liệu truy vết của mọi phim →
  // mọi thay đổi vẫn được ghi nhận, dù ở bản 3 cấp phẳng nó không còn quyết định quyền.
  | 'department.create'
  | 'department.update'
  | 'department.delete'
  | 'report.export'

export interface AuditEvent {
  action: AuditAction
  /** Ai thực hiện. `null` khi chưa xác định được danh tính (vd đăng nhập thất bại). */
  actorId: number | null
  /** Đối tượng bị tác động, nếu có (id người dùng bị khoá, id phim bị xoá...). */
  targetId?: number | string | null
  /** Kết quả — baseline yêu cầu ghi cả thành công lẫn thất bại. */
  outcome: 'success' | 'failure'
  /** Ngữ cảnh thêm. TUYỆT ĐỐI không đưa mật khẩu/token/secret vào đây. */
  detail?: Record<string, string | number | boolean | null | undefined>
}

/**
 * Các khoá bị che khi ghi log, phòng trường hợp người viết code sau này vô tình truyền
 * dữ liệu nhạy cảm vào `detail` (02-security-baseline §4: "không log giá trị bí mật").
 */
const REDACT_PATTERN = /pass|secret|token|key|hash|authorization|credential/i

function redact(detail: AuditEvent['detail']): Record<string, unknown> {
  if (!detail) return {}
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(detail)) {
    out[k] = REDACT_PATTERN.test(k) ? '[đã che]' : v
  }
  return out
}

/**
 * Dựng nội dung một dòng nhật ký kiểm toán. Tách riêng khỏi việc ghi để test được
 * (đặc biệt là hành vi che dữ liệu nhạy cảm) mà không phải bắt output của Logger.
 */
export function formatAuditEntry(event: AuditEvent, now: Date = new Date()): string {
  const parts: string[] = [
    `time=${now.toISOString()}`,
    `action=${event.action}`,
    `outcome=${event.outcome}`,
    `actor=${event.actorId ?? 'ẩn danh'}`,
  ]
  if (event.targetId !== undefined && event.targetId !== null) {
    parts.push(`target=${event.targetId}`)
  }
  for (const [k, v] of Object.entries(redact(event.detail))) {
    if (v !== undefined) parts.push(`${k}=${v}`)
  }
  return parts.join(' ')
}

/**
 * Ghi một sự kiện kiểm toán. KHÔNG BAO GIỜ ném lỗi ra ngoài — việc ghi nhật ký thất bại
 * không được phép làm hỏng nghiệp vụ đang chạy (03-error-handling §4: lỗi ở một phần phụ
 * không được kéo sập thao tác chính).
 */
export function auditLog(event: AuditEvent): void {
  try {
    const line = formatAuditEntry(event)
    if (event.outcome === 'failure') logger.warn(line)
    else logger.log(line)
  } catch {
    // Nuốt có chủ đích: nhật ký kiểm toán là phụ trợ, không phải đường đi chính.
  }
}
