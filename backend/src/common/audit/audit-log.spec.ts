import { auditLog, formatAuditEntry } from './audit-log'

/**
 * GĐ7 — nhật ký kiểm toán (chuẩn Backend MISA 02-security-baseline §7).
 * Điều quan trọng nhất cần chặn hồi quy: dòng log KHÔNG được chứa dữ liệu bí mật, và
 * việc ghi log hỏng KHÔNG được làm hỏng nghiệp vụ đang chạy.
 */

const at = new Date('2026-07-27T10:30:00.000Z')

describe('formatAuditEntry', () => {
  it('ghi đủ 4 thành phần baseline yêu cầu: thời điểm, hành động, người thực hiện, kết quả', () => {
    const line = formatAuditEntry({ action: 'login.success', actorId: 5, outcome: 'success' }, at)
    expect(line).toContain('time=2026-07-27T10:30:00.000Z')
    expect(line).toContain('action=login.success')
    expect(line).toContain('actor=5')
    expect(line).toContain('outcome=success')
  })

  it('ghi đối tượng bị tác động khi có', () => {
    const line = formatAuditEntry(
      { action: 'user.delete', actorId: 1, targetId: 42, outcome: 'success' },
      at,
    )
    expect(line).toContain('target=42')
  })

  it('bỏ qua target khi không có (không in "target=null" gây nhiễu)', () => {
    const line = formatAuditEntry({ action: 'login.failure', actorId: null, outcome: 'failure' }, at)
    expect(line).not.toContain('target=')
  })

  it('người thực hiện chưa xác định được ghi là "ẩn danh", không phải "null"', () => {
    const line = formatAuditEntry({ action: 'login.failure', actorId: null, outcome: 'failure' }, at)
    expect(line).toContain('actor=ẩn danh')
  })

  it('giữ lại ngữ cảnh thường (không nhạy cảm)', () => {
    const line = formatAuditEntry(
      { action: 'report.export', actorId: 2, outcome: 'success', detail: { rows: 120 } },
      at,
    )
    expect(line).toContain('rows=120')
  })

  // ── Che dữ liệu nhạy cảm ────────────────────────────────────────────────
  it.each(['password', 'newPassword', 'accessToken', 'apiKey', 'passwordHash', 'authorization', 'clientSecret'])(
    'che giá trị của trường nhạy cảm "%s" (không bao giờ lọt vào log)',
    (field) => {
      const line = formatAuditEntry(
        { action: 'password.change', actorId: 5, outcome: 'success', detail: { [field]: 'BiMatThatSu123' } },
        at,
      )
      expect(line).not.toContain('BiMatThatSu123')
      expect(line).toContain('[đã che]')
    },
  )

  it('trường không nhạy cảm KHÔNG bị che nhầm', () => {
    const line = formatAuditEntry(
      { action: 'user.create', actorId: 1, targetId: 9, outcome: 'success', detail: { role: 'employee' } },
      at,
    )
    expect(line).toContain('role=employee')
    expect(line).not.toContain('[đã che]')
  })
})

describe('auditLog', () => {
  it('không ném lỗi ở đường đi bình thường', () => {
    expect(() => auditLog({ action: 'login.success', actorId: 1, outcome: 'success' })).not.toThrow()
  })

  it('KHÔNG ném lỗi ngay cả khi dữ liệu đầu vào dị dạng (log hỏng không được làm sập nghiệp vụ)', () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular
    expect(() =>
      auditLog({
        action: 'user.delete',
        actorId: 1,
        outcome: 'success',
        detail: circular as never,
      }),
    ).not.toThrow()
  })
})
