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
import MobileHeroHeader from '@/components/mobile/MobileHeroHeader.vue'
import { useNotificationsStore } from '@/features/notifications/notificationsStore'
import { categoryColorFor, categoryColorVar, categoryIconFor } from './filmTypes'
import { useFilmsStore } from './filmsStore'
import { filmSearchQuery } from './searchState'
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
 *  - Ô tìm kiếm nằm NGAY TRONG màn này (GĐ8-B, ADR-061). Trước đây nó dựa vào icon tìm kiếm
 *    của `MHeaderBar :compact`; từ khi header MDS bị ẩn hẳn ở Compact, màn Kho phim phải tự
 *    mang ô tìm kiếm — đây là màn duy nhất tìm kiếm có nghĩa.
 *
 * GĐ8-B đổi phần VỎ chứ không đổi nghiệp vụ:
 *  - Hero header brand bo góc dưới lớn, chứa tiêu đề + chuông thông báo + ô tìm kiếm dạng
 *    viên thuốc nền trắng, thay cho toolbar trắng phẳng của GĐ8-A.
 *  - Hàng ô chuyên mục (icon vuông bo tròn) làm lối tắt lọc nhanh ở đầu vùng nội dung.
 *  - Nút "Thêm phim" KHÔNG còn ở đây — nó là FAB giữa bottom nav (xem `MobileBottomNav`).
 */
const router = useRouter()
const store = useFilmsStore()
const notifications = useNotificationsStore()

const emit = defineEmits<{ (e: 'notifications'): void }>()

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

/**
 * Ô chuyên mục ở đầu trang: chỉ chuyên mục CẤP MỘT (nhánh con vẫn được gộp vào khi lọc, theo
 * đúng quy tắc dùng chung ở `useFilmListFilters`). Giới hạn 8 ô — quá số đó thì hàng cuộn
 * ngang thành vô tận và mất tác dụng "lối tắt".
 *
 * Kèm ô "Tất cả" đứng đầu để bỏ lọc nhanh mà không phải mở bottom sheet.
 */
const categoryTiles = computed(() => {
  const all = {
    id: null as number | null,
    name: 'Tất cả',
    icon: 'layout-grid',
    color: categoryColorVar('brand'),
  }
  // Tối đa 7 chuyên mục + ô "Tất cả" = 8 ô = đúng 2 hàng lưới 4 cột, không lẻ hàng.
  return [
    all,
    ...categoriesTree.value.slice(0, 7).map((c) => ({
      id: c.id as number | null,
      name: c.name,
      icon: categoryIconFor(c.id),
      color: categoryColorVar(categoryColorFor(c.id)),
    })),
  ]
})

/**
 * Bấm ô chuyên mục đang chọn lần nữa = bỏ lọc (không cần đi tìm nút Xoá).
 * `id === null` là ô "Tất cả" → luôn bỏ lọc chuyên mục.
 */
