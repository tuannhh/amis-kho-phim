import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore, type UserRole } from '@/features/auth/authStore'
import {
  ADMIN_ROLES,
  FILM_WRITE_ROLES,
  MANAGED_FILMS_ROLES,
  REPORT_ROLES,
} from '@/features/auth/permissions'

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
      component: () => import('@/features/films/FilmListView.vue'),
      meta: { title: 'Kho phim' },
    },
    {
      path: '/my-films',
      name: 'my-films',
      component: () => import('@/features/films/ManagedFilmsView.vue'),
      // Cấp 1 không quản lý phim nào → không có gì để hiện, chặn luôn ở route.
      meta: { title: 'Phim tôi quản lý', roles: MANAGED_FILMS_ROLES },
    },
    {
      path: '/films/:slug',
      name: 'film-detail',
      component: () => import('@/features/films/FilmDetailView.vue'),
      meta: { title: 'Chi tiết phim' },
    },
    {
      path: '/upload',
      name: 'upload',
      component: () => import('@/features/upload/FilmUploadView.vue'),
      // Cấp 1 (viewer) không được vào màn tạo/sửa phim — backend cũng chặn ở @Roles.
      meta: { title: 'Thêm phim', roles: FILM_WRITE_ROLES },
    },
    {
      path: '/categories',
      name: 'categories',
      component: () => import('@/features/categories/CategoryView.vue'),
      // Cấp 1 (viewer) chỉ có đúng "Kho phim": không thấy menu Chuyên mục và cũng không vào
      // được bằng cách gõ thẳng URL (ẩn menu thôi thì chưa đủ).
      meta: { title: 'Chuyên mục', roles: FILM_WRITE_ROLES },
    },
    {
      path: '/admin/departments',
      name: 'admin-departments',
      component: () => import('@/features/departments/DepartmentAdminView.vue'),
      meta: { title: 'Quản lý phòng ban', roles: ADMIN_ROLES },
    },
    {
      path: '/admin/users',
      name: 'admin-users',
      component: () => import('@/features/admin/UserAdminView.vue'),
      meta: { title: 'Quản trị người dùng', roles: ADMIN_ROLES },
    },
    {
      path: '/admin/reports',
      name: 'admin-reports',
      component: () => import('@/features/reports/ReportsView.vue'),
      // ADR-053: Cấp 3 vào được, backend tự giới hạn dữ liệu theo phòng ban của họ.
      meta: { title: 'Báo cáo', roles: REPORT_ROLES },
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
