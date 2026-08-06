import type { AuthUser, UserRole } from './authStore'

/**
 * NGUỒN SỰ THẬT DUY NHẤT phía FE cho RBAC 3 CẤP PHẲNG (ADR-045) — gom vào đây vì cùng một quy
 * tắc được dùng ở nhiều màn (danh sách phim, chi tiết phim, sidebar, router guard, quản trị
 * người dùng); mỗi màn tự viết lại điều kiện là cách chắc chắn nhất để lệch nhau.
 *
 * ⚠️ Toàn bộ hàm ở file này CHỈ để ẩn/hiện nút và điều hướng cho UX. Quyền THỰC do backend
 * kiểm (`RolesGuard` + `FilmsService.assertCanManage`). Không bao giờ coi đây là hàng rào
 * bảo mật — đã có bộ e2e chứng minh backend tự chặn dù FE có gọi thẳng API.
 */

export const ROLE_LEVEL: Record<UserRole, 1 | 2 | 3> = {
  viewer: 1,
  employee: 2,
  super_admin: 3,
}

/** Nhãn tiếng Việt — khớp `ROLE_NAME` của backend. */
export const ROLE_LABEL: Record<UserRole, string> = {
  viewer: 'Người xem',
  employee: 'Nhân viên văn phòng',
  super_admin: 'Quản trị cao nhất',
}

/** Mô tả ngắn quyền của từng cấp — hiện trong dropdown chọn vai trò để admin chọn đúng. */
export const ROLE_HINT: Record<UserRole, string> = {
  viewer: 'Chỉ xem phim, không tạo/sửa/xoá',
  employee: 'Tạo phim và sửa/xoá phim của chính mình',
  super_admin: 'Sửa/xoá được MỌI phim + toàn quyền quản trị hệ thống',
}

export const ROLE_COLOR: Record<UserRole, 'brand' | 'info' | 'warning' | 'neutral'> = {
  viewer: 'neutral',
  employee: 'info',
  super_admin: 'brand',
}

/** Vai trò được TẠO/SỬA/XOÁ phim (Cấp 2 trở lên) — khớp `FILM_WRITE_ROLES` của backend. */
export const FILM_WRITE_ROLES: UserRole[] = ['employee', 'super_admin']

/** Vai trò quản trị hệ thống (người dùng, phòng ban, chuyên mục, báo cáo) — chỉ Cấp 3. */
export const ADMIN_ROLES: UserRole[] = ['super_admin']

export function isAtLeastLevel(role: UserRole | null, level: 1 | 2 | 3): boolean {
  return !!role && ROLE_LEVEL[role] >= level
}

/** Có được tạo phim / thấy nút "Thêm phim" hay không. */
export function canCreateFilm(role: UserRole | null): boolean {
  return isAtLeastLevel(role, 2)
}

/** Có quyền quản trị hệ thống (Cấp 3) hay không. */
export function isSystemAdmin(role: UserRole | null): boolean {
  return role === 'super_admin'
}

/**
 * Thông tin tối thiểu của phim cần để quyết định ẩn/hiện nút Sửa/Xoá.
 *
 * Ở bản 3 CẤP PHẲNG chỉ cần đúng `uploaderId`: phòng ban của phim và vai trò người tạo KHÔNG
 * tham gia quyết định nữa (API vẫn trả hai trường đó để hiển thị/truy vết).
 */
export interface FilmOwnership {
  uploaderId: number
}

/**
 * Bản sao Y HỆT logic `FilmsService.assertCanManage` của backend, viết lại phía FE để ẩn/hiện
 * nút. Nếu sửa quy tắc ở backend thì PHẢI sửa cả đây (và ngược lại) — hai nơi lệch nhau sẽ
 * làm người dùng thấy nút rồi bấm vào nhận 403, hoặc không thấy nút dù thật ra có quyền.
 *
 * Đúng HAI điều kiện: là Cấp 3, HOẶC là chính chủ của phim.
 */
export function canManageFilm(actor: AuthUser | null, film: FilmOwnership | null): boolean {
  if (!actor || !film) return false
  if (actor.roleCode === 'super_admin') return true
  if (actor.roleCode === 'viewer') return false
  return film.uploaderId === actor.id
}
