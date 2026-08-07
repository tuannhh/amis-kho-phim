import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    VitePWA({
      // 'prompt' (không phải 'autoUpdate'): KHÔNG được tự activate service worker mới
      // và reload ngầm khi người dùng có form đang nhập dở (vd FilmUploadView) — theo
      // đúng mobile-pwa.md mục 7 "Có phiên bản mới". App tự hiện Inline Notification
      // "Có phiên bản mới" + nút Cập nhật qua virtual:pwa-register (xem App.vue).
      registerType: 'prompt',
      injectRegister: null,
      manifest: {
        id: '/',
        name: 'AMIS Kho phim',
        short_name: 'Kho phim',
        description: 'Quản lý kho phim nội bộ MISA — xem, tìm kiếm, đăng tải phim theo chuyên mục.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        lang: 'vi',
        background_color: '#ffffff',
        theme_color: '#245fdf',
        icons: [
          { src: '/icons/app-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/app-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/app-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell + static asset: cache tự động qua glob mặc định (js/css/html/ảnh).
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // KHÔNG cache /media/* (video — nặng, không nên chiếm cache storage) và
        // KHÔNG cache request có Authorization header (dữ liệu nhạy cảm/token).
        navigateFallbackDenylist: [/^\/api\//, /^\/media\//],
        runtimeCaching: [
          {
            // API nghiệp vụ: network-first, fallback cache khi mất mạng (dữ liệu stale
            // có nhãn rõ ở tầng UI qua offline banner — không âm thầm hiện dữ liệu cũ).
            urlPattern: /^\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'kho-phim-api',
              networkTimeoutSeconds: 8,
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 },
            },
          },
          {
            // Video/thumbnail stream qua proxy — không bao giờ cache (file lớn, có thể
            // gắn theo quyền truy cập, không phù hợp cache dùng chung ở SW).
            urlPattern: /^\/media\/.*/i,
            handler: 'NetworkOnly',
          },
        ],
      },
      devOptions: {
        // Bật SW cả khi `npm run dev` để tiện kiểm thử offline/update trong quá trình dựng —
        // không ảnh hưởng gì tới build production (chỉ là cờ dev).
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5173,
    // Chỉ có tác dụng khi `npm run dev` (không ảnh hưởng bản build): đẩy /api và /media sang
    // stack Docker đang chạy (nginx ở cổng 8180) để dựng/soi giao diện với DỮ LIỆU THẬT mà
    // không phải build lại image frontend mỗi lần sửa một dòng CSS.
    proxy: {
      '/api': { target: process.env.DEV_API_TARGET || 'http://localhost:8180', changeOrigin: true },
      '/media': { target: process.env.DEV_API_TARGET || 'http://localhost:8180', changeOrigin: true },
    },
  },
})
