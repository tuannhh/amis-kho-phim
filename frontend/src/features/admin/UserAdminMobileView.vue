<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import MMobileTopBar from '@/components/mds/MMobileTopBar.vue'
import MButton from '@/components/mds/MButton.vue'
import MInput from '@/components/mds/MInput.vue'
import MSelect from '@/components/mds/MSelect.vue'
import MTag from '@/components/mds/MTag.vue'
import MIcon from '@/components/mds/MIcon.vue'
import MDrawer from '@/components/mds/MDrawer.vue'
import MDialog from '@/components/mds/MDialog.vue'
import MEmptyState from '@/components/mds/MEmptyState.vue'
import MSpinner from '@/components/mds/MSpinner.vue'
import { useToast } from '@/components/mds/toast.js'
import { useAuthStore } from '@/features/auth/authStore'
import { departmentsApi, type ApiDepartment } from '@/features/departments/departmentsApi'
import { usersApi, creatableRoles, ROLE_COLOR, ROLE_LABEL, type ApiUser, type AssignableRole } from './usersApi'

const router = useRouter()
const toast = useToast()
const auth = useAuthStore()
const users = ref<ApiUser[]>([])
const departments = ref<ApiDepartment[]>([])
const search = ref('')
const loading = ref(false)
const sheetOpen = ref(false)
const submitting = ref(false)
const editing = ref<ApiUser | null>(null)
const deleteTarget = ref<ApiUser | null>(null)
const deleting = ref(false)
const resultOpen = ref(false)
const generatedPassword = ref('')
const createdName = ref('')
const NO_DEPARTMENT = 0
const form = reactive({ fullName: '', email: '', role: undefined as AssignableRole | undefined, departmentId: NO_DEPARTMENT, tempPassword: '' })

const roleOptions = computed(() => creatableRoles(auth.role).map((role) => ({ label: ROLE_LABEL[role], value: role })))
const departmentOptions = computed(() => [{ label: 'Chưa gán phòng ban', value: NO_DEPARTMENT }, ...departments.value.map((item) => ({ label: item.name, value: item.id }))])
const filtered = computed(() => {
  const query = search.value.trim().toLowerCase()
  return query ? users.value.filter((user) => user.fullName.toLowerCase().includes(query) || user.email.toLowerCase().includes(query)) : users.value
})
function departmentName(id: number | null) { return id == null ? 'Chưa gán phòng ban' : departments.value.find((item) => item.id === id)?.name || 'Chưa gán phòng ban' }
function canManage(user: ApiUser) { return auth.role === 'super_admin' && user.id !== auth.user?.id && user.roleCode !== 'super_admin' }
async function load() {
  loading.value = true
  try { const [items, departmentRows] = await Promise.all([usersApi.list(), departmentsApi.list()]); users.value = items; departments.value = departmentRows }
  catch (error: unknown) { toast.error(error instanceof Error ? error.message : 'Không tải được người dùng') }
  finally { loading.value = false }
}
onMounted(load)
function openCreate() {
  editing.value = null
  Object.assign(form, { fullName: '', email: '', role: roleOptions.value[0]?.value, departmentId: NO_DEPARTMENT, tempPassword: '' })
  sheetOpen.value = true
}
function openEdit(user: ApiUser) {
  editing.value = user
  Object.assign(form, { fullName: user.fullName, email: user.email, role: user.roleCode as AssignableRole, departmentId: user.departmentId ?? NO_DEPARTMENT, tempPassword: '' })
  sheetOpen.value = true
}
async function save() {
  if (!form.role || (!editing.value && (!form.fullName.trim() || !form.email.trim()))) return toast.error('Nhập đủ họ tên, email và vai trò')
  submitting.value = true
  try {
    const departmentId = form.departmentId === NO_DEPARTMENT ? null : form.departmentId
    if (editing.value) {
      await usersApi.update(editing.value.id, { roleCode: form.role, departmentId })
      toast.success('Đã cập nhật người dùng')
    } else {
      const result = await usersApi.create({ fullName: form.fullName.trim(), email: form.email.trim(), roleCode: form.role, departmentId: departmentId ?? undefined, password: form.tempPassword.trim() || undefined })
      if (result.generatedPassword) { createdName.value = result.user.fullName; generatedPassword.value = result.generatedPassword; resultOpen.value = true }
      else toast.success('Đã tạo người dùng')
    }
    sheetOpen.value = false
    await load()
  } catch (error: unknown) { toast.error(error instanceof Error ? error.message : 'Lưu người dùng không thành công') }
  finally { submitting.value = false }
}
async function toggleActive(user: ApiUser) {
  try { await usersApi.setStatus(user.id, !user.isActive); await load(); toast.success(user.isActive ? 'Đã khoá tài khoản' : 'Đã mở khoá tài khoản') }
  catch (error: unknown) { toast.error(error instanceof Error ? error.message : 'Không đổi được trạng thái') }
}
async function remove() {
  if (!deleteTarget.value) return
  deleting.value = true
  try { await usersApi.remove(deleteTarget.value.id); deleteTarget.value = null; await load(); toast.success('Đã xoá người dùng') }
  catch (error: unknown) { toast.error(error instanceof Error ? error.message : 'Xoá người dùng không thành công') }
  finally { deleting.value = false }
}
async function copyPassword() {
  try { await navigator.clipboard.writeText(generatedPassword.value); toast.success('Đã copy mật khẩu tạm') }
  catch { toast.error('Không thể copy mật khẩu') }
}
</script>

