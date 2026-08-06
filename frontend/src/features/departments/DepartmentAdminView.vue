<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import MButton from '@/components/mds/MButton.vue'
import MInput from '@/components/mds/MInput.vue'
import MDataTable from '@/components/mds/MDataTable.vue'
import MIcon from '@/components/mds/MIcon.vue'
import MTag from '@/components/mds/MTag.vue'
import MDialog from '@/components/mds/MDialog.vue'
import MSpinner from '@/components/mds/MSpinner.vue'
import { useToast } from '@/components/mds/toast.js'
import { useFormValidation, rules } from '@/components/mds/useFormValidation.js'
import { departmentsApi, type ApiDepartment } from './departmentsApi'

/**
 * Quản lý phòng ban — màn DANH SÁCH chuẩn MDS (nền xám, bảng trong card trắng có
 * `--mds-shadow-card`, tiêu đề bên trái / nút Primary ngoài cùng bên phải, ô tìm kiếm ở trái
 * toolbar bảng, action dòng hiện khi hover — `patterns/data-table.md` §1/§4).
 *
 * Chỉ Cấp 3 vào được (router guard + `@Roles('super_admin')` ở backend). Ở bản 3 cấp phẳng
 * phòng ban KHÔNG quyết định quyền của ai (ADR-046), nhưng vẫn là danh mục dùng chung toàn hệ
 * thống nên quyền ghi giữ ở cấp cao nhất.
 */
const toast = useToast()

const rows = ref<ApiDepartment[]>([])
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    rows.value = await departmentsApi.list()
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'Không tải được danh sách phòng ban')
  } finally {
    loading.value = false
  }
}
onMounted(load)

const search = ref('')
const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return rows.value
  return rows.value.filter((d) => d.name.toLowerCase().includes(q))
})

const columns = [
  { key: 'name', label: 'Tên phòng ban', width: 320 },
  { key: 'userCount', label: 'Số người dùng', width: 140 },
  { key: 'createdAt', label: 'Ngày tạo', width: 120 },
]

function asDept(row: unknown): ApiDepartment {
  return row as ApiDepartment
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('vi-VN')
}

// ── Thêm / Sửa ─────────────────────────────────────────────────────────────
const dialogOpen = ref(false)
const submitting = ref(false)
const editing = ref<ApiDepartment | null>(null)
const form = reactive({ name: '' })

const { errors, validate, clearErrors } = useFormValidation({
  name: [rules.required('Tên phòng ban không được để trống')],
}) as {
  errors: Record<string, string>
  validate: (values: Record<string, unknown>) => boolean
  clearErrors: () => void
}

function openCreate() {
  editing.value = null
  form.name = ''
  clearErrors()
  dialogOpen.value = true
}

function openEdit(row: ApiDepartment) {
  editing.value = row
  form.name = row.name
  clearErrors()
  dialogOpen.value = true
}

async function save() {
  if (!validate(form)) return
  submitting.value = true
  try {
    const payload = { name: form.name.trim() }
    if (editing.value) {
      await departmentsApi.update(editing.value.id, payload)
      toast.success(`Đã cập nhật phòng ban "${payload.name}"`)
    } else {
      await departmentsApi.create(payload)
      toast.success(`Đã thêm phòng ban "${payload.name}"`)
    }
    dialogOpen.value = false
    await load()
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'Lưu phòng ban không thành công')
  } finally {
    submitting.value = false
  }
}

// ── Xoá ────────────────────────────────────────────────────────────────────
const deleteTarget = ref<ApiDepartment | null>(null)
const deleting = ref(false)

