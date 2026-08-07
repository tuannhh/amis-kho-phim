<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import MButton from '@/components/mds/MButton.vue'
import MIcon from '@/components/mds/MIcon.vue'
import MSwitch from '@/components/mds/MSwitch.vue'
import MTree from '@/components/mds/MTree.vue'
import MDrawer from '@/components/mds/MDrawer.vue'
import MRadioGroup from '@/components/mds/MRadioGroup.vue'
import MEmptyState from '@/components/mds/MEmptyState.vue'
import MSpinner from '@/components/mds/MSpinner.vue'
import { useFilmsStore } from './filmsStore'
import { filmSearchQuery } from './searchState'
import { useAuthStore } from '@/features/auth/authStore'
import { canCreateFilm } from '@/features/auth/permissions'
import FilmCardMobile from './FilmCardMobile.vue'
import FilmManageDialogs from './FilmManageDialogs.vue'
import CategoryShelves from './CategoryShelves.vue'
import { PAGE_SIZE_OPTIONS, useFilmListFilters } from './useFilmListFilters'
import { flattenCategoryTree, type ApiCategoryNode } from '@/features/categories/categoriesApi'
import type { ApiFilm } from './filmsApi'

/**
 * Kho phim — BẢN MOBILE (Compact <600px, GĐ8). Không phải FilmListView co giãn bằng CSS:
 * đây là màn riêng, dựng từ khung `ui/templates/mobile/ListPageMobile.vue` của skill
 * misa-design-system rồi sửa theo nghiệp vụ Kho phim.
 *
 * Chọn view nào là việc của `responsiveView` ở router (ADR-058). Mọi dữ liệu và quy tắc lọc
 * dùng CHUNG với desktop qua `filmsStore` + `useFilmListFilters` — file này chỉ khác cách
 * trình bày.
 *
 * Ba điểm khác desktop, đều theo `mobile-pwa.md`:
 *  - Toolbar 2 tầng (§4.1): tiêu đề + Primary ở tầng đầu, bộ lọc ở tầng sau.
 *  - Bộ lọc chuyên mục/phim mới/số dòng chuyển vào BOTTOM SHEET (§4.5) thay vì dropdown +
 *    switch dàn ngang — ở 320px hàng đó chắc chắn vỡ.
 *  - Ô tìm kiếm KHÔNG lặp lại ở đây: `MHeaderBar :compact` đã đổi ô tìm kiếm toàn cục thành
 *    icon mở search full-width từ GĐ6 (§3), dựng thêm một ô nữa là thừa và chật.
 */
const router = useRouter()
const store = useFilmsStore()
const auth = useAuthStore()

const {
  categoriesTree,
  categoryFilter,
  onlyNew,
  pageSize,
  page,
  loadCategories,
  selectedCategoryName,
  hasActiveFilter,
  filtered,
  totalPages,
  paged,
  rangeText,
  prevPage,
  nextPage,
  clearSearch,
  resetFilters,
} = useFilmListFilters(computed(() => store.films))

onMounted(() => {
  store.load()
  loadCategories().then(() => {
    // Mở sẵn toàn bộ nhánh cha để người dùng thấy ngay quan hệ cha–con mà không phải bấm
    // từng chevron trên màn hình nhỏ.
    expandedCategories.value = flattenCategoryTree(categoriesTree.value)
      .filter((c) => c.children?.length)
      .map((c) => c.id)
  })
})

/* ── Bộ lọc dạng bottom sheet ─────────────────────────────────────────────── */

const filterOpen = ref(false)
const expandedCategories = ref<number[]>([])

/** Số bộ lọc đang bật — hiện thành badge trên nút Lọc để không phải mở sheet mới biết. */
const activeFilterCount = computed(
  () =>
    (categoryFilter.value != null ? 1 : 0) +
    (onlyNew.value ? 1 : 0) +
    (filmSearchQuery.value.trim() ? 1 : 0),
)

