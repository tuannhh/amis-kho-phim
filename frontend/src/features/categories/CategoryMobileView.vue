<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import MButton from '@/components/mds/MButton.vue'
import MInput from '@/components/mds/MInput.vue'
import MTextarea from '@/components/mds/MTextarea.vue'
import MSelect from '@/components/mds/MSelect.vue'
import MIcon from '@/components/mds/MIcon.vue'
import MEmptyState from '@/components/mds/MEmptyState.vue'
import MDialog from '@/components/mds/MDialog.vue'
import MDrawer from '@/components/mds/MDrawer.vue'
import MSpinner from '@/components/mds/MSpinner.vue'
import MobileHeroHeader from '@/components/mobile/MobileHeroHeader.vue'
import { useToast } from '@/components/mds/toast.js'
import { useFormValidation, rules } from '@/components/mds/useFormValidation.js'
import { categoriesApi, categoryOptions, type ApiCategoryNode } from './categoriesApi'
import { useAuthStore } from '@/features/auth/authStore'
import { canCreateAnyCategory, canWriteCategory, isSystemAdmin } from '@/features/auth/permissions'

/**
 * Chuyên mục — BẢN MOBILE (Compact <600px, GĐ8-C).
 *
 * VÌ SAO CÓ FILE NÀY: `CategoryView.vue` là master-detail 2 cột (cây 320px cố định bên trái,
 * form chi tiết bên phải). Ở 390px, cột trái đã chiếm 320px nên cột phải chỉ còn vài chục
 * pixel — chữ trong đó xuống dòng từng ký tự một, kèm thanh cuộn riêng. Đây không phải thứ
 * sửa được bằng vài class responsive: bố cục "hai vùng cạnh nhau" không có chỗ trên điện
 * thoại. Bản mobile bỏ hẳn cột chi tiết, thay bằng:
 *   - MỘT danh sách cây dọc, cha có chevron mở/thu (accordion), con thụt lề.
 *   - Bấm một chuyên mục → mở BOTTOM SHEET sửa (mobile-pwa.md §4.5: form ngắn dùng bottom
 *     sheet) thay vì panel chi tiết đứng cố định bên cạnh.
 *   - Nút "Thêm chuyên mục" giữ nguyên góc trên phải, nằm trong hero header.
 *
 * NGHIỆP VỤ KHÔNG ĐỔI so với desktop — cùng `categoriesApi`, cùng bộ quy tắc quyền theo tầng
 * (ADR-051) qua đúng ba helper `canCreateAnyCategory` / `isSystemAdmin` / `canWriteCategory`:
 * chuyên mục GỐC chỉ Cấp 4 tạo/sửa/xoá được, chuyên mục CON từ Cấp 2 trở lên. Không có bản
 * sao quy tắc riêng cho mobile.
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
    // Mở sẵn mọi nhánh có con: danh sách chuyên mục của kho phim chỉ vài chục dòng, bắt người
    // dùng bấm mở từng nhánh mới thấy nội dung là thêm việc chứ không gọn hơn.
    expanded.value = flatten().filter((n) => n.children?.length).map((n) => n.id)
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'Không tải được chuyên mục')
  } finally {
    loading.value = false
  }
}
onMounted(loadTree)

function flatten(nodes: ApiCategoryNode[] = tree.value): ApiCategoryNode[] {
  return nodes.flatMap((n) => [n, ...(n.children ? flatten(n.children) : [])])
}

const expanded = ref<number[]>([])
function toggleExpand(id: number) {
  const i = expanded.value.indexOf(id)
  if (i >= 0) expanded.value.splice(i, 1)
  else expanded.value.push(id)
}

/** Cây → danh sách dòng phẳng theo trạng thái mở/thu, kèm `depth` để thụt lề. */
interface Row {
  node: ApiCategoryNode
  depth: number
  hasChildren: boolean
}
const rows = computed<Row[]>(() => {
  const out: Row[] = []
  const walk = (list: ApiCategoryNode[], depth: number) => {
    for (const node of list) {
      const hasChildren = !!node.children?.length
      out.push({ node, depth, hasChildren })
      if (hasChildren && expanded.value.includes(node.id)) walk(node.children!, depth + 1)
    }
  }
  walk(tree.value, 0)
  return out
})

/** Dropdown cha giữ thứ tự cây + thụt lề (dùng chung helper với desktop). */
const parentOptions = computed(() => categoryOptions(tree.value))
const noParentAvailable = computed(() => mustPickParent.value && parentOptions.value.length === 0)

/* ── Bottom sheet thêm/sửa ─────────────────────────────────────────────── */

const sheetOpen = ref(false)
const isCreating = ref(false)
const editingId = ref<number | null>(null)
const submitting = ref(false)
const form = reactive({ name: '', description: '', parentId: undefined as number | undefined })

const { errors, validate, clearErrors } = useFormValidation({
  name: [rules.required('Tên chuyên mục không được để trống')],
}) as {
  errors: Record<string, string>
  validate: (values: Record<string, unknown>) => boolean
  clearErrors: () => void
}

