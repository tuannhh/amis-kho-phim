<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import MButton from '@/components/mds/MButton.vue'
import MIcon from '@/components/mds/MIcon.vue'
import MSelect from '@/components/mds/MSelect.vue'
import MEmptyState from '@/components/mds/MEmptyState.vue'
import MSpinner from '@/components/mds/MSpinner.vue'
import { useToast } from '@/components/mds/toast.js'
import FilmCard from './FilmCard.vue'
import FilmManageDialogs from './FilmManageDialogs.vue'
import { filmsApi, type ApiFilm } from './filmsApi'
import { publishedTime } from './filmTypes'
import { useAuthStore } from '@/features/auth/authStore'
import { canCreateFilm, canManageFilm } from '@/features/auth/permissions'
import {
  categoriesApi,
  categoryIdsWithDescendants,
  categoryOptions as buildCategoryOptions,
  type ApiCategoryNode,
} from '@/features/categories/categoriesApi'

/**
 * "Phim tôi quản lý" (đợt 2 việc 6) — đúng những phim người đang đăng nhập được phép sửa/xoá.
 *
 * Phạm vi do BACKEND quyết định qua `GET /films?scope=managed` (cùng ma trận với
 * `assertCanManage`), FE không tự lọc lấy:
 *   Cấp 2 → phim của chính mình
 *   Cấp 3 → phim của mình + phim của Cấp 2 cùng phòng ban
 *   Cấp 4 → toàn bộ kho phim
 *
 * ADR-057: Cấp 4 VẪN có mục này (thay vì ẩn đi cho gọn) — để bốn cấp cùng một chỗ thao tác
 * quản lý phim, không phải nhớ "cấp nào thì làm ở màn nào". Với Cấp 4 nó trùng nội dung với
 * Kho phim, nhưng khác mục đích: ở đây không có kệ/không lọc trưng bày, chỉ là danh sách để
 * sửa/xoá nhanh.
 */
const router = useRouter()
const toast = useToast()
const auth = useAuthStore()

const films = ref<ApiFilm[]>([])
const loading = ref(false)
const categoriesTree = ref<ApiCategoryNode[]>([])

const categoryFilter = ref<number | undefined>(undefined)
const sort = ref<'newest' | 'views'>('newest')

const sortOptions = [
  { label: 'Mới nhất', value: 'newest' as const },
  { label: 'Xem nhiều nhất', value: 'views' as const },
]

const categoryFilterOptions = computed(() => [
  { label: 'Tất cả chuyên mục', value: undefined as number | undefined, depth: 0 },
  ...buildCategoryOptions(categoriesTree.value),
])

async function load() {
  loading.value = true
  try {
    films.value = await filmsApi.listManaged()
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'Không tải được danh sách phim')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  load()
  categoriesApi.tree().then((t) => (categoriesTree.value = t))
})

const visible = computed(() => {
  const ids =
    categoryFilter.value == null
      ? null
      : new Set(categoryIdsWithDescendants(categoriesTree.value, categoryFilter.value))
  return films.value
    .filter((f) => !ids || (f.categoryId != null && ids.has(f.categoryId)))
    .slice()
    .sort((a, b) =>
      sort.value === 'views'
        ? b.viewCount - a.viewCount
        : publishedTime(b.publishedAt) - publishedTime(a.publishedAt),
    )
})

const totals = computed(() => ({
  films: visible.value.length,
  views: visible.value.reduce((s, f) => s + f.viewCount, 0),
  downloads: visible.value.reduce((s, f) => s + f.downloadCount, 0),
}))

function fmt(n: number) {
  return n.toLocaleString('vi-VN')
}

function openFilm(film: ApiFilm) {
  router.push({
    name: 'film-detail',
    params: { categorySlug: film.urlCategorySlug, filmSlug: film.urlFilmSlug },
  })
}

/**
 * Chốt chặn cuối phía FE: kể cả khi backend lỡ trả về một phim ngoài phạm vi (dữ liệu cũ,
 * lỗi lọc), thẻ đó vẫn chỉ xem được chứ không hiện nút Sửa/Xoá. Yêu cầu này người dùng nêu
 * tường minh cho màn này.
 */
function isManageable(film: ApiFilm) {
  return canManageFilm(auth.user, film)
}

const canCreate = computed(() => canCreateFilm(auth.role))
const manageDialogs = ref<InstanceType<typeof FilmManageDialogs> | null>(null)
</script>

<template>
  <section class="flex h-full flex-col">
    <header
      class="flex h-14 shrink-0 items-center justify-between gap-3 bg-white px-5"
      style="box-shadow: var(--mds-shadow-card, 0 0 2px 0 rgba(0,0,0,0.1))"
    >
      <h1 class="text-[16px] font-semibold" style="color: var(--mds-text-primary)">
        Phim tôi quản lý
      </h1>
      <MButton v-if="canCreate" variant="primary" @click="router.push({ name: 'upload' })">
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
          <div class="w-full sm:w-[240px]">
            <MSelect
              v-model="categoryFilter"
              :options="categoryFilterOptions"
              placeholder="Tất cả chuyên mục"
            />
          </div>
          <div class="w-full sm:w-[180px]">
            <MSelect v-model="sort" :options="sortOptions" />
          </div>
          <span
            class="ml-auto flex items-center gap-3 text-[13px]"
            style="color: var(--mds-text-secondary)"
          >
            <MSpinner v-if="loading" :size="14" />
            <span>{{ fmt(totals.films) }} phim</span>
            <span class="flex items-center gap-1">
              <MIcon name="eye" :size="12" />{{ fmt(totals.views) }}
            </span>
            <span class="flex items-center gap-1">
              <MIcon name="download" :size="12" />{{ fmt(totals.downloads) }}
            </span>
          </span>
        </div>

        <div
          v-if="visible.length"
          class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          <FilmCard
            v-for="film in visible"
            :key="film.id"
            :film="film"
            :manageable="isManageable(film)"
            @open="openFilm"
            @edit="manageDialogs?.openEdit($event)"
            @delete="manageDialogs?.openDelete($event)"
          />
        </div>

        <MEmptyState
          v-else-if="!loading"
          type="no-data"
          title="Chưa có phim nào bạn quản lý"
          description="Phim bạn đăng — và với Trưởng phòng là cả phim của nhân viên cùng phòng ban — sẽ hiện ở đây."
        >
          <template #actions>
            <MButton v-if="canCreate" variant="primary" @click="router.push({ name: 'upload' })">
              Thêm phim
            </MButton>
          </template>
        </MEmptyState>
      </div>
    </div>

    <FilmManageDialogs ref="manageDialogs" @changed="load" />
  </section>
</template>