async function confirmDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await departmentsApi.remove(deleteTarget.value.id)
    toast.success(`Đã xoá phòng ban "${deleteTarget.value.name}"`)
    deleteTarget.value = null
    await load()
  } catch (e: unknown) {
    // Backend trả 409 kèm số bản ghi đang tham chiếu — hiện nguyên thông điệp đó cho người
    // dùng biết phải chuyển bản ghi nào trước, thay vì báo lỗi chung chung.
    toast.error(e instanceof Error ? e.message : 'Xoá phòng ban không thành công')
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <section class="flex h-full flex-col">
    <header
      class="flex h-14 shrink-0 items-center justify-between gap-3 bg-white px-5"
      style="box-shadow: var(--mds-shadow-card, 0 0 2px 0 rgba(0,0,0,0.1))"
    >
      <h1 class="text-[16px] font-semibold" style="color: var(--mds-text-primary)">Quản lý phòng ban</h1>
      <MButton variant="primary" @click="openCreate">
        <template #icon><MIcon name="plus" :size="16" /></template>
        Thêm phòng ban
      </MButton>
    </header>

    <div class="flex-1 overflow-hidden p-4">
      <MDataTable
        :columns="columns"
        :rows="filtered"
        row-key="id"
        class="h-full rounded-lg bg-white"
        style="box-shadow: var(--mds-shadow-card, 0 0 2px 0 rgba(0,0,0,0.1))"
      >
        <template #toolbar-search>
          <div class="w-[240px]">
            <MInput v-model="search" placeholder="Tìm theo tên phòng ban" clearable>
              <template #prefix><MIcon name="search" :size="16" /></template>
            </MInput>
          </div>
        </template>

        <template #cell-userCount="{ row }">
          <MTag :color="asDept(row).userCount ? 'info' : 'neutral'" size="sm">
            {{ asDept(row).userCount }} người
          </MTag>
        </template>

        <template #cell-createdAt="{ row }">{{ formatDate(asDept(row).createdAt) }}</template>

        <template #row-actions="{ row }">
          <button
            type="button"
            title="Sửa tên phòng ban"
            class="flex h-7 w-7 items-center justify-center rounded-md"
            style="border: 1px solid var(--mds-border, #ced1d6); color: var(--mds-icon-neutral)"
            @click="openEdit(asDept(row))"
          >
            <MIcon name="pencil" :size="12" />
          </button>
          <button
            type="button"
            title="Xoá phòng ban"
            class="flex h-7 w-7 items-center justify-center rounded-md"
            style="border: 1px solid var(--mds-border, #ced1d6); color: var(--mds-danger)"
            @click="deleteTarget = asDept(row)"
          >
            <MIcon name="trash" :size="12" />
          </button>
        </template>

        <template #empty>
          <span>Chưa có phòng ban nào.<br />Bấm "Thêm phòng ban" để tạo mới.</span>
        </template>

        <template #footer-info>
          <span v-if="loading" class="flex items-center gap-2"><MSpinner :size="14" /> Đang tải...</span>
          <span v-else>Tổng số phòng ban: {{ filtered.length }}</span>
        </template>
      </MDataTable>
    </div>

    <!-- Dialog thêm / sửa -->
    <MDialog v-model="dialogOpen" :title="editing ? 'Sửa phòng ban' : 'Thêm phòng ban'" :width="440">
      <div class="flex flex-col gap-4">
        <div data-field="name">
          <label class="mb-1 block text-[13px] font-medium" style="color: var(--mds-text-primary)">
            Tên phòng ban <span style="color: var(--mds-danger)">*</span>
          </label>
          <MInput v-model="form.name" placeholder="VD: Phòng Truyền thông" :error="errors.name" />
          <p class="mt-1 text-[12px]" style="color: var(--mds-text-secondary)">
            Phòng ban dùng để truy vết phim/tài khoản, không ảnh hưởng quyền — tên không được trùng nhau.
          </p>
        </div>
      </div>
      <template #footer>
        <MButton variant="secondary" :disabled="submitting" @click="dialogOpen = false">Hủy</MButton>
        <MButton variant="primary" :loading="submitting" @click="save">Lưu</MButton>
      </template>
    </MDialog>

    <!-- Xác nhận xoá -->
    <MDialog
      :model-value="!!deleteTarget"
      title="Xoá phòng ban"
      :width="440"
      @update:model-value="deleteTarget = null"
    >
      <p class="text-[13px]" style="color: var(--mds-text-primary)">
        Xoá phòng ban <strong>{{ deleteTarget?.name }}</strong> ?
      </p>
      <p v-if="deleteTarget?.userCount" class="mt-2 text-[13px]" style="color: var(--mds-danger)">
        Phòng ban này đang có {{ deleteTarget.userCount }} người dùng. Hãy chuyển họ sang phòng ban
        khác trước — hệ thống sẽ từ chối xoá để không làm mất phạm vi quyền của phim đã tạo.
      </p>
      <template #footer>
        <MButton variant="secondary" :disabled="deleting" @click="deleteTarget = null">Hủy</MButton>
        <MButton variant="danger" :loading="deleting" @click="confirmDelete">Xoá</MButton>
      </template>
    </MDialog>
  </section>
</template>
