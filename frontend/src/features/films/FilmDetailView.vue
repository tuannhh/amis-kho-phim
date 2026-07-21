<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MButton from '@/components/mds/MButton.vue'
import MIcon from '@/components/mds/MIcon.vue'
import MTag from '@/components/mds/MTag.vue'
import MEmptyState from '@/components/mds/MEmptyState.vue'
import VideoPlayer from '@/components/VideoPlayer.vue'
import { mockFilms, isFilmNew } from './mockFilms'
import { useAuthStore } from '@/features/auth/authStore'

/**
 * Chi tiết/Xem phim — URL riêng /films/:slug (yêu cầu chủ đầu tư).
 * GĐ 0.5 dùng mock; GĐ 2 gắn API films, GĐ 4 hoàn thiện player thật.
 */
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const film = computed(() => mockFilms.find((f) => f.slug === route.params.slug))

// Quyền sửa/xoá: super_admin/admin bất kỳ phim; nhân viên chỉ phim của mình (ADR-002).
// FE chỉ ẩn/hiện; GĐ2+ backend (OwnerGuard theo uploader_id) mới là nguồn kiểm quyền thật.
const canManage = computed(() => {
  if (!film.value) return false
  if (auth.role === 'super_admin' || auth.role === 'admin') return true
  return film.value.uploaderId === auth.user?.id
})

function formatViews(n: number) {
  return n.toLocaleString('vi-VN')
}

function goBack() {
  router.push({ name: 'films' })
}
function goEdit() {
  if (film.value) router.push({ name: 'upload', query: { edit: film.value.slug } })
}
</script>

<template>
  <section v-if="film" class="flex h-full flex-col overflow-hidden">
    <!-- Header trắng: back + tiêu đề — nút thao tác ghim góc trên phải -->
    <header class="flex shrink-0 flex-wrap items-center justify-between gap-3 bg-white px-4 py-3">
      <div class="flex min-w-0 items-center gap-2">
        <button
          type="button"
          class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:opacity-80"
          style="color: var(--mds-icon-neutral)"
          aria-label="Quay lại"
          @click="goBack"
        >
          <MIcon name="chevron-left" :size="20" />
        </button>
        <h1 class="truncate text-[18px] font-semibold" style="color: var(--mds-text-primary)">
          {{ film.title }}
        </h1>
        <MTag v-if="isFilmNew(film)" color="danger" size="sm">Phim mới</MTag>
      </div>

      <div v-if="canManage" class="flex items-center gap-2">
        <MButton variant="secondary" @click="goEdit">
          <template #icon><MIcon name="pencil" :size="16" /></template>
          Sửa
        </MButton>
        <MButton variant="danger">
          <template #icon><MIcon name="trash" :size="16" /></template>
          Xoá
        </MButton>
      </div>
    </header>

    <div class="flex-1 overflow-auto p-4">
      <div class="mx-auto flex max-w-5xl flex-col gap-4">
        <!-- Player -->
        <div
          class="rounded-lg bg-white p-3"
          style="box-shadow: var(--mds-shadow-card, 0 0 2px 0 rgba(0,0,0,0.1))"
        >
          <VideoPlayer :title="film.title" :sources="film.sources" :links="film.links" />
        </div>

        <!-- Thông tin phim -->
        <div
          class="flex flex-col gap-3 rounded-lg bg-white p-4"
          style="box-shadow: var(--mds-shadow-card, 0 0 2px 0 rgba(0,0,0,0.1))"
        >
          <div class="flex flex-wrap items-center gap-2">
            <MTag :color="film.categoryColor" size="sm">{{ film.category }}</MTag>
            <span
              v-for="tag in film.hashtags"
              :key="tag"
              class="text-[12px]"
              style="color: var(--mds-brand-600)"
            >
              #{{ tag }}
            </span>
          </div>

          <p class="text-[13px] leading-[19px]" style="color: var(--mds-text-primary)">
            {{ film.description }}
          </p>

          <div
            class="flex flex-wrap items-center gap-4 border-t pt-3 text-[12px]"
            style="border-color: var(--mds-border-light,#E9EAEB); color: var(--mds-text-secondary)"
          >
            <span class="flex items-center gap-1">
              <MIcon name="eye" :size="12" />
              {{ formatViews(film.viewCount) }} lượt xem
            </span>
            <span class="flex items-center gap-1">
              <MIcon name="user" :size="12" />
              {{ film.uploader }}
            </span>
            <span class="flex items-center gap-1">
              <MIcon name="calendar" :size="12" />
              {{ film.publishedAt }}
            </span>

            <a
              v-if="film.links.storage"
              :href="film.links.storage"
              download
              class="ml-auto"
            >
              <MButton variant="secondary" size="md">
                <template #icon><MIcon name="download" :size="16" /></template>
                Tải về
              </MButton>
            </a>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Không tìm thấy phim (slug sai/đã xoá) -->
  <section v-else class="flex h-full items-center justify-center p-4">
    <MEmptyState
      type="no-result"
      title="Không tìm thấy phim"
      description="Phim có thể đã bị xoá hoặc đường dẫn không đúng."
    >
      <template #actions>
        <MButton variant="primary" @click="goBack">Về Kho phim</MButton>
      </template>
    </MEmptyState>
  </section>
</template>
