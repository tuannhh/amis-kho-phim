<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import MButton from '@/components/mds/MButton.vue'
import MSelect from '@/components/mds/MSelect.vue'
import MDateRangePicker from '@/components/mds/MDateRangePicker.vue'
import MDataTable from '@/components/mds/MDataTable.vue'
import MTag from '@/components/mds/MTag.vue'
import MIcon from '@/components/mds/MIcon.vue'
import MSpinner from '@/components/mds/MSpinner.vue'
import { useToast } from '@/components/mds/toast.js'
import { usersApi, type ApiUser } from '@/features/admin/usersApi'
import { reportsApi, type FilmsReport, type ReportFilmRow } from './reportsApi'

/**
 * Báo cáo Quản trị (GĐ5, 03-roadmap.md) — chỉ super_admin/admin (route guard +
 * BE @Roles). Lọc theo người upload + khoảng ngày upload; xuất CSV cùng bộ lọc.
 */
const toast = useToast()

const users = ref<ApiUser[]>([])
const report = ref<FilmsReport>({ summary: [], films: [] })
const loading = ref(false)
const exporting = ref(false)

// FE quy ước: undefined = "chưa chọn" (không dùng null).
const uploaderId = ref<number | undefined>(undefined)
const dateRange = reactive<{ start: Date | null; end: Date | null }>({ start: null, end: null })

const uploaderOptions = computed(() => [
  { label: 'Tất cả người upload', value: undefined as number | undefined },
  ...users.value.map((u) => ({ label: u.fullName, value: u.id as number | undefined })),
])

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}
function toDateStr(d: Date | null): string | undefined {
  if (!d) return undefined
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function currentQuery() {
  return { uploaderId: uploaderId.value, from: toDateStr(dateRange.start), to: toDateStr(dateRange.end) }
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

async function loadUsers() {
  try {
    users.value = await usersApi.list()
  } catch {
    // Không chặn báo cáo nếu danh sách người dùng lỗi — bộ lọc chỉ mất tuỳ chọn tên.
  }
}

onMounted(async () => {
  await Promise.all([loadUsers(), loadReport()])
})

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

function formatDate(iso: string): string {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('vi-VN')
}

function asRow(row: unknown): ReportFilmRow {
  return row as ReportFilmRow
}

const columns = [
  { key: 'title', label: 'Tên phim', width: 260 },
  { key: 'uploaderName', label: 'Người upload', width: 180 },
  { key: 'categoryName', label: 'Chuyên mục', width: 160 },
  { key: 'createdAt', label: 'Ngày upload', width: 120 },
  { key: 'viewCount', label: 'Lượt xem', width: 100, align: 'right' },
]
</script>

<template>
  <section class="flex h-full flex-col" style="background: var(--mds-bg-canvas, #ECEDEF)">
    <header
      class="flex h-14 shrink-0 items-center justify-between gap-3 bg-white px-5"
      style="box-shadow: var(--mds-shadow-card, 0 0 2px 0 rgba(0,0,0,0.1))"
    >
      <h1 class="text-[16px] font-semibold" style="color: var(--mds-text-primary)">
        Báo cáo Quản trị — Phim đã upload
      </h1>
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
          <div class="w-[220px]">
            <label class="mb-1 block text-[13px] font-medium" style="color: var(--mds-text-primary)">
              Người upload
            </label>
            <MSelect v-model="uploaderId" :options="uploaderOptions" placeholder="Tất cả người upload" />
          </div>
          <div class="w-[260px]">
            <label class="mb-1 block text-[13px] font-medium" style="color: var(--mds-text-primary)">
              Khoảng ngày upload
            </label>
            <MDateRangePicker v-model="dateRange" />
          </div>
          <MButton variant="secondary" :loading="loading" @click="loadReport">
            <template #icon><MIcon name="search" :size="16" /></template>
            Áp dụng
          </MButton>
        </div>

        <!-- Tổng theo người upload -->
        <div
          class="flex shrink-0 flex-wrap gap-2 rounded-lg bg-white p-4"
          style="box-shadow: var(--mds-shadow-card, 0 0 2px 0 rgba(0,0,0,0.1))"
        >
          <span class="mr-1 text-[13px] font-medium" style="color: var(--mds-text-primary)">
            Tổng theo người upload:
          </span>
          <span v-if="loading" class="flex items-center gap-2 text-[13px]" style="color: var(--mds-text-secondary)">
            <MSpinner :size="14" /> Đang tải...
          </span>
          <span v-else-if="!report.summary.length" class="text-[13px]" style="color: var(--mds-text-secondary)">
            Không có dữ liệu
          </span>
          <MTag v-for="s in report.summary" v-else :key="s.uploaderId" color="info" size="sm">
            {{ s.uploaderName }}: {{ s.count }} phim
          </MTag>
        </div>

        <!-- Bảng chi tiết -->
        <div class="min-h-0 flex-1">
          <MDataTable
            :columns="columns"
            :rows="report.films"
            row-key="id"
            :loading="loading"
            class="h-full rounded-lg bg-white"
            style="box-shadow: var(--mds-shadow-card, 0 0 2px 0 rgba(0,0,0,0.1))"
          >
            <template #cell-categoryName="{ row }">{{ asRow(row).categoryName ?? '—' }}</template>
            <template #cell-createdAt="{ row }">{{ formatDate(asRow(row).createdAt) }}</template>
            <template #footer-info>Tổng số phim: {{ report.films.length }}</template>
          </MDataTable>
        </div>
      </div>
    </div>
  </section>
</template>