/**
 * MTree nhận `{ id, label, children }`; cây chuyên mục của app dùng `name`. Chuyển đổi tại
 * đây thay vì đổi kiểu dữ liệu API — API/schema thuộc phạm vi KHÔNG được đụng ở GĐ8.
 */
function toTreeNodes(nodes: ApiCategoryNode[]): Array<Record<string, unknown>> {
  return nodes.map((n) => ({
    id: n.id,
    label: n.name,
    children: n.children?.length ? toTreeNodes(n.children) : undefined,
  }))
}
const categoryTreeNodes = computed(() => toTreeNodes(categoriesTree.value))

/** `null` trong MTree = chưa chọn node nào = "Tất cả chuyên mục". */
const treeSelected = computed({
  get: () => categoryFilter.value ?? null,
  set: (v: number | string | null) => {
    categoryFilter.value = v == null ? undefined : Number(v)
  },
})

function selectAllCategories() {
  categoryFilter.value = undefined
}

/* ── Điều hướng / thao tác ────────────────────────────────────────────────── */

function openFilm(film: ApiFilm) {
  router.push({ name: 'film-detail', params: { slug: film.slug } })
}

/** "Tất cả" trên một kệ → lọc luôn theo chuyên mục đó. */
function showAllOfCategory(categoryId: number) {
  categoryFilter.value = categoryId
}

/** Cấp 2 trở lên mới thấy nút thêm phim (RBAC 4 cấp — ADR-040, dùng chung helper với desktop). */
const canCreate = computed(() => canCreateFilm(auth.role))

function goUpload() {
  router.push({ name: 'upload' })
}

const manageDialogs = ref<InstanceType<typeof FilmManageDialogs> | null>(null)

/** Vùng cuộn của danh sách — đổi trang thì đưa người dùng về đầu danh sách. */
const scrollArea = ref<HTMLElement | null>(null)
function goPrev() {
  prevPage()
  scrollArea.value?.scrollTo({ top: 0 })
}
function goNext() {
  nextPage()
  scrollArea.value?.scrollTo({ top: 0 })
}
</script>

