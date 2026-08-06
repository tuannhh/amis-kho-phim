import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator'
import type { RoleCode } from '../entities/role.entity'

/** Vai trò mà API cho phép GÁN — không ai tạo/đổi thành `super_admin` qua API (giữ nguyên GĐ1). */
export const ASSIGNABLE_ROLE_CODES = ['viewer', 'employee'] as const
export type AssignableRoleCode = Exclude<RoleCode, 'super_admin'>

export class CreateUserDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @MaxLength(190)
  email!: string

  @IsString()
  @MinLength(2, { message: 'Họ tên tối thiểu 2 ký tự' })
  @MaxLength(150)
  fullName!: string

  @IsIn(ASSIGNABLE_ROLE_CODES as unknown as string[], { message: 'Vai trò không hợp lệ' })
  roleCode!: AssignableRoleCode

  /**
   * Phòng ban. Thiếu trường = chưa gán. Service kiểm tra id có tồn tại thật trước khi lưu —
   * không tin id client gửi lên (`02-security-baseline.md` §2).
   */
  @IsOptional()
  @IsInt({ message: 'Phòng ban không hợp lệ' })
  @IsPositive({ message: 'Phòng ban không hợp lệ' })
  departmentId?: number

  /** Mật khẩu tạm; để trống → hệ thống tự sinh và trả về 1 lần trong response. */
  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Mật khẩu tối thiểu 8 ký tự' })
  @MaxLength(72)
  password?: string
}

export class UpdateUserStatusDto {
  @IsBoolean()
  isActive!: boolean
}

/**
 * Sửa tài khoản (Cấp 3). Cần thiết vì cấp MỚI `viewer` (Cấp 1) không có tài khoản nào tự
 * động chuyển sang khi migrate — Cấp 3 phải tự gán lại, và phải gán được phòng ban (truy
 * vết) cho tài khoản sau khi đã tồn tại.
 *
 * `departmentId: null` = BỎ gán phòng ban (khác với thiếu trường = không đổi gì).
 */
export class UpdateUserDto {
  @IsOptional()
  @IsIn(ASSIGNABLE_ROLE_CODES as unknown as string[], { message: 'Vai trò không hợp lệ' })
  roleCode?: AssignableRoleCode

  // `@IsOptional()` của class-validator bỏ qua kiểm tra khi giá trị là null HOẶC undefined —
  // đúng nhu cầu ở đây: null = bỏ gán phòng ban, thiếu trường = không đổi.
  @IsOptional()
  @IsInt({ message: 'Phòng ban không hợp lệ' })
  @IsPositive({ message: 'Phòng ban không hợp lệ' })
  departmentId?: number | null
}
