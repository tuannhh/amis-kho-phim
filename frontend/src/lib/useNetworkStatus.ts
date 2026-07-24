// Theo dõi navigator.onLine + sự kiện online/offline — dùng cho Inline Notification
// "Mất kết nối mạng" trong App.vue (mobile-pwa.md §7 "Offline": Inline/Inline Notification
// trong vùng nội dung, KHÔNG chỉ toast).
import { onMounted, onUnmounted, ref } from 'vue'

export function useNetworkStatus() {
  const isOnline = ref(typeof navigator !== 'undefined' ? navigator.onLine : true)

  function onOnline() {
    isOnline.value = true
  }
  function onOffline() {
    isOnline.value = false
  }

  onMounted(() => {
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
  })
  onUnmounted(() => {
    window.removeEventListener('online', onOnline)
    window.removeEventListener('offline', onOffline)
  })

  return { isOnline }
}
