<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { isEmbedded, registerBackHandler } from '@/lib/amisBridge'
import MHeaderBar from '@/components/mds/MHeaderBar.vue'
import MSidebar from '@/components/mds/MSidebar.vue'
import MToast from '@/components/mds/MToast.vue'
import MIcon from '@/components/mds/MIcon.vue'
import MGlobalInline from '@/components/mds/MGlobalInline.vue'
import { filmSearchQuery } from '@/features/films/searchState'
import { useAuthStore, type UserRole } from '@/features/auth/authStore'
import { useNotificationsStore } from '@/features/notifications/notificationsStore'
import NotificationsPanel from '@/features/notifications/NotificationsPanel.vue'
import { useWindowSize } from '@/lib/windowSize'
import { useNetworkStatus } from '@/lib/useNetworkStatus'
import { usePwaUpdate } from '@/lib/usePwaUpdate'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const notifications = useNotificationsStore()

// GĐ6 — PWA & Mobile: window size class (mobile-pwa.md §2), trạng thái mạng và
// service worker cập nhật (mobile-pwa.md §7).
const { isCompact } = useWindowSize()
const { isOnline } = useNetworkStatus()
const { needRefresh, offlineReady, applyUpdate, dismissOfflineReady } = usePwaUpdate()

// Poll số thông báo chưa đọc khi đã đăng nhập; dừng khi đăng xuất (GĐ5).
watch(
  () => auth.isAuthenticated,
  (ok) => (ok ? notifications.startPolling() : notifications.stopPolling()),
  { immediate: true },
)

const notificationsPanelOpen = ref(false)
function toggleNotificationsPanel() {
  userMenuOpen.value = false
  notificationsPanelOpen.value = !notificationsPanelOpen.value
}

// Trang auth (login/đổi mật khẩu) hiển thị full-page, không header/sidebar.
const isBlank = computed(() => route.meta.blank === true)

// GĐ6.1 — Chế độ nhúng trong WebView AMIS Mobile (scaffold, xem lib/amisBridge.ts):
// app mẹ đã có chrome riêng (header/điều hướng của nó) nên Kho phim ẩn hẳn MHeaderBar +
// sidebar/bottom-nav, chỉ render router-view full màn hình — tương tự cách isBlank xử lý
// trang auth, nhưng áp dụng cho MỌI route khi đang nhúng.
const isEmbeddedMode = isEmbedded()

// Nút back cứng của app mẹ (Android) gọi vào đây qua window.__khoPhimHandleNativeBack.
// TODO(AMIS Mobile bridge thật): điểm nối window.AMISBridge?.closeWebview?.() bên dưới là
// giả định tạm — xác nhận lại tên hàm thật với đội AMIS Mobile.
onMounted(() => {
  if (!isEmbeddedMode) return
  registerBackHandler(() => {
    if (route.name !== 'films' && router.currentRoute.value.fullPath !== '/') {
      router.back()
    } else {
      window.AMISBridge?.closeWebview?.()
    }
  })
})

const ROLE_LABEL: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  employee: 'Nhân viên',
}

// Điều hướng sidebar ↔ route (key = tên route gốc). Mục Quản trị người dùng
// chỉ hiện với super_admin/admin (quyền thực vẫn do backend kiểm).
const allSidebarItems = [
  { key: 'films', label: 'Kho phim', icon: 'layout-grid' },
  { key: 'upload', label: 'Thêm phim', icon: 'upload' },
  { key: 'categories', label: 'Chuyên mục', icon: 'folder' },
  { key: 'admin-users', label: 'Quản trị người dùng', icon: 'users', roles: ['super_admin', 'admin'] as UserRole[] },
  { key: 'admin-reports', label: 'Báo cáo', icon: 'chart-bar', roles: ['super_admin', 'admin'] as UserRole[] },
]
const sidebarItems = computed(() =>
  allSidebarItems.filter((it) => !it.roles || (auth.role && it.roles.includes(auth.role))),
)

const activeKey = computed<string>(() => {
  const name = route.name as string
  if (name === 'film-detail') return 'films'
  return name || 'films'
})
const collapsed = ref(false)

function onNavigate(key: string) {
  router.push({ name: key })
}

