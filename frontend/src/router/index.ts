import { createRouter, createWebHistory } from 'vue-router'

/**
 * Router AMIS Kho phim.
 * Mỗi feature là 1 route độc lập (lazy-load) → module hoá, sửa 1 vùng không lan.
 * GĐ 0: các view là placeholder; GĐ 0.5 sẽ thay bằng UI mock đầy đủ.
 */
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/films' },
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
      meta: { title: 'Quản trị người dùng' },
    },
  ],
})

// Tiêu đề trình duyệt theo route (quy ước MDS)
router.afterEach((to) => {
  const t = (to.meta.title as string) || ''
  document.title = t ? `${t} — AMIS Kho phim` : 'AMIS Kho phim'
})

export default router
