<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import MButton from '@/components/mds/MButton.vue'
import MInput from '@/components/mds/MInput.vue'
import MSelect from '@/components/mds/MSelect.vue'
import MDataTable from '@/components/mds/MDataTable.vue'
import MTag from '@/components/mds/MTag.vue'
import MIcon from '@/components/mds/MIcon.vue'
import MDialog from '@/components/mds/MDialog.vue'
import { useToast } from '@/components/mds/toast.js'
import { useFormValidation, rules } from '@/components/mds/useFormValidation.js'
import { CURRENT_MOCK_USER } from '@/features/films/mockFilms'
import { mockUsers, ROLE_LABEL, ROLE_COLOR, creatableRoles, type UserRole, type MockAppUser } from './mockUsers'

/**
 * Quản trị người dùng — GĐ 0.5 (mock). Super Admin tạo Admin+Nhân viên;
 * Admin chỉ tạo Nhân viên (ma trận phân quyền 01-architecture.md §5).
 * GĐ 1 gắn API auth/users module thật.
 */
const toast = useToast()

const search = ref('')
const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return mockUsers
  return mockUsers.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
})

const columns = [
  { key: 'name', label: 'Họ tên', width: 200 },
  { key: 'email', label: 'Email', width: 220 },
  { key: 'role', label: 'Vai trò', width: 130 },
  { key: 'createdBy', label: 'Người tạo', width: 180 },
  { key: 'createdAt', label: 'Ngày tạo', width: 110 },
  { key: 'isActive', label: 'Trạng thái', width: 120 },
]

const roleOptions = computed(() =>
  creatableRoles(CURRENT_MOCK_USER.role).map((r) => ({ label: ROLE_LABEL[r], value: r }))
)

// MDataTable là JS thuần → slot `row` suy ra kiểu unknown; ép kiểu tường minh ở nơi dùng
function asUser(row: unknown): MockAppUser {
  return row as MockAppUser
}

function canManage(row: (typeof mockUsers)[number]) {
  if (row.id === CURRENT_MOCK_USER.id) return false // không tự khoá/xoá chính mình
  if (CURRENT_MOCK_USER.role === 'super_admin') return row.role !== 'super_admin'
  if (CURRENT_MOCK_USER.role === 'admin') return row.role === 'employee'
  return false
}

const dialogOpen = ref(false)
// undefined (không phải null) — MSelect không nhận null trong kiểu modelValue
const form = reactive({ name: '', email: '', role: undefined as UserRole | undefined, tempPassword: '' })

// useFormValidation.js là JS thuần → `errors` suy ra kiểu {}; ép kiểu tường minh để dùng errors.name/email/role
const { errors, validate, clearErrors } = useFormValidation({
  name: [rules.required('Họ tên không được để trống')],
  email: [rules.required('Email không được để trống'), rules.email()],
  role: [rules.required('Vui lòng chọn vai trò')],
}) as {
  errors: Record<string, string>
  validate: (values: Record<string, unknown>) => boolean
  clearErrors: () => void
}

function openCreate() {
  form.name = ''
  form.email = ''
  form.role = roleOptions.value[0]?.value ?? undefined
  form.tempPassword = ''
  clearErrors()
  dialogOpen.value = true
}

function createUser() {
  if (!validate(form)) return
  mockUsers.push({
    id: Math.max(0, ...mockUsers.map((u) => u.id)) + 1,
    name: form.name.trim(),
    email: form.email.trim(),
    role: form.role!,
    createdBy: CURRENT_MOCK_USER.name,
    createdAt: new Date().toLocaleDateString('vi-VN'),
    isActive: true,
  })
  toast.success(`Đã tạo tài khoản ${ROLE_LABEL[form.role!]} cho "${form.name}"`)
  dialogOpen.value = false
}

function toggleActive(row: (typeof mockUsers)[number]) {
  row.isActive = !row.isActive
  toast.success(row.isActive ? `Đã mở khoá "${row.name}"` : `Đã khoá "${row.name}"`)
}

function removeUser(row: (typeof mockUsers)[number]) {
  const idx = mockUsers.findIndex((u) => u.id === row.id)
  if (idx !== -1) mockUsers.splice(idx, 1)
  toast.success(`Đã xoá tài khoản "${row.name}"`)
}
</script>