<template>
  <section class="flex h-full flex-col" style="background: var(--mds-bg-canvas, #ecedef)">
    <!-- Toolbar 2 tầng (mobile-pwa.md §4.1) -->
    <div class="shrink-0 bg-white px-3 pb-2 pt-2" style="box-shadow: var(--mds-shadow-card, 0 0 2px 0 rgba(0,0,0,0.1))">
      <div class="flex items-center justify-between gap-2">
        <h1 class="min-w-0 truncate text-[16px] font-semibold" style="color: var(--mds-text-primary)">
          Kho phim
        </h1>
        <!-- Nhãn "Thêm" viết riêng cho mobile (desktop là "Thêm phim") — ngắn để nút không
             bao giờ phải xuống dòng ở 320px. Cấp 1 không thấy nút này. -->
        <!-- min-h-12: MButton cao 32px theo mật độ MDS desktop; màn cảm ứng cần vùng chạm
             48px (mobile-pwa.md §5). Đặt tại chỗ dùng thay vì sửa MButton toàn cục, để bản
             desktop giữ nguyên mật độ. -->
        <MButton v-if="canCreate" variant="primary" class="min-h-12 shrink-0 whitespace-nowrap" @click="goUpload">
          <template #icon><MIcon name="plus" :size="16" /></template>
          Thêm
        </MButton>
      </div>

      <div class="mt-2 flex items-center gap-2">
        <button
          type="button"
          class="flex min-h-12 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium"
          :style="
            activeFilterCount
              ? 'border-color: var(--mds-brand-600); background: var(--mds-brand-50); color: var(--mds-brand-700)'
              : 'border-color: var(--mds-border, #CED1D6); color: var(--mds-text-secondary)'
          "
          :aria-label="`Bộ lọc${activeFilterCount ? ` (${activeFilterCount} đang bật)` : ''}`"
          @click="filterOpen = true"
        >
          <MIcon name="filter" :size="16" />
          <span class="whitespace-nowrap">Bộ lọc</span>
          <span
            v-if="activeFilterCount"
            class="grid h-4 min-w-4 place-items-center rounded-full px-1 text-[11px] font-semibold text-white"
            style="background: var(--mds-brand-600)"
          >
            {{ activeFilterCount }}
          </span>
        </button>

        <span
          class="ml-auto flex min-w-0 items-center gap-1.5 truncate text-[12px]"
          style="color: var(--mds-text-secondary)"
        >
          <MSpinner v-if="store.loading" :size="14" />
          {{ rangeText }}
        </span>
      </div>

      <!-- Chip bộ lọc đang bật: cuộn ngang trong đúng container này, không đẩy trang tràn ngang -->
      <div v-if="activeFilterCount" class="-mx-3 mt-2 flex gap-1.5 overflow-x-auto px-3 pb-0.5">
        <button
          v-if="filmSearchQuery.trim()"
          type="button"
          class="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium"
          style="background: var(--mds-brand-50); color: var(--mds-brand-700)"
          @click="clearSearch"
        >
          <MIcon name="search" :size="12" />
          <span class="max-w-[140px] truncate">{{ filmSearchQuery }}</span>
          <MIcon name="x" :size="12" />
        </button>
        <button
          v-if="categoryFilter != null"
          type="button"
          class="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium"
          style="background: var(--mds-brand-50); color: var(--mds-brand-700)"
          @click="selectAllCategories"
        >
          <span class="max-w-[140px] truncate">{{ selectedCategoryName }}</span>
          <MIcon name="x" :size="12" />
        </button>
        <button
          v-if="onlyNew"
          type="button"
          class="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium"
          style="background: var(--mds-brand-50); color: var(--mds-brand-700)"
          @click="onlyNew = false"
        >
          <span class="whitespace-nowrap">Phim mới</span>
          <MIcon name="x" :size="12" />
        </button>
      </div>
    </div>

    <!-- Nội dung: đúng MỘT vùng cuộn dọc (mobile-pwa.md §6) -->
    <div ref="scrollArea" class="min-h-0 flex-1 overflow-y-auto p-3">
      <div class="flex flex-col gap-3">
        <!-- Kệ ngang theo chuyên mục cha — chỉ khi chưa lọc gì (ADR-056), cuộn ngang trong kệ -->
        <CategoryShelves
          v-if="!hasActiveFilter && !store.loading"
          mobile
          :films="store.films"
          :categories="categoriesTree"
          @open="openFilm"
          @edit="manageDialogs?.openEdit($event)"
          @delete="manageDialogs?.openDelete($event)"
          @show-all="showAllOfCategory"
        />

        <!-- Danh sách phim dạng card, 1 cột (§4.1: xử lý từng bản ghi độc lập → card) -->
        <div v-if="paged.length" class="flex flex-col gap-3">
          <FilmCardMobile
            v-for="film in paged"
            :key="film.id"
            :film="film"
            @open="openFilm"
            @edit="manageDialogs?.openEdit($event)"
            @delete="manageDialogs?.openDelete($event)"
          />
        </div>

        <div v-else-if="!store.loading" class="rounded-lg bg-white p-2">
          <MEmptyState
            type="no-result"
            title="Không tìm thấy phim phù hợp"
            description="Thử đổi từ khoá tìm kiếm hoặc bỏ bớt bộ lọc."
          >
            <template #actions>
              <MButton v-if="activeFilterCount" variant="secondary" class="min-h-12" @click="resetFilters">
                Xoá bộ lọc
              </MButton>
            </template>
          </MEmptyState>
        </div>

        <!-- Phân trang: Prev/Next theo MDS, mỗi nút là vùng chạm 48px, không dàn nút chữ -->
        <div
          v-if="filtered.length"
          class="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2"
          style="box-shadow: var(--mds-shadow-card, 0 0 2px 0 rgba(0,0,0,0.1))"
        >
          <button
            type="button"
            class="grid h-12 w-12 shrink-0 place-items-center rounded-lg disabled:opacity-40"
            style="border: 1px solid var(--mds-border, #ced1d6); color: var(--mds-icon-neutral)"
            :disabled="page <= 1"
            aria-label="Trang trước"
            @click="goPrev"
          >
            <MIcon name="chevron-left" :size="20" />
          </button>
          <span class="min-w-0 truncate text-center text-[12px]" style="color: var(--mds-text-secondary)">
            Trang {{ page }}/{{ totalPages }}
          </span>
          <button
            type="button"
            class="grid h-12 w-12 shrink-0 place-items-center rounded-lg disabled:opacity-40"
            style="border: 1px solid var(--mds-border, #ced1d6); color: var(--mds-icon-neutral)"
            :disabled="page >= totalPages"
            aria-label="Trang sau"
            @click="goNext"
          >
            <MIcon name="chevron-right" :size="20" />
          </button>
        </div>
      </div>
    </div>

    <!-- Bottom sheet bộ lọc (mobile-pwa.md §4.5). Lọc áp dụng NGAY khi chọn — người dùng thấy
         luôn số phim đổi ở tầng toolbar, không cần cơ chế nháp/Áp dụng. -->
    <MDrawer v-model="filterOpen" position="bottom" title="Bộ lọc">
      <div class="flex flex-col gap-4">
        <div>
          <p class="mb-1.5 text-[13px] font-semibold" style="color: var(--mds-text-primary)">
            Chuyên mục
          </p>
          <!-- Chọn chuyên mục CHA = xem cả nhánh con (quy tắc dùng chung với desktop) -->
          <button
            type="button"
            class="mb-1 flex min-h-12 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px]"
            :style="
              categoryFilter == null
                ? 'background: var(--mds-brand-50); color: var(--mds-brand-700); font-weight: 600'
                : 'color: var(--mds-text-primary)'
            "
            @click="selectAllCategories"
          >
            Tất cả chuyên mục
          </button>
          <div class="max-h-[38dvh] overflow-y-auto">
            <MTree
              v-model:selected="treeSelected"
              v-model:expanded="expandedCategories"
              :nodes="categoryTreeNodes"
            />
          </div>
        </div>

        <label class="flex min-h-12 items-center gap-2 border-t pt-3 text-[13px]" style="border-color: var(--mds-border-light, #e9eaeb); color: var(--mds-text-primary)">
          <MSwitch v-model="onlyNew" />
          Chỉ hiển thị phim mới
        </label>

        <div class="border-t pt-3" style="border-color: var(--mds-border-light, #e9eaeb)">
          <p class="mb-1.5 text-[13px] font-semibold" style="color: var(--mds-text-primary)">
            Số phim mỗi trang
          </p>
          <!-- MRadioGroup dọc thay cho MSelect: dropdown của MSelect teleport ra body ở
               z-[1000], nằm DƯỚI panel bottom sheet z-[1001] nên sẽ bị che. -->
          <MRadioGroup v-model="pageSize" :options="PAGE_SIZE_OPTIONS" direction="vertical" />
        </div>
      </div>

      <template #footer>
        <!-- Đúng 2 nút, mỗi nút chiếm nửa hàng và whitespace-nowrap → không bao giờ ngắt dòng -->
        <MButton variant="secondary" class="min-h-12 flex-1 whitespace-nowrap" @click="resetFilters">
          Xoá lọc
        </MButton>
        <MButton variant="primary" class="min-h-12 flex-1 whitespace-nowrap" @click="filterOpen = false">
          Xong
        </MButton>
      </template>
    </MDrawer>

    <FilmManageDialogs ref="manageDialogs" @changed="store.load()" />
  </section>
</template>

<style scoped>
/* Vùng chạm 48px cho từng dòng chuyên mục trong bottom sheet (mobile-pwa.md §5). MTree đặt
   py-1.5 (~28px) cho mật độ desktop — chỉ nới ở màn cảm ứng, không đụng bản desktop. */
@media (pointer: coarse) {
  :deep([role='treeitem']) {
    min-height: 48px;
  }
}
</style>
