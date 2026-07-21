<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MHeaderBar from '@/components/mds/MHeaderBar.vue'
import MSidebar from '@/components/mds/MSidebar.vue'
import MToast from '@/components/mds/MToast.vue'
import MIcon from '@/components/mds/MIcon.vue'
import { filmSearchQuery } from '@/features/films/searchState'
import { useAuthStore, type UserRole } from '@/features/auth/authStore'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

// Trang auth (login/đổi mật khẩu) hiển thị full-page, không header/sidebar.
const isBlank = computed(() => route.meta.blank === true)

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
</script>

<template>
  <!-- Layout auth: full-page -->
  <router-view v-if="isBlank" />

  <!-- Layout app: header + sidebar -->
  <div v-else class="flex h-full flex-col" style="background: var(--mds-bg-canvas, #ECEDEF)">
    <MHeaderBar
      variant="brand"
      app-name="AMIS Kho phim"
      company-name="MISA"
      search-placeholder="Tìm phim theo tên, hashtag... (Enter để tìm)"
      :user="currentUser"
      :notification-count="0"
      @search="onHeaderSearch"
      @logo-click="goHome"
      @user-click="toggleUserMenu"
    />

    <!-- Popover menu người dùng -->
    <template v-if="userMenuOpen">
      <div class="fixed inset-0 z-40" @click="userMenuOpen = false" />
      <div
        class="fixed right-2 top-[52px] z-50 w-56 overflow-hidden rounded-lg bg-white py-1"
        style="box-shadow: var(--mds-shadow-md, 0 4px 12px 0 rgba(0,0,0,0.12))"
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
      <MSidebar
        :items="sidebarItems"
        :model-value="activeKey"
        v-model:collapsed="collapsed"
        @update:model-value="onNavigate"
      />
      <main class="min-w-0 flex-1 overflow-hidden">
        <router-view />
      </main>
    </div>

    <MToast />
  </div>
</template>
