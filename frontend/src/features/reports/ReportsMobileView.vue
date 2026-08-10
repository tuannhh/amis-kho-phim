<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import MMobileTopBar from '@/components/mds/MMobileTopBar.vue'
import MButton from '@/components/mds/MButton.vue'
import MInput from '@/components/mds/MInput.vue'
import MSelect from '@/components/mds/MSelect.vue'
import MIcon from '@/components/mds/MIcon.vue'
import MDrawer from '@/components/mds/MDrawer.vue'
import MSpinner from '@/components/mds/MSpinner.vue'
import MEmptyState from '@/components/mds/MEmptyState.vue'
import { useToast } from '@/components/mds/toast.js'
import { useAuthStore } from '@/features/auth/authStore'
import { isSystemAdmin } from '@/features/auth/permissions'
import { departmentsApi, type ApiDepartment } from '@/features/departments/departmentsApi'
import { categoriesApi, categoryOptions as buildCategoryOptions, type ApiCategoryNode } from '@/features/categories/categoriesApi'
import { reportsApi, type FilmsReport } from './reportsApi'

const router = useRouter()
const toast = useToast()
const auth = useAuthStore()
const report = ref<FilmsReport>({ totals: { films: 0, views: 0, downloads: 0, uploaders: 0 }, scope: { departmentId: null, departmentName: null, locked: false }, summary: [], films: [] })
const departments = ref<ApiDepartment[]>([])
const categoriesTree = ref<ApiCategoryNode[]>([])
const loading = ref(false)
const exporting = ref(false)
const filterOpen = ref(false)
const activeTab = ref<'overview' | 'people' | 'films'>('overview')
const uploaderId = ref<number | undefined>()
const categoryId = ref<number | undefined>()
const departmentId = ref<number | undefined>()
const minViews = ref('')
const maxViews = ref('')
const from = ref('')
const to = ref('')
const sort = ref<'newest' | 'views' | 'downloads'>('newest')
const canPickDepartment = computed(() => isSystemAdmin(auth.role))
const tabs = [{ key: 'overview', label: 'Tổng quan' }, { key: 'people', label: 'Nhân viên' }, { key: 'films', label: 'Phim' }] as const
const categoryOptions = computed(() => [{ label: 'Tất cả chuyên mục', value: undefined as number | undefined }, ...buildCategoryOptions(categoriesTree.value)])
const uploaderOptions = computed(() => [{ label: 'Tất cả nhân viên', value: undefined as number | undefined }, ...report.value.summary.map((item) => ({ label: item.uploaderName, value: item.uploaderId }))])
const departmentOptions = computed(() => [{ label: 'Tất cả phòng ban', value: undefined as number | undefined }, ...departments.value.map((item) => ({ label: item.name, value: item.id }))])
const sortOptions = [{ label: 'Mới nhất', value: 'newest' }, { label: 'Lượt xem nhiều nhất', value: 'views' }, { label: 'Lượt tải nhiều nhất', value: 'downloads' }]
const stats = computed(() => [
  { label: 'Phim', value: report.value.totals.films, icon: 'layout-grid' },
  { label: 'Lượt xem', value: report.value.totals.views, icon: 'eye' },
  { label: 'Lượt tải', value: report.value.totals.downloads, icon: 'download' },
  { label: 'Người đăng', value: report.value.totals.uploaders, icon: 'users' },
])
function toNumber(value: string) { const number = Number(value.trim()); return value.trim() && Number.isFinite(number) && number >= 0 ? Math.floor(number) : undefined }
function query() { return { uploaderId: uploaderId.value, categoryId: categoryId.value, departmentId: canPickDepartment.value ? departmentId.value : undefined, from: from.value || undefined, to: to.value || undefined, minViews: toNumber(minViews.value), maxViews: toNumber(maxViews.value), sort: sort.value } }
async function load() {
  loading.value = true
  try { report.value = await reportsApi.getFilms(query()) }
  catch (error: unknown) { toast.error(error instanceof Error ? error.message : 'Không tải được báo cáo') }
  finally { loading.value = false }
}
onMounted(async () => {
  categoriesApi.tree().then((tree) => (categoriesTree.value = tree))
  if (canPickDepartment.value) departmentsApi.list().then((items) => (departments.value = items)).catch(() => undefined)
  await load()
})
function resetFilters() { uploaderId.value = undefined; categoryId.value = undefined; departmentId.value = undefined; minViews.value = ''; maxViews.value = ''; from.value = ''; to.value = ''; sort.value = 'newest' }
function applyFilters() { filterOpen.value = false; load() }
async function exportCsv() {
  exporting.value = true
  try { await reportsApi.downloadCsv(query()); toast.success('Đã xuất file CSV') }
  catch (error: unknown) { toast.error(error instanceof Error ? error.message : 'Xuất CSV không thành công') }
  finally { exporting.value = false }
}
function fmt(value: number) { return value.toLocaleString('vi-VN') }
function date(iso: string) { const value = new Date(iso); return Number.isNaN(value.getTime()) ? '' : value.toLocaleDateString('vi-VN') }
</script>

