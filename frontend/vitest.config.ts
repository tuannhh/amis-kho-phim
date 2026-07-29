import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

/**
 * Cấu hình test FE (GĐ7) — CỐ Ý tách khỏi `vite.config.ts` để không nạp plugin PWA/
 * Tailwind khi chạy test (không cần thiết, chỉ làm chậm và ồn log).
 *
 * Phạm vi hiện tại: logic thuần + module bridge (jsdom). CHƯA test component UI —
 * cần thêm @vue/test-utils, và UI đã được kiểm bằng review thật trên trình duyệt qua
 * từng giai đoạn (Review Gate). Ghi nhận là giới hạn có chủ đích, không phải bỏ sót.
 */
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.spec.ts'],
    globals: false,
  },
})
