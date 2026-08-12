<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getHostAdapter } from '@/lib/hostAdapter'
import MHeaderBar from '@/components/mds/MHeaderBar.vue'
import MSidebar from '@/components/mds/MSidebar.vue'
import MToast from '@/components/mds/MToast.vue'
import MIcon from '@/components/mds/MIcon.vue'
import MGlobalInline from '@/components/mds/MGlobalInline.vue'
import MobileBottomNav from '@/components/mobile/MobileBottomNav.vue'
import { filmSearchQuery } from '@/features/films/searchState'
import { useAuthStore } from '@/features/auth/authStore'
import {
  ADMIN_ROLES,
  FILM_WRITE_ROLES,
  MANAGED_FILMS_ROLES,
  REPORT_ROLES,
  ROLE_LABEL,
  canCreateFilm,
} from '@/features/auth/permissions'
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
const { isNativeMobile, sizeClass } = useWindowSize()
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

// GĐ6.1 — capability của WebView AMIS Mobile đi qua HostAdapter. Host sở hữu launcher/status
// bar, còn mini-app vẫn phải sở hữu native top bar/navigation nghiệp vụ ở cả phone/tablet.
//
// Retrofit Tier B (2026-08-12, Production Compatibility Gate): gọi qua `getHostAdapter()`
// thay vì thẳng `isEmbedded()`/`window.AMISBridge` rải rác — implementation đổi được (khi có
// bridge contract thật) mà không phải sửa lại component này.
const host = getHostAdapter()
const isEmbeddedMode = host.isEmbedded()

/**
 * Native Mobile (phone + tablet) không dựng `MHeaderBar` Platform.
 *
 * Đây là NGOẠI LỆ CÓ CHỦ ĐÍCH với quy chuẩn "web app độc lập phải có header MDS"
 * (`references/patterns/header-bar.md`). Lý do: mô hình phân phối THẬT của Kho phim trên
 * điện thoại không phải "mở bằng link trình duyệt trần" mà LUÔN là bấm icon Kho phim trong
 * app AMIS Mobile — tức luôn nhúng, và app mẹ đã có chrome riêng. Dựng thêm một thanh brand
 * nữa bên trong chỉ tạo cảm giác "web thu nhỏ" chứ không thêm chức năng nào.
 *
 * Tablet vẫn là native surface theo UI compliance gate, kể cả chạy browser test/PWA; desktop
 * Platform bắt đầu từ 1200px.
 *
 * Những chức năng của header bị mất được bù ở đâu:
 *   - Tìm kiếm  → ô tìm kiếm ngay trong `FilmListMobileView` (không còn dựa vào icon header).
 *   - Thông báo → chuông trên hero header màn Kho phim + mục trong màn "Tài khoản".
 *   - Avatar (đổi mật khẩu / đăng xuất) → màn "Tài khoản" (tab cuối bottom nav).
 *   - Nút 9 chấm chuyển ứng dụng + cụm AVA/Chat/Trợ giúp → KHÔNG bù, vô nghĩa khi nhúng
 *     trong AMIS Mobile (app mẹ đã có).
 */
const showMdsHeader = computed(() => !isNativeMobile.value)

// Nút back cứng của app mẹ (Android) gọi vào đây qua window.__khoPhimHandleNativeBack.
// TODO(AMIS Mobile bridge thật): `host.closeApp()` (xem lib/hostAdapter.ts) gọi
// window.AMISBridge?.closeWebview?.() — tên hàm CHƯA xác nhận với đội AMIS Mobile, đây vẫn
// là giả định tạm dù đã gom về một chỗ.
onMounted(() => {
  if (!isEmbeddedMode) return
  host.registerBackHandler(() => {
    if (route.name !== 'films' && router.currentRoute.value.fullPath !== '/') {
      router.back()
    } else {
      host.closeApp()
    }
  })
})

/**
 * Điều hướng sidebar ↔ route (key = tên route gốc) — lọc theo RBAC 4 cấp (ADR-040):
 *  - "Thêm phim" và "Chuyên mục" chỉ từ Cấp 2 trở lên — Cấp 1 (viewer) chỉ thấy đúng
 *    "Kho phim", vì họ không tạo/sửa gì nên xem cây chuyên mục cũng không để làm gì.
 *  - "Phim tôi quản lý" từ Cấp 2 trở lên (Cấp 1 không quản lý phim nào).
 *  - "Quản trị người dùng" / "Quản lý phòng ban" chỉ Cấp 4.
 *  - "Báo cáo" từ Cấp 3 (ADR-053) — Cấp 3 chỉ thấy phòng ban của mình, backend ép phạm vi.
 * Quyền thực vẫn do backend kiểm — đây chỉ là ẩn/hiện cho UX.
 * Icon lấy từ bộ Tabler đã đăng ký (`iconRegistry.generated.js`), không tự vẽ SVG.
 */
