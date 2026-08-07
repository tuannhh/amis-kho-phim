import { Type } from 'class-transformer'
import { IsIn, IsInt, IsOptional, IsPositive, IsString, Matches, Min } from 'class-validator'

/**
 * Query báo cáo phim. Mọi trường optional — không truyền = toàn bộ (trong phạm vi mà vai trò
 * của người gọi cho phép).
 *
 * ⚠️ `departmentId` CHỈ có tác dụng với Cấp 4. Với Cấp 3 (Trưởng phòng) trường này bị BỎ QUA
 * hoàn toàn ở service và thay bằng phòng ban thật đọc từ DB (ADR-053) — client không được
 * phép tự khai phạm vi dữ liệu mình xem, đúng `02-security-baseline.md` §2.
 */
export class ReportQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  uploaderId?: number

  /** Lọc theo chuyên mục — TỰ ĐỘNG gồm cả chuyên mục con cháu (xem `idsWithDescendants`). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  categoryId?: number

  /** Chỉ Cấp 4 dùng được. Cấp 3 gửi lên cũng vô hiệu. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  departmentId?: number

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'from phải theo định dạng YYYY-MM-DD' })
  from?: string

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'to phải theo định dạng YYYY-MM-DD' })
  to?: string

  /** Khoảng lượt xem (tính trên từng phim). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minViews?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxViews?: number

  @IsOptional()
  @IsIn(['newest', 'views', 'downloads'])
  sort?: 'newest' | 'views' | 'downloads'

  @IsOptional()
  @IsIn(['csv'])
  format?: 'csv'
}
