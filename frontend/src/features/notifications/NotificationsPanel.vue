<script setup lang="ts">
import { watch } from 'vue'
import { useRouter } from 'vue-router'
import MEmptyState from '@/components/mds/MEmptyState.vue'
import MSpinner from '@/components/mds/MSpinner.vue'
import MIcon from '@/components/mds/MIcon.vue'
import { useNotificationsStore } from './notificationsStore'
import type { ApiNotification } from './notificationsApi'

/**
 * Panel thông báo — góc trên bên phải, dưới chuông trên MHeaderBar. Theo đúng
 * pattern popover tự dựng đã dùng cho menu người dùng (App.vue): lớp phủ
 * `fixed inset-0` bắt click-outside + panel `fixed` định vị dưới header 52px,
 * shadow-md (overlay), KHÔNG dùng MDialog (dialog che toàn màn hình, không hợp
 * cho panel nhỏ góc trên — theo hướng dẫn skill misa-design-system).
 */
const props = withDefaults(
  defineProps<{ modelValue: boolean; topOffset?: number; fullScreen?: boolean }>(),
  { topOffset: 52, fullScreen: false },
)
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

const store = useNotificationsStore()
const router = useRouter()

const TYPE_LABEL: Record<string, string> = { new_film: 'Phim mới', updated: 'Cập nhật bản mới' }

function close() {
  emit('update:modelValue', false)
}

watch(
  () => props.modelValue,
  async (open) => {
    if (open && !store.loaded) await store.loadList()
  },
)

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'Vừa xong'
  if (minutes < 60) return `${minutes} phút trước`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} giờ trước`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} ngày trước`
  return new Date(iso).toLocaleDateString('vi-VN')
}

async function onItemClick(n: ApiNotification) {
  if (!n.isRead) await store.markRead(n.id)
  close()
  if (n.filmSlug) router.push({ name: 'film-detail', params: { slug: n.filmSlug } })
}
</script>

<template>
  <template v-if="modelValue">
    <div class="fixed inset-0 z-40" @click="close" />
    <!-- Compact: full-screen (mobile-pwa.md §4.5 "bottom sheet/dialog" — panel danh sách
         dài hơn chọn full-screen thay vì popover hẹp). Medium+: giữ nguyên popover góc trên. -->
    <div
      class="fixed z-50 flex flex-col overflow-hidden bg-white"
      :class="fullScreen ? 'inset-0' : 'right-2 w-[360px] max-h-[70vh] rounded-lg'"
      :style="fullScreen ? {} : { top: `${topOffset}px`, boxShadow: 'var(--mds-shadow-md, 0 4px 12px 0 rgba(0,0,0,0.12))' }"
    >
      <div
        class="flex shrink-0 items-center justify-between border-b px-3 py-2"
        :style="{ borderColor: 'var(--mds-border-light, #E9EAEB)', paddingTop: fullScreen ? 'max(8px, env(safe-area-inset-top))' : undefined }"
      >
        <span class="flex items-center gap-2">
          <button v-if="fullScreen" type="button" class="grid h-8 w-8 place-items-center rounded-lg" style="color: var(--mds-icon-neutral)" aria-label="Đóng" @click="close">
            <MIcon name="chevron-left" :size="20" />
          </button>
          <p class="text-[13px] font-semibold" style="color: var(--mds-text-primary)">Thông báo</p>
        </span>
        <button
          type="button"
          class="text-[12px] font-medium disabled:cursor-not-allowed disabled:opacity-40"
          style="color: var(--mds-brand-600, #245FDF)"
          :disabled="!store.unreadCount"
          @click="store.markAllRead()"
        >
          Đánh dấu tất cả đã đọc
        </button>
      </div>

      <div class="flex-1 overflow-y-auto">
        <div
          v-if="store.loading"
          class="flex items-center justify-center gap-2 py-8 text-[13px]"
          style="color: var(--mds-text-secondary)"
        >
          <MSpinner :size="16" /> Đang tải...
        </div>
        <MEmptyState
          v-else-if="!store.items.length"
          title="Chưa có thông báo"
          description="Thông báo phim mới/cập nhật bản mới sẽ hiện ở đây."
          class="py-8"
        />
        <template v-else>
          <button
            v-for="n in store.items"
            :key="n.id"
            type="button"
            class="flex w-full items-start gap-2 border-b px-3 py-2.5 text-left hover:bg-[var(--mds-bg-hover-soft,#F2F4F7)]"
            style="border-color: var(--mds-border-light, #E9EAEB)"
            @click="onItemClick(n)"
          >
            <span
              class="mt-1.5 h-2 w-2 shrink-0 rounded-full"
              :class="n.isRead ? '' : 'bg-[var(--mds-brand-600,#245FDF)]'"
            />
            <span class="min-w-0 flex-1">
              <span
                class="block truncate text-[13px]"
                :class="n.isRead ? 'font-normal' : 'font-semibold'"
                style="color: var(--mds-text-primary)"
              >
                {{ TYPE_LABEL[n.type] || n.type }}: {{ n.filmTitle }}
              </span>
              <span class="mt-0.5 block text-[12px]" style="color: var(--mds-text-secondary)">
                {{ relativeTime(n.createdAt) }}
              </span>
            </span>
          </button>
        </template>
      </div>
    </div>
  </template>
</template>
