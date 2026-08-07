<script setup lang="ts">
/**
 * MobileBottomNav — điều hướng cấp một ở Compact (<600px), GĐ8-B.
 *
 * Khác bản GĐ8-A (dãy nút phẳng dàn đều trong `App.vue`):
 *  - Thanh nền trắng bo góc trên lớn + đổ bóng hắt LÊN, tách khỏi nội dung như một lớp nổi
 *    riêng thay vì chỉ là một đường kẻ `border-t`.
 *  - Hành động chính "Thêm phim" là NÚT TRÒN NỔI (FAB) đặt giữa, nhô lên đè mép thanh — thay
 *    cho việc vừa có nút "Thêm" trong toolbar trang vừa có tab "Thêm phim" trùng chức năng.
 *    FAB chỉ hiện với người có quyền tạo phim (RBAC do cha truyền xuống qua `show-fab`).
 *  - Mục đang chọn có nền brand nhạt dạng viên thuốc bao quanh icon, không chỉ đổi màu chữ.
 *
 * Tối đa 4 mục điều hướng + FAB (mobile-pwa.md §3: bottom nav khi <= 5 điểm đến cấp một).
 * Những điểm đến còn lại (Quản trị, Báo cáo) cha đưa vào màn "Tài khoản", không nhồi vào đây.
 * Icon lấy từ bộ Tabler đã đăng ký; màu chỉ dùng token brand/neutral.
 */
import MIcon from '@/components/mds/MIcon.vue'

export interface BottomNavItem {
  key: string
  label: string
  icon: string
}

const props = withDefaults(
  defineProps<{
    items: BottomNavItem[]
    active: string
    showFab?: boolean
    fabLabel?: string
    fabIcon?: string
  }>(),
  { showFab: false, fabLabel: 'Thêm phim', fabIcon: 'plus' },
)

const emit = defineEmits<{ (e: 'select', key: string): void; (e: 'fab'): void }>()

/**
 * Khi có FAB, chia mục thành hai cụm trái/phải để chừa đúng một khoảng trống ở GIỮA cho nút
 * tròn — không để FAB đè lên nhãn của mục nào. Số mục lẻ thì cụm trái nhiều hơn một.
 */
function half(side: 'left' | 'right') {
  if (!props.showFab) return side === 'left' ? props.items : []
  const cut = Math.ceil(props.items.length / 2)
  return side === 'left' ? props.items.slice(0, cut) : props.items.slice(cut)
}
</script>

<template>
  <nav
    class="fixed inset-x-0 bottom-0 z-30 rounded-t-[20px] bg-white"
    style="
      box-shadow: 0 -6px 20px -6px rgba(16, 24, 40, 0.14);
      padding-bottom: env(safe-area-inset-bottom);
      padding-left: env(safe-area-inset-left);
      padding-right: env(safe-area-inset-right);
    "
    aria-label="Điều hướng chính"
  >
    <div class="relative flex items-stretch">
      <!-- Cụm trái -->
      <button
        v-for="item in half('left')"
        :key="item.key"
        type="button"
        class="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-0.5 pb-1.5 pt-2"
        style="min-height: 60px"
        :class="active === item.key ? 'text-[var(--mds-brand-600)]' : 'text-[var(--mds-text-secondary)]'"
        :aria-current="active === item.key ? 'page' : undefined"
        @click="emit('select', item.key)"
      >
        <span
          class="grid h-7 w-12 shrink-0 place-items-center rounded-full transition-colors"
          :style="active === item.key ? 'background: var(--mds-brand-50)' : ''"
        >
          <MIcon :name="item.icon" :size="20" />
        </span>
        <span
          class="max-w-full truncate text-[10px] leading-[13px]"
          :class="active === item.key ? 'font-semibold' : ''"
        >
          {{ item.label }}
        </span>
      </button>

      <!-- Khoảng trống dành cho FAB ở giữa -->
      <div v-if="showFab" class="w-[68px] shrink-0" aria-hidden="true" />

      <!-- Cụm phải -->
      <button
        v-for="item in half('right')"
        :key="item.key"
        type="button"
        class="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-0.5 pb-1.5 pt-2"
        style="min-height: 60px"
        :class="active === item.key ? 'text-[var(--mds-brand-600)]' : 'text-[var(--mds-text-secondary)]'"
        :aria-current="active === item.key ? 'page' : undefined"
        @click="emit('select', item.key)"
      >
        <span
          class="grid h-7 w-12 shrink-0 place-items-center rounded-full transition-colors"
          :style="active === item.key ? 'background: var(--mds-brand-50)' : ''"
        >
          <MIcon :name="item.icon" :size="20" />
        </span>
        <span
          class="max-w-full truncate text-[10px] leading-[13px]"
          :class="active === item.key ? 'font-semibold' : ''"
        >
          {{ item.label }}
        </span>
      </button>

      <!-- FAB: 56px đường kính (>48px vùng chạm), nhô lên khỏi mép thanh -->
      <button
        v-if="showFab"
        type="button"
        class="absolute left-1/2 grid h-14 w-14 -translate-x-1/2 place-items-center rounded-full text-white active:scale-95"
        style="
          top: -22px;
          background: linear-gradient(160deg, var(--mds-brand-500) 0%, var(--mds-brand-600) 100%);
          box-shadow: 0 6px 16px -2px color-mix(in srgb, var(--mds-brand-600) 45%, transparent);
          transition: transform 120ms ease;
        "
        :aria-label="fabLabel"
        @click="emit('fab')"
      >
        <MIcon :name="fabIcon" :size="26" />
      </button>
    </div>
  </nav>
</template>
