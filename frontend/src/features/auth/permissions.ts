import type { AuthUser, UserRole } from './authStore'

/**
 * NGUỒN SỰ THẬT DUY NHẤT phía FE cho RBAC 4 cấp (ADR-040) — gom vào đây vì cùng một quy tắc
 * được dùng ở nhiều màn (danh sách phim, chi tiết phim, sidebar, router guard, quản trị người
 * dùng); mỗi màn tự viết lại điều kiện là cách chắc chắn nhất để lệch nhau.
 *
 * ⚠️ Toàn bộ hàm ở file này CHỈ để ẩn/hiện nút và điều hướng cho UX. Quyền THỰC do backend
 * kiểm (`RolesGuard` + `FilmsService.assertCanManage`). Không bao giờ coi đây là hàng rào
 * bảo mật — đã có bộ e2e chứng minh backend tự chặn dù FE có gọi thẳng API.
 */

export const ROLE_LEVEL: Record<UserRole, 1 | 2 | 3 | 4> = {
  viewer: 1,
  employee: 2,
  dept_manager: 3,
  super_admin: 4,
}

/** Nhãn tiếng Việt — khớp `ROLE_NAME` của backend. */
export const ROLE_LABEL: Record<UserRole, string> = {
  viewer: 'Người xem',
  employee: 'Nhân viên văn phòng',
  dept_manager: 'Trưởng phòng',
  super_admin: 'Quản trị cao nhất',
}

/** Mô tả ngắn quyền của từng cấp — hiện trong dropdown chọn vai trò để admin chọn đúng. */
export const ROLE_HINT: Record<UserRole, string> = {
  viewer: 'Chỉ xem phim, không tạo/sửa/xoá',
  employee: 'Tạo phim và sửa/xoá phim của chính mình',
  dept_manager: 'Thêm quyền sửa/xoá phim của nhân viên cùng phòng ban',
  super_admin: 'Toàn quyền quản trị hệ thống',
}

export const ROLE_COLOR: Record<UserRole, 'brand' | 'info' | 'warning' | 'neutral'> = {
  viewer: 'neutral',
  employee: 'info',
  dept_manager: 'warning',
  super_admin: 'brand',
}

/** Vai trò được TẠO/SỬA/XOÁ phim (Cấp 2 trở lên) — khớp `FILM_WRITE_ROLES` của backend. */
export const FILM_WRITE_ROLES: UserRole[] = ['employee', 'dept_manager', 'super_admin']

/** Vai trò quản trị hệ thống (người dùng, phòng ban) — chỉ Cấp 4. */
export const ADMIN_ROLES: UserRole[] = ['super_admin']

/**
 * Vai trò xem được BÁO CÁO (ADR-053) — Cấp 3 và Cấp 4.
 *
 * Tách khỏi `ADMIN_ROLES` có chủ đích: báo cáo không còn là quyền quản trị hệ thống nữa.
 * Cấp 3 xem được nhưng CHỈ trong phòng ban của mình — phạm vi đó do backend ép, không phải
 * do FE giấu bớt dữ liệu.
 */
export const REPORT_ROLES: UserRole[] = ['dept_manager', 'super_admin']

/** Vai trò có màn "Phim tôi quản lý" — Cấp 2 trở lên (Cấp 1 không quản lý phim nào). */
export const MANAGED_FILMS_ROLES: UserRole[] = ['employee', 'dept_manager', 'super_admin']

export function isAtLeastLevel(role: UserRole | null, level: 1 | 2 | 3 | 4): boolean {
  return !!role && ROLE_LEVEL[role] >= level
}

/** Có được tạo phim / thấy nút "Thêm phim" hay không. */
export function canCreateFilm(role: UserRole | null): boolean {
  return isAtLeastLevel(role, 2)
}

/** Có quyền quản trị hệ thống (Cấp 4) hay không. */
export function isSystemAdmin(role: UserRole | null): boolean {
  return role === 'super_admin'
}

/**
 * Bản sao logic `CategoriesService.assertCanWrite` của backend (ADR-051) — quyền ghi chuyên mục
 * phân theo TẦNG chứ không theo một mức vai trò duy nhất:
 *
 *   chuyên mục GỐC (`parentId == null`) → chỉ Cấp 4
 *   chuyên mục CON (`parentId != null`) → Cấp 2 trở lên
 *
 * Sửa quy tắc ở backend thì PHẢI sửa cả đây (và ngược lại).
 */
export function canWriteCategory(role: UserRole | null, isRoot: boolean): boolean {
  if (role === 'super_admin') return true
  if (isRoot) return false
  return isAtLeastLevel(role, 2)
}

/** Có thấy nút "Thêm chuyên mục" không — Cấp 2 trở lên (Cấp 2/3 chỉ tạo được chuyên mục con). */
export function canCreateAnyCategory(role: UserRole | null): boolean {
  return isAtLeastLevel(role, 2)
}

/** Thông tin tối thiểu của phim cần để quyết định ẩn/hiện nút Sửa/Xoá. */
export interface FilmOwnership {
  uploaderId: number
  /** Snapshot phòng ban lúc tạo phim (ADR-042). */
  departmentId: number | null
  /** Vai trò hiện tại của người tạo — Cấp 3 chỉ quản được phim do Cấp 2 tạo. */
  uploaderRoleCode: UserRole | null
}

/**
 * Bản sao Y HỆT logic `FilmsService.assertCanManage` của backend, viết lại phía FE để ẩn/hiện
 * nút. Nếu sửa quy tắc ở backend thì PHẢI sửa cả đây (và ngược lại) — hai nơi lệch nhau sẽ
 * làm người dùng thấy nút rồi bấm vào nhận 403, hoặc không thấy nút dù thật ra có quyền.
 */
export function canManageFilm(actor: AuthUser | null, film: FilmOwnership | null): boolean {
  if (!actor || !film) return false
  if (actor.roleCode === 'super_admin') return true
  if (actor.roleCode === 'viewer') return false
  if (film.uploaderId === actor.id) return true

  if (actor.roleCode === 'dept_manager') {
    // null KHÔNG được coi là "trùng null" — giống hệt chốt chặn ở backend.
    if (actor.departmentId == null || film.departmentId == null) return false
    return film.departmentId === actor.departmentId && film.uploaderRoleCode === 'employee'
  }

  return false
}
