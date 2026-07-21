import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Between, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm'
import { Film } from '../films/entities/film.entity'
import type { ReportQueryDto } from './dto/report-query.dto'

export interface ReportFilmRow {
  id: number
  slug: string
  title: string
  uploaderId: number
  uploaderName: string
  categoryName: string | null
  createdAt: string
  viewCount: number
}

export interface ReportSummaryRow {
  uploaderId: number
  uploaderName: string
  count: number
}

export interface FilmsReport {
  summary: ReportSummaryRow[]
  films: ReportFilmRow[]
}

/**
 * Báo cáo Quản trị: theo giai đoạn ai upload bao nhiêu phim + gồm phim gì
 * (03-roadmap.md GĐ5). Lọc theo người upload/khoảng ngày UPLOAD (films.created_at
 * — thời điểm phim được tạo trong hệ thống, khác `published_at` là mốc tag
 * "Phim mới" có thể bị đẩy lại khi sửa/cập nhật bản mới).
 */
@Injectable()
export class ReportsService {
  constructor(@InjectRepository(Film) private readonly films: Repository<Film>) {}

  async getReport(query: ReportQueryDto): Promise<FilmsReport> {
    const where: Record<string, unknown> = {}
    if (query.uploaderId) where.uploaderId = query.uploaderId

    if (query.from && query.to) {
      where.createdAt = Between(new Date(`${query.from}T00:00:00.000Z`), new Date(`${query.to}T23:59:59.999Z`))
    } else if (query.from) {
      where.createdAt = MoreThanOrEqual(new Date(`${query.from}T00:00:00.000Z`))
    } else if (query.to) {
      where.createdAt = LessThanOrEqual(new Date(`${query.to}T23:59:59.999Z`))
    }

    const rows = await this.films.find({
      where,
      relations: ['uploader', 'category'],
      order: { createdAt: 'DESC' },
    })

    const films: ReportFilmRow[] = rows.map((f) => ({
      id: f.id,
      slug: f.slug,
      title: f.title,
      uploaderId: f.uploaderId,
      uploaderName: f.uploader?.fullName ?? '—',
      categoryName: f.category?.name ?? null,
      createdAt: f.createdAt.toISOString(),
      viewCount: f.viewCount,
    }))

    const summaryMap = new Map<number, ReportSummaryRow>()
    for (const f of films) {
      const existed = summaryMap.get(f.uploaderId)
      if (existed) existed.count++
      else summaryMap.set(f.uploaderId, { uploaderId: f.uploaderId, uploaderName: f.uploaderName, count: 1 })
    }
    const summary = Array.from(summaryMap.values()).sort((a, b) => b.count - a.count)

    return { summary, films }
  }

  /** UTF-8 BOM để Excel mở tiếng Việt đúng; header tiếng Việt (ADR mới GĐ5). */
  toCsv(report: FilmsReport): string {
    const header = ['Tên phim', 'Người upload', 'Chuyên mục', 'Ngày upload', 'Lượt xem']
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`
    const lines = [header.map(escape).join(',')]
    for (const f of report.films) {
      const date = new Date(f.createdAt)
      const dateStr = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`
      lines.push(
        [f.title, f.uploaderName, f.categoryName ?? '', dateStr, String(f.viewCount)].map(escape).join(','),
      )
    }
    return '﻿' + lines.join('\r\n')
  }
}
