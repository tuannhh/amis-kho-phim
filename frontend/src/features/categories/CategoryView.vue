<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import MButton from '@/components/mds/MButton.vue'
import MInput from '@/components/mds/MInput.vue'
import MTextarea from '@/components/mds/MTextarea.vue'
import MSelect from '@/components/mds/MSelect.vue'
import MTree from '@/components/mds/MTree.vue'
import MIcon from '@/components/mds/MIcon.vue'
import MEmptyState from '@/components/mds/MEmptyState.vue'
import MDialog from '@/components/mds/MDialog.vue'
import MSpinner from '@/components/mds/MSpinner.vue'
import { useToast } from '@/components/mds/toast.js'
import { useFormValidation, rules } from '@/components/mds/useFormValidation.js'
import { categoriesApi, type ApiCategoryNode } from './categoriesApi'

/**
 * Quản lý chuyên mục — GĐ2 (API thật). Master-Detail: cây chuyên mục bên trái,
 * form thêm/sửa bên phải. Cha chỉ chọn được lúc tạo (giữ UX GĐ0.5); sửa chỉ
 * đổi tên/mô tả (backend UpdateCategoryDto không nhận parentId).
 */
const toast = useToast()

const tree = ref<ApiCategoryNode[]>([])
const loading = ref(false)

async function loadTree() {
  loading.value = true
  try {
    tree.value = await categoriesApi.tree()
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'Không tải được chuyên mục')
  } finally {
    loading.value = false
  }
}
onMounted(loadTree)

// MTree cần field `label` để hiển thị — map name→label, giữ nguyên cấu trúc cây.
interface TreeDisplayNode {
  id: number
  label: string
  children?: TreeDisplayNode[]
}
function toDisplay(nodes: ApiCategoryNode[]): TreeDisplayNode[] {
  return nodes.map((n) => ({ id: n.id, label: n.name, children: n.children ? toDisplay(n.children) : undefined }))
}
const treeNodes = computed(() => toDisplay(tree.value))

function flatten(nodes: ApiCategoryNode[] = tree.value): ApiCategoryNode[] {
  return nodes.flatMap((n) => [n, ...(n.children ? flatten(n.children) : [])])
}

const expanded = ref<number[]>([])
const selectedId = ref<number | null>(null)

const parentOptions = computed(() => flatten().map((c) => ({ label: c.name, value: c.id })))

// parentId dùng undefined (không phải null) — MSelect không nhận null trong kiểu modelValue
const form = reactive({ name: '', description: '', parentId: undefined as number | undefined })
const editingId = ref<number | null>(null)
const isCreating = ref(false)
const deleteTarget = ref<ApiCategoryNode | null>(null)
const submitting = ref(false)

const { errors, validate, clearErrors } = useFormValidation({
  name: [rules.required('Tên chuyên mục không được để trống')],
}) as {
  errors: Record<string, string>
  validate: (values: Record<string, unknown>) => boolean
  clearErrors: () => void
}

function resetForm() {
  form.name = ''
  form.description = ''
  form.parentId = undefined
  clearErrors()
}

function selectNode(id: number) {
  selectedId.value = id
  isCreating.value = false
  const node = flatten().find((c) => c.id === id)
  if (!node) return
  editingId.value = id
  form.name = node.name
  form.description = node.description || ''
  form.parentId = node.parentId ?? undefined
}

function startCreate() {
  isCreating.value = true
  editingId.value = null
  selectedId.value = null
  resetForm()
}

async function save() {
  if (!validate(form)) return
  submitting.value = true
  try {
    if (isCreating.value) {
      const created = await categoriesApi.create({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        parentId: form.parentId,
      })
      toast.success(`Đã tạo chuyên mục "${created.name}"`)
      if (form.parentId && !expanded.value.includes(form.parentId)) expanded.value.push(form.parentId)
      await loadTree()
      selectNode(created.id)
    } else if (editingId.value) {
      const updated = await categoriesApi.update(editingId.value, {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
      })
      toast.success(`Đã cập nhật chuyên mục "${updated.name}"`)
      await loadTree()
    }
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'Lưu chuyên mục không thành công')
  } finally {
    submitting.value = false
  }
}

function askDelete() {
  const node = flatten().find((c) => c.id === (editingId.value || selectedId.value))
  if (node) deleteTarget.value = node
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  try {
    await categoriesApi.remove(deleteTarget.value.id)
    toast.success(`Đã xoá chuyên mục "${deleteTarget.value.name}"`)
    deleteTarget.value = null
    editingId.value = null
    selectedId.value = null
    resetForm()
    await loadTree()
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'Xoá chuyên mục không thành công')
  }
}
</script>

