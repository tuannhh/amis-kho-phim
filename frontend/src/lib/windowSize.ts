// Window size class theo skill misa-design-system (references/patterns/mobile-pwa.md §2):
// breakpoint HÀNH VI theo chiều rộng cửa sổ hiện tại, không theo tên thiết bị/user-agent.
// Compact <600 · Medium 600-839 · Expanded 840-1199 · Large >=1200.
import { computed, onMounted, onUnmounted, ref } from 'vue'

export type SizeClass = 'compact' | 'medium' | 'expanded' | 'large'

const width = ref(typeof window !== 'undefined' ? window.innerWidth : 1280)
let listenerCount = 0

function update() {
  width.value = window.innerWidth
}

/**
 * Composable dùng chung — nhiều component gọi cùng lúc chỉ đăng ký 1 listener resize
 * (đếm tham chiếu qua listenerCount) để tránh trùng lặp khi App.vue + MHeaderBar +
 * NotificationsPanel... đều cần biết size class hiện tại.
 */
export function useWindowSize() {
  onMounted(() => {
    if (listenerCount === 0) window.addEventListener('resize', update)
    listenerCount++
    update()
  })
  onUnmounted(() => {
    listenerCount--
    if (listenerCount === 0) window.removeEventListener('resize', update)
  })

  const sizeClass = computed<SizeClass>(() => {
    const w = width.value
    if (w < 600) return 'compact'
    if (w < 840) return 'medium'
    if (w < 1200) return 'expanded'
    return 'large'
  })
  const isCompact = computed(() => sizeClass.value === 'compact')

  return { width, sizeClass, isCompact }
}
