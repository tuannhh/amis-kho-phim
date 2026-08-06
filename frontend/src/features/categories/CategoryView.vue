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
import { useAuthStore } from '@/features/auth/authStore'
import { canCreateAnyCategory, canWriteCategory, isSystemAdmin } from '@/features/auth/permissions'

/**
 * Quản lý chuyên mục — GĐ2 (API thật). Master-Detail: cây chuyên mục bên trái,
 * form thêm/sửa bên phải. Cha chỉ chọn được lúc tạo (giữ UX GĐ0.5); sửa chỉ
 * đổi tên/mô tả (backend UpdateCategoryDto không nhận parentId).
 *
 * QUYỀN GHI THEO TẦNG (ADR-051, thay ADR-044):
 *   - chuyên mục GỐC → chỉ Cấp 4
 *   - chuyên mục CON → Cấp 2 trở lên
 *
 * Nên với Cấp 2/3, ô "Chuyên mục cha" là BẮT BUỘC và dropdown KHÔNG có lựa chọn "Không có
 * (chuyên mục gốc)" — chặn ngay từ UI đúng bằng chốt chặn ở backend, thay vì để người dùng
 * điền xong rồi mới ăn 403.
 */
const toast = useToast()
const auth = useAuthStore()

/** Có thấy nút "Thêm chuyên mục" không (Cấp 2 trở lên). */
const canWrite = computed(() => canCreateAnyCategory(auth.role))

/** Cấp 4 — người duy nhất được tạo/sửa/xoá chuyên mục gốc. */
const canWriteRoot = computed(() => isSystemAdmin(auth.role))

/** Cấp 2/3 bắt buộc chọn cha (không được tạo gốc). */
const mustPickParent = computed(() => !canWriteRoot.value)

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

/**
 * Cấp 2/3 phải chọn cha nhưng kho chưa có chuyên mục nào để chọn → họ không tạo được gì cho
 * tới khi Cấp 4 tạo chuyên mục gốc đầu tiên. Hiện thông báo giải thích, không bỏ mặc form câm.
 */
const noParentAvailable = computed(() => mustPickParent.value && parentOptions.value.length === 0)

/** Chuyên mục đang chọn có phải gốc không (quyết định được sửa/xoá hay không). */
const selectedIsRoot = computed(() => {
  const node = flatten().find((c) => c.id === editingId.value)
  return node ? node.parentId == null : false
})
/** Được sửa/xoá chuyên mục đang chọn không — khớp `assertCanWrite` theo tầng ở backend. */
const canWriteSelected = computed(() => canWriteCategory(auth.role, selectedIsRoot.value))

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
  // Cấp 2/3 tạo mới mà chưa chọn cha = đang định tạo chuyên mục gốc → chặn tại chỗ, nói rõ lý
  // do. Backend vẫn tự chặn độc lập (ADR-051); đây chỉ để người dùng khỏi mất công gửi lên.
  if (isCreating.value && mustPickParent.value && form.parentId == null) {
    toast.error('Bạn cần chọn một chuyên mục cha. Chỉ Quản trị cao nhất mới tạo được chuyên mục gốc.')
    return
  }
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
      <MButton v-if="canWrite" variant="primary" @click="startCreate">
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
          <span v-if="canWrite">Chưa có chuyên mục nào.<br />Bấm "Thêm chuyên mục" để tạo mới.</span>
          <span v-else>Chưa có chuyên mục nào.</span>
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
        <div v-if="canWrite && (isCreating || editingId)" class="flex min-h-0 flex-1 flex-col">
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
                  Nằm trong chuyên mục
                  <span v-if="mustPickParent" style="color: var(--mds-danger)">*</span>
                </label>
                <MSelect
                  v-model="form.parentId"
                  :options="parentOptions"
                  :disabled="noParentAvailable"
                  :placeholder="
                    mustPickParent
                      ? 'Chọn chuyên mục lớn để đặt vào trong'
                      : 'Để trống — tạo một chuyên mục lớn mới'
                  "
                />
                <p class="mt-1 text-[12px]" style="color: var(--mds-text-secondary)">
                  <span v-if="canWriteRoot">
                    Để trống ô này sẽ tạo một <strong>chuyên mục lớn</strong> đứng riêng ở ngoài
                    cùng. Chọn một chuyên mục có sẵn thì mục mới nằm gọn bên trong nó.
                  </span>
                  <span v-else>
                    Mục mới sẽ nằm bên trong chuyên mục bạn chọn. Chỉ Quản trị cao nhất mới tạo
                    được chuyên mục lớn đứng riêng ở ngoài cùng.
                  </span>
                </p>
                <p
                  v-if="noParentAvailable"
                  class="mt-2 rounded-lg p-3 text-[12px]"
                  style="background: color-mix(in srgb, var(--mds-warning) 10%, white); color: var(--mds-text-primary)"
                >
                  Hệ thống chưa có chuyên mục lớn nào để đặt mục mới vào trong, nên bạn chưa tạo
                  được chuyên mục. Hãy đề nghị Quản trị cao nhất tạo chuyên mục lớn trước.
                </p>
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
          <footer class="flex shrink-0 items-center justify-between gap-3 border-t px-5 py-3" style="border-color: var(--mds-border-light,#E9EAEB)">
            <MButton
              v-if="!isCreating && canWriteSelected"
              variant="danger"
              :disabled="submitting"
              @click="askDelete"
            >
              <template #icon><MIcon name="trash" :size="16" /></template>
              Xoá
            </MButton>
            <!-- Chuyên mục gốc, người xem không đủ quyền: nói rõ lý do thay vì footer trống trơn -->
            <span
              v-else-if="!isCreating"
              class="text-[12px]"
              style="color: var(--mds-text-secondary)"
            >
              Đây là chuyên mục lớn — chỉ Quản trị cao nhất được sửa hoặc xoá.
            </span>
            <span v-else />
            <MButton
              v-if="isCreating || canWriteSelected"
              variant="primary"
              :loading="submitting"
              :disabled="noParentAvailable"
              @click="save"
            >
              Lưu
            </MButton>
          </footer>
        </div>

        <MEmptyState
          v-else
          type="initial"
          title="Chọn một chuyên mục để xem chi tiết"
          :description="canWrite ? 'Hoặc bấm \'Thêm chuyên mục\' để tạo mới' : 'Bạn chỉ có quyền xem danh sách chuyên mục'"
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
