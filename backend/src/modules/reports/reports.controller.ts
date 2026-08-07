import { Controller, Get, Query, Res } from '@nestjs/common'
import type { Response } from 'express'
import { ReportsService } from './reports.service'
import { ReportQueryDto } from './dto/report-query.dto'
import { Roles } from '../../common/auth/roles.decorator'
import { CurrentUser } from '../../common/auth/current-user.decorator'
import { auditLog } from '../../common/audit/audit-log'
import type { AuthUser } from '../../common/auth/auth-user'

/**
 * Báo cáo phim — Cấp 4 (toàn công ty) và Cấp 3 (chỉ phòng ban của chính mình), ADR-053.
 *
 * Ghi chú lịch sử: trước đợt 2 endpoint này CHỈ mở cho Cấp 4, vì đặc tả khi đó không nhắc tới
 * quyền báo cáo của Trưởng phòng và báo cáo có PII (họ tên người upload). Nay người dùng đã
 * yêu cầu rõ ràng nên mở cho Cấp 3, kèm điều kiện bắt buộc: **phạm vi phòng ban do SERVER
 * quyết định**, không có tham số nào của client đổi được (xem `resolveDepartmentScope`).
 * Cấp 1 và Cấp 2 vẫn bị chặn ở guard.
 */
@Controller('reports')
@Roles('super_admin', 'dept_manager')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('films')
  async films(
    @CurrentUser() actor: AuthUser,
    @Query() query: ReportQueryDto,
    @Res() res: Response,
  ) {
    const report = await this.reports.getReport(actor, query)

    if (query.format === 'csv') {
      // Xuất dữ liệu hàng loạt là sự kiện nhạy cảm — baseline §7 và §9 (PII) đều yêu cầu
      // ghi nhận riêng, phân biệt với việc chỉ xem báo cáo trên màn hình.
      auditLog({
        action: 'report.export',
        actorId: actor.id,
        outcome: 'success',
        detail: {
          rows: report.films.length,
          from: query.from,
          to: query.to,
          uploaderId: query.uploaderId,
          categoryId: query.categoryId,
          // Ghi phạm vi ĐÃ ĐƯỢC ÁP DỤNG (server quyết định), không ghi tham số client gửi —
          // nhật ký kiểm toán phải phản ánh dữ liệu thật đã rời khỏi hệ thống.
          departmentId: report.scope.departmentId,
        },
      })
      const csv = this.reports.toCsv(report)
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', 'attachment; filename="bao-cao-upload-phim.csv"')
      res.status(200).send(csv)
      return
    }

    res.status(200).json(report)
  }
}
