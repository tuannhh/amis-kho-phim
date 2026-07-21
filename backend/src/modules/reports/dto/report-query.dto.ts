import { Type } from 'class-transformer'
import { IsIn, IsInt, IsOptional, IsPositive, IsString, Matches } from 'class-validator'

/**
 * Query báo cáo upload phim (GĐ5). Mọi trường optional — không truyền = toàn bộ.
 * `format=csv` → controller trả file CSV thay vì JSON (cùng 1 endpoint, ADR mới).
 */
export class ReportQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  uploaderId?: number

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'from phải theo định dạng YYYY-MM-DD' })
  from?: string

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'to phải theo định dạng YYYY-MM-DD' })
  to?: string

  @IsOptional()
  @IsIn(['csv'])
  format?: 'csv'
}