const allSidebarItems = [
  { key: 'films', label: 'Kho phim', icon: 'layout-grid' },
  { key: 'upload', label: 'Thêm phim', icon: 'upload', roles: FILM_WRITE_ROLES },
  { key: 'categories', label: 'Chuyên mục', icon: 'folder', roles: FILM_WRITE_ROLES },
  { key: 'my-films', label: 'Phim tôi quản lý', icon: 'list', roles: MANAGED_FILMS_ROLES },
  { key: 'admin-departments', label: 'Quản lý phòng ban', icon: 'building', roles: ADMIN_ROLES },
  { key: 'admin-users', label: 'Quản trị người dùng', icon: 'users', roles: ADMIN_ROLES },
  { key: 'admin-reports', label: 'Báo cáo', icon: 'chart-bar', roles: REPORT_ROLES },
]
const sidebarItems = computed(() =>
  allSidebarItems.filter((it) => !it.roles || (auth.role && it.roles.includes(auth.role))),
)

const activeKey = computed<string>(() => {
  const name = route.name as string
  if (name === 'film-detail') return 'films'
  return name || 'films'
})
/**
 * Sidebar thu gọn (rail 56px). Người dùng tự bấm "Thu gọn" ở Expanded/Large; riêng MEDIUM
 * (600-839px) thì ÉP rail, không cho mở rộng.
 *
 * Vì sao ép (GĐ8-C): `mobile-pwa.md` §3 "Medium ưu tiên navigation rail rộng 56px" và "Không
 * cố giữ sidebar nếu phần nội dung chính còn quá hẹp". Ở tablet dọc 600px, sidebar 240px ăn
 * 40% bề ngang; màn Chuyên mục còn khoảng 180px cho cả cây lẫn form nên chữ vỡ vụn — đúng
 * kiểu lỗi người dùng đã chụp ở điện thoại, chỉ khác độ rộng. Rail trả lại ~180px cho nội
 * dung mà không mất điểm điều hướng nào.
 */
const collapsedByUser = ref(false)
const collapsed = computed<boolean>({
  get: () => sizeClass.value === 'medium' || collapsedByUser.value,
  set: (v) => {
    collapsedByUser.value = v
  },
})

/* ── Bottom nav Compact (GĐ8-B) ───────────────────────────────────────────────
 * Bottom nav chỉ chứa TỐI ĐA 4 mục + FAB (mobile native spec cho phép <= 5 điểm đến cấp một;
 * FAB tính là một). Danh sách sidebar đầy đủ của Cấp 3/Cấp 4 dài hơn thế, nên:
 *   - "Thêm phim" KHÔNG còn là một tab — nó trở thành FAB ở giữa thanh (hành động chính,
 *     không phải một điểm đến ngang hàng), và chỉ hiện khi có quyền tạo phim.
 *   - Các điểm đến ít dùng (Báo cáo, Quản lý phòng ban, Quản trị người dùng) chuyển vào màn
 *     "Tài khoản" thay vì nhồi thêm tab — xem `AccountMobileView.vue`.
 * Quy tắc quyền dùng lại nguyên `sidebarItems` phía trên, không viết lại điều kiện RBAC.
 */
const MOBILE_NAV_ORDER = ['films', 'my-films', 'categories'] as const

/**
 * Nhãn RÚT GỌN riêng cho bottom nav: ô nhãn chỉ rộng ~80px ở 375px, "Phim tôi quản lý" của
 * sidebar desktop bị cắt thành "Phim tôi quả...". Nhãn đầy đủ vẫn giữ nguyên ở sidebar.
 */
const MOBILE_NAV_LABEL: Record<string, string> = {
  'my-films': 'Của tôi',
}

const mobileNavItems = computed(() => {
  const allowed = new Set(sidebarItems.value.map((it) => it.key))
  const items = MOBILE_NAV_ORDER.filter((key) => allowed.has(key)).map(
    (key) => allSidebarItems.find((it) => it.key === key)!,
  )
  // "Tài khoản" luôn là mục cuối và luôn có mặt với mọi vai trò.
  return [...items, { key: 'account', label: 'Tài khoản', icon: 'user' }].map((it) => ({
    key: it.key,
    label: MOBILE_NAV_LABEL[it.key] ?? it.label,
    icon: it.icon,
  }))
})

/** FAB "Thêm phim" — cùng điều kiện quyền với nút Thêm của màn danh sách (Cấp 2 trở lên). */
const showMobileFab = computed(() => canCreateFilm(auth.role))

