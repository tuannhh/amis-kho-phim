<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import MButton from '@/components/mds/MButton.vue'
import MSelect from '@/components/mds/MSelect.vue'
import MSwitch from '@/components/mds/MSwitch.vue'
import MTag from '@/components/mds/MTag.vue'
import MIcon from '@/components/mds/MIcon.vue'
import MEmptyState from '@/components/mds/MEmptyState.vue'
import { useToast } from '@/components/mds/toast.js'
import { mockFilms, SOURCE_LABEL, isFilmNew, publishedTime } from './mockFilms'
import { filmSearchQuery } from './searchState'

/**
 * Danh sách phim — GĐ 0.5 (mock data). GĐ 2 sẽ thay `mockFilms` bằng gọi API
 * thật của films module (giữ nguyên UI/props, chỉ đổi nguồn dữ liệu).
 * Tìm kiếm dùng CHUNG 1 ô duy nhất trên header (xem searchState.ts) — trang
 * này không có ô tìm kiếm riêng để tránh trùng lặp.
 */
const router = useRouter()
const toast = useToast()

// null = xem tất cả chuyên mục
const categoryFilter = ref<string | null>(null)
const onlyNew = ref(false)

// Phân trang (GĐ 2 sẽ chuyển sang phân trang phía server)
const pageSizeOptions = [
  { label: '20 / trang', value: 20 },
  { label: '30 / trang', value: 30 },
  { label: '50 / trang', value: 50 },
]
const pageSize = ref(20)
const page = ref(1)

const categoryOptions = computed(() => {
  const set = new Set(mockFilms.map((f) => f.category))
  // Option đầu tiên để quay về xem toàn bộ (value null)
  return [
    { label: 'Tất cả chuyên mục', value: null as string | null },
    ...Array.from(set).map((c) => ({ label: c, value: c as string | null })),
  ]
})

const filtered = computed(() => {
  const q = filmSearchQuery.value.trim().toLowerCase()
  return mockFilms
    .filter((f) => {
      if (onlyNew.value && !isFilmNew(f)) return false
      if (categoryFilter.value && f.category !== categoryFilter.value) return false
      if (!q) return true
      const inTitle = f.title.toLowerCase().includes(q)
      const inTags = f.hashtags.some((h) => h.toLowerCase().includes(q))
      return inTitle || inTags
    })
    // Luôn hiển thị phim mới đưa lên trước tiên (publishedAt giảm dần)
    .slice()
    .sort((a, b) => publishedTime(b) - publishedTime(a))
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

// Đổi bộ lọc/kích thước trang → về trang 1; kẹp page trong khoảng hợp lệ
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

function goUpload() {
  router.push({ name: 'upload' })
}

// Copy nhanh link nguồn (YouTube/Vimeo/Google Drive/MISA Drive/Nội bộ) ngay từ danh sách
async function copyLink(url: string | undefined, label: string, event: Event) {
  event.stopPropagation() // không mở trang chi tiết khi bấm nút copy trên thẻ
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
    <!-- Page header 56px -->
    <header
      class="flex h-14 shrink-0 items-center justify-between gap-3 bg-white px-5"
      style="box-shadow: var(--mds-shadow-card, 0 0 2px 0 rgba(0,0,0,0.1))"
    >
      <h1 class="text-[16px] font-semibold" style="color: var(--mds-text-primary)">Kho phim</h1>
      <MButton variant="primary" @click="goUpload">
        <template #icon><MIcon name="plus" :size="16" /></template>
        Thêm phim
      </MButton>
    </header>

    <div class="flex-1 overflow-auto p-4">
      <div
        class="flex flex-col gap-4 rounded-lg bg-white p-4"
        style="box-shadow: var(--mds-shadow-card, 0 0 2px 0 rgba(0,0,0,0.1))"
      >
        <!-- Toolbar lọc: chuyên mục + switch phim mới. Tìm kiếm dùng ô Enter trên header (1 ô duy nhất). -->
        <div class="flex flex-wrap items-center gap-3">
          <div class="w-full sm:w-[220px]">
            <MSelect v-model="categoryFilter" :options="categoryOptions" placeholder="Tất cả chuyên mục" />
          </div>
          <label class="flex items-center gap-2 text-[13px]" style="color: var(--mds-text-secondary)">
            <MSwitch v-model="onlyNew" />
            Chỉ hiển thị phim mới
          </label>
          <!-- Chip từ khoá đang tìm (nhập ở ô tìm kiếm trên header, Enter để áp dụng) -->
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
          <span class="ml-auto text-[13px]" style="color: var(--mds-text-secondary)">
            {{ rangeText }}
          </span>
        </div>

        <!-- Lưới thẻ phim 16:9 (phim mới nhất lên đầu) -->
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
            <!-- Thumbnail 16:9 — ảnh thật nếu đã upload, không thì gradient mock -->
            <div
              class="relative aspect-video w-full overflow-hidden"
              :style="
                film.thumbnailUrl
                  ? { backgroundImage: `url(${film.thumbnailUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                  : { background: `linear-gradient(135deg, ${film.thumbnailFrom}, ${film.thumbnailTo})` }
              "
            >
              <span
                class="absolute bottom-2 right-2 rounded px-1.5 py-0.5 text-[11px] font-medium text-white"
                style="background: rgba(0,0,0,0.55)"
              >
                {{ film.duration }}
              </span>
              <!-- Play affordance (chưa có icon "play" chính thức trong MDS — TODO bổ sung registry) -->
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

            <!-- Nội dung thẻ -->
            <div class="flex flex-1 flex-col gap-2 p-3">
              <h3
                class="line-clamp-2 text-[14px] font-medium leading-[19px]"
                style="color: var(--mds-text-primary)"
                :title="film.title"
              >
                {{ film.title }}
              </h3>

              <div class="flex flex-wrap items-center gap-1.5">
                <!-- Đặt trong hàng tag (không đè lên thumbnail) để luôn thấy rõ kể cả khi có ảnh bìa thật -->
                <MTag v-if="isFilmNew(film)" color="danger" size="sm">Phim mới</MTag>
                <MTag :color="film.categoryColor" size="sm">{{ film.category }}</MTag>
                <!-- Nguồn phim: bấm để copy nhanh link (không mở trang chi tiết) -->
                <button
                  v-for="src in film.sources"
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
                <span>{{ film.publishedAt }}</span>
              </div>
              <div class="truncate text-[12px]" style="color: var(--mds-text-placeholder)">
                {{ film.uploader }}
              </div>
            </div>
          </article>
        </div>

        <!-- Không có kết quả -->
        <MEmptyState
          v-else
          type="no-result"
          title="Không tìm thấy phim phù hợp"
          description="Thử đổi từ khóa tìm kiếm, bỏ bớt bộ lọc chuyên mục hoặc tắt 'Chỉ hiển thị phim mới'."
        />

        <!-- Phân trang: số phim/trang (20/30/50) + prev/next (MDS: không đánh số trang) -->
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
