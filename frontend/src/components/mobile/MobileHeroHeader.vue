<script setup lang="ts">
/**
 * MobileHeroHeader — thanh đầu trang của các màn hình CẤP MỘT ở Compact (<600px), GĐ8-B.
 *
 * Vì sao có component này thay vì dùng `MHeaderBar`:
 * từ ADR-061, ở Compact Kho phim ẨN HẲN `MHeaderBar` (thanh brand 9 chấm/tìm kiếm/chuông/
 * avatar). Mô hình phân phối thật trên điện thoại là NHÚNG trong app AMIS Mobile — app mẹ đã
 * có chrome riêng của nó, nên chồng thêm một thanh brand nữa vừa thừa vừa "web thu nhỏ".
 * Thanh này thay vai trò đó: vẫn là vùng brand nhận diện app, nhưng dựng theo ngôn ngữ mobile
 * (bo góc dưới lớn, khoảng thở rộng, tiêu đề lớn) chứ không phải một dải công cụ dày đặc icon.
 *
 * Màu: CHỈ dùng token brand của theme hiện tại (`--mds-brand-600/700`). Gradient là chuyển sắc
 * giữa hai bậc CÙNG thang brand, không pha màu mới ngoài token.
 *
 * Dùng ở màn cấp một (Kho phim, Tài khoản...). Màn cấp hai (chi tiết phim, form) vẫn dùng
 * `MMobileTopBar` với nút Back — không đổi.
 */
import MIcon from '@/components/mds/MIcon.vue'

withDefaults(
  defineProps<{
    title: string
    /** Dòng phụ nhỏ dưới tiêu đề (vd tên người dùng, số lượng bản ghi). */
    subtitle?: string
    /** Hiện chuông thông báo ở góc phải (bù cho chuông của MHeaderBar đã bị ẩn). */
    showNotifications?: boolean
    notificationCount?: number
  }>(),
  { subtitle: '', showNotifications: false, notificationCount: 0 },
)

const emit = defineEmits<{ (e: 'notifications'): void }>()
</script>

<template>
  <header
    class="relative shrink-0 rounded-b-[24px] px-4 pb-4"
    style="
      background: linear-gradient(160deg, var(--mds-brand-600) 0%, var(--mds-brand-700) 100%);
      padding-top: max(14px, env(safe-area-inset-top));
    "
  >
    <div class="flex items-start gap-2">
      <div class="min-w-0 flex-1">
        <h1 class="truncate text-[22px] font-semibold leading-[28px] text-white">{{ title }}</h1>
        <p v-if="subtitle" class="mt-0.5 truncate text-[13px] leading-[18px] text-white/75">
          {{ subtitle }}
        </p>
      </div>

      <!-- Vùng chạm 48px (mobile-pwa.md §5); glyph giữ 20px, chỉ nới vùng bấm. -->
      <button
        v-if="showNotifications"
        type="button"
        class="relative -mr-1.5 -mt-1 grid h-12 w-12 shrink-0 place-items-center rounded-full text-white active:bg-white/15"
        :aria-label="notificationCount ? `Thông báo (${notificationCount} chưa đọc)` : 'Thông báo'"
        @click="emit('notifications')"
      >
        <MIcon name="bell" :size="22" />
        <span
          v-if="notificationCount > 0"
          class="absolute right-1.5 top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[10px] font-semibold leading-none text-white ring-2"
          style="background: var(--mds-danger); --tw-ring-color: var(--mds-brand-700)"
        >
          {{ notificationCount > 99 ? '99+' : notificationCount }}
        </span>
      </button>
    </div>

    <!-- Chỗ cắm ô tìm kiếm / chip / nội dung phụ nằm TRONG vùng brand -->
    <slot />
  </header>
</template>
