<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import MButton from '@/components/mds/MButton.vue'
import MSelect from '@/components/mds/MSelect.vue'
import MSwitch from '@/components/mds/MSwitch.vue'
import MIcon from '@/components/mds/MIcon.vue'
import MEmptyState from '@/components/mds/MEmptyState.vue'
import MSpinner from '@/components/mds/MSpinner.vue'
import { useFilmsStore } from './filmsStore'
import { publishedTime } from './filmTypes'
import { filmSearchQuery } from './searchState'
import { useAuthStore } from '@/features/auth/authStore'
import { canCreateFilm } from '@/features/auth/permissions'
import FilmCard from './FilmCard.vue'
import FilmManageDialogs from './FilmManageDialogs.vue'
import CategoryShelves from './CategoryShelves.vue'
import {
  categoriesApi,
  categoryIdsWithDescendants,
  categoryOptions as buildCategoryOptions,
  type ApiCategoryNode,
} from '@/features/categories/categoriesApi'
import type { ApiFilm } from './filmsApi'

/**
 * Kho phim. Tìm kiếm dùng CHUNG một ô duy nhất trên header (`searchState.ts`).
 *
 * Đợt 2 bổ sung 3 thứ:
 *  - Việc 13: bộ lọc chuyên mục dựng theo CÂY (cha–con, con thụt lề) thay vì danh sách phẳng
 *    tên chuyên mục. Lọc theo id, và chọn chuyên mục CHA thì lấy cả phim ở chuyên mục con.
 *  - Việc 14: khu vực "kệ ngang theo chuyên mục" (`CategoryShelves`) hiện ở TRÊN CÙNG khi
 *    người dùng chưa lọc/tìm gì. Xem quyết định luồng UI ở ADR-056.
 *  - Việc 10: nút Sửa/Xoá trên thẻ phim mở POPUP tại chỗ, không rời trang.
 */
const router = useRouter()
const store = useFilmsStore()
const auth = useAuthStore()

const categoriesTree = ref<ApiCategoryNode[]>([])

onMounted(() => {
  store.load()
  categoriesApi.tree().then((t) => (categoriesTree.value = t))
})

// undefined = xem tất cả chuyên mục (MSelect không nhận null trong kiểu modelValue)
const categoryFilter = ref<number | undefined>(undefined)
const onlyNew = ref(false)

const pageSizeOptions = [
  { label: '20 / trang', value: 20 },
  { label: '30 / trang', value: 30 },
  { label: '50 / trang', value: 50 },
]
const pageSize = ref(20)
const page = ref(1)

/**
 * Lựa chọn chuyên mục cho dropdown: dựng từ CÂY chuyên mục thật (có `depth` để thụt lề), không
 * phải từ tên chuyên mục xuất hiện trong danh sách phim như trước. Nhờ vậy chuyên mục chưa có
 * phim nào vẫn hiện ra đúng vị trí trong cây, và quan hệ cha–con nhìn là thấy.
 */
const categoryFilterOptions = computed(() => [
  { label: 'Tất cả chuyên mục', value: undefined as number | undefined, depth: 0 },
  ...buildCategoryOptions(categoriesTree.value),
])

/** Chọn chuyên mục cha = xem cả nhánh (khớp `idsWithDescendants` ở backend). */
const selectedCategoryIds = computed(() =>
  categoryFilter.value == null
    ? null
    : new Set(categoryIdsWithDescendants(categoriesTree.value, categoryFilter.value)),
)

const hasActiveFilter = computed(
  () => categoryFilter.value != null || onlyNew.value || !!filmSearchQuery.value.trim(),
)

const filtered = computed(() => {
  const q = filmSearchQuery.value.trim().toLowerCase()
  const ids = selectedCategoryIds.value
  return store.films
    .filter((f) => {
      if (onlyNew.value && !f.isNew) return false
      if (ids && (f.categoryId == null || !ids.has(f.categoryId))) return false
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

function openFilm(film: ApiFilm) {
  router.push({ name: 'film-detail', params: { slug: film.slug } })
}

/** "Xem tất cả" trên một kệ → chọn luôn chuyên mục đó ở bộ lọc, chuyển sang lưới đầy đủ. */
function showAllOfCategory(categoryId: number) {
  categoryFilter.value = categoryId
}

/** Cấp 2 trở lên mới thấy nút "Thêm phim" (RBAC 4 cấp — ADR-040). */
const canCreate = computed(() => canCreateFilm(auth.role))

function goUpload() {
  router.push({ name: 'upload' })
}

const manageDialogs = ref<InstanceType<typeof FilmManageDialogs> | null>(null)
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
      <div class="flex flex-col gap-4">
        <!-- Kệ ngang theo chuyên mục — chỉ khi CHƯA lọc gì (ADR-056) -->
        <CategoryShelves
          v-if="!hasActiveFilter && !store.loading"
          :films="store.films"
          :categories="categoriesTree"
          @open="openFilm"
          @edit="manageDialogs?.openEdit($event)"
          @delete="manageDialogs?.openDelete($event)"
          @show-all="showAllOfCategory"
        />

        <div
          class="flex flex-col gap-4 rounded-lg bg-white p-4"
          style="box-shadow: var(--mds-shadow-card, 0 0 2px 0 rgba(0,0,0,0.1))"
        >
          <div class="flex flex-wrap items-center gap-3">
            <div class="w-full sm:w-[240px]">
              <MSelect
                v-model="categoryFilter"
                :options="categoryFilterOptions"
                placeholder="Tất cả chuyên mục"
              />
            </div>
            <label
              class="flex items-center gap-2 text-[13px]"
              style="color: var(--mds-text-secondary)"
            >
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
            <span
              class="ml-auto flex items-center gap-2 text-[13px]"
              style="color: var(--mds-text-secondary)"
            >
              <MSpinner v-if="store.loading" :size="14" />
              {{ rangeText }}
            </span>
          </div>

          <div
            v-if="paged.length"
            class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          >
            <FilmCard
              v-for="film in paged"
              :key="film.id"
              :film="film"
              @open="openFilm"
              @edit="manageDialogs?.openEdit($event)"
              @delete="manageDialogs?.openDelete($event)"
            />
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
            <div
              class="flex items-center gap-2 text-[13px]"
              style="color: var(--mds-text-secondary)"
            >
              <span>Hiển thị</span>
              <div class="w-[130px]">
                <MSelect v-model="pageSize" :options="pageSizeOptions" />
              </div>
            </div>
            <div
              class="flex items-center gap-3 text-[13px]"
              style="color: var(--mds-text-secondary)"
            >
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
    </div>

    <FilmManageDialogs ref="manageDialogs" @changed="store.load()" />
  </section>
</template>