// Danh tính thật từ auth store (thay CURRENT_MOCK_USER của GĐ0.5).
const currentUser = computed(() => (auth.user ? { name: auth.user.fullName } : undefined))

// Ô tìm kiếm DUY NHẤT ở header — Enter tìm phim, tự sang Kho phim nếu đang màn khác.
function onHeaderSearch(text: string) {
  filmSearchQuery.value = text
  if (route.name !== 'films') router.push({ name: 'films' })
}

function goHome() {
  if (route.name !== 'films') router.push({ name: 'films' })
}

// Menu người dùng (đổi mật khẩu / đăng xuất) — popover nhẹ góc trên phải.
const userMenuOpen = ref(false)
function toggleUserMenu() {
  notificationsPanelOpen.value = false
  userMenuOpen.value = !userMenuOpen.value
}
function goChangePassword() {
  userMenuOpen.value = false
  router.push({ name: 'change-password' })
}
function logout() {
  userMenuOpen.value = false
  auth.logout()
  router.replace({ name: 'login' })
}

// Chiều cao thật của khối banner (offline/update) + header — dùng làm điểm neo `top`
// cho popover/panel nổi, vì banner Global Inline có thể hiện/ẩn động (mobile-pwa.md
// §7) làm header trôi xuống; không được hardcode top cố định như trước GĐ6.
const topBarEl = ref<HTMLElement | null>(null)
const topBarHeight = ref(48)
let topBarObserver: ResizeObserver | null = null
watch(topBarEl, (el) => {
  topBarObserver?.disconnect()
  if (!el) return
  topBarObserver = new ResizeObserver(([entry]) => {
    topBarHeight.value = entry.contentRect.height
  })
  topBarObserver.observe(el)
})

// Tìm kiếm full-width overlay ở Compact (mobile-pwa.md §3): MHeaderBar tự ẩn ô input
// và phát sự kiện này khi bấm icon tìm kiếm — App.vue chỉ cần forward tới cùng logic
// onHeaderSearch đã có.
function offlineRetry() {
  location.reload()
}
</script>

