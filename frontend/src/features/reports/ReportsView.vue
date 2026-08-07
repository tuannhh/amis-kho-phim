<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import MButton from '@/components/mds/MButton.vue'
import MSelect from '@/components/mds/MSelect.vue'
import MInput from '@/components/mds/MInput.vue'
import MDateRangePicker from '@/components/mds/MDateRangePicker.vue'
import MDataTable from '@/components/mds/MDataTable.vue'
import MTabs from '@/components/mds/MTabs.vue'
import MIcon from '@/components/mds/MIcon.vue'
import MSpinner from '@/components/mds/MSpinner.vue'
import { useToast } from '@/components/mds/toast.js'
import { departmentsApi, type ApiDepartment } from '@/features/departments/departmentsApi'
import {
  categoriesApi,
  categoryOptions as buildCategoryOptions,
  type ApiCategoryNode,
} from '@/features/categories/categoriesApi'
import {
  reportsApi,
  type FilmsReport,
  type ReportFilmRow,
  type ReportSummaryRow,
} from './reportsApi'
import { useAuthStore } from '@/features/auth/authStore'
import { isSystemAdmin } from '@/features/auth/permissions'

/**
 * Báo cáo phim. Từ đợt 2 (ADR-053) mở cho CẢ Cấp 3, nhưng:
 *
 *  - Cấp 3 bị khoá phạm vi trong phòng ban của mình. FE KHÔNG hiện ô chọn phòng ban cho họ,
 *    và kể cả có gửi lên thì backend cũng bỏ qua — chốt chặn thật nằm ở server, phần ẩn đi
 *    này chỉ để giao diện không hứa điều làm không được.
 *  - Cấp 4 xem toàn công ty, chọn lọc được từng phòng ban.
 *
 * Ba nhóm dữ liệu người dùng yêu cầu được chia thành 3 tab trên cùng MỘT lần gọi API:
 *   Tổng quan (số liệu tổng) · Theo nhân viên · Theo từng phim.
 */
const toast = useToast()
const auth = useAuthStore()

const emptyReport: FilmsReport = {
  totals: { films: 0, views: 0, downloads: 0, uploaders: 0 },
  scope: { departmentId: null, departmentName: null, locked: false },
  summary: [],
  films: [],
}

const report = ref<FilmsReport>(emptyReport)
const loading = ref(false)
const exporting = ref(false)

const departments = ref<ApiDepartment[]>([])
const categoriesTree = ref<ApiCategoryNode[]>([])

// FE quy ước: undefined = "chưa chọn" (không dùng null).
const uploaderId = ref<number | undefined>(undefined)
const categoryId = ref<number | undefined>(undefined)
const departmentId = ref<number | undefined>(undefined)
const minViews = ref('')
const maxViews = ref('')
const sort = ref<'newest' | 'views' | 'downloads'>('newest')
const dateRange = reactive<{ start: Date | null; end: Date | null }>({ start: null, end: null })

const activeTab = ref('overview')
const tabs = [
  { key: 'overview', label: 'Tổng quan' },
  { key: 'byUploader', label: 'Theo nhân viên' },
  { key: 'byFilm', label: 'Theo từng phim' },
]

const canPickDepartment = computed(() => isSystemAdmin(auth.role))

const sortOptions = [
  { label: 'Mới nhất', value: 'newest' as const },
  { label: 'Lượt xem nhiều nhất', value: 'views' as const },
  { label: 'Lượt tải nhiều nhất', value: 'downloads' as const },
]

const departmentOptions = computed(() => [
  { label: 'Tất cả phòng ban', value: undefined as number | undefined },
  ...departments.value.map((d) => ({ label: d.name, value: d.id as number | undefined })),
])

const categoryFilterOptions = computed(() => [
  { label: 'Tất cả chuyên mục', value: undefined as number | undefined, depth: 0 },
  ...buildCategoryOptions(categoriesTree.value),
])

/**
 * Danh sách nhân viên để lọc lấy TỪ CHÍNH BÁO CÁO (`summary`), không gọi `/users`.
 *
 * Hai lý do: (1) `/users` chỉ Cấp 4 gọi được nên Cấp 3 sẽ có ô lọc rỗng; (2) không cần thiết
 * phải kéo cả danh bạ công ty (có PII) về chỉ để đổ một dropdown — người không đăng phim nào
 * thì cũng không có gì để lọc.
 */
const uploaderOptions = computed(() => [
  { label: 'Tất cả nhân viên', value: undefined as number | undefined },
  ...report.value.summary.map((s) => ({
    label: s.uploaderName,
    value: s.uploaderId as number | undefined,
  })),
])

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}
function toDateStr(d: Date | null): string | undefined {
  if (!d) return undefined
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}
function toNum(v: string): number | undefined {
  const n = Number(v.trim())
  return v.trim() !== '' && Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined
}

