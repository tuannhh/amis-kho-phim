import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore, type UserRole } from '@/features/auth/authStore'
import {
  ADMIN_ROLES,
  FILM_WRITE_ROLES,
  MANAGED_FILMS_ROLES,
  REPORT_ROLES,
} from '@/features/auth/permissions'
import { lazyResponsiveView } from '@/lib/responsiveView'

/**
 * Router AMIS Kho phim.
 * Mỗi feature là 1 route độc lập (lazy-load) → module hoá, sửa 1 vùng không lan.
 * GĐ1: thêm route auth (login/đổi mật khẩu) + navigation guard (đăng nhập + phân quyền).
 * meta.public: không cần đăng nhập · meta.roles: giới hạn theo vai trò (FE ẩn/chặn cho UX;
 * quyền THỰC backend kiểm).
 */
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/films' },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/features/auth/LoginView.vue'),
      meta: { title: 'Đăng nhập', public: true, blank: true },
    },
    {
      path: '/change-password',
      name: 'change-password',
      component: () => import('@/features/auth/ChangePasswordView.vue'),
      meta: { title: 'Đổi mật khẩu', blank: true },
    },
    {
      path: '/films',
      name: 'films',
      // GĐ8 — "1 route, 2 view" (ADR-058): cùng URL, đổi component theo window size class.
      component: lazyResponsiveView(
        () => import('@/features/films/FilmListView.vue'),
        () => import('@/features/films/FilmListMobileView.vue'),
        'FilmListResponsive',
      ),
      meta: { title: 'Kho phim' },
    },
    {
      path: '/my-films',
      name: 'my-films',
      component: lazyResponsiveView(
        () => import('@/features/films/ManagedFilmsView.vue'),
        () => import('@/features/films/ManagedFilmsMobileView.vue'),
        'ManagedFilmsResponsive',
      ),
      // Cấp 1 không quản lý phim nào → không có gì để hiện, chặn luôn ở route.
      meta: { title: 'Phim tôi quản lý', roles: MANAGED_FILMS_ROLES },
    },
    {
      // Route CŨ, giữ nguyên cho link đã chia sẻ TRƯỚC 2026-08-13 (yêu cầu chủ dự án: link
      // cũ không bao giờ được 404). Component tự phát hiện + `router.replace` sang URL mới
      // — xem `filmRouteResolve.ts`. KHÔNG dùng để tạo link MỚI nữa (xem route `film-detail`
      // bên dưới, `path: '/'` phải đứng SAU route này vì `/films` là 1 segment tĩnh cụ thể
      // hơn, và route 2-segment generic bên dưới xếp cuối cùng theo quy ước).
      path: '/films/:slug',
      name: 'film-detail-legacy',
      component: lazyResponsiveView(
        () => import('@/features/films/FilmDetailView.vue'),
        () => import('@/features/films/FilmDetailMobileView.vue'),
        'FilmDetailResponsive',
      ),
      meta: { title: 'Chi tiết phim' },
    },
    {
      // GĐ8-B (ADR-061) — màn "Tài khoản" CHỈ dành cho Compact: gom lại những thứ vốn nằm
      // trong `MHeaderBar` (thông báo, đổi mật khẩu, đăng xuất) sau khi thanh đó bị ẩn ở
      // Compact, cộng các điểm đến quản trị không lên được bottom nav. Mọi vai trò đều vào
      // được — nội dung bên trong tự lọc theo quyền; view tự chuyển về Kho phim nếu cửa sổ
      // rộng lên quá 600px.
      path: '/account',
      name: 'account',
      component: () => import('@/features/account/AccountMobileView.vue'),
      meta: { title: 'Tài khoản' },
    },
    {
      path: '/upload',
      name: 'upload',
      component: lazyResponsiveView(
        () => import('@/features/upload/FilmUploadView.vue'),
        () => import('@/features/upload/FilmUploadMobileView.vue'),
        'FilmUploadResponsive',
      ),
      // Cấp 1 (viewer) không được vào màn tạo/sửa phim — backend cũng chặn ở @Roles.
      meta: { title: 'Thêm phim', roles: FILM_WRITE_ROLES },
    },
    {
      path: '/categories',
      name: 'categories',
      // GĐ8-C: master-detail 2 cột của bản desktop không có chỗ ở <600px (cột chi tiết bị ép
      // còn vài pixel, chữ vỡ từng ký tự) → thêm bản mobile riêng theo ADR-058.
      component: lazyResponsiveView(
        () => import('@/features/categories/CategoryView.vue'),
        () => import('@/features/categories/CategoryMobileView.vue'),
        'CategoryResponsive',
      ),
      // Cấp 1 (viewer) chỉ có đúng "Kho phim": không thấy menu Chuyên mục và cũng không vào
      // được bằng cách gõ thẳng URL (ẩn menu thôi thì chưa đủ).
      meta: { title: 'Chuyên mục', roles: FILM_WRITE_ROLES },
    },
    {
      path: '/admin/departments',
      name: 'admin-departments',
      component: lazyResponsiveView(
        () => import('@/features/departments/DepartmentAdminView.vue'),
        () => import('@/features/departments/DepartmentAdminMobileView.vue'),
        'DepartmentAdminResponsive',
      ),
      meta: { title: 'Quản lý phòng ban', roles: ADMIN_ROLES },
    },
    {
      path: '/admin/users',
      name: 'admin-users',
      component: lazyResponsiveView(
        () => import('@/features/admin/UserAdminView.vue'),
        () => import('@/features/admin/UserAdminMobileView.vue'),
        'UserAdminResponsive',
      ),
      meta: { title: 'Quản trị người dùng', roles: ADMIN_ROLES },
    },
    {
      path: '/admin/reports',
      name: 'admin-reports',
      component: lazyResponsiveView(
        () => import('@/features/reports/ReportsView.vue'),
        () => import('@/features/reports/ReportsMobileView.vue'),
        'ReportsResponsive',
      ),
      // ADR-053: Cấp 3 vào được, backend tự giới hạn dữ liệu theo phòng ban của họ.
      meta: { title: 'Báo cáo', roles: REPORT_ROLES },
    },
    {
      // URL công khai MỚI của phim (2026-08-13, yêu cầu chủ dự án): cấu trúc
      // `ten-chuyen-muc/ten-phim-ngay-phat-hanh-version`. Đặt CUỐI mảng route theo quy ước —
      // dù vue-router 4 tự xếp route TĨNH (`/admin/users`, `/my-films`...) ưu tiên hơn route
      // ĐỘNG 2 tham số này bất kể thứ tự khai báo, nên không có rủi ro route này "nuốt" các
      // route cố định phía trên (kể cả khi 1 chuyên mục lỡ có slug trùng tên 1 route tĩnh).
      path: '/:categorySlug/:filmSlug',
      name: 'film-detail',
      component: lazyResponsiveView(
        () => import('@/features/films/FilmDetailView.vue'),
        () => import('@/features/films/FilmDetailMobileView.vue'),
        'FilmDetailResponsive',
      ),
      meta: { title: 'Chi tiết phim' },
    },
  ],
})

// Guard: khôi phục phiên (1 lần) → chặn chưa đăng nhập → ép đổi mật khẩu → chặn theo role.
router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (!auth.ready) await auth.restore()

  const isPublic = to.meta.public === true

  if (!auth.isAuthenticated) {
    return isPublic ? true : { name: 'login', query: { redirect: to.fullPath } }
  }

  // Đã đăng nhập mà buộc đổi mật khẩu → dồn về trang đổi mật khẩu.
  if (auth.user?.mustChangePassword && to.name !== 'change-password') {
    return { name: 'change-password' }
  }

  // Đã đăng nhập thì không vào lại trang login.
  if (to.name === 'login') return { path: '/' }

  // Chặn theo vai trò (nếu route yêu cầu).
  const roles = to.meta.roles as UserRole[] | undefined
  if (roles && (!auth.role || !roles.includes(auth.role))) {
    return { path: '/' }
  }

  return true
})

// Tiêu đề trình duyệt theo route (quy ước MDS)
router.afterEach((to) => {
  const t = (to.meta.title as string) || ''
  document.title = t ? `${t} — AMIS Kho phim` : 'AMIS Kho phim'
})

export default router