<template>
  <!-- GĐ6.1 — đang thử SSO qua bridge AMIS Mobile lúc khởi động (embedded, xem authStore.restore).
       Chỉ hiện khi embedded để không đổi hành vi màn hình mặc định (không query param). -->
  <div
    v-if="isEmbeddedMode && auth.bridgeAuthPending"
    class="flex h-dvh w-full items-center justify-center"
    style="background: var(--mds-bg-canvas, #ECEDEF)"
  >
    <p class="text-[13px]" style="color: var(--mds-text-secondary)">Đang xác thực...</p>
  </div>

  <!-- Layout embedded: full màn hình, không header/sidebar/bottom-nav (app mẹ tự có chrome) -->
  <template v-else-if="isEmbeddedMode">
    <router-view />
    <MToast />
  </template>

  <!-- Layout auth: full-page -->
  <router-view v-else-if="isBlank" />

  <!-- Layout app: header + sidebar -->
  <div
    v-else
    class="flex flex-col"
    style="background: var(--mds-bg-canvas, #ECEDEF); min-height: 100dvh; height: 100dvh"
  >
    <div ref="topBarEl" class="shrink-0" style="padding-left: env(safe-area-inset-left); padding-right: env(safe-area-inset-right)">
      <!-- Global Inline: mất mạng (mobile-pwa.md §7 "Offline") -->
      <MGlobalInline v-if="!isOnline" type="warning" icon="alert-triangle" action-label="Thử lại" @action="offlineRetry">
        Mất kết nối mạng — bạn vẫn xem được dữ liệu đã tải trước đó, nhưng số liệu mới nhất và thao tác lưu/tải phim sẽ không hoạt động.
      </MGlobalInline>
      <!-- Global Inline: có phiên bản mới (KHÔNG tự reload nếu form đang có nội dung chưa lưu) -->
      <MGlobalInline v-else-if="needRefresh" type="info" icon="refresh" action-label="Cập nhật" @action="applyUpdate">
        Đã có phiên bản mới của Kho phim. Bấm Cập nhật để dùng bản mới nhất (trang sẽ tải lại).
      </MGlobalInline>
      <MGlobalInline v-else-if="offlineReady" type="success" icon="circle-check" closable @close="dismissOfflineReady">
        Kho phim đã sẵn sàng dùng ngoại tuyến cho những phần đã xem qua.
      </MGlobalInline>

      <MHeaderBar
        variant="brand"
        app-name="AMIS Kho phim"
        company-name="MISA"
        search-placeholder="Tìm phim theo tên, hashtag... (Enter để tìm)"
        :user="currentUser"
        :notification-count="notifications.unreadCount"
        :compact="isCompact"
        @search="onHeaderSearch"
        @logo-click="goHome"
        @user-click="toggleUserMenu"
        @notifications="toggleNotificationsPanel"
      />
    </div>

    <NotificationsPanel v-model="notificationsPanelOpen" :top-offset="topBarHeight + 4" :full-screen="isCompact" />

    <!-- Popover menu người dùng -->
    <template v-if="userMenuOpen">
      <div class="fixed inset-0 z-40" @click="userMenuOpen = false" />
      <div
        class="fixed right-2 z-50 w-56 overflow-hidden rounded-lg bg-white py-1"
        :style="{ top: `${topBarHeight + 4}px`, boxShadow: 'var(--mds-shadow-md, 0 4px 12px 0 rgba(0,0,0,0.12))' }"
      >
        <div class="border-b px-3 py-2" style="border-color: var(--mds-border-light, #E9EAEB)">
          <p class="truncate text-[13px] font-semibold" style="color: var(--mds-text-primary)">
            {{ auth.user?.fullName }}
          </p>
          <p class="truncate text-[12px]" style="color: var(--mds-text-secondary)">{{ auth.user?.email }}</p>
          <p class="mt-0.5 text-[12px]" style="color: var(--mds-brand-600, #245FDF)">
            {{ auth.role ? ROLE_LABEL[auth.role] : '' }}
          </p>
        </div>
        <button
          type="button"
          class="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-[var(--mds-bg-hover-soft,#F2F4F7)]"
          style="color: var(--mds-text-primary)"
          @click="goChangePassword"
        >
          <MIcon name="lock" :size="16" /> Đổi mật khẩu
        </button>
        <button
          type="button"
          class="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-[var(--mds-bg-hover-soft,#F2F4F7)]"
          style="color: var(--mds-danger, #F04438)"
          @click="logout"
        >
          <MIcon name="logout" :size="16" /> Đăng xuất
        </button>
      </div>
    </template>

    <div class="flex min-h-0 flex-1">
      <!-- Compact (<600px): KHÔNG giữ sidebar cố định (mobile-pwa.md §2/§3) — thay bằng
           bottom navigation vì sidebarItems tối đa 5 điểm đến ổn định, đủ điều kiện dùng
           bottom nav thay vì drawer. -->
      <MSidebar
        v-if="!isCompact"
        :items="sidebarItems"
        :model-value="activeKey"
        v-model:collapsed="collapsed"
        @update:model-value="onNavigate"
      />
      <main class="min-w-0 flex-1 overflow-hidden" :style="isCompact ? { paddingBottom: 'calc(56px + env(safe-area-inset-bottom))' } : {}">
        <router-view />
      </main>
    </div>

    <!-- Bottom navigation — Compact only. Icon MDS + nhãn theo đúng mục 3 "Điều hướng
         và app shell": mỗi mục có icon + label, không dùng dãy icon không nhãn. -->
    <nav
      v-if="isCompact"
      class="fixed inset-x-0 bottom-0 z-30 flex shrink-0 items-stretch border-t bg-white"
      style="border-color: var(--mds-border-light, #E9EAEB); padding-bottom: env(safe-area-inset-bottom)"
      aria-label="Điều hướng chính"
    >
      <button
        v-for="item in sidebarItems"
        :key="item.key"
        type="button"
        class="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px]"
        style="min-height: 56px"
        :class="activeKey === item.key ? 'font-semibold text-[var(--mds-brand-600)]' : 'text-[var(--mds-text-secondary)]'"
        :aria-current="activeKey === item.key ? 'page' : undefined"
        @click="onNavigate(item.key)"
      >
        <MIcon :name="item.icon" :size="20" />
        <span class="max-w-full truncate px-1">{{ item.label }}</span>
      </button>
    </nav>

    <MToast />
  </div>
</template>