/** Chuyên mục đang sửa có phải gốc không → quyết định được sửa/xoá hay không. */
const editingIsRoot = computed(() => {
  const node = flatten().find((c) => c.id === editingId.value)
  return node ? node.parentId == null : false
})
const canWriteSelected = computed(() => canWriteCategory(auth.role, editingIsRoot.value))

function resetForm() {
  form.name = ''
  form.description = ''
  form.parentId = undefined
  clearErrors()
}

function startCreate() {
  isCreating.value = true
  editingId.value = null
  resetForm()
  sheetOpen.value = true
}

function openNode(node: ApiCategoryNode) {
  isCreating.value = false
  editingId.value = node.id
  form.name = node.name
  form.description = node.description || ''
  form.parentId = node.parentId ?? undefined
  clearErrors()
  sheetOpen.value = true
}

function closeSheet() {
  sheetOpen.value = false
  editingId.value = null
  isCreating.value = false
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
    } else if (editingId.value) {
      const updated = await categoriesApi.update(editingId.value, {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
      })
      toast.success(`Đã cập nhật chuyên mục "${updated.name}"`)
      await loadTree()
    }
    closeSheet()
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'Lưu chuyên mục không thành công')
  } finally {
    submitting.value = false
  }
}

/* ── Xoá ───────────────────────────────────────────────────────────────── */

const deleteTarget = ref<ApiCategoryNode | null>(null)
function askDelete() {
  const node = flatten().find((c) => c.id === editingId.value)
  if (node) deleteTarget.value = node
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  try {
    await categoriesApi.remove(deleteTarget.value.id)
    toast.success(`Đã xoá chuyên mục "${deleteTarget.value.name}"`)
    deleteTarget.value = null
    closeSheet()
    await loadTree()
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'Xoá chuyên mục không thành công')
  }
}
</script>