<template>
  <section class="mds-mobile-app flex h-full min-h-0 flex-col overflow-hidden bg-[var(--mds-bg-page)]">
    <MMobileTopBar title="Báo cáo" :show-more="false" @back="router.push({ name: 'account' })">
      <template #actions><MButton variant="icon" aria-label="Xuất CSV" :loading="exporting" @click="exportCsv"><template #icon><MIcon name="file-export" :size="20" /></template></MButton></template>
    </MMobileTopBar>
    <div class="mds-mobile-gutter-x flex shrink-0 items-center justify-between border-b bg-white py-3" style="border-color: var(--mds-border-light)"><span class="min-w-0 truncate text-[12px]" style="color: var(--mds-text-secondary)">{{ report.scope.locked ? `Phạm vi: ${report.scope.departmentName || 'phòng ban'}` : 'Phạm vi: toàn công ty' }}</span><MButton variant="neutral" @click="filterOpen = true"><template #icon><MIcon name="filter" :size="18" /></template>Lọc</MButton></div>
    <div class="shrink-0 overflow-x-auto border-b bg-white px-4" style="border-color: var(--mds-border-light)"><div class="flex min-w-max"><button v-for="tab in tabs" :key="tab.key" type="button" class="h-12 border-b-2 px-4 text-[13px] font-medium" :class="activeTab === tab.key ? 'border-[var(--mds-brand-600)] text-[var(--mds-brand-600)]' : 'border-transparent text-[var(--mds-text-secondary)]'" @click="activeTab = tab.key">{{ tab.label }}</button></div></div>
    <div class="min-h-0 flex-1 overflow-y-auto p-4">
      <div v-if="loading" class="flex justify-center py-10"><MSpinner :size="20" /></div>
      <template v-else-if="activeTab === 'overview'"><div class="grid grid-cols-2 gap-3"><article v-for="item in stats" :key="item.label" class="min-w-0 rounded-lg bg-white p-3" style="box-shadow: var(--mds-shadow-card)"><span class="flex items-center gap-1 truncate text-[12px]" style="color: var(--mds-text-secondary)"><MIcon :name="item.icon" :size="16" />{{ item.label }}</span><strong class="mt-1 block truncate text-[22px]">{{ fmt(item.value) }}</strong></article></div><p class="mt-4 rounded-lg bg-white p-3 text-[12px] leading-5" style="box-shadow: var(--mds-shadow-card); color: var(--mds-text-secondary)">Số liệu được trình bày theo phạm vi quyền hiện tại. Dùng nút lọc để thay đổi chuyên mục, nhân viên, thời gian hoặc mức tương tác.</p></template>
      <MEmptyState v-else-if="activeTab === 'people' && !report.summary.length" type="no-data" title="Chưa có dữ liệu nhân viên" />
      <ul v-else-if="activeTab === 'people'" class="overflow-hidden rounded-lg bg-white" style="box-shadow: var(--mds-shadow-card)"><li v-for="item in report.summary" :key="item.uploaderId" class="flex min-h-[68px] items-center gap-3 border-b px-3 py-2 last:border-0" style="border-color: var(--mds-border-light)"><span class="grid h-9 w-9 shrink-0 place-items-center rounded-full" style="background: var(--mds-brand-50); color: var(--mds-brand-600)"><MIcon name="user" :size="18" /></span><span class="min-w-0 flex-1"><strong class="block truncate text-[14px]">{{ item.uploaderName }}</strong><span class="block text-[12px]" style="color: var(--mds-text-secondary)">{{ fmt(item.count) }} phim · {{ fmt(item.viewCount) }} lượt xem</span></span><span class="text-right text-[12px]" style="color: var(--mds-text-secondary)">{{ fmt(item.downloadCount) }} tải</span></li></ul>
      <MEmptyState v-else-if="!report.films.length" type="no-data" title="Chưa có dữ liệu phim" />
      <ul v-else class="overflow-hidden rounded-lg bg-white" style="box-shadow: var(--mds-shadow-card)"><li v-for="item in report.films" :key="item.id" class="flex min-h-[76px] items-center gap-3 border-b px-3 py-3 last:border-0" style="border-color: var(--mds-border-light)"><span class="grid h-10 w-10 shrink-0 place-items-center rounded-lg" style="background: var(--mds-brand-50); color: var(--mds-brand-600)"><MIcon name="file" :size="20" /></span><span class="min-w-0 flex-1"><strong class="block truncate text-[14px]">{{ item.title }}</strong><span class="block truncate text-[12px]" style="color: var(--mds-text-secondary)">{{ item.uploaderName }} · {{ item.categoryName || 'Chưa phân loại' }}</span><span class="block text-[11px]" style="color: var(--mds-text-muted)">{{ date(item.publishedAt) }}</span></span><span class="shrink-0 text-right text-[12px]" style="color: var(--mds-text-secondary)"><span class="block">{{ fmt(item.viewCount) }} xem</span><span class="block">{{ fmt(item.downloadCount) }} tải</span></span></li></ul>
    </div>
    <MDrawer v-model="filterOpen" position="bottom" title="Lọc báo cáo"><div class="flex flex-col gap-4"><div v-if="canPickDepartment"><label class="mb-1 block text-[13px] font-medium">Phòng ban</label><MSelect v-model="departmentId" :options="departmentOptions" /></div><div><label class="mb-1 block text-[13px] font-medium">Chuyên mục</label><MSelect v-model="categoryId" :options="categoryOptions" /></div><div><label class="mb-1 block text-[13px] font-medium">Nhân viên</label><MSelect v-model="uploaderId" :options="uploaderOptions" /></div><div class="grid grid-cols-2 gap-3"><div><label class="mb-1 block text-[13px] font-medium">Từ ngày</label><MInput v-model="from" type="date" /></div><div><label class="mb-1 block text-[13px] font-medium">Đến ngày</label><MInput v-model="to" type="date" /></div><div><label class="mb-1 block text-[13px] font-medium">Lượt xem từ</label><MInput v-model="minViews" inputmode="numeric" placeholder="0" /></div><div><label class="mb-1 block text-[13px] font-medium">Đến</label><MInput v-model="maxViews" inputmode="numeric" placeholder="Không giới hạn" /></div></div><div><label class="mb-1 block text-[13px] font-medium">Sắp xếp</label><MSelect v-model="sort" :options="sortOptions" /></div></div><template #footer><MButton variant="secondary" @click="resetFilters">Xoá lọc</MButton><MButton variant="primary" :loading="loading" @click="applyFilters">Áp dụng</MButton></template></MDrawer>
  </section>
</template>
