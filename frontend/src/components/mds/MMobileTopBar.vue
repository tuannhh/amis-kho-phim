<script setup>
/**
 * MMobileTopBar — clone của `ui/templates/mobile/MMobileTopBar.vue` (skill misa-design-system),
 * giữ nguyên bố cục/kích thước/token của khung gốc.
 *
 * Khác biệt duy nhất so với khung gốc: BỎ biến thể `mode="home"`. Ở AMIS Kho phim, app shell
 * cấp một (logo, tìm kiếm, thông báo, avatar) đã do `MHeaderBar :compact` đảm nhiệm từ GĐ6 —
 * dựng thêm một thanh "home" nữa sẽ thành hai header chồng nhau. Thanh này chỉ dùng cho
 * thanh TIÊU ĐỀ TRANG bên trong nội dung (Back + tiêu đề rút gọn + More), đúng vai trò
 * `mode="page"` của khung gốc.
 *
 * Nút More: mặc định là icon button phát sự kiện `more`; truyền slot `actions` để thay bằng
 * `MDropdownMenu` khi cần menu thật (mobile-pwa.md §4.3 — action ít dùng gom vào More, không
 * dồn 4-5 text button lên header).
 */
import MIcon from './MIcon.vue'

defineProps({
  title: { type: String, default: '' },
  /** Ẩn hẳn vùng bên phải khi trang không có thao tác phụ nào. */
  showMore: { type: Boolean, default: true },
})
const emit = defineEmits(['back', 'more'])
</script>

<template>
  <header
    class="flex h-12 shrink-0 items-center gap-2 border-b bg-white px-2"
    style="border-color: var(--mds-border-light, #e9eaeb)"
  >
    <!-- Vùng chạm 48px theo mobile-pwa.md §5 (glyph vẫn giữ 24px, chỉ nới vùng bấm). -->
    <button
      type="button"
      class="grid h-12 w-12 shrink-0 place-items-center rounded-lg hover:bg-[var(--mds-bg-hover-soft,#F2F4F7)]"
      style="color: var(--mds-icon-neutral)"
      aria-label="Quay lại"
      @click="emit('back')"
    >
      <MIcon name="chevron-left" :size="24" />
    </button>

    <h1
      class="min-w-0 flex-1 truncate text-[16px] font-semibold leading-[22px]"
      style="color: var(--mds-text-primary)"
      :title="title"
    >
      {{ title }}
    </h1>

    <slot name="actions">
      <button
        v-if="showMore"
        type="button"
        class="grid h-12 w-12 shrink-0 place-items-center rounded-lg hover:bg-[var(--mds-bg-hover-soft,#F2F4F7)]"
        style="color: var(--mds-icon-neutral)"
        aria-label="Thêm thao tác"
        @click="emit('more')"
      >
        <MIcon name="dots-vertical" :size="20" />
      </button>
    </slot>
  </header>
</template>