<template>
  <section class="flex h-full flex-col overflow-hidden" style="background: var(--mds-bg-page, #ecedef)">
    <MobileHeroHeader title="Chuyên mục" :subtitle="`${flatten().length} chuyên mục`">
      <!-- Hành động chính giữ đúng góc trên phải như bản người dùng đã duyệt. Dùng <button>
           thẳng (không MButton) vì MButton ghim chiều cao 32px theo mật độ desktop — trên nền
           brand cần một viên thuốc trắng cao 44px cho vừa ngón tay. -->
      <template #actions>
        <button
          v-if="canWrite"
          type="button"
          class="-mr-1 flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-white px-3.5 text-[13.5px] font-semibold transition-transform active:scale-[0.97]"
          style="color: var(--mds-brand-700)"
          @click="startCreate"
        >
          <MIcon name="plus" :size="17" />
          Thêm
        </button>
      </template>
    </MobileHeroHeader>

    <div class="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-4">
      <div v-if="loading" class="flex items-center justify-center gap-2 py-10 text-[13px]" style="color: var(--mds-text-secondary)">
        <MSpinner :size="18" /> Đang tải...
      </div>

      <MEmptyState
        v-else-if="!rows.length"
        type="initial"
        title="Chưa có chuyên mục nào"
        :description="canWrite ? 'Bấm \'Thêm\' ở góc trên để tạo chuyên mục đầu tiên.' : 'Bạn chỉ có quyền xem danh sách chuyên mục.'"
      />

      <!-- Danh sách cây MỘT CỘT: chuyên mục gốc là thẻ trắng riêng, con thụt lề bên trong cùng
           thẻ. Không có vùng chi tiết đứng cạnh — chi tiết mở ở bottom sheet. -->
      <ul v-else class="flex flex-col gap-2">
        <li
          v-for="row in rows"
          :key="row.node.id"
          class="overflow-hidden rounded-xl bg-white"
          :style="{
            boxShadow: 'var(--mds-shadow-card, 0 0 2px 0 rgba(0,0,0,0.1))',
            marginLeft: `${row.depth * 16}px`,
          }"
        >
          <div class="flex items-stretch">
            <!-- Chevron là nút RIÊNG: mở/thu nhánh không được lẫn với mở form sửa. Node lá vẫn
                 chừa đúng chỗ đó để nhãn các dòng cùng cấp thẳng cột nhau. -->
            <button
              v-if="row.hasChildren"
              type="button"
              class="grid w-12 shrink-0 place-items-center"
              style="color: var(--mds-icon-neutral)"
              :aria-expanded="expanded.includes(row.node.id)"
              :aria-label="expanded.includes(row.node.id) ? `Thu gọn ${row.node.name}` : `Mở rộng ${row.node.name}`"
              @click="toggleExpand(row.node.id)"
            >
              <MIcon
                name="chevron-right"
                :size="18"
                class="transition-transform"
                :style="expanded.includes(row.node.id) ? { transform: 'rotate(90deg)' } : undefined"
              />
            </button>
            <span v-else class="w-12 shrink-0" aria-hidden="true" />

            <button
              type="button"
              class="flex min-h-[56px] min-w-0 flex-1 items-center gap-2 py-2 pr-3 text-left active:bg-[var(--mds-bg-hover-soft,#f2f4f7)]"
              @click="openNode(row.node)"
            >
              <MIcon
                :name="row.depth === 0 ? 'folder' : 'file'"
                :size="18"
                class="shrink-0"
                :style="{ color: row.depth === 0 ? 'var(--mds-brand-600)' : 'var(--mds-icon-neutral)' }"
              />
              <span class="min-w-0 flex-1">
                <span
                  class="block truncate text-[14px]"
                  :style="{
                    color: 'var(--mds-text-primary)',
                    fontWeight: row.depth === 0 ? 600 : 400,
                  }"
                >
                  {{ row.node.name }}
                </span>
                <span
                  v-if="row.node.description"
                  class="mt-0.5 block truncate text-[12px]"
                  style="color: var(--mds-text-secondary)"
                >
                  {{ row.node.description }}
                </span>
              </span>
              <MIcon name="chevron-right" :size="16" class="shrink-0" style="color: var(--mds-text-placeholder)" />
            </button>
          </div>
        </li>
      </ul>
    </div>

    <!-- Bottom sheet thêm/sửa -->
    <MDrawer
      :model-value="sheetOpen"
      position="bottom"
      :title="isCreating ? 'Thêm chuyên mục' : 'Sửa chuyên mục'"
      @update:model-value="(v: boolean) => !v && closeSheet()"
    >
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
              mustPickParent ? 'Chọn chuyên mục lớn để đặt vào trong' : 'Để trống — tạo một chuyên mục lớn mới'
            "
          />
          <p class="mt-1 text-[12px]" style="color: var(--mds-text-secondary)">
            <span v-if="canWriteRoot">
              Để trống ô này sẽ tạo một <strong>chuyên mục lớn</strong> đứng riêng ở ngoài cùng.
            </span>
            <span v-else>
              Mục mới sẽ nằm bên trong chuyên mục bạn chọn. Chỉ Quản trị cao nhất mới tạo được
              chuyên mục lớn đứng riêng ở ngoài cùng.
            </span>
          </p>
          <p
            v-if="noParentAvailable"
            class="mt-2 rounded-lg p-3 text-[12px]"
            style="background: color-mix(in srgb, var(--mds-warning) 10%, white); color: var(--mds-text-primary)"
          >
            Hệ thống chưa có chuyên mục lớn nào để đặt mục mới vào trong, nên bạn chưa tạo được
            chuyên mục. Hãy đề nghị Quản trị cao nhất tạo chuyên mục lớn trước.
          </p>
        </div>

        <div>
          <label class="mb-1 block text-[13px] font-medium" style="color: var(--mds-text-primary)">Mô tả</label>
          <MTextarea v-model="form.description" :rows="3" :maxlength="500" placeholder="Mô tả chuyên mục" />
        </div>

        <!-- Chuyên mục gốc + người xem không đủ quyền: nói rõ lý do thay vì im lặng ẩn nút -->
        <p
          v-if="!isCreating && !canWriteSelected"
          class="rounded-lg p-3 text-[12px]"
          style="background: var(--mds-bg-hover-soft, #f2f4f7); color: var(--mds-text-secondary)"
        >
          Đây là chuyên mục lớn — chỉ Quản trị cao nhất được sửa hoặc xoá.
        </p>
      </div>

      <template #footer>
        <div class="flex w-full items-center justify-between gap-2">
          <MButton
            v-if="!isCreating && canWriteSelected"
            variant="danger"
            :disabled="submitting"
            @click="askDelete"
          >
            <template #icon><MIcon name="trash" :size="16" /></template>
            Xoá
          </MButton>
          <span v-else />
          <div class="flex items-center gap-2">
            <MButton variant="secondary" :disabled="submitting" @click="closeSheet">Hủy</MButton>
            <MButton
              v-if="isCreating || canWriteSelected"
              variant="primary"
              :loading="submitting"
              :disabled="noParentAvailable"
              @click="save"
            >
              Lưu
            </MButton>
          </div>
        </div>
      </template>
    </MDrawer>

    <MDialog
      :model-value="!!deleteTarget"
      title="Xoá chuyên mục"
      type="danger"
      :width="440"
      @update:model-value="deleteTarget = null"
    >
      <p class="text-[13px]" style="color: var(--mds-text-primary)">
        Bạn có chắc muốn xoá chuyên mục <strong>"{{ deleteTarget?.name }}"</strong>? Chuyên mục con
        (nếu có) sẽ bị xoá theo; phim thuộc chuyên mục này chỉ mất liên kết, không bị xoá.
      </p>
      <template #footer>
        <MButton variant="secondary" @click="deleteTarget = null">Hủy</MButton>
        <MButton variant="danger" @click="confirmDelete">Xoá</MButton>
      </template>
    </MDialog>
  </section>
</template>