function currentQuery() {
  return {
    uploaderId: uploaderId.value,
    categoryId: categoryId.value,
    // Cố ý không gửi khi người dùng không phải Cấp 4 — server bỏ qua, nhưng gửi thừa một
    // tham số vô hiệu chỉ làm nhật ký khó đọc.
    departmentId: canPickDepartment.value ? departmentId.value : undefined,
    from: toDateStr(dateRange.start),
    to: toDateStr(dateRange.end),
    minViews: toNum(minViews.value),
    maxViews: toNum(maxViews.value),
    sort: sort.value,
  }
}

async function loadReport() {
  loading.value = true
  try {
    report.value = await reportsApi.getFilms(currentQuery())
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'Không tải được báo cáo')
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  categoriesApi.tree().then((t) => (categoriesTree.value = t))
  if (canPickDepartment.value) {
    // Chỉ Cấp 4 gọi được /departments; Cấp 3 không cần vì phạm vi đã bị khoá sẵn.
    departmentsApi.list().then((d) => (departments.value = d)).catch(() => undefined)
  }
  await loadReport()
})

function resetFilters() {
  uploaderId.value = undefined
  categoryId.value = undefined
  departmentId.value = undefined
  minViews.value = ''
  maxViews.value = ''
  sort.value = 'newest'
  dateRange.start = null
  dateRange.end = null
  loadReport()
}

async function onExportCsv() {
  exporting.value = true
  try {
    await reportsApi.downloadCsv(currentQuery())
    toast.success('Đã xuất file CSV')
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'Xuất CSV không thành công')
  } finally {
    exporting.value = false
  }
}

function fmt(n: number): string {
  return n.toLocaleString('vi-VN')
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('vi-VN')
}

function asFilm(row: unknown): ReportFilmRow {
  return row as ReportFilmRow
}
function asSummary(row: unknown): ReportSummaryRow {
  return row as ReportSummaryRow
}

const filmColumns = [
  { key: 'title', label: 'Tên phim', width: 260 },
  { key: 'uploaderName', label: 'Nhân viên', width: 170 },
  { key: 'categoryName', label: 'Chuyên mục', width: 150 },
  { key: 'publishedAt', label: 'Ngày đăng', width: 110 },
  { key: 'viewCount', label: 'Lượt xem', width: 100, align: 'right' },
  { key: 'downloadCount', label: 'Lượt tải', width: 100, align: 'right' },
]

const uploaderColumns = [
  { key: 'uploaderName', label: 'Nhân viên', width: 240 },
  { key: 'count', label: 'Số phim đã đăng', width: 150, align: 'right' },
  { key: 'viewCount', label: 'Tổng lượt xem', width: 150, align: 'right' },
  { key: 'downloadCount', label: 'Tổng lượt tải', width: 150, align: 'right' },
]

/** Thẻ số liệu ở tab Tổng quan. */
const statCards = computed(() => [
  { label: 'Tổng số phim', value: report.value.totals.films, icon: 'layout-grid' },
  { label: 'Tổng lượt xem', value: report.value.totals.views, icon: 'eye' },
  { label: 'Tổng lượt tải', value: report.value.totals.downloads, icon: 'download' },
  { label: 'Số nhân viên đăng phim', value: report.value.totals.uploaders, icon: 'users' },
])
</script>

