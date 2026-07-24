<script setup>
// MGlobalInline — "Thông báo dạng Global Inline" theo references/communication.md mục 2.5:
// dải thông báo TRÊN CÙNG ứng dụng (phía trên header), dùng cho cảnh báo mất mạng / có
// phiên bản mới / phiên đăng nhập hết hạn (mobile-pwa.md mục 7). Icon đóng X tuỳ chọn.
// Chưa có trong bộ ui/components/ đóng gói sẵn của skill MDS — TODO: đề xuất bổ sung
// vào bộ chung nếu dùng lại ở nhiều app khác.
import MIcon from './MIcon.vue'
import MButton from './MButton.vue'

const props = defineProps({
  type: { type: String, default: 'info' }, // info | warning | error | success
  icon: { type: String, default: '' },
  actionLabel: { type: String, default: '' },
  closable: { type: Boolean, default: false },
})
const emit = defineEmits(['action', 'close'])

const COLOR = {
  info: 'var(--mds-info)',
  warning: 'var(--mds-warning)',
  error: 'var(--mds-danger)',
  success: 'var(--mds-success)',
}
const ICON = { info: 'info-circle', warning: 'alert-triangle', error: 'alert-circle', success: 'circle-check' }
</script>

<template>
  <div
    class="flex w-full shrink-0 items-center gap-2 px-4 py-2 text-[13px]"
    :style="{
      background: `color-mix(in srgb, ${COLOR[type]} 12%, white)`,
      color: 'var(--mds-text-primary)',
      paddingTop: 'max(8px, env(safe-area-inset-top))',
    }"
    role="status"
  >
    <MIcon :name="icon || ICON[type]" :size="16" :style="{ color: COLOR[type] }" class="shrink-0" />
    <span class="min-w-0 flex-1"><slot /></span>
    <MButton v-if="actionLabel" variant="secondary" size="sm" @click="emit('action')">{{ actionLabel }}</MButton>
    <button
      v-if="closable"
      type="button"
      class="grid h-8 w-8 shrink-0 place-items-center rounded-lg hover:bg-black/5"
      aria-label="Đóng"
      @click="emit('close')"
    >
      <MIcon name="x" :size="16" />
    </button>
  </div>
</template>
