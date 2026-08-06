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
import { useAuthStore } from '@/features/auth/authStore'
import { ROLE_HINT } from '@/features/auth/permissions'
import { departmentsApi, type ApiDepartment } from '@/features/departments/departmentsApi'
import {
  usersApi,
  ROLE_LABEL,
  ROLE_COLOR,
  creatableRoles,
  type ApiUser,
  type AssignableRole,
} from './usersApi'

/**
 * Quản trị người dùng — RBAC 3 CẤP PHẲNG (ADR-045).
 *
 * CHỈ Cấp 3 (`super_admin`) vào được màn này; gán được Cấp 1/Cấp 2 và phòng ban, KHÔNG gán
 * được Cấp 3 khác. Phòng ban ở bản này KHÔNG ảnh hưởng quyền (ADR-046) — chỉ dùng để truy
 * vết/đối soát, nên form không cảnh báo khi để trống.
 *
 * Quyền THỰC do backend kiểm (RolesGuard + service); FE chỉ ẩn/hiện nút cho UX.
 */
const toast = useToast()
const auth = useAuthStore()

const users = ref<ApiUser[]>([])
const departments = ref<ApiDepartment[]>([])
const loading = ref(false)

async function loadUsers() {
  loading.value = true
  try {
    // Tải song song — 2 request độc lập, không cần chờ tuần tự.
    const [u, d] = await Promise.all([usersApi.list(), departmentsApi.list()])
    users.value = u
    departments.value = d
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'Không tải được danh sách người dùng')
  } finally {
    loading.value = false
  }
}
onMounted(loadUsers)

/** Tên phòng ban theo id — dùng cho cột bảng. */
const departmentName = (id: number | null) =>
  id == null ? '—' : (departments.value.find((d) => d.id === id)?.name ?? `#${id}`)

/**
 * Tuỳ chọn phòng ban cho MSelect. Giá trị 0 = "Chưa gán" — CỐ Ý không dùng `undefined`/`null`
 * làm value của option: `undefined` là trạng thái "chưa chọn gì" của MSelect (quy ước dự án,
 * `11-coding-rules.md` §2), nếu dùng luôn cho option "Chưa gán" thì không phân biệt được
 * "chưa chọn" với "chọn có chủ đích là không thuộc phòng ban nào".
 */
const NO_DEPARTMENT = 0
const departmentOptions = computed(() => [
  { label: 'Chưa gán phòng ban', value: NO_DEPARTMENT },
  ...departments.value.map((d) => ({ label: d.name, value: d.id })),
])

const search = ref('')
const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return users.value
  return users.value.filter(
    (u) => u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
  )
})

const columns = [
  { key: 'fullName', label: 'Họ tên', width: 180 },
  { key: 'email', label: 'Email', width: 200 },
  { key: 'roleCode', label: 'Vai trò', width: 150 },
  { key: 'departmentId', label: 'Phòng ban', width: 160 },
  { key: 'createdBy', label: 'Người tạo', width: 150 },
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

/**
 * Ai được sửa/khoá/xoá ai — khớp `UsersService.assertCanManage`: chỉ Cấp 3, không tự tác động
 * chính mình, không đụng Cấp 3 khác. Chỉ để ẩn/hiện nút (backend vẫn chặn thật).
 */
function canManage(row: ApiUser) {
  if (row.id === auth.user?.id) return false
  if (auth.role !== 'super_admin') return false
  return row.roleCode !== 'super_admin'
}

const dialogOpen = ref(false)
const submitting = ref(false)
const form = reactive({
  fullName: '',
  email: '',
  role: undefined as AssignableRole | undefined,
  departmentId: NO_DEPARTMENT as number,
  tempPassword: '',
})

/**
 * Gợi ý mềm: phòng ban KHÔNG ảnh hưởng quyền ở bản 3 cấp phẳng, nhưng để trống thì phim do
 * người này tạo sẽ không có dữ liệu truy vết phòng ban.
 */
const departmentWarning = computed(() =>
  form.departmentId === NO_DEPARTMENT && form.role === 'employee'
    ? 'Chưa gán phòng ban: phim do tài khoản này tạo sẽ không có thông tin phòng ban để truy vết. Không ảnh hưởng quyền.'
    : '',
)

/** Gợi ý quyền của vai trò đang chọn — hiện ngay dưới dropdown để chọn đúng cấp. */
const roleHint = computed(() => (form.role ? ROLE_HINT[form.role] : ''))

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
  form.departmentId = NO_DEPARTMENT
  form.tempPassword = ''
  clearErrors()
  dialogOpen.value = true
}

