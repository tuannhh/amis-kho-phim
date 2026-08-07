<script setup lang="ts">
/**
 * Tài khoản — màn hình CHỈ CÓ Ở COMPACT (<600px), GĐ8-B.
 *
 * Lý do tồn tại: từ ADR-061, ở Compact Kho phim ẩn hẳn `MHeaderBar`. Những thứ vốn nằm trong
 * thanh đó mà vẫn CÒN Ý NGHĨA khi chạy nhúng trong AMIS Mobile được gom về đây, đúng một chỗ:
 *   - Thông báo  → mở `NotificationsPanel` full-screen (panel dùng chung với desktop).
 *   - Đổi mật khẩu, Đăng xuất → vốn nằm trong popover avatar của header.
 *   - Các điểm đến ÍT DÙNG không lên được bottom nav (Báo cáo, Quản lý phòng ban, Quản trị
 *     người dùng) — bottom nav chỉ chứa tối đa 4 mục + FAB (mobile-pwa.md §3).
 * Hai thứ KHÔNG bù lại vì vô nghĩa khi nhúng: nút 9 chấm chuyển ứng dụng và cụm tiện ích
 * AVA/Chat/Trợ giúp — app mẹ AMIS Mobile đã có sẵn.
 *
 * Ở Medium trở lên màn này không tồn tại trong điều hướng (header MDS lo hết) → tự chuyển về
 * Kho phim nếu người dùng kéo rộng cửa sổ khi đang đứng ở đây.
 */
import { computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import MIcon from '@/components/mds/MIcon.vue'
import MobileHeroHeader from '@/components/mobile/MobileHeroHeader.vue'
import { useAuthStore } from '@/features/auth/authStore'
import { ROLE_LABEL, ADMIN_ROLES, REPORT_ROLES } from '@/features/auth/permissions'
import { useNotificationsStore } from '@/features/notifications/notificationsStore'
import { useWindowSize } from '@/lib/windowSize'

const router = useRouter()
const auth = useAuthStore()
const notifications = useNotificationsStore()
const { isCompact } = useWindowSize()

const emit = defineEmits<{ (e: 'notifications'): void }>()

watch(
  isCompact,
  (compact) => {
    if (!compact) router.replace({ name: 'films' })
  },
  { immediate: true },
)

/** Chữ cái đầu của tên — avatar chữ, không tải ảnh (hệ thống chưa có ảnh đại diện thật). */
const initials = computed(() => {
  const parts = (auth.user?.fullName || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  const last = parts[parts.length - 1][0]
  const first = parts.length > 1 ? parts[0][0] : ''
  return (first + last).toUpperCase()
})

const roleLabel = computed(() => (auth.role ? ROLE_LABEL[auth.role] : ''))

/**
 * Điểm đến bị đẩy khỏi bottom nav. Cùng ma trận RBAC với sidebar desktop (`App.vue`) — không
 * viết lại điều kiện quyền ở đây, chỉ dùng lại đúng các hằng số vai trò.
 */
const adminItems = computed(() => {
  const role = auth.role
  const items: Array<{ key: string; label: string; icon: string }> = []
  if (role && REPORT_ROLES.includes(role)) {
    items.push({ key: 'admin-reports', label: 'Báo cáo', icon: 'chart-bar' })
  }
  if (role && ADMIN_ROLES.includes(role)) {
    items.push({ key: 'admin-departments', label: 'Quản lý phòng ban', icon: 'building' })
    items.push({ key: 'admin-users', label: 'Quản trị người dùng', icon: 'users' })
  }
  return items
})

function go(key: string) {
  router.push({ name: key })
}

function logout() {
  auth.logout()
  router.replace({ name: 'login' })
}
</script>

<template>
  <section class="flex h-full flex-col" style="background: var(--mds-bg-page, #ecedef)">
    <MobileHeroHeader title="Tài khoản">
      <!-- Thẻ danh tính nằm ĐÈ lên mép dưới vùng brand: bố cục quen thuộc của app di động,
           đồng thời giúp mắt bám vào tên người dùng thay vì vào thanh màu. -->
      <div
        class="mt-3 flex items-center gap-3 rounded-2xl bg-white p-3.5"
        style="box-shadow: 0 8px 20px -8px rgba(16, 24, 40, 0.28)"
      >
        <span
          class="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-[18px] font-semibold"
          style="background: var(--mds-brand-50); color: var(--mds-brand-700)"
          aria-hidden="true"
        >
          {{ initials }}
        </span>
        <div class="min-w-0 flex-1">
          <p class="truncate text-[16px] font-semibold leading-[22px]" style="color: var(--mds-text)">
            {{ auth.user?.fullName }}
          </p>
          <p class="mt-0.5 truncate text-[12.5px]" style="color: var(--mds-text-secondary)">
            {{ auth.user?.email }}
          </p>
          <span
            v-if="roleLabel"
            class="mt-1.5 inline-flex h-6 items-center rounded-full px-2.5 text-[11.5px] font-semibold"
            style="background: var(--mds-brand-50); color: var(--mds-brand-700)"
          >
            {{ roleLabel }}
          </span>
        </div>
      </div>
    </MobileHeroHeader>

    <div class="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-4">
      <!-- Nhóm 1: những gì vốn nằm trong header MDS đã bị ẩn -->
      <p class="mb-2 px-1 text-[11.5px] font-semibold uppercase tracking-wide" style="color: var(--mds-text-secondary)">
        Cá nhân
      </p>
      <div class="overflow-hidden rounded-2xl bg-white" style="box-shadow: var(--mds-shadow-card)">
        <button
          type="button"
          class="flex w-full items-center gap-3 px-3.5 text-left active:bg-[var(--mds-bg-hover-soft)]"
          style="min-height: 56px"
          @click="emit('notifications')"
        >
          <span
            class="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
            style="background: var(--mds-brand-50); color: var(--mds-brand-600)"
          >
            <MIcon name="bell" :size="18" />
          </span>
          <span class="min-w-0 flex-1 truncate text-[14px]" style="color: var(--mds-text)">Thông báo</span>
          <span
            v-if="notifications.unreadCount > 0"
            class="grid h-5 min-w-5 shrink-0 place-items-center rounded-full px-1.5 text-[11px] font-semibold text-white"
            style="background: var(--mds-danger)"
          >
            {{ notifications.unreadCount > 99 ? '99+' : notifications.unreadCount }}
          </span>
          <MIcon name="chevron-right" :size="18" style="color: var(--mds-text-placeholder)" />
        </button>

        <div class="mx-3.5 border-t" style="border-color: var(--mds-border-light)" />

        <button
          type="button"
          class="flex w-full items-center gap-3 px-3.5 text-left active:bg-[var(--mds-bg-hover-soft)]"
          style="min-height: 56px"
          @click="go('change-password')"
        >
          <span
            class="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
            style="background: var(--mds-brand-50); color: var(--mds-brand-600)"
          >
            <MIcon name="lock" :size="18" />
          </span>
          <span class="min-w-0 flex-1 truncate text-[14px]" style="color: var(--mds-text)">Đổi mật khẩu</span>
          <MIcon name="chevron-right" :size="18" style="color: var(--mds-text-placeholder)" />
        </button>
      </div>

      <!-- Nhóm 2: điểm đến quản trị không lên bottom nav (chỉ hiện đúng theo vai trò) -->
      <template v-if="adminItems.length">
        <p class="mb-2 mt-5 px-1 text-[11.5px] font-semibold uppercase tracking-wide" style="color: var(--mds-text-secondary)">
          Quản trị
        </p>
        <div class="overflow-hidden rounded-2xl bg-white" style="box-shadow: var(--mds-shadow-card)">
          <template v-for="(item, i) in adminItems" :key="item.key">
            <div v-if="i > 0" class="mx-3.5 border-t" style="border-color: var(--mds-border-light)" />
            <button
              type="button"
              class="flex w-full items-center gap-3 px-3.5 text-left active:bg-[var(--mds-bg-hover-soft)]"
              style="min-height: 56px"
              @click="go(item.key)"
            >
              <span
                class="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
                style="background: var(--mds-brand-50); color: var(--mds-brand-600)"
              >
                <MIcon :name="item.icon" :size="18" />
              </span>
              <span class="min-w-0 flex-1 truncate text-[14px]" style="color: var(--mds-text)">
                {{ item.label }}
              </span>
              <MIcon name="chevron-right" :size="18" style="color: var(--mds-text-placeholder)" />
            </button>
          </template>
        </div>
      </template>

      <!-- Đăng xuất đứng RIÊNG một khối, cách xa các mục điều hướng để không bấm nhầm -->
      <button
        type="button"
        class="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-white text-[14px] font-semibold active:bg-[var(--mds-bg-hover-soft)]"
        style="min-height: 52px; color: var(--mds-danger); box-shadow: var(--mds-shadow-card)"
        @click="logout"
      >
        <MIcon name="logout" :size="18" />
        Đăng xuất
      </button>

      <p class="mt-5 text-center text-[11.5px]" style="color: var(--mds-text-placeholder)">
        AMIS Kho phim · MISA
      </p>
    </div>
  </section>
</template>
