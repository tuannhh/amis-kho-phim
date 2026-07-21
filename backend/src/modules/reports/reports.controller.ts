import { Controller, Get, Query, Res } from '@nestjs/common'
import type { Response } from 'express'
import { ReportsService } from './reports.service'
import { ReportQueryDto } from './dto/report-query.dto'
import { Roles } from '../../common/auth/roles.decorator'

/** Báo cáo Quản trị — chỉ super_admin/admin (03-roadmap.md GĐ5). */
@Controller('reports')
@Roles('super_admin', 'admin')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('films')
  async films(@Query() query: ReportQueryDto, @Res() res: Response) {
    const report = await this.reports.getReport(query)

    if (query.format === 'csv') {
      const csv = this.reports.toCsv(report)
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', 'attachment; filename="bao-cao-upload-phim.csv"')
      res.status(200).send(csv)
      return
    }

    res.status(200).json(report)
  }
}
