<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MHeaderBar from '@/components/mds/MHeaderBar.vue'
import MSidebar from '@/components/mds/MSidebar.vue'
import MToast from '@/components/mds/MToast.vue'
import { filmSearchQuery } from '@/features/films/searchState'

const router = useRouter()
const route = useRoute()

// Điều hướng sidebar ↔ route (key = tên route gốc)
const sidebarItems = [
  { key: 'films', label: 'Kho phim', icon: 'layout-grid' },
  { key: 'upload', label: 'Thêm phim', icon: 'upload' },
  { key: 'categories', label: 'Chuyên mục', icon: 'folder' },
  { key: 'admin-users', label: 'Quản trị người dùng', icon: 'users' },
]

// Map route hiện tại về key sidebar (chi tiết phim vẫn active mục "Kho phim")
const activeKey = computed<string>(() => {
  const name = route.name as string
  if (name === 'film-detail') return 'films'
  return name || 'films'
})
const collapsed = ref(false)

function onNavigate(key: string) {
  router.push({ name: key })
}

// Mock identity GĐ 0 — thay bằng dữ liệu đăng nhập thật ở GĐ 1
const currentUser = { name: 'Super Admin' }

// Ô tìm kiếm DUY NHẤT của app nằm ở header — Enter để tìm phim theo tên/hashtag,
// tự điều hướng sang Kho phim nếu đang ở màn khác (không còn ô tìm kiếm trùng lặp
// trong trang Kho phim).
function onHeaderSearch(text: string) {
  filmSearchQuery.value = text
  if (route.name !== 'films') router.push({ name: 'films' })
}

// Bấm logo/tên app trên header → về trang chủ (Kho phim)
function goHome() {
  if (route.name !== 'films') router.push({ name: 'films' })
}
</script>

<template>
  <div class="flex h-full flex-col" style="background: var(--mds-bg-canvas, #ECEDEF)">
    <!-- Global Header 48px -->
    <MHeaderBar
      variant="brand"
      app-name="AMIS Kho phim"
      company-name="MISA"
      search-placeholder="Tìm phim theo tên, hashtag... (Enter để tìm)"
      :user="currentUser"
      :notification-count="0"
      @search="onHeaderSearch"
      @logo-click="goHome"
    />

    <!-- Thân: Sidebar + nội dung -->
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
