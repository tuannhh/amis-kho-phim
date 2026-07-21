import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore, type UserRole } from '@/features/auth/authStore'

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
      path: '/films/:slug',
      name: 'film-detail',
      component: () => import('@/features/films/FilmDetailView.vue'),
      meta: { title: 'Chi tiết phim' },
    },
    {
      path: '/upload',
      name: 'upload',
      component: () => import('@/features/upload/FilmUploadView.vue'),
      meta: { title: 'Thêm phim' },
    },
    {
      path: '/categories',
      name: 'categories',
      component: () => import('@/features/categories/CategoryView.vue'),
      meta: { title: 'Chuyên mục' },
    },
    {
      path: '/admin/users',
      name: 'admin-users',
      component: () => import('@/features/admin/UserAdminView.vue'),
      meta: { title: 'Quản trị người dùng', roles: ['super_admin', 'admin'] as UserRole[] },
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
