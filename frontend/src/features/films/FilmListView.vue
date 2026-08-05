<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import MButton from '@/components/mds/MButton.vue'
import MSelect from '@/components/mds/MSelect.vue'
import MSwitch from '@/components/mds/MSwitch.vue'
import MTag from '@/components/mds/MTag.vue'
import MIcon from '@/components/mds/MIcon.vue'
import MEmptyState from '@/components/mds/MEmptyState.vue'
import MSpinner from '@/components/mds/MSpinner.vue'
import { useToast } from '@/components/mds/toast.js'
import { useFilmsStore } from './filmsStore'
import { filmSources } from './filmsApi'
import { SOURCE_LABEL, isFilmNew, publishedTime, categoryColorFor, thumbnailGradient, formatVNDate } from './filmTypes'
import { filmSearchQuery } from './searchState'
import { useAuthStore } from '@/features/auth/authStore'
import { canCreateFilm } from '@/features/auth/permissions'

/**
 * Danh sách phim — GĐ2 (API thật qua filmsStore). Tìm kiếm dùng CHUNG 1 ô duy nhất
 * trên header (searchState.ts) — trang này không có ô tìm kiếm riêng.
 */
const router = useRouter()
const toast = useToast()
const store = useFilmsStore()
const auth = useAuthStore()

onMounted(() => store.load())

// undefined = xem tất cả chuyên mục (MSelect không nhận null trong kiểu modelValue)
const categoryFilter = ref<string | undefined>(undefined)
const onlyNew = ref(false)

const pageSizeOptions = [
  { label: '20 / trang', value: 20 },
  { label: '30 / trang', value: 30 },
  { label: '50 / trang', value: 50 },
]
const pageSize = ref(20)
const page = ref(1)

const categoryOptions = computed(() => {
  const set = new Set(store.films.map((f) => f.categoryName).filter((c): c is string => !!c))
  return [
    { label: 'Tất cả chuyên mục', value: undefined as string | undefined },
    ...Array.from(set).map((c) => ({ label: c, value: c as string | undefined })),
  ]
})

const filtered = computed(() => {
  const q = filmSearchQuery.value.trim().toLowerCase()
  return store.films
    .filter((f) => {
      if (onlyNew.value && !isFilmNew(f.publishedAt)) return false
      if (categoryFilter.value && f.categoryName !== categoryFilter.value) return false
      if (!q) return true
      const inTitle = f.title.toLowerCase().includes(q)
      const inTags = f.hashtags.some((h) => h.toLowerCase().includes(q))
      return inTitle || inTags
    })
    .slice()
    .sort((a, b) => publishedTime(b.publishedAt) - publishedTime(a.publishedAt))
})

const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / pageSize.value)))

const paged = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filtered.value.slice(start, start + pageSize.value)
})

const rangeText = computed(() => {
  const total = filtered.value.length
  if (!total) return '0 phim'
  const start = (page.value - 1) * pageSize.value + 1
  const end = Math.min(page.value * pageSize.value, total)
  return `${start}–${end} / ${total} phim`
})

watch([filtered, pageSize], () => {
  if (page.value > totalPages.value) page.value = totalPages.value
})
watch([categoryFilter, onlyNew, filmSearchQuery, pageSize], () => {
  page.value = 1
})

function prevPage() {
  if (page.value > 1) page.value--
}
function nextPage() {
  if (page.value < totalPages.value) page.value++
}

function clearSearch() {
  filmSearchQuery.value = ''
}

function formatViews(n: number) {
  return n.toLocaleString('vi-VN')
}

function openFilm(slug: string) {
  router.push({ name: 'film-detail', params: { slug } })
}

/** Cấp 2 trở lên mới thấy nút "Thêm phim" (RBAC 4 cấp — ADR-040). */
const canCreate = computed(() => canCreateFilm(auth.role))

function goUpload() {
  router.push({ name: 'upload' })
}

