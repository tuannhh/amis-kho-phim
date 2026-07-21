import { defineStore } from 'pinia'
import { ref } from 'vue'
import { notificationsApi, type ApiNotification } from './notificationsApi'

/**
 * Thông báo phim mới/cập nhật bản mới (GĐ5). Không cần realtime phức tạp:
 * load số chưa đọc khi mount + poll định kỳ (mặc định 30s) + load lại sau khi
 * đánh dấu đã đọc. Panel danh sách (NotificationsPanel.vue) gọi `loadList()`
 * khi mở lần đầu.
 */
export const useNotificationsStore = defineStore('notifications', () => {
  const items = ref<ApiNotification[]>([])
  const unreadCount = ref(0)
  const loading = ref(false)
  const loaded = ref(false)
  let pollTimer: ReturnType<typeof setInterval> | undefined

  async function refreshUnreadCount() {
    try {
      unreadCount.value = (await notificationsApi.unreadCount()).count
    } catch {
      // im lặng — không làm phiền người dùng vì lỗi poll nền
    }
  }

  async function loadList() {
    loading.value = true
    try {
      items.value = await notificationsApi.list()
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  async function markRead(id: number) {
    const item = items.value.find((i) => i.id === id)
    if (item?.isRead) return
    await notificationsApi.markRead(id)
    if (item) item.isRead = true
    await refreshUnreadCount()
  }

  async function markAllRead() {
    await notificationsApi.markAllRead()
    items.value.forEach((i) => (i.isRead = true))
    unreadCount.value = 0
  }

  function startPolling(intervalMs = 30000) {
    stopPolling()
    refreshUnreadCount()
    pollTimer = setInterval(refreshUnreadCount, intervalMs)
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = undefined
    }
    loaded.value = false
    items.value = []
    unreadCount.value = 0
  }

  return { items, unreadCount, loading, loaded, refreshUnreadCount, loadList, markRead, markAllRead, startPolling, stopPolling }
})