function toggleCategoryTile(id: number | null) {
  if (id == null) categoryFilter.value = undefined
  else categoryFilter.value = categoryFilter.value === id ? undefined : id
  scrollArea.value?.scrollTo({ top: 0 })
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
  <!-- Nền: chuyển sắc rất nhẹ từ tint brand nhạt nhất xuống nền xám chuẩn MDS. Hai đầu đều là
       token có sẵn (`--mds-brand-50` → `--mds-bg-page`), không pha màu mới; mục đích là để
       vùng ngay dưới hero header không cắt phựt từ xanh đậm sang xám. -->
  <section class="flex h-full flex-col" style="background: var(--mds-bg-page, #ecedef)">
    <!-- Hero header brand: tiêu đề + chuông + ô tìm kiếm nằm chung trong một khối bo góc dưới.
         Thay cho toolbar trắng phẳng của GĐ8-A và cho cả MHeaderBar đã ẩn (ADR-061). -->
    <MobileHeroHeader
      title="Kho phim"
      show-notifications
      :notification-count="notifications.unreadCount"
      @notifications="emit('notifications')"
    >
      <div class="mt-3 flex items-center gap-2">
        <!-- Ô tìm kiếm dạng viên thuốc nền trắng. font-size 16px là BẮT BUỘC trên compact
             touch (mobile-pwa.md §5) — nhỏ hơn thì iOS tự phóng to trang khi focus. -->
        <div class="relative min-w-0 flex-1">
          <span class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" style="color: var(--mds-text-placeholder)">
            <MIcon name="search" :size="18" />
          </span>
          <input
            v-model="filmSearchQuery"
            type="search"
            inputmode="search"
            enterkeyhint="search"
            class="h-12 w-full rounded-full bg-white pl-11 pr-10 text-[16px] outline-none placeholder:text-[var(--mds-text-placeholder)]"
            style="color: var(--mds-text)"
            placeholder="Tìm phim, hashtag..."
            aria-label="Tìm phim theo tên hoặc hashtag"
          />
          <button
            v-if="filmSearchQuery.trim()"
            type="button"
            class="absolute right-0 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full"
            style="color: var(--mds-text-secondary)"
            aria-label="Xoá từ khoá tìm kiếm"
            @click="clearSearch"
          >
            <MIcon name="x" :size="18" />
          </button>
        </div>

        <!-- Nút lọc: ô vuông bo tròn nền trắng mờ, cùng chiều cao ô tìm kiếm -->
        <button
          type="button"
          class="relative grid h-12 w-12 shrink-0 place-items-center rounded-full text-white active:bg-white/25"
          style="background: rgba(255, 255, 255, 0.18)"
          :aria-label="`Bộ lọc${activeFilterCount ? ` (${activeFilterCount} đang bật)` : ''}`"
          @click="filterOpen = true"
        >
          <MIcon name="filter" :size="20" />
          <span
            v-if="activeFilterCount"
            class="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[10px] font-semibold leading-none text-white ring-2"
            style="background: var(--mds-danger); --tw-ring-color: var(--mds-brand-700)"
          >
            {{ activeFilterCount }}
          </span>
        </button>
      </div>
    </MobileHeroHeader>

    <!-- Nội dung: đúng MỘT vùng cuộn dọc (mobile-pwa.md §6) -->
    <!-- Nền vùng nội dung: chuyển sắc rất nhẹ từ tint brand nhạt nhất xuống nền xám chuẩn MDS,
         để chỗ tiếp giáp ngay dưới hero header không cắt phựt từ xanh đậm sang xám. Cả hai
         đầu đều là token có sẵn (`--mds-brand-50` → `--mds-bg-page`), không pha màu mới.
         Đặt trên chính vùng cuộn nên dải màu bám theo mép trên khung nhìn, không trôi theo
         nội dung. -->
    <div
      ref="scrollArea"
      class="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-4"
      style="background: linear-gradient(180deg, var(--mds-brand-50) 0px, var(--mds-bg-page, #ecedef) 200px)"
    >
      <!-- Hàng ô chuyên mục: lối tắt lọc nhanh. Icon Tabler đã đăng ký, nền là tint pha từ
           ĐÚNG token màu của chuyên mục đó (cùng tông với MTag chuyên mục trên thẻ phim),
           không có mã màu nào nằm ngoài tokens.css. -->
      <div v-if="categoryTiles.length > 1" class="mb-5 grid grid-cols-4 gap-x-2 gap-y-3">
        <button
          v-for="tile in categoryTiles"
          :key="tile.id ?? 'all'"
          type="button"
          class="flex min-w-0 flex-col items-center gap-1.5"
          :aria-pressed="(categoryFilter ?? null) === tile.id"
          @click="toggleCategoryTile(tile.id)"
        >
          <span
            class="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-2xl transition-transform active:scale-95"
            :style="{
              background: `color-mix(in srgb, ${tile.color} 13%, white)`,
              color: tile.color,
              boxShadow:
                (categoryFilter ?? null) === tile.id
                  ? `0 0 0 2px white, 0 0 0 4px ${tile.color}`
                  : '0 2px 8px -3px rgba(16,24,40,0.18)',
            }"
          >
            <MIcon :name="tile.icon" :size="24" />
          </span>
          <!-- min-h 2 dòng: tên chuyên mục dài ngắn khác nhau, không ghim chiều cao thì các ô
               trong cùng hàng lệch chân nhau. -->
          <span
            class="line-clamp-2 min-h-[28px] w-full text-center text-[11px] leading-[14px]"
            :style="{
              color: (categoryFilter ?? null) === tile.id ? tile.color : 'var(--mds-text-secondary)',
              fontWeight: (categoryFilter ?? null) === tile.id ? 600 : 400,
            }"
          >
            {{ tile.name }}
          </span>
        </button>
      </div>

      <!-- Chip bộ lọc đang bật + số kết quả: một hàng, cuộn ngang, không đẩy trang tràn -->
      <div class="mb-3 flex items-center gap-2">
        <!-- Chip: viên thuốc CAO 32px cho gọn mắt, nhưng nút bao ngoài cao 48px để vùng chạm
             vẫn đạt chuẩn màn cảm ứng (mobile-pwa.md §5) — nới viên thuốc lên 48px sẽ làm cả
             hàng bộ lọc nặng nề. -->
        <div v-if="activeFilterCount" class="-mx-4 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-4">
          <button
            v-if="filmSearchQuery.trim()"
            type="button"
            class="flex h-12 shrink-0 items-center"
            aria-label="Bỏ lọc theo từ khoá"
            @click="clearSearch"
          >
            <span
              class="flex h-8 items-center gap-1 rounded-full px-3 text-[12px] font-medium"
              style="background: var(--mds-brand-50); color: var(--mds-brand-700)"
            >
              <MIcon name="search" :size="12" />
              <span class="max-w-[120px] truncate">{{ filmSearchQuery }}</span>
              <MIcon name="x" :size="13" />
            </span>
          </button>
          <button
            v-if="categoryFilter != null"
            type="button"
            class="flex h-12 shrink-0 items-center"
            aria-label="Bỏ lọc theo chuyên mục"
            @click="selectAllCategories"
          >
            <span
              class="flex h-8 items-center gap-1 rounded-full px-3 text-[12px] font-medium"
              style="background: var(--mds-brand-50); color: var(--mds-brand-700)"
            >
              <span class="max-w-[120px] truncate">{{ selectedCategoryName }}</span>
              <MIcon name="x" :size="13" />
            </span>
          </button>
          <button
            v-if="onlyNew"
            type="button"
            class="flex h-12 shrink-0 items-center"
            aria-label="Bỏ lọc phim mới"
            @click="onlyNew = false"
          >
            <span
              class="flex h-8 items-center gap-1 rounded-full px-3 text-[12px] font-medium"
              style="background: var(--mds-brand-50); color: var(--mds-brand-700)"
            >
              <span class="whitespace-nowrap">Phim mới</span>
              <MIcon name="x" :size="13" />
            </span>
          </button>
        </div>
        <span
          class="ml-auto flex shrink-0 items-center gap-1.5 text-[12px]"
          style="color: var(--mds-text-secondary)"
        >
          <MSpinner v-if="store.loading" :size="14" />
          {{ rangeText }}
        </span>
      </div>

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

        <!-- Chưa lọc/tìm gì → phim đã hiện đủ ở kệ chuyên mục phía trên rồi, ẩn danh sách
             đầy đủ để tránh hiện trùng cùng phim 2 lần trên 1 màn (ADR-063). -->
        <p
          v-if="!hasActiveFilter && !store.loading"
          class="px-1 py-4 text-center text-[12.5px]"
          style="color: var(--mds-text-secondary)"
        >
          Mở bộ lọc để xem danh sách đầy đủ tại đây.
        </p>

        <!-- Danh sách phim dạng card, 1 cột (§4.1: xử lý từng bản ghi độc lập → card) -->
        <div v-else-if="paged.length" class="flex flex-col gap-3">
          <FilmCardMobile
            v-for="film in paged"
            :key="film.id"
            :film="film"
            @open="openFilm"
            @edit="manageDialogs?.openEdit($event)"
            @delete="manageDialogs?.openDelete($event)"
          />
        </div>

        <div v-else-if="!store.loading" class="rounded-[18px] bg-white p-3" style="box-shadow: 0 4px 16px -4px rgba(16,24,40,0.12)">
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
          v-if="hasActiveFilter && filtered.length"
          class="flex items-center justify-between gap-2 rounded-[18px] bg-white px-3 py-2.5"
          style="box-shadow: 0 4px 16px -4px rgba(16,24,40,0.12)"
        >
          <button
            type="button"
            class="grid h-12 w-12 shrink-0 place-items-center rounded-full disabled:opacity-40"
            style="background: var(--mds-brand-50); color: var(--mds-brand-600)"
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
            class="grid h-12 w-12 shrink-0 place-items-center rounded-full disabled:opacity-40"
            style="background: var(--mds-brand-50); color: var(--mds-brand-600)"
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
