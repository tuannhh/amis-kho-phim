<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import MButton from '@/components/mds/MButton.vue'
import MInput from '@/components/mds/MInput.vue'
import MTextarea from '@/components/mds/MTextarea.vue'
import MSelect from '@/components/mds/MSelect.vue'
import MTree from '@/components/mds/MTree.vue'
import MIcon from '@/components/mds/MIcon.vue'
import MEmptyState from '@/components/mds/MEmptyState.vue'
import MDialog from '@/components/mds/MDialog.vue'
import { useToast } from '@/components/mds/toast.js'
import { useFormValidation, rules } from '@/components/mds/useFormValidation.js'
import { categoryTree, flattenCategories, removeCategory, type CategoryNode } from './mockCategories'
import { toSlug as slugify } from '../films/mockFilms'

/**
 * Quản lý chuyên mục — GĐ 0.5 (mock). Master-Detail: cây chuyên mục bên trái,
 * form thêm/sửa bên phải. GĐ 2 gắn API categories module thật.
 */
const toast = useToast()

const expanded = ref<string[]>(['phim-su-kien'])
const selectedId = ref<string | null>(null)

// Tree hiển thị dùng label làm text chính (MTree cần {id,label,...})
const treeNodes = computed(() => categoryTree)

const parentOptions = computed(() =>
  flattenCategories().map((c) => ({ label: c.label, value: c.id }))
)

const form = reactive({ label: '', description: '', parentId: null as string | null })
const editingId = ref<string | null>(null)
const isCreating = ref(false)
const deleteTarget = ref<CategoryNode | null>(null)

const { errors, validate, clearErrors } = useFormValidation({
  label: [rules.required('Tên chuyên mục không được để trống')],
})

function resetForm() {
  form.label = ''
  form.description = ''
  form.parentId = null
  clearErrors()
}

function selectNode(id: string) {
  selectedId.value = id
  isCreating.value = false
  const node = flattenCategories().find((c) => c.id === id)
  if (!node) return
  editingId.value = id
  form.label = node.label
  form.description = node.description || ''
  form.parentId = node.parentId || null
}

function startCreate() {
  isCreating.value = true
  editingId.value = null
  selectedId.value = null
  resetForm()
}

function save() {
  if (!validate(form)) return

  if (isCreating.value) {
    const newNode: CategoryNode = {
      id: slugify(form.label) || `chuyen-muc-${Date.now()}`,
      label: form.label.trim(),
      description: form.description.trim(),
      parentId: form.parentId,
    }
    if (form.parentId) {
      const parent = flattenCategories().find((c) => c.id === form.parentId)
      if (parent) {
        parent.children = parent.children || []
        parent.children.push(newNode)
        if (!expanded.value.includes(parent.id)) expanded.value.push(parent.id)
      }
    } else {
      categoryTree.push(newNode)
    }
    toast.success(`Đã tạo chuyên mục "${newNode.label}"`)
    selectNode(newNode.id)
  } else if (editingId.value) {
    const node = flattenCategories().find((c) => c.id === editingId.value)
    if (node) {
      node.label = form.label.trim()
      node.description = form.description.trim()
      toast.success(`Đã cập nhật chuyên mục "${node.label}"`)
    }
  }
}

function askDelete() {
  const node = flattenCategories().find((c) => c.id === (editingId.value || selectedId.value))
  if (node) deleteTarget.value = node
}

function confirmDelete() {
  if (!deleteTarget.value) return
  removeCategory(deleteTarget.value.id)
  toast.success(`Đã xoá chuyên mục "${deleteTarget.value.label}"`)
  deleteTarget.value = null
  editingId.value = null
  selectedId.value = null
  resetForm()
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
        <MTree
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
              <div data-field="label">
                <label class="mb-1 block text-[13px] font-medium" style="color: var(--mds-text-primary)">
                  Tên chuyên mục <span style="color: var(--mds-danger)">*</span>
                </label>
                <MInput v-model="form.label" placeholder="Nhập tên chuyên mục" :error="errors.label" />
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
            <MButton v-if="!isCreating" variant="danger" @click="askDelete">
              <template #icon><MIcon name="trash" :size="16" /></template>
              Xoá
            </MButton>
            <span v-else />
            <MButton variant="primary" @click="save">Lưu</MButton>
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
        Bạn có chắc muốn xoá chuyên mục <strong>"{{ deleteTarget?.label }}"</strong>? Hành động này
        không thể hoàn tác.
      </p>
      <template #footer>
        <MButton variant="secondary" @click="deleteTarget = null">Hủy</MButton>
        <MButton variant="danger" @click="confirmDelete">Xoá</MButton>
      </template>
    </MDialog>
  </section>
</template>