// ── Sửa tài khoản: đổi vai trò + phòng ban ─────────────────────────────────
// Cần thiết vì Cấp 1 (`viewer`) là cấp MỚI — không tài khoản nào tự động chuyển sang khi
// migrate RBAC, Cấp 3 phải tự gán lại ở đây (ADR-047).
const editOpen = ref(false)
const editing = ref<ApiUser | null>(null)
const editForm = reactive({ role: undefined as AssignableRole | undefined, departmentId: NO_DEPARTMENT as number })

function openEdit(row: ApiUser) {
  editing.value = row
  // Tài khoản đang là Cấp 3 không sửa được (canManage đã chặn), nên role luôn nằm trong danh
  // sách gán được.
  editForm.role = row.roleCode === 'super_admin' ? undefined : (row.roleCode as AssignableRole)
  editForm.departmentId = row.departmentId ?? NO_DEPARTMENT
  editOpen.value = true
}

const editRoleHint = computed(() => (editForm.role ? ROLE_HINT[editForm.role] : ''))

async function saveEdit() {
  if (!editing.value || !editForm.role) return
  submitting.value = true
  try {
    const updated = await usersApi.update(editing.value.id, {
      roleCode: editForm.role,
      departmentId: editForm.departmentId === NO_DEPARTMENT ? null : editForm.departmentId,
    })
    editOpen.value = false
    await loadUsers()
    toast.success(`Đã cập nhật "${updated.fullName}" thành ${ROLE_LABEL[updated.roleCode]}`)
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'Cập nhật tài khoản không thành công')
  } finally {
    submitting.value = false
  }
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
      roleCode: form.role as AssignableRole,
      departmentId: form.departmentId === NO_DEPARTMENT ? undefined : form.departmentId,
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

        <template #cell-departmentId="{ row }">
          <span :style="asUser(row).departmentId == null ? 'color: var(--mds-text-secondary)' : ''">
            {{ departmentName(asUser(row).departmentId) }}
          </span>
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
              title="Sửa vai trò / phòng ban"
              class="flex h-7 w-7 items-center justify-center rounded-md"
              style="border: 1px solid var(--mds-border, #ced1d6); color: var(--mds-icon-neutral)"
              @click="openEdit(asUser(row))"
            >
              <MIcon name="pencil" :size="12" />
            </button>
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
          <p v-if="roleHint" class="mt-1 text-[12px]" style="color: var(--mds-text-secondary)">
            {{ roleHint }}
          </p>
        </div>
        <div>
          <label class="mb-1 block text-[13px] font-medium" style="color: var(--mds-text-primary)">
            Phòng ban
          </label>
          <MSelect
            v-model="form.departmentId"
            :options="departmentOptions"
            placeholder="Chọn phòng ban"
          />
          <p v-if="departmentWarning" class="mt-1 text-[12px]" style="color: var(--mds-warning, #dc6803)">
            {{ departmentWarning }}
          </p>
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

    <!-- Dialog sửa vai trò / phòng ban -->
    <MDialog v-model="editOpen" title="Sửa vai trò và phòng ban" :width="480">
      <div class="flex flex-col gap-4">
        <p class="text-[13px]" style="color: var(--mds-text-secondary)">
          Tài khoản: <strong style="color: var(--mds-text-primary)">{{ editing?.fullName }}</strong>
          ({{ editing?.email }})
        </p>
        <div>
          <label class="mb-1 block text-[13px] font-medium" style="color: var(--mds-text-primary)">
            Vai trò <span style="color: var(--mds-danger)">*</span>
          </label>
          <MSelect v-model="editForm.role" :options="roleOptions" placeholder="Chọn vai trò" />
          <p v-if="editRoleHint" class="mt-1 text-[12px]" style="color: var(--mds-text-secondary)">
            {{ editRoleHint }}
          </p>
        </div>
        <div>
          <label class="mb-1 block text-[13px] font-medium" style="color: var(--mds-text-primary)">
            Phòng ban
          </label>
          <MSelect
            v-model="editForm.departmentId"
            :options="departmentOptions"
            placeholder="Chọn phòng ban"
          />
          <p class="mt-1 text-[12px]" style="color: var(--mds-text-secondary)">
            Phòng ban chỉ dùng để truy vết, KHÔNG ảnh hưởng quyền sửa/xoá phim — phim đã tạo vẫn
            giữ phòng ban lúc tạo.
          </p>
        </div>
      </div>
      <template #footer>
        <MButton variant="secondary" :disabled="submitting" @click="editOpen = false">Hủy</MButton>
        <MButton variant="primary" :loading="submitting" :disabled="!editForm.role" @click="saveEdit">
          Lưu
        </MButton>
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