<template>
  <section class="mds-mobile-app flex h-full min-h-0 flex-col overflow-hidden bg-[var(--mds-bg-page)]">
    <MMobileTopBar title="Quản trị người dùng" :show-more="false" @back="router.push({ name: 'account' })">
      <template #actions><MButton variant="icon" aria-label="Thêm người dùng" @click="openCreate"><template #icon><MIcon name="plus" :size="20" /></template></MButton></template>
    </MMobileTopBar>
    <div class="mds-mobile-gutter-x shrink-0 border-b bg-white py-3" style="border-color: var(--mds-border-light)"><MInput v-model="search" clearable placeholder="Tìm tên hoặc email"><template #prefix><MIcon name="search" :size="20" /></template></MInput></div>
    <div class="min-h-0 flex-1 overflow-y-auto">
      <div v-if="loading" class="flex justify-center py-10"><MSpinner :size="20" /></div>
      <MEmptyState v-else-if="!filtered.length" type="no-data" title="Chưa có người dùng" description="Tạo tài khoản để phân quyền sử dụng kho phim." />
      <ul v-else>
        <li v-for="user in filtered" :key="user.id" class="mds-mobile-gutter-x flex min-h-[80px] items-center gap-3 border-b bg-white py-3" style="border-color: var(--mds-border-light)">
          <span class="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[14px] font-semibold" style="background: var(--mds-brand-50); color: var(--mds-brand-600)">{{ user.fullName.slice(0, 1).toUpperCase() }}</span>
          <span class="min-w-0 flex-1"><strong class="block truncate text-[14px]">{{ user.fullName }}</strong><span class="block truncate text-[12px]" style="color: var(--mds-text-secondary)">{{ user.email }}</span><span class="mt-1 flex min-w-0 items-center gap-1.5"><MTag :color="ROLE_COLOR[user.roleCode]" size="sm">{{ ROLE_LABEL[user.roleCode] }}</MTag><span class="truncate text-[11px]" style="color: var(--mds-text-muted)">{{ departmentName(user.departmentId) }}</span></span></span>
          <MButton v-if="canManage(user)" variant="icon" aria-label="Sửa người dùng" @click="openEdit(user)"><template #icon><MIcon name="pencil" :size="18" /></template></MButton>
        </li>
      </ul>
    </div>
    <MDrawer v-model="sheetOpen" position="bottom" :title="editing ? 'Sửa người dùng' : 'Thêm người dùng'">
      <div class="flex flex-col gap-4">
        <template v-if="!editing"><div><label class="mb-1 block text-[13px] font-medium">Họ tên <span style="color: var(--mds-danger)">*</span></label><MInput v-model="form.fullName" placeholder="Nhập họ tên" /></div><div><label class="mb-1 block text-[13px] font-medium">Email <span style="color: var(--mds-danger)">*</span></label><MInput v-model="form.email" type="email" placeholder="ten@misa.com.vn" /></div></template>
        <div><label class="mb-1 block text-[13px] font-medium">Vai trò <span style="color: var(--mds-danger)">*</span></label><MSelect v-model="form.role" :options="roleOptions" /></div>
        <div><label class="mb-1 block text-[13px] font-medium">Phòng ban</label><MSelect v-model="form.departmentId" :options="departmentOptions" /></div>
        <div v-if="!editing"><label class="mb-1 block text-[13px] font-medium">Mật khẩu tạm</label><MInput v-model="form.tempPassword" type="password" placeholder="Bỏ trống để hệ thống tạo" /></div>
        <div v-if="editing && canManage(editing)" class="flex gap-2 border-t pt-4" style="border-color: var(--mds-border-light)"><MButton variant="secondary" class="flex-1" @click="toggleActive(editing)">{{ editing.isActive ? 'Khoá tài khoản' : 'Mở khoá' }}</MButton><MButton variant="danger" class="flex-1" @click="deleteTarget = editing; sheetOpen = false">Xoá</MButton></div>
      </div>
      <template #footer><MButton variant="secondary" :disabled="submitting" @click="sheetOpen = false">Hủy</MButton><MButton variant="primary" :loading="submitting" @click="save">Lưu</MButton></template>
    </MDrawer>
    <MDialog :model-value="!!deleteTarget" title="Xoá người dùng" type="danger" @update:model-value="deleteTarget = null"><p>Tài khoản <strong>{{ deleteTarget?.fullName }}</strong> sẽ bị xoá vĩnh viễn.</p><template #footer><MButton variant="secondary" :disabled="deleting" @click="deleteTarget = null">Hủy</MButton><MButton variant="danger" :loading="deleting" @click="remove">Xoá</MButton></template></MDialog>
    <MDialog v-model="resultOpen" title="Tài khoản đã được tạo"><p>Mật khẩu tạm của <strong>{{ createdName }}</strong>:</p><p class="mt-2 rounded-lg p-3 font-mono text-[15px]" style="background: var(--mds-bg-disabled)">{{ generatedPassword }}</p><template #footer><MButton variant="secondary" @click="copyPassword">Copy</MButton><MButton variant="primary" @click="resultOpen = false">Đã xong</MButton></template></MDialog>
  </section>
</template>