async function copyLink(url: string | undefined, label: string, event: Event) {
  event.stopPropagation()
  if (!url) return
  try {
    await navigator.clipboard.writeText(url)
    toast.success(`Đã copy link ${label}`)
  } catch {
    toast.error('Không thể copy link — trình duyệt chặn quyền clipboard')
  }
}
</script>

<template>
  <section class="flex h-full flex-col">
    <header
      class="flex h-14 shrink-0 items-center justify-between gap-3 bg-white px-5"
      style="box-shadow: var(--mds-shadow-card, 0 0 2px 0 rgba(0,0,0,0.1))"
    >
      <h1 class="text-[16px] font-semibold" style="color: var(--mds-text-primary)">Kho phim</h1>
      <!-- Cấp 1 (viewer) chỉ xem → không thấy nút tạo phim. Backend cũng trả 403 nếu gọi thẳng API. -->
      <MButton v-if="canCreate" variant="primary" @click="goUpload">
        <template #icon><MIcon name="plus" :size="16" /></template>
        Thêm phim
      </MButton>
    </header>

    <div class="flex-1 overflow-auto p-4">
      <div
        class="flex flex-col gap-4 rounded-lg bg-white p-4"
        style="box-shadow: var(--mds-shadow-card, 0 0 2px 0 rgba(0,0,0,0.1))"
      >
        <div class="flex flex-wrap items-center gap-3">
          <div class="w-full sm:w-[220px]">
            <MSelect v-model="categoryFilter" :options="categoryOptions" placeholder="Tất cả chuyên mục" />
          </div>
          <label class="flex items-center gap-2 text-[13px]" style="color: var(--mds-text-secondary)">
            <MSwitch v-model="onlyNew" />
            Chỉ hiển thị phim mới
          </label>
          <button
            v-if="filmSearchQuery"
            type="button"
            class="flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-medium"
            style="background: var(--mds-brand-50); color: var(--mds-brand-700)"
            title="Bỏ lọc theo từ khoá"
            @click="clearSearch"
          >
            <MIcon name="search" :size="12" />
            "{{ filmSearchQuery }}"
            <MIcon name="x" :size="12" />
          </button>
          <span class="ml-auto flex items-center gap-2 text-[13px]" style="color: var(--mds-text-secondary)">
            <MSpinner v-if="store.loading" :size="14" />
            {{ rangeText }}
          </span>
        </div>

        <div
          v-if="paged.length"
          class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          <article
            v-for="film in paged"
            :key="film.id"
            class="group flex cursor-pointer flex-col overflow-hidden rounded-lg ring-1 ring-transparent transition hover:ring-[var(--mds-brand-600)]"
            style="box-shadow: var(--mds-shadow-card, 0 0 2px 0 rgba(0,0,0,0.1))"
            @click="openFilm(film.slug)"
          >
            <!-- Thumbnail 16:9 — ảnh bìa thật (MinIO) nếu có, fallback gradient theo chuyên mục -->
            <div
              class="relative aspect-video w-full overflow-hidden"
              :style="{ background: `linear-gradient(135deg, ${thumbnailGradient(film.categoryId)[0]}, ${thumbnailGradient(film.categoryId)[1]})` }"
            >
              <img
                v-if="film.thumbnailUrl"
                :src="film.thumbnailUrl"
                :alt="film.title"
                class="absolute inset-0 h-full w-full object-cover"
                loading="lazy"
              />
              <span
                class="absolute bottom-2 right-2 rounded px-1.5 py-0.5 text-[11px] font-medium text-white"
                style="background: rgba(0,0,0,0.55)"
              >
                {{ film.duration }}
              </span>
              <span
                class="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100"
                style="background: rgba(0,0,0,0.15)"
              >
                <span
                  class="flex h-11 w-11 items-center justify-center rounded-full"
                  style="background: rgba(255,255,255,0.9)"
                >
                  <span
                    class="ml-0.5 h-0 w-0 border-y-[7px] border-l-[11px] border-y-transparent"
                    style="border-left-color: var(--mds-brand-600)"
                  />
                </span>
              </span>
            </div>

            <div class="flex flex-1 flex-col gap-2 p-3">
              <h3
                class="line-clamp-2 text-[14px] font-medium leading-[19px]"
                style="color: var(--mds-text-primary)"
                :title="film.title"
              >
                {{ film.title }}
              </h3>

              <div class="flex flex-wrap items-center gap-1.5">
                <MTag v-if="isFilmNew(film.publishedAt)" color="danger" size="sm">Phim mới</MTag>
                <MTag v-if="film.categoryName" :color="categoryColorFor(film.categoryId)" size="sm">{{ film.categoryName }}</MTag>
                <button
                  v-for="src in filmSources(film)"
                  :key="src"
                  type="button"
                  class="inline-flex h-5 items-center gap-1 rounded px-2 text-[12px] font-medium transition hover:brightness-95"
                  style="background: var(--mds-bg-disabled); color: var(--mds-text-secondary)"
                  :title="`Copy link ${SOURCE_LABEL[src]}`"
                  @click="copyLink(film.links[src], SOURCE_LABEL[src], $event)"
                >
                  {{ SOURCE_LABEL[src] }}
                  <MIcon name="copy" :size="12" />
                </button>
              </div>

              <div class="flex flex-wrap gap-1">
                <span
                  v-for="tag in film.hashtags"
                  :key="tag"
                  class="text-[12px]"
                  style="color: var(--mds-brand-600)"
                >
                  #{{ tag }}
                </span>
              </div>

              <div
                class="mt-auto flex items-center justify-between pt-1 text-[12px]"
                style="color: var(--mds-text-secondary)"
              >
                <span class="flex items-center gap-1">
                  <MIcon name="eye" :size="12" />
                  {{ formatViews(film.viewCount) }} lượt xem
                </span>
                <span>{{ formatVNDate(film.publishedAt) }}</span>
              </div>
              <div class="truncate text-[12px]" style="color: var(--mds-text-placeholder)">
                {{ film.uploaderName }}
              </div>
            </div>
          </article>
        </div>

        <MEmptyState
          v-else-if="!store.loading"
          type="no-result"
          title="Không tìm thấy phim phù hợp"
          description="Thử đổi từ khóa tìm kiếm, bỏ bớt bộ lọc chuyên mục hoặc tắt 'Chỉ hiển thị phim mới'."
        />

        <div
          v-if="filtered.length"
          class="flex flex-wrap items-center justify-between gap-3 border-t pt-3"
          style="border-color: var(--mds-border-light,#E9EAEB)"
        >
          <div class="flex items-center gap-2 text-[13px]" style="color: var(--mds-text-secondary)">
            <span>Hiển thị</span>
            <div class="w-[130px]">
              <MSelect v-model="pageSize" :options="pageSizeOptions" />
            </div>
          </div>
          <div class="flex items-center gap-3 text-[13px]" style="color: var(--mds-text-secondary)">
            <span>{{ rangeText }}</span>
            <div class="flex items-center gap-1">
              <button
                type="button"
                class="flex h-8 w-8 items-center justify-center rounded-md disabled:opacity-40"
                style="border: 1px solid var(--mds-border,#CED1D6); color: var(--mds-icon-neutral)"
                :disabled="page <= 1"
                title="Trang trước"
                @click="prevPage"
              >
                <MIcon name="chevron-left" :size="16" />
              </button>
              <button
                type="button"
                class="flex h-8 w-8 items-center justify-center rounded-md disabled:opacity-40"
                style="border: 1px solid var(--mds-border,#CED1D6); color: var(--mds-icon-neutral)"
                :disabled="page >= totalPages"
                title="Trang sau"
                @click="nextPage"
              >
                <MIcon name="chevron-right" :size="16" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
