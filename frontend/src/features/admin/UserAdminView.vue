<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import MButton from '@/components/mds/MButton.vue'
import MInput from '@/components/mds/MInput.vue'
import MSelect from '@/components/mds/MSelect.vue'
import MDataTable from '@/components/mds/MDataTable.vue'
import MTag from '@/components/mds/MTag.vue'
import MIcon from '@/components/mds/MIcon.vue'
import MDialog from '@/components/mds/MDialog.vue'
import MSpinner from '@/components/mds/MSpinner.vue'
import { useToast } from '@/components/mds/toast.js'
import { useFormValidation, rules } from '@/components/mds/useFormValidation.js'
import { useAuthStore, type UserRole } from '@/features/auth/authStore'
import {
  usersApi,
  ROLE_LABEL,
  ROLE_COLOR,
  creatableRoles,
  type ApiUser,
} from './usersApi'

/**
 * Quản trị người dùng — GĐ1 (API thật). Super Admin tạo Admin+Nhân viên;
 * Admin chỉ tạo Nhân viên. Quyền THỰC do backend kiểm (service layer);
 * FE chỉ ẩn/hiện nút cho UX.
 */
const toast = useToast()
const auth = useAuthStore()

const users = ref<ApiUser[]>([])
const loading = ref(false)

async function loadUsers() {
  loading.value = true
  try {
    users.value = await usersApi.list()
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'Không tải được danh sách người dùng')
  } finally {
    loading.value = false
  }
}
onMounted(loadUsers)

const search = ref('')
const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return users.value
  return users.value.filter(
    (u) => u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
  )
})

const columns = [
  { key: 'fullName', label: 'Họ tên', width: 200 },
  { key: 'email', label: 'Email', width: 220 },
  { key: 'roleCode', label: 'Vai trò', width: 130 },
  { key: 'createdBy', label: 'Người tạo', width: 180 },
  { key: 'createdAt', label: 'Ngày tạo', width: 110 },
  { key: 'isActive', label: 'Trạng thái', width: 120 },
]

const roleOptions = computed(() =>
  creatableRoles(auth.role).map((r) => ({ label: ROLE_LABEL[r], value: r })),
)

function asUser(row: unknown): ApiUser {
  return row as ApiUser
}

/** Hiển thị tên người tạo (map id → tên trong danh sách); null = tài khoản hệ thống. */
function createdByName(row: ApiUser): string {
  if (row.createdBy == null) return 'Hệ thống'
  return users.value.find((u) => u.id === row.createdBy)?.fullName ?? `#${row.createdBy}`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('vi-VN')
}

/** Ai được khoá/xoá ai — khớp backend; chỉ để ẩn/hiện nút (backend vẫn chặn thật). */
function canManage(row: ApiUser) {
  if (row.id === auth.user?.id) return false
  if (auth.role === 'super_admin') return row.roleCode !== 'super_admin'
  if (auth.role === 'admin') return row.roleCode === 'employee'
  return false
}

const dialogOpen = ref(false)
const submitting = ref(false)
const form = reactive({ fullName: '', email: '', role: undefined as UserRole | undefined, tempPassword: '' })

const { errors, validate, clearErrors } = useFormValidation({
  fullName: [rules.required('Họ tên không được để trống')],
  email: [rules.required('Email không được để trống'), rules.email()],
  role: [rules.required('Vui lòng chọn vai trò')],
}) as {
  errors: Record<string, string>
  validate: (values: Record<string, unknown>) => boolean
  clearErrors: () => void
}

function openCreate() {
  form.fullName = ''
  form.email = ''
  form.role = roleOptions.value[0]?.value ?? undefined
  form.tempPassword = ''
  clearErrors()
  dialogOpen.value = true
}

// Dialog hiện mật khẩu tạm hệ thống sinh (để bàn giao cho người dùng mới).
const resultOpen = ref(false)
const createdInfo = reactive({ name: '', password: '' })

