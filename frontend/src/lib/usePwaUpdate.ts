// Bọc `virtual:pwa-register/vue` (vite-plugin-pwa) — cấp 2 cờ cho App.vue hiện Inline
// Notification: "Có phiên bản mới" (needRefresh, action Cập nhật) và "Sẵn sàng dùng offline"
// (offlineReady, chỉ hiện 1 lần). registerType 'prompt' ở vite.config.ts đảm bảo KHÔNG có
// service worker mới nào tự activate/reload ngầm — người dùng phải bấm "Cập nhật".
import { useRegisterSW } from 'virtual:pwa-register/vue'

export function usePwaUpdate() {
  const { offlineReady, needRefresh, updateServiceWorker } = useRegisterSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      // Kiểm tra bản cập nhật định kỳ (mỗi 30') — trang nội bộ ít khi đóng tab cả ngày.
      if (!registration) return
      setInterval(() => registration.update(), 30 * 60 * 1000)
    },
  })

  async function applyUpdate() {
    await updateServiceWorker(true)
  }

  function dismissOfflineReady() {
    offlineReady.value = false
  }

  return { offlineReady, needRefresh, applyUpdate, dismissOfflineReady }
}
