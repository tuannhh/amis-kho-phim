<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import MButton from '@/components/mds/MButton.vue'
import MSelect from '@/components/mds/MSelect.vue'
import MSwitch from '@/components/mds/MSwitch.vue'
import MIcon from '@/components/mds/MIcon.vue'
import MEmptyState from '@/components/mds/MEmptyState.vue'
import MSpinner from '@/components/mds/MSpinner.vue'
import { useFilmsStore } from './filmsStore'
import { filmSearchQuery } from './searchState'
import { useAuthStore } from '@/features/auth/authStore'
import { canCreateFilm } from '@/features/auth/permissions'
import FilmCard from './FilmCard.vue'
import FilmManageDialogs from './FilmManageDialogs.vue'
import CategoryShelves from './CategoryShelves.vue'
import { PAGE_SIZE_OPTIONS, useFilmListFilters } from './useFilmListFilters'
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

// Toàn bộ quy tắc lọc/phân trang nằm ở composable DÙNG CHUNG với bản mobile (GĐ8) —
// xem useFilmListFilters.ts. View này chỉ còn phần trình bày.
const {
  categoriesTree,
  categoryFilter,
  onlyNew,
  pageSize,
  page,
  loadCategories,
  categoryFilterOptions,
  hasActiveFilter,
  filtered,
  totalPages,
  paged,
  rangeText,
  prevPage,
  nextPage,
  clearSearch,
} = useFilmListFilters(computed(() => store.films))

const pageSizeOptions = PAGE_SIZE_OPTIONS

onMounted(() => {
  store.load()
  loadCategories()
})

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
        <!-- Thanh bộ lọc LUÔN ở đầu trang — đây là cách duy nhất bật hasActiveFilter, để
             xuống dưới cùng (như trước ADR-067) thì trang nhiều kệ chuyên mục sẽ đẩy nó mất
             hút, phải cuộn hết mới thấy. -->
        <div
          class="flex flex-wrap items-center gap-3 rounded-lg bg-white p-4"
          style="box-shadow: var(--mds-shadow-card, 0 0 2px 0 rgba(0,0,0,0.1))"
        >
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

        <!-- Lưới đầy đủ + phân trang — chỉ khi có bộ lọc/tìm kiếm đang bật, tránh hiện trùng
             phim với kệ chuyên mục ở trên (ADR-063). -->
        <div
          v-if="hasActiveFilter"
          class="flex flex-col gap-4 rounded-lg bg-white p-4"
          style="box-shadow: var(--mds-shadow-card, 0 0 2px 0 rgba(0,0,0,0.1))"
        >
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