<template>
  <section class="flex h-full flex-col">
    <header
      class="flex h-14 shrink-0 items-center justify-between gap-3 bg-white px-5"
      style="box-shadow: var(--mds-shadow-card, 0 0 2px 0 rgba(0,0,0,0.1))"
    >
      <h1 class="text-[16px] font-semibold" style="color: var(--mds-text-primary)">Quản trị người dùng</h1>
      <MButton v-if="roleOptions.length" variant="primary" @click="openCreate">
        <template #icon><MIcon name="plus" :size="16" /></template>
        Thêm người dùng
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
            <MInput v-model="search" placeholder="Tìm theo tên, email" clearable>
              <template #prefix><MIcon name="search" :size="16" /></template>
            </MInput>
          </div>
        </template>

        <template #cell-role="{ row }">
          <MTag :color="ROLE_COLOR[asUser(row).role]" size="sm">{{ ROLE_LABEL[asUser(row).role] }}</MTag>
        </template>

        <template #cell-isActive="{ row }">
          <MTag :color="asUser(row).isActive ? 'success' : 'neutral'" size="sm">
            {{ asUser(row).isActive ? 'Đang hoạt động' : 'Đã khoá' }}
          </MTag>
        </template>

        <template #row-actions="{ row }">
          <template v-if="canManage(asUser(row))">
            <button
              type="button"
              :title="asUser(row).isActive ? 'Khoá tài khoản' : 'Mở khoá'"
              class="flex h-7 w-7 items-center justify-center rounded-md"
              style="border: 1px solid var(--mds-border,#CED1D6); color: var(--mds-icon-neutral)"
              @click="toggleActive(asUser(row))"
            >
              <MIcon :name="asUser(row).isActive ? 'lock' : 'lock-open'" :size="12" />
            </button>
            <button
              type="button"
              title="Xoá"
              class="flex h-7 w-7 items-center justify-center rounded-md"
              style="border: 1px solid var(--mds-border,#CED1D6); color: var(--mds-danger)"
              @click="removeUser(asUser(row))"
            >
              <MIcon name="trash" :size="12" />
            </button>
          </template>
        </template>

        <template #footer-info>Tổng số người dùng: {{ filtered.length }}</template>
      </MDataTable>
    </div>

    <!-- Dialog thêm người dùng -->
    <MDialog v-model="dialogOpen" title="Thêm người dùng" :width="480">
      <div class="flex flex-col gap-4">
        <div data-field="name">
          <label class="mb-1 block text-[13px] font-medium" style="color: var(--mds-text-primary)">
            Họ tên <span style="color: var(--mds-danger)">*</span>
          </label>
          <MInput v-model="form.name" placeholder="Nhập họ tên" :error="errors.name" />
        </div>
        <div data-field="email">
          <label class="mb-1 block text-[13px] font-medium" style="color: var(--mds-text-primary)">
            Email <span style="color: var(--mds-danger)">*</span>
          </label>
          <MInput v-model="form.email" type="email" placeholder="ten@misa.com.vn" :error="errors.email" />
        </div>
        <div data-field="role">
          <label class="mb-1 block text-[13px] font-medium" style="color: var(--mds-text-primary)">
            Vai trò <span style="color: var(--mds-danger)">*</span>
          </label>
          <MSelect v-model="form.role" :options="roleOptions" placeholder="Chọn vai trò" :error="errors.role" />
        </div>
        <div>
          <label class="mb-1 block text-[13px] font-medium" style="color: var(--mds-text-primary)">
            Mật khẩu tạm thời
          </label>
          <MInput v-model="form.tempPassword" type="password" placeholder="Để trống để hệ thống tự sinh" />
          <p class="mt-1 text-[12px]" style="color: var(--mds-text-secondary)">
            Người dùng bắt buộc đổi mật khẩu trong lần đăng nhập đầu tiên.
          </p>
        </div>
      </div>
      <template #footer>
        <MButton variant="secondary" @click="dialogOpen = false">Hủy</MButton>
        <MButton variant="primary" @click="createUser">Tạo tài khoản</MButton>
      </template>
    </MDialog>
  </section>
</template>
