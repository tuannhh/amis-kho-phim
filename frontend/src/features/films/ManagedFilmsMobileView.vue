<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import MMobileTopBar from '@/components/mds/MMobileTopBar.vue'
import MButton from '@/components/mds/MButton.vue'
import MDrawer from '@/components/mds/MDrawer.vue'
import MSelect from '@/components/mds/MSelect.vue'
import MIcon from '@/components/mds/MIcon.vue'
import MEmptyState from '@/components/mds/MEmptyState.vue'
import MSpinner from '@/components/mds/MSpinner.vue'
import MDialog from '@/components/mds/MDialog.vue'
import FilmCardMobile from './FilmCardMobile.vue'
import { filmsApi, type ApiFilm } from './filmsApi'
import { publishedTime } from './filmTypes'
import { useToast } from '@/components/mds/toast.js'
import { categoriesApi, categoryIdsWithDescendants, categoryOptions as buildCategoryOptions, type ApiCategoryNode } from '@/features/categories/categoriesApi'
import { useAuthStore } from '@/features/auth/authStore'
import { canCreateFilm } from '@/features/auth/permissions'

const router = useRouter()
const toast = useToast()
const auth = useAuthStore()
const films = ref<ApiFilm[]>([])
const categoriesTree = ref<ApiCategoryNode[]>([])
const loading = ref(false)
const filterOpen = ref(false)
const categoryFilter = ref<number | undefined>()
const sort = ref<'newest' | 'views'>('newest')
const deleteTarget = ref<ApiFilm | null>(null)
const deleting = ref(false)

const categoryOptions = computed(() => [
  { label: 'Tất cả chuyên mục', value: undefined as number | undefined, depth: 0 },
  ...buildCategoryOptions(categoriesTree.value),
])
const sortOptions = [
  { label: 'Mới nhất', value: 'newest' },
  { label: 'Xem nhiều nhất', value: 'views' },
]
const visible = computed(() => {
  const ids = categoryFilter.value == null ? null : new Set(categoryIdsWithDescendants(categoriesTree.value, categoryFilter.value))
  return films.value
    .filter((film) => !ids || (film.categoryId != null && ids.has(film.categoryId)))
    .slice()
    .sort((a, b) => sort.value === 'views' ? b.viewCount - a.viewCount : publishedTime(b.publishedAt) - publishedTime(a.publishedAt))
})
const totals = computed(() => ({
  films: visible.value.length,
  views: visible.value.reduce((sum, film) => sum + film.viewCount, 0),
}))
const canCreate = computed(() => canCreateFilm(auth.role))

async function load() {
  loading.value = true
  try {
    films.value = await filmsApi.listManaged()
  } catch (error: unknown) {
    toast.error(error instanceof Error ? error.message : 'Không tải được danh sách phim')
  } finally {
    loading.value = false
  }
}
onMounted(() => {
  load()
  categoriesApi.tree().then((tree) => (categoriesTree.value = tree))
})
function resetFilters() {
  categoryFilter.value = undefined
  sort.value = 'newest'
}
function confirmFilters() {
  filterOpen.value = false
}
function openFilm(film: ApiFilm) {
  router.push({ name: 'film-detail', params: { slug: film.slug } })
}
function editFilm(film: ApiFilm) {
  router.push({ name: 'upload', query: { edit: film.slug } })
}
async function deleteFilm() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    const title = deleteTarget.value.title
    await filmsApi.remove(deleteTarget.value.id)
    deleteTarget.value = null
    await load()
    toast.success(`Đã xoá phim "${title}"`)
  } catch (error: unknown) {
    toast.error(error instanceof Error ? error.message : 'Xoá phim không thành công')
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <section class="mds-mobile-app flex h-full min-h-0 flex-col overflow-hidden bg-[var(--mds-bg-page)]">
    <MMobileTopBar title="Phim tôi quản lý" :show-more="false" @back="router.push({ name: 'films' })">
      <template #actions>
        <MButton v-if="canCreate" variant="icon" aria-label="Thêm phim" @click="router.push({ name: 'upload' })">
          <template #icon><MIcon name="plus" :size="20" /></template>
        </MButton>
      </template>
    </MMobileTopBar>

    <div class="mds-mobile-gutter-x mds-mobile-row-gap-2 flex shrink-0 items-center gap-2 border-b bg-white py-3" style="border-color: var(--mds-border-light)">
      <span class="min-w-0 flex-1 truncate text-[13px]" style="color: var(--mds-text-secondary)">
        {{ totals.films }} phim · {{ totals.views.toLocaleString('vi-VN') }} lượt xem
      </span>
      <MButton variant="neutral" aria-label="Lọc và sắp xếp" @click="filterOpen = true">
        <template #icon><MIcon name="filter" :size="18" /></template>
        Lọc
      </MButton>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto px-4 py-4">
      <div v-if="loading" class="flex justify-center py-10"><MSpinner :size="20" /></div>
      <div v-else-if="visible.length" class="flex flex-col gap-3">
        <FilmCardMobile v-for="film in visible" :key="film.id" :film="film" @open="openFilm" @edit="editFilm" @delete="deleteTarget = $event" />
      </div>
      <MEmptyState v-else type="no-data" title="Chưa có phim để quản lý" description="Những phim thuộc phạm vi của bạn sẽ hiện tại đây.">
        <template #actions><MButton v-if="canCreate" variant="primary" @click="router.push({ name: 'upload' })">Thêm phim</MButton></template>
      </MEmptyState>
    </div>

    <MDrawer v-model="filterOpen" position="bottom" title="Lọc phim">
      <div class="flex flex-col gap-4">
        <div><label class="mb-1 block text-[13px] font-medium">Chuyên mục</label><MSelect v-model="categoryFilter" :options="categoryOptions" /></div>
        <div><label class="mb-1 block text-[13px] font-medium">Sắp xếp</label><MSelect v-model="sort" :options="sortOptions" /></div>
      </div>
      <template #footer>
        <MButton variant="secondary" @click="resetFilters">Xoá lọc</MButton>
        <MButton variant="primary" @click="confirmFilters">Xem kết quả</MButton>
      </template>
    </MDrawer>

    <MDialog :model-value="!!deleteTarget" title="Xoá vĩnh viễn phim này?" type="danger" @update:model-value="deleteTarget = null">
      <p><strong>{{ deleteTarget?.title }}</strong> sẽ bị gỡ khỏi kho phim. Hành động không thể hoàn tác.</p>
      <template #footer>
        <MButton variant="secondary" :disabled="deleting" @click="deleteTarget = null">Hủy</MButton>
        <MButton variant="danger" :loading="deleting" @click="deleteFilm">Xoá</MButton>
      </template>
    </MDialog>
  </section>
</template>
