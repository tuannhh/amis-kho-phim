import { Entity, PrimaryColumn, Column } from 'typeorm'

/**
 * Vai trò cố định (seed tĩnh) — RBAC 3 CẤP PHẲNG (ADR-045).
 *
 *  - `viewer`      (Cấp 1) — chỉ XEM. Không tạo/sửa/xoá phim.
 *  - `employee`    (Cấp 2) — Cấp 1 + tạo phim + sửa/xoá phim CỦA CHÍNH MÌNH.
 *  - `super_admin` (Cấp 3) — Cấp 2 + sửa/xoá **MỌI** phim (KHÔNG giới hạn phòng ban)
 *                            + toàn bộ quyền quản trị hệ thống (người dùng, phòng ban,
 *                            chuyên mục, báo cáo).
 *
 * PHẲNG = không có cấp nào bị giới hạn phạm vi theo `department_id`. Cột/bảng phòng ban vẫn
 * tồn tại nhưng CHỈ để TRUY VẾT, không tham gia quyết định quyền (ADR-046).
 *
 * Vai trò `admin` cũ ĐÃ BỊ LOẠI BỎ hoàn toàn — dữ liệu cũ migrate sang `super_admin`
 * (xem ADR-047 và migration `AddDepartmentsAndRbac3Levels`).
 */
export type RoleCode = 'viewer' | 'employee' | 'super_admin'

/** Cấp bậc số của từng vai trò — dùng để so sánh "từ Cấp N trở lên". Nguồn sự thật duy nhất. */
export const ROLE_LEVEL: Record<RoleCode, 1 | 2 | 3> = {
  viewer: 1,
  employee: 2,
  super_admin: 3,
}

/** Nhãn tiếng Việt của vai trò (seed bảng `roles`, hiển thị FE). */
export const ROLE_NAME: Record<RoleCode, string> = {
  viewer: 'Người xem',
  employee: 'Nhân viên văn phòng',
  super_admin: 'Quản trị cao nhất',
}

/** Danh sách vai trò theo đúng thứ tự cấp tăng dần (seed + dropdown FE). */
export const ALL_ROLE_CODES: RoleCode[] = ['viewer', 'employee', 'super_admin']

/**
 * Vai trò được phép TẠO/SỬA/XOÁ phim (Cấp 2 trở lên) — dùng cho `@Roles` ở FilmsController.
 * Cấp 1 (`viewer`) bị chặn ngay ở tầng guard, KHÔNG chỉ dựa vào kiểm tra phía sau.
 */
export const FILM_WRITE_ROLES: RoleCode[] = ['employee', 'super_admin']

/** True nếu `role` ở cấp >= `level`. */
export function isAtLeastLevel(role: RoleCode, level: 1 | 2 | 3): boolean {
  return (ROLE_LEVEL[role] ?? 0) >= level
}

@Entity({ name: 'roles' })
export class Role {
  @PrimaryColumn({ type: 'varchar', length: 20 })
  code!: RoleCode

  @Column({ type: 'varchar', length: 50 })
  name!: string
}