async function createUser() {
  if (!validate(form)) return
  submitting.value = true
  try {
    const res = await usersApi.create({
      email: form.email.trim(),
      fullName: form.fullName.trim(),
      roleCode: form.role as Exclude<UserRole, 'super_admin'>,
      password: form.tempPassword.trim() || undefined,
    })
    dialogOpen.value = false
    await loadUsers()
    if (res.generatedPassword) {
      createdInfo.name = res.user.fullName
      createdInfo.password = res.generatedPassword
      resultOpen.value = true
    } else {
      toast.success(`Đã tạo tài khoản ${ROLE_LABEL[res.user.roleCode]} cho "${res.user.fullName}"`)
    }
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'Tạo tài khoản không thành công')
  } finally {
    submitting.value = false
  }
}

async function toggleActive(row: ApiUser) {
  try {
    await usersApi.setStatus(row.id, !row.isActive)
    await loadUsers()
    toast.success(row.isActive ? `Đã khoá "${row.fullName}"` : `Đã mở khoá "${row.fullName}"`)
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'Không đổi được trạng thái')
  }
}

async function removeUser(row: ApiUser) {
  try {
    await usersApi.remove(row.id)
    await loadUsers()
    toast.success(`Đã xoá tài khoản "${row.fullName}"`)
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'Xoá tài khoản không thành công')
  }
}

async function copyPassword() {
  try {
    await navigator.clipboard.writeText(createdInfo.password)
    toast.success('Đã copy mật khẩu tạm')
  } catch {
    toast.error('Không copy được, vui lòng copy thủ công')
  }
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

        <template #cell-roleCode="{ row }">
          <MTag :color="ROLE_COLOR[asUser(row).roleCode]" size="sm">{{ ROLE_LABEL[asUser(row).roleCode] }}</MTag>
        </template>

        <template #cell-createdBy="{ row }">{{ createdByName(asUser(row)) }}</template>
        <template #cell-createdAt="{ row }">{{ formatDate(asUser(row).createdAt) }}</template>

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

        <template #footer-info>
          <span v-if="loading" class="flex items-center gap-2"><MSpinner :size="14" /> Đang tải...</span>
          <span v-else>Tổng số người dùng: {{ filtered.length }}</span>
        </template>
      </MDataTable>
    </div>

    <!-- Dialog thêm người dùng -->
    <MDialog v-model="dialogOpen" title="Thêm người dùng" :width="480">
      <div class="flex flex-col gap-4">
        <div data-field="fullName">
          <label class="mb-1 block text-[13px] font-medium" style="color: var(--mds-text-primary)">
            Họ tên <span style="color: var(--mds-danger)">*</span>
          </label>
          <MInput v-model="form.fullName" placeholder="Nhập họ tên" :error="errors.fullName" />
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
        <MButton variant="secondary" :disabled="submitting" @click="dialogOpen = false">Hủy</MButton>
        <MButton variant="primary" :loading="submitting" @click="createUser">Tạo tài khoản</MButton>
      </template>
    </MDialog>

    <!-- Dialog hiện mật khẩu tạm sau khi tạo -->
    <MDialog v-model="resultOpen" title="Đã tạo tài khoản" :width="440">
      <div class="flex flex-col gap-3">
        <p class="text-[13px]" style="color: var(--mds-text-primary)">
          Tài khoản cho <strong>{{ createdInfo.name }}</strong> đã được tạo. Gửi mật khẩu tạm dưới đây
          cho người dùng — họ sẽ đổi mật khẩu ở lần đăng nhập đầu.
        </p>
        <div
          class="flex items-center justify-between gap-2 rounded-md px-3 py-2"
          style="background: var(--mds-bg-hover-soft, #F2F4F7)"
        >
          <code class="text-[14px] font-semibold" style="color: var(--mds-text-primary)">{{ createdInfo.password }}</code>
          <MButton variant="secondary" size="sm" @click="copyPassword">
            <template #icon><MIcon name="copy" :size="14" /></template>
            Copy
          </MButton>
        </div>
      </div>
      <template #footer>
        <MButton variant="primary" @click="resultOpen = false">Đã hiểu</MButton>
      </template>
    </MDialog>
  </section>
</template>
