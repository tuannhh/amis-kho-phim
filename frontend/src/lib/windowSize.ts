// Breakpoint theo container, không theo user-agent. Size class vẫn phục vụ density/layout nội
// bộ; còn MDS 2.0 quy định cả điện thoại VÀ tablet (<1200px) phải dùng native mini-app, không
// được rơi về Header Platform + sidebar desktop chỉ vì màn hình rộng hơn 600px.
// Compact <600 · Medium 600-839 · Expanded 840-1199 · Large >=1200.
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { getHostAdapter } from './hostAdapter'

export type SizeClass = 'compact' | 'medium' | 'expanded' | 'large'

const width = ref(typeof window !== 'undefined' ? window.innerWidth : 1280)
let listenerCount = 0

function update() {
  width.value = window.innerWidth
}

/** Export hàm thuần để chốt boundary tablet/mobile trong unit test, không dựa vào UA. */
export function isNativeMobileWidth(value: number): boolean {
  return value < 1200
}

/**
 * AMIS Mobile host luôn chọn native composition, kể cả WebView tablet rộng hơn 1200px.
 * Browser/PWA test không có host contract thì dùng breakpoint làm fallback để vẫn test đúng
 * cây mobile trên phone/tablet. Không chọn shell theo vai trò hay user-agent.
 */
export function isNativeMobileSurface(width: number, embedded: boolean): boolean {
  return embedded || isNativeMobileWidth(width)
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
  /** Host AMIS luôn native; ngoài host thì phone/tablet <1200px cũng dùng native composition. */
  const isNativeMobile = computed(() => isNativeMobileSurface(width.value, getHostAdapter().isEmbedded()))

  return { width, sizeClass, isCompact, isNativeMobile }
}
