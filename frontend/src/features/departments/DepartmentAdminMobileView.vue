<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import MMobileTopBar from '@/components/mds/MMobileTopBar.vue'
import MButton from '@/components/mds/MButton.vue'
import MInput from '@/components/mds/MInput.vue'
import MIcon from '@/components/mds/MIcon.vue'
import MDrawer from '@/components/mds/MDrawer.vue'
import MDialog from '@/components/mds/MDialog.vue'
import MEmptyState from '@/components/mds/MEmptyState.vue'
import MSpinner from '@/components/mds/MSpinner.vue'
import { useToast } from '@/components/mds/toast.js'
import { departmentsApi, type ApiDepartment } from './departmentsApi'

const router = useRouter()
const toast = useToast()
const rows = ref<ApiDepartment[]>([])
const search = ref('')
const loading = ref(false)
const sheetOpen = ref(false)
const submitting = ref(false)
const editing = ref<ApiDepartment | null>(null)
const deleteTarget = ref<ApiDepartment | null>(null)
const deleting = ref(false)
const form = reactive({ name: '' })
const filtered = computed(() => {
  const query = search.value.trim().toLowerCase()
  return query ? rows.value.filter((item) => item.name.toLowerCase().includes(query)) : rows.value
})

async function load() {
  loading.value = true
  try { rows.value = await departmentsApi.list() }
  catch (error: unknown) { toast.error(error instanceof Error ? error.message : 'Không tải được phòng ban') }
  finally { loading.value = false }
}
onMounted(load)
function openCreate() { editing.value = null; form.name = ''; sheetOpen.value = true }
function openEdit(item: ApiDepartment) { editing.value = item; form.name = item.name; sheetOpen.value = true }
async function save() {
  const name = form.name.trim()
  if (!name) return toast.error('Tên phòng ban không được để trống')
  submitting.value = true
  try {
    if (editing.value) await departmentsApi.update(editing.value.id, { name })
    else await departmentsApi.create({ name })
    sheetOpen.value = false
    await load()
    toast.success('Đã lưu phòng ban')
  } catch (error: unknown) { toast.error(error instanceof Error ? error.message : 'Lưu phòng ban không thành công') }
  finally { submitting.value = false }
}
async function remove() {
  if (!deleteTarget.value) return
  deleting.value = true
  try { await departmentsApi.remove(deleteTarget.value.id); deleteTarget.value = null; await load(); toast.success('Đã xoá phòng ban') }
  catch (error: unknown) { toast.error(error instanceof Error ? error.message : 'Xoá phòng ban không thành công') }
  finally { deleting.value = false }
}
</script>

<template>
  <section class="mds-mobile-app flex h-full min-h-0 flex-col overflow-hidden bg-[var(--mds-bg-page)]">
    <MMobileTopBar title="Quản lý phòng ban" :show-more="false" @back="router.push({ name: 'account' })">
      <template #actions><MButton variant="icon" aria-label="Thêm phòng ban" @click="openCreate"><template #icon><MIcon name="plus" :size="20" /></template></MButton></template>
    </MMobileTopBar>
    <div class="mds-mobile-gutter-x shrink-0 border-b bg-white py-3" style="border-color: var(--mds-border-light)">
      <MInput v-model="search" clearable placeholder="Tìm phòng ban"><template #prefix><MIcon name="search" :size="20" /></template></MInput>
    </div>
    <div class="min-h-0 flex-1 overflow-y-auto">
      <div v-if="loading" class="flex justify-center py-10"><MSpinner :size="20" /></div>
      <MEmptyState v-else-if="!filtered.length" type="no-data" title="Chưa có phòng ban" description="Tạo phòng ban để phân quyền theo tổ chức." />
      <ul v-else>
        <li v-for="item in filtered" :key="item.id" class="mds-mobile-gutter-x flex min-h-[72px] items-center gap-3 border-b bg-white py-2" style="border-color: var(--mds-border-light)">
          <span class="grid h-10 w-10 shrink-0 place-items-center rounded-lg" style="background: var(--mds-brand-50); color: var(--mds-brand-600)"><MIcon name="building" :size="20" /></span>
          <span class="min-w-0 flex-1"><strong class="block truncate text-[14px]">{{ item.name }}</strong><span class="block text-[12px]" style="color: var(--mds-text-secondary)">{{ item.userCount }} người dùng</span></span>
          <MButton variant="icon" aria-label="Sửa phòng ban" @click="openEdit(item)"><template #icon><MIcon name="pencil" :size="18" /></template></MButton>
          <MButton variant="icon" aria-label="Xoá phòng ban" @click="deleteTarget = item"><template #icon><MIcon name="trash" :size="18" /></template></MButton>
        </li>
      </ul>
    </div>
    <MDrawer v-model="sheetOpen" position="bottom" :title="editing ? 'Sửa phòng ban' : 'Thêm phòng ban'">
      <label class="mb-1 block text-[13px] font-medium">Tên phòng ban <span style="color: var(--mds-danger)">*</span></label>
      <MInput v-model="form.name" placeholder="VD: Phòng Truyền thông" />
      <template #footer><MButton variant="secondary" :disabled="submitting" @click="sheetOpen = false">Hủy</MButton><MButton variant="primary" :loading="submitting" @click="save">Lưu</MButton></template>
    </MDrawer>
    <MDialog :model-value="!!deleteTarget" title="Xoá phòng ban" type="danger" @update:model-value="deleteTarget = null">
      <p>Phòng ban <strong>{{ deleteTarget?.name }}</strong> sẽ bị xoá.</p><p v-if="deleteTarget?.userCount" class="mt-2" style="color: var(--mds-danger)">Cần chuyển {{ deleteTarget.userCount }} người dùng sang phòng ban khác trước.</p>
      <template #footer><MButton variant="secondary" :disabled="deleting" @click="deleteTarget = null">Hủy</MButton><MButton variant="danger" :loading="deleting" @click="remove">Xoá</MButton></template>
    </MDialog>
  </section>
</template>
