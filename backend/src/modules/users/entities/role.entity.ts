import { Entity, PrimaryColumn, Column } from 'typeorm'

/**
 * Vai trò cố định (seed tĩnh) — RBAC 4 CẤP CÓ SCOPE PHÒNG BAN (ADR-040).
 *
 *  - `viewer`       (Cấp 1) — chỉ XEM. Không tạo/sửa/xoá phim.
 *  - `employee`     (Cấp 2) — Cấp 1 + tạo phim + sửa/xoá phim CỦA CHÍNH MÌNH.
 *  - `dept_manager` (Cấp 3) — Cấp 2 + sửa/xoá phim của mọi `employee` CÙNG phòng ban.
 *  - `super_admin`  (Cấp 4) — Cấp 3 + sửa/xoá phim MỌI phòng ban + toàn bộ quyền quản trị
 *                             hệ thống (quản lý người dùng, phòng ban, chuyên mục, báo cáo).
 *
 * Vai trò `admin` cũ ĐÃ BỊ LOẠI BỎ hoàn toàn — dữ liệu cũ được migrate sang `super_admin`
 * (hành vi "sửa được mọi phim toàn công ty" của nó khớp Cấp 4, không khớp Cấp 3). Xem
 * ADR-041 và migration `AddDepartmentsAndRbac4Levels`.
 */
export type RoleCode = 'viewer' | 'employee' | 'dept_manager' | 'super_admin'

/** Cấp bậc số của từng vai trò — dùng để so sánh "từ Cấp N trở lên". Nguồn sự thật duy nhất. */
export const ROLE_LEVEL: Record<RoleCode, 1 | 2 | 3 | 4> = {
  viewer: 1,
  employee: 2,
  dept_manager: 3,
  super_admin: 4,
}

/** Nhãn tiếng Việt của vai trò (seed bảng `roles`, hiển thị FE). */
export const ROLE_NAME: Record<RoleCode, string> = {
  viewer: 'Người xem',
  employee: 'Nhân viên văn phòng',
  dept_manager: 'Trưởng phòng',
  super_admin: 'Quản trị cao nhất',
}

/** Danh sách vai trò theo đúng thứ tự cấp tăng dần (seed + dropdown FE). */
export const ALL_ROLE_CODES: RoleCode[] = ['viewer', 'employee', 'dept_manager', 'super_admin']

/**
 * Vai trò được phép TẠO/SỬA/XOÁ phim (Cấp 2 trở lên) — dùng cho `@Roles` ở FilmsController.
 * Cấp 1 (`viewer`) bị chặn ngay ở tầng guard, KHÔNG chỉ dựa vào kiểm tra phía sau.
 */
export const FILM_WRITE_ROLES: RoleCode[] = ['employee', 'dept_manager', 'super_admin']

/** True nếu `role` ở cấp >= `level`. */
export function isAtLeastLevel(role: RoleCode, level: 1 | 2 | 3 | 4): boolean {
  return (ROLE_LEVEL[role] ?? 0) >= level
}

@Entity({ name: 'roles' })
export class Role {
  @PrimaryColumn({ type: 'varchar', length: 20 })
  code!: RoleCode

  @Column({ type: 'varchar', length: 50 })
  name!: string
}