/**
 * Màn CẤP HAI ở Compact: đẩy chồng lên trên bottom nav thay vì hiện song song, đúng cách app
 * di động xử lý trang chi tiết. Điều kiện để có mặt trong danh sách này: màn đó PHẢI tự có
 * nút Back (`MMobileTopBar`), nếu không người dùng sẽ mắc kẹt không còn đường đi.
 * Thoả điều kiện: `film-detail` (MMobileTopBar) và `upload` (đã có thanh tiêu đề kèm nút back
 * riêng). Với `upload` còn một lý do nữa: FAB "Thêm phim" hiện đè lên chính màn Thêm phim là
 * vô nghĩa, và bottom nav che mất footer Huỷ/Xuất bản.
 *
 * KHÔNG đưa vào đây các màn quản trị (báo cáo, phòng ban, người dùng): chúng vẫn là bản
 * desktop ở Compact, không có nút back nào, nên bottom nav là lối thoát duy nhất — GĐ8 Giai
 * đoạn B sẽ dựng lại chúng rồi mới tính tiếp.
 */
const SECOND_LEVEL_ROUTES = new Set([
  'film-detail',
  'upload',
  'my-films',
  'admin-departments',
  'admin-users',
  'admin-reports',
])
const showBottomNav = computed(
  () => isNativeMobile.value && !SECOND_LEVEL_ROUTES.has(route.name as string),
)

/**
 * Mục nào sáng ở bottom nav. Các route quản trị mở TỪ màn Tài khoản nên vẫn tô sáng "Tài
 * khoản" — nếu không, người dùng đứng ở màn Báo cáo sẽ thấy cả thanh không mục nào sáng.
 */
const mobileActiveKey = computed(() => {
  const key = activeKey.value
  if (key === 'account' || key.startsWith('admin-')) return 'account'
  return key
})

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

  <!-- Layout auth: full-page -->
  <router-view v-else-if="isBlank" />

  <!-- Layout app: desktop header/sidebar (>=1200) · native phone/tablet shell (<1200). -->
  <div
    v-else
  class="flex flex-col"
  :class="{ 'mds-mobile-app': isNativeMobile }"
    style="background: var(--mds-bg-page, #ECEDEF); min-height: 100dvh; height: 100dvh"
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

      <!-- Cụm tiện ích AVA/AMIS Chat/Thông báo/Trợ giúp/Khác/Thiết lập hiện đủ theo đúng thứ tự
           chuẩn header-bar.md dù Kho phim chưa có tính năng thật đứng sau AVA/Chat/Trợ giúp/
           Thiết lập — bấm tạm thời chưa có hành động (chờ tính năng tương ứng). Riêng "Tính năng
           mới" (loa) ẩn hẳn vì Kho phim chưa có nội dung "tính năng mới" nào để hiển thị — đứng
           sát AVA mà không có nội dung thật gây rối mắt hơn là hữu ích. -->
      <!-- ADR-061: ẩn hẳn ở Compact (vỏ mobile riêng thay thế), giữ NGUYÊN từ Medium trở lên. -->
      <MHeaderBar
        v-if="showMdsHeader"
        variant="brand"
        app-name="AMIS Kho phim"
        company-name="MISA"
        search-placeholder="Tìm phim theo tên, hashtag... (Enter để tìm)"
        :user="currentUser"
        :notification-count="notifications.unreadCount"
        :compact="false"
        :show-whats-new="false"
        @search="onHeaderSearch"
        @logo-click="goHome"
        @user-click="toggleUserMenu"
        @notifications="toggleNotificationsPanel"
      />
    </div>

    <NotificationsPanel v-model="notificationsPanelOpen" :top-offset="topBarHeight + 4" :full-screen="isNativeMobile" />

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
      <!-- Native phone/tablet: không dùng sidebar desktop; dùng app navigation riêng. -->
      <MSidebar
        v-if="!isNativeMobile"
        :items="sidebarItems"
        :model-value="activeKey"
        v-model:collapsed="collapsed"
        @update:model-value="onNavigate"
      />
      <main class="min-w-0 flex-1 overflow-hidden" :style="showBottomNav ? { paddingBottom: 'calc(var(--mds-mobile-bottom-nav-height) + var(--mds-mobile-safe-bottom))' } : {}">
        <!-- Native view tự dựng top bar/hero và phát notifications, không dùng header desktop. -->
        <router-view @notifications="toggleNotificationsPanel" />
      </main>
    </div>

    <!-- Bottom navigation — Native phone/tablet. 4 mục + FAB "Thêm phim" ở giữa. -->
    <MobileBottomNav
      v-if="showBottomNav"
      :items="mobileNavItems"
      :active="mobileActiveKey"
      :show-fab="showMobileFab"
      fab-label="Thêm phim"
      @select="onNavigate"
      @fab="onNavigate('upload')"
    />

    <MToast />
  </div>
</template>
