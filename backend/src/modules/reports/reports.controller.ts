import { Controller, Get, Query, Res } from '@nestjs/common'
import type { Response } from 'express'
import { ReportsService } from './reports.service'
import { ReportQueryDto } from './dto/report-query.dto'
import { Roles } from '../../common/auth/roles.decorator'
import { CurrentUser } from '../../common/auth/current-user.decorator'
import { auditLog } from '../../common/audit/audit-log'
import type { AuthUser } from '../../common/auth/auth-user'

/**
 * Báo cáo Quản trị — chỉ Cấp 3 (`super_admin`), RBAC 3 cấp phẳng (ADR-045).
 *
 * Cố ý KHÔNG mở cho Cấp 2: đặc tả nghiệp vụ chỉ cho Cấp 2 tạo phim và sửa/xoá phim của chính
 * mình, không nhắc quyền xem báo cáo. Báo cáo là xuất dữ liệu hàng loạt có PII (họ tên người
 * upload) nên giữ ở mức hạn chế nhất theo `02-security-baseline.md` §9 — mở rộng cho Cấp 2
 * là việc cần yêu cầu nghiệp vụ rõ ràng, không tự suy diễn.
 */
@Controller('reports')
@Roles('super_admin')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('films')
  async films(
    @CurrentUser() actor: AuthUser,
    @Query() query: ReportQueryDto,
    @Res() res: Response,
  ) {
    const report = await this.reports.getReport(query)

    if (query.format === 'csv') {
      // Xuất dữ liệu hàng loạt là sự kiện nhạy cảm — baseline §7 và §9 (PII) đều yêu cầu
      // ghi nhận riêng, phân biệt với việc chỉ xem báo cáo trên màn hình.
      auditLog({
        action: 'report.export',
        actorId: actor.id,
        outcome: 'success',
        detail: { rows: report.films.length, from: query.from, to: query.to, uploaderId: query.uploaderId },
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