<template>
  <section class="flex h-full flex-col">
    <header
      class="flex h-14 shrink-0 items-center justify-between gap-3 bg-white px-5"
      style="box-shadow: var(--mds-shadow-card, 0 0 2px 0 rgba(0,0,0,0.1))"
    >
      <h1 class="text-[16px] font-semibold" style="color: var(--mds-text-primary)">Chuyên mục</h1>
      <MButton variant="primary" @click="startCreate">
        <template #icon><MIcon name="plus" :size="16" /></template>
        Thêm chuyên mục
      </MButton>
    </header>

    <div class="flex flex-1 gap-4 overflow-hidden p-4">
      <!-- Cây chuyên mục -->
      <div
        class="w-[320px] shrink-0 overflow-auto rounded-lg bg-white p-3"
        style="box-shadow: var(--mds-shadow-card, 0 0 2px 0 rgba(0,0,0,0.1))"
      >
        <div v-if="loading" class="flex items-center gap-2 p-3 text-[13px]" style="color: var(--mds-text-secondary)">
          <MSpinner :size="14" /> Đang tải...
        </div>
        <div
          v-else-if="!treeNodes.length"
          class="flex flex-col items-center gap-2 p-6 text-center text-[13px]"
          style="color: var(--mds-text-placeholder)"
        >
          <MIcon name="folder" :size="28" />
          <span>Chưa có chuyên mục nào.<br />Bấm "Thêm chuyên mục" để tạo mới.</span>
        </div>
        <MTree
          v-else
          :nodes="treeNodes"
          v-model:selected="selectedId"
          v-model:expanded="expanded"
          @update:selected="selectNode"
        />
      </div>

      <!-- Form thêm/sửa -->
      <div
        class="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg bg-white"
        style="box-shadow: var(--mds-shadow-card, 0 0 2px 0 rgba(0,0,0,0.1))"
      >
        <div v-if="isCreating || editingId" class="flex min-h-0 flex-1 flex-col">
          <div class="flex-1 overflow-auto p-5">
            <h3 class="mb-4 text-[16px] font-semibold" style="color: var(--mds-text-primary)">
              {{ isCreating ? 'Thêm chuyên mục' : 'Sửa chuyên mục' }}
            </h3>

            <div class="flex flex-col gap-4">
              <div data-field="name">
                <label class="mb-1 block text-[13px] font-medium" style="color: var(--mds-text-primary)">
                  Tên chuyên mục <span style="color: var(--mds-danger)">*</span>
                </label>
                <MInput v-model="form.name" placeholder="Nhập tên chuyên mục" :error="errors.name" />
              </div>

              <div v-if="isCreating">
                <label class="mb-1 block text-[13px] font-medium" style="color: var(--mds-text-primary)">
                  Chuyên mục cha
                </label>
                <MSelect v-model="form.parentId" :options="parentOptions" placeholder="Không có (chuyên mục gốc)" />
              </div>

              <div>
                <label class="mb-1 block text-[13px] font-medium" style="color: var(--mds-text-primary)">
                  Mô tả
                </label>
                <MTextarea v-model="form.description" :rows="4" :maxlength="500" placeholder="Mô tả chuyên mục" />
              </div>
            </div>
          </div>

          <!-- Footer ghim -->
          <footer class="flex shrink-0 items-center justify-between border-t px-5 py-3" style="border-color: var(--mds-border-light,#E9EAEB)">
            <MButton v-if="!isCreating" variant="danger" :disabled="submitting" @click="askDelete">
              <template #icon><MIcon name="trash" :size="16" /></template>
              Xoá
            </MButton>
            <span v-else />
            <MButton variant="primary" :loading="submitting" @click="save">Lưu</MButton>
          </footer>
        </div>

        <MEmptyState
          v-else
          type="initial"
          title="Chọn một chuyên mục để xem chi tiết"
          description="Hoặc bấm 'Thêm chuyên mục' để tạo mới"
        />
      </div>
    </div>

    <MDialog
      :model-value="!!deleteTarget"
      title="Xoá chuyên mục"
      type="danger"
      :width="440"
      @update:model-value="deleteTarget = null"
    >
      <p class="text-[13px]" style="color: var(--mds-text-primary)">
        Bạn có chắc muốn xoá chuyên mục <strong>"{{ deleteTarget?.name }}"</strong>? Chuyên mục con (nếu
        có) sẽ bị xoá theo; phim thuộc chuyên mục này chỉ mất liên kết, không bị xoá.
      </p>
      <template #footer>
        <MButton variant="secondary" @click="deleteTarget = null">Hủy</MButton>
        <MButton variant="danger" @click="confirmDelete">Xoá</MButton>
      </template>
    </MDialog>
  </section>
</template>