<template>
  <section class="flex h-full flex-col" style="background: var(--mds-bg-canvas, #ECEDEF)">
    <header
      class="flex h-14 shrink-0 items-center justify-between gap-3 bg-white px-5"
      style="box-shadow: var(--mds-shadow-card, 0 0 2px 0 rgba(0,0,0,0.1))"
    >
      <div class="flex min-w-0 items-baseline gap-2">
        <h1 class="text-[16px] font-semibold" style="color: var(--mds-text-primary)">Báo cáo phim</h1>
        <!-- Nói rõ người dùng đang xem phạm vi nào — Trưởng phòng cần biết con số này chỉ của
             phòng mình, không phải toàn công ty. -->
        <span class="truncate text-[13px]" style="color: var(--mds-text-secondary)">
          <template v-if="report.scope.locked">
            Phạm vi: {{ report.scope.departmentName || 'chưa gán phòng ban' }}
          </template>
          <template v-else-if="report.scope.departmentName">
            Phạm vi: {{ report.scope.departmentName }}
          </template>
          <template v-else>Phạm vi: toàn công ty</template>
        </span>
      </div>
      <MButton variant="primary" :loading="exporting" @click="onExportCsv">
        <template #icon><MIcon name="file-export" :size="16" /></template>
        Xuất CSV
      </MButton>
    </header>

    <div class="flex-1 overflow-hidden p-4">
      <div class="flex h-full flex-col gap-4">
        <!-- Bộ lọc -->
        <div
          class="flex shrink-0 flex-wrap items-end gap-3 rounded-lg bg-white p-4"
          style="box-shadow: var(--mds-shadow-card, 0 0 2px 0 rgba(0,0,0,0.1))"
        >
          <div v-if="canPickDepartment" class="w-[200px]">
            <label
              class="mb-1 block text-[13px] font-medium"
              style="color: var(--mds-text-primary)"
              >Phòng ban</label
            >
            <MSelect
              v-model="departmentId"
              :options="departmentOptions"
              placeholder="Tất cả phòng ban"
            />
          </div>
          <div class="w-[220px]">
            <label
              class="mb-1 block text-[13px] font-medium"
              style="color: var(--mds-text-primary)"
              >Chuyên mục</label
            >
            <MSelect
              v-model="categoryId"
              :options="categoryFilterOptions"
              placeholder="Tất cả chuyên mục"
            />
          </div>
          <div class="w-[200px]">
            <label
              class="mb-1 block text-[13px] font-medium"
              style="color: var(--mds-text-primary)"
              >Nhân viên</label
            >
            <MSelect
              v-model="uploaderId"
              :options="uploaderOptions"
              placeholder="Tất cả nhân viên"
            />
          </div>
          <div class="w-[260px]">
            <label
              class="mb-1 block text-[13px] font-medium"
              style="color: var(--mds-text-primary)"
              >Khoảng ngày upload</label
            >
            <MDateRangePicker v-model="dateRange" />
          </div>
          <div class="w-[150px]">
            <label
              class="mb-1 block text-[13px] font-medium"
              style="color: var(--mds-text-primary)"
              >Lượt xem từ</label
            >
            <MInput v-model="minViews" placeholder="0" />
          </div>
          <div class="w-[150px]">
            <label
              class="mb-1 block text-[13px] font-medium"
              style="color: var(--mds-text-primary)"
              >đến</label
            >
            <MInput v-model="maxViews" placeholder="Không giới hạn" />
          </div>
          <div class="w-[200px]">
            <label
              class="mb-1 block text-[13px] font-medium"
              style="color: var(--mds-text-primary)"
              >Sắp xếp</label
            >
            <MSelect v-model="sort" :options="sortOptions" />
          </div>
          <MButton variant="secondary" @click="resetFilters">Xoá lọc</MButton>
          <MButton variant="primary" :loading="loading" @click="loadReport">
            <template #icon><MIcon name="search" :size="16" /></template>
            Áp dụng
          </MButton>
        </div>

        <MTabs v-model="activeTab" :tabs="tabs" class="shrink-0" />

        <!-- Tab 1 — Tổng quan -->
        <div v-if="activeTab === 'overview'" class="min-h-0 flex-1 overflow-auto">
          <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div
              v-for="card in statCards"
              :key="card.label"
              class="flex flex-col gap-1 rounded-lg bg-white p-4"
              style="box-shadow: var(--mds-shadow-card, 0 0 2px 0 rgba(0,0,0,0.1))"
            >
              <span
                class="flex items-center gap-1.5 text-[13px]"
                style="color: var(--mds-text-secondary)"
              >
                <MIcon :name="card.icon" :size="14" />
                {{ card.label }}
              </span>
              <span class="text-[24px] font-semibold" style="color: var(--mds-text-primary)">
                <MSpinner v-if="loading" :size="18" />
                <template v-else>{{ fmt(card.value) }}</template>
              </span>
            </div>
          </div>
        </div>

        <!-- Tab 2 — Theo từng nhân viên -->
        <div v-else-if="activeTab === 'byUploader'" class="min-h-0 flex-1">
          <MDataTable
            :columns="uploaderColumns"
            :rows="report.summary"
            row-key="uploaderId"
            :loading="loading"
            class="h-full rounded-lg bg-white"
            style="box-shadow: var(--mds-shadow-card, 0 0 2px 0 rgba(0,0,0,0.1))"
          >
            <template #cell-count="{ row }">{{ fmt(asSummary(row).count) }}</template>
            <template #cell-viewCount="{ row }">{{ fmt(asSummary(row).viewCount) }}</template>
            <template #cell-downloadCount="{ row }">
              {{ fmt(asSummary(row).downloadCount) }}
            </template>
            <template #footer-info>{{ fmt(report.totals.uploaders) }} nhân viên</template>
          </MDataTable>
        </div>

        <!-- Tab 3 — Theo từng phim -->
        <div v-else class="min-h-0 flex-1">
          <MDataTable
            :columns="filmColumns"
            :rows="report.films"
            row-key="id"
            :loading="loading"
            class="h-full rounded-lg bg-white"
            style="box-shadow: var(--mds-shadow-card, 0 0 2px 0 rgba(0,0,0,0.1))"
          >
            <template #cell-categoryName="{ row }">{{ asFilm(row).categoryName ?? '—' }}</template>
            <template #cell-publishedAt="{ row }">
              {{ formatDate(asFilm(row).publishedAt) }}
            </template>
            <template #cell-viewCount="{ row }">{{ fmt(asFilm(row).viewCount) }}</template>
            <template #cell-downloadCount="{ row }">
              {{ fmt(asFilm(row).downloadCount) }}
            </template>
            <template #footer-info>Tổng số phim: {{ fmt(report.totals.films) }}</template>
          </MDataTable>
        </div>
      </div>
    </div>
  </section>
</template>
