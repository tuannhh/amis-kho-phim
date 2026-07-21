<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MButton from '@/components/mds/MButton.vue'
import MInput from '@/components/mds/MInput.vue'
import MSelect from '@/components/mds/MSelect.vue'
import MTextarea from '@/components/mds/MTextarea.vue'
import MCombobox from '@/components/mds/MCombobox.vue'
import MUpload from '@/components/mds/MUpload.vue'
import MDialog from '@/components/mds/MDialog.vue'
import MIcon from '@/components/mds/MIcon.vue'
import { useToast } from '@/components/mds/toast.js'
import { useFormValidation, rules } from '@/components/mds/useFormValidation.js'
import { useFilmsStore } from '@/features/films/filmsStore'
import { filmsApi, type UpsertFilmPayload } from '@/features/films/filmsApi'
import { categoriesApi, flattenCategoryTree, type ApiCategoryNode } from '@/features/categories/categoriesApi'

/**
 * Thêm/Sửa phim — GĐ2 (API thật cho metadata + link ngoài). Upload file
 * storage/thumbnail thật (MinIO) là GĐ3 — ở đây chỉ xem trước trong phiên
 * làm việc (không gửi lên server), có ghi chú rõ cho người dùng.
 */
const toast = useToast()
const route = useRoute()
const router = useRouter()
const store = useFilmsStore()

const categoriesTree = ref<ApiCategoryNode[]>([])
onMounted(async () => {
  await Promise.all([store.load(), categoriesApi.tree().then((t) => (categoriesTree.value = t))])
  loadEditingFilm()
})

const editingSlug = computed(() => (route.query.edit as string) || '')
const editingFilm = computed(() => store.films.find((f) => f.slug === editingSlug.value))
const isEditMode = computed(() => !!editingFilm.value)

const categoryOptions = computed(() =>
  flattenCategoryTree(categoriesTree.value).map((c) => ({ label: c.name, value: c.id })),
)
const hashtagOptions = computed(() => {
  const set = new Set(store.films.flatMap((f) => f.hashtags))
  return Array.from(set).map((h) => ({ label: `#${h}`, value: h }))
})

const form = reactive({
  title: '',
  // undefined (không phải null) — MSelect không nhận null trong kiểu modelValue
  categoryId: undefined as number | undefined,
  description: '',
  hashtags: [] as string[],
  youtube: '',
  vimeo: '',
  gdrive: '',
  misadrive: '',
})

const videoFile = ref<File | null>(null)
const videoFileMeta = ref<Array<{ id: string; name: string; size: number; status: 'done' }>>([])
const thumbnailUrl = ref<string>('')
const thumbnailMeta = ref<Array<{ id: string; name: string; size: number; status: 'done' }>>([])

function loadEditingFilm() {
  const f = editingFilm.value
  if (!f) return
  form.title = f.title
  form.categoryId = f.categoryId ?? undefined
  form.description = f.description || ''
  form.hashtags = [...f.hashtags]
  form.youtube = f.links.youtube || ''
  form.vimeo = f.links.vimeo || ''
  form.gdrive = f.links.gdrive || ''
  form.misadrive = f.links.misadrive || ''
}

const { errors, validate } = useFormValidation({
  title: [rules.required('Tên phim không được để trống')],
  categoryId: [rules.required('Vui lòng chọn chuyên mục')],
}) as {
  errors: Record<string, string>
  validate: (values: Record<string, unknown>) => boolean
}

function onSelectVideo(files: File[]) {
  const file = files[0]
  if (!file) return
  videoFile.value = file
  videoFileMeta.value = [{ id: 'video', name: file.name, size: file.size, status: 'done' }]
}
function onRemoveVideo() {
  videoFile.value = null
  videoFileMeta.value = []
}

function onSelectThumbnail(files: File[]) {
  const file = files[0]
  if (!file) return
  if (thumbnailUrl.value) URL.revokeObjectURL(thumbnailUrl.value)
  thumbnailUrl.value = URL.createObjectURL(file)
  thumbnailMeta.value = [{ id: 'thumb', name: file.name, size: file.size, status: 'done' }]
}
function onRemoveThumbnail() {
  if (thumbnailUrl.value) URL.revokeObjectURL(thumbnailUrl.value)
  thumbnailUrl.value = ''
  thumbnailMeta.value = []
}

// Phát hiện trùng tiêu đề (bỏ qua chính phim đang sửa)
const duplicateFilm = computed(() => {
  const t = form.title.trim().toLowerCase()
  if (!t) return null
  return store.films.find((f) => f.title.trim().toLowerCase() === t && f.slug !== editingSlug.value)
})

const confirmDialogOpen = ref(false)
const submitting = ref(false)

function hasAtLeastOneSource(): boolean {
  return !!(form.youtube.trim() || form.vimeo.trim() || form.gdrive.trim() || form.misadrive.trim())
}

function buildPayload(): UpsertFilmPayload {
  return {
    title: form.title.trim(),
    categoryId: form.categoryId!,
    description: form.description.trim() || undefined,
    hashtags: form.hashtags,
    youtubeUrl: form.youtube.trim() || undefined,
    vimeoUrl: form.vimeo.trim() || undefined,
    gdriveUrl: form.gdrive.trim() || undefined,
    misadriveUrl: form.misadrive.trim() || undefined,
  }
}

async function publish() {
  if (!validate(form)) return

  if (!hasAtLeastOneSource()) {
    toast.error('Cần nhập ít nhất một link ngoài (YouTube/Vimeo/Google Drive/MISA Drive)')
    return
  }

  if (isEditMode.value && editingFilm.value) {
    await saveUpdate(editingFilm.value.id, `Đã cập nhật phim "${form.title}"`)
    return
  }

  if (duplicateFilm.value) {
    confirmDialogOpen.value = true
    return
  }

  await createNewFilm()
}

async function createNewFilm() {
  submitting.value = true
  try {
    const created = await filmsApi.create(buildPayload())
    toast.success(`Đã xuất bản phim mới "${created.title}"`)
    await store.load()
    router.push({ name: 'film-detail', params: { slug: created.slug } })
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'Xuất bản phim không thành công')
  } finally {
    submitting.value = false
  }
}

async function saveUpdate(id: number, successMessage: string) {
  submitting.value = true
  try {
    const updated = await filmsApi.update(id, buildPayload())
    toast.success(successMessage)
    await store.load()
    router.push({ name: 'film-detail', params: { slug: updated.slug } })
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'Lưu phim không thành công')
  } finally {
    submitting.value = false
  }
}

async function confirmUpdateVersion() {
  if (!duplicateFilm.value) return
  confirmDialogOpen.value = false
  await saveUpdate(duplicateFilm.value.id, `Đã cập nhật bản mới cho "${duplicateFilm.value.title}", gắn tag Phim mới`)
}

function cancel() {
  router.push({ name: 'films' })
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <!-- Header trắng đơn giản -->
    <header class="flex h-14 shrink-0 items-center gap-2 bg-white px-4">
      <button
        type="button"
        class="flex h-8 w-8 items-center justify-center rounded-lg hover:opacity-80"
        style="color: var(--mds-icon-neutral)"
        aria-label="Quay lại"
        @click="cancel"
      >
        <MIcon name="chevron-left" :size="20" />
      </button>
      <h1 class="text-[16px] font-semibold" style="color: var(--mds-text-primary)">
        {{ isEditMode ? 'Sửa thông tin phim' : 'Thêm phim' }}
      </h1>
    </header>

    <!-- Body cuộn được -->
    <main class="min-h-0 flex-1 overflow-y-auto">
      <div class="mx-auto w-full max-w-3xl px-4 py-6">
        <!-- Cảnh báo trùng tiêu đề -->
        <div
          v-if="duplicateFilm && !isEditMode"
          class="mb-4 flex items-start gap-3 rounded-lg p-4"
          style="background: color-mix(in srgb, var(--mds-warning) 10%, white); border: 1px solid color-mix(in srgb, var(--mds-warning) 40%, white)"
        >
          <MIcon name="alert-triangle" :size="20" style="color: var(--mds-warning)" />
          <div class="text-[13px]" style="color: var(--mds-text-primary)">
            <p class="font-medium">Đã có phim trùng tiêu đề "{{ duplicateFilm.title }}"</p>
            <p style="color: var(--mds-text-secondary)">
              Tải lên bởi {{ duplicateFilm.uploaderName }}. Khi bấm "Xuất bản", bạn sẽ được hỏi có
              muốn cập nhật thành bản mới của phim này không.
            </p>
          </div>
        </div>

        <div
          class="rounded-lg bg-white p-6"
          style="box-shadow: var(--mds-shadow-card, 0 0 2px 0 rgba(0,0,0,0.1))"
        >
          <h3 class="mb-4 text-[16px] font-semibold" style="color: var(--mds-text-primary)">
            Thông tin phim
          </h3>

          <div class="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            <div class="sm:col-span-2" data-field="title">
              <label class="mb-1 block text-[13px] font-medium" style="color: var(--mds-text-primary)">
                Tên phim <span style="color: var(--mds-danger)">*</span>
              </label>
              <MInput v-model="form.title" placeholder="Nhập tên phim" :error="errors.title" />
            </div>

            <div data-field="categoryId">
              <label class="mb-1 block text-[13px] font-medium" style="color: var(--mds-text-primary)">
                Chuyên mục <span style="color: var(--mds-danger)">*</span>
              </label>
              <MSelect v-model="form.categoryId" :options="categoryOptions" placeholder="Chọn chuyên mục" :error="errors.categoryId" />
            </div>

            <div>
              <label class="mb-1 block text-[13px] font-medium" style="color: var(--mds-text-primary)">
                Hashtag
              </label>
              <MCombobox
                v-model="form.hashtags"
                :options="hashtagOptions"
                multiple
                allow-create
                placeholder="Chọn hoặc thêm hashtag mới"
              />
            </div>

            <div class="sm:col-span-2">
              <label class="mb-1 block text-[13px] font-medium" style="color: var(--mds-text-primary)">
                Mô tả
              </label>
              <MTextarea v-model="form.description" :rows="4" :maxlength="1000" placeholder="Mô tả nội dung phim" />
            </div>
          </div>
        </div>

        <!-- Tệp & liên kết -->
        <div
          class="mt-4 rounded-lg bg-white p-6"
          style="box-shadow: var(--mds-shadow-card, 0 0 2px 0 rgba(0,0,0,0.1))"
        >
          <h3 class="mb-4 text-[16px] font-semibold" style="color: var(--mds-text-primary)">
            Tệp phim &amp; liên kết ngoài
          </h3>

          <div class="flex flex-col gap-5">
            <div>
              <MUpload
                label="Tải phim lên storage nội bộ"
                accept="video/*"
                :multiple="false"
                :maxSizeMB="2048"
                :model-value="videoFileMeta"
                @select-files="onSelectVideo"
                @remove="onRemoveVideo"
              />
              <p class="mt-1 text-[12px]" style="color: var(--mds-text-secondary)">
                Lưu trữ nội bộ thật (MinIO) sẽ có ở giai đoạn tiếp theo — hiện tại vui lòng dùng ít
                nhất một link ngoài bên dưới để phim hiển thị được.
              </p>
            </div>

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label class="mb-1 flex items-center gap-1.5 text-[13px] font-medium" style="color: var(--mds-text-primary)">
                  <MIcon name="external-link" :size="16" /> Link YouTube
                </label>
                <MInput v-model="form.youtube" placeholder="https://youtube.com/watch?v=..." />
              </div>
              <div>
                <label class="mb-1 flex items-center gap-1.5 text-[13px] font-medium" style="color: var(--mds-text-primary)">
                  <MIcon name="external-link" :size="16" /> Link Vimeo
                </label>
                <MInput v-model="form.vimeo" placeholder="https://vimeo.com/..." />
              </div>
              <div>
                <label class="mb-1 flex items-center gap-1.5 text-[13px] font-medium" style="color: var(--mds-text-primary)">
                  <MIcon name="external-link" :size="16" /> Link Google Drive
                </label>
                <MInput v-model="form.gdrive" placeholder="https://drive.google.com/..." />
              </div>
              <div>
                <label class="mb-1 flex items-center gap-1.5 text-[13px] font-medium" style="color: var(--mds-text-primary)">
                  <MIcon name="external-link" :size="16" /> Link MISA Drive
                </label>
                <MInput v-model="form.misadrive" placeholder="https://drive.misa.vn/..." />
              </div>
            </div>
          </div>
        </div>

        <!-- Thumbnail 16:9 -->
        <div
          class="mt-4 rounded-lg bg-white p-6"
          style="box-shadow: var(--mds-shadow-card, 0 0 2px 0 rgba(0,0,0,0.1))"
        >
          <h3 class="mb-4 text-[16px] font-semibold" style="color: var(--mds-text-primary)">
            Ảnh bìa (thumbnail 16:9)
          </h3>

          <div class="flex flex-col gap-3 sm:flex-row sm:items-start">
            <div
              class="aspect-video w-full max-w-[280px] shrink-0 overflow-hidden rounded-lg"
              style="background: var(--mds-bg-disabled); border: 1px solid var(--mds-border,#CED1D6)"
            >
              <img v-if="thumbnailUrl" :src="thumbnailUrl" class="h-full w-full object-cover" alt="Xem trước ảnh bìa" />
              <div v-else class="flex h-full w-full flex-col items-center justify-center gap-1" style="color: var(--mds-text-placeholder)">
                <MIcon name="photo" :size="28" />
                <span class="text-[12px]">Chưa có ảnh bìa</span>
              </div>
            </div>

            <div class="flex-1">
              <MUpload
                label="Tải ảnh bìa"
                accept="image/*"
                :multiple="false"
                :maxSizeMB="10"
                :model-value="thumbnailMeta"
                @select-files="onSelectThumbnail"
                @remove="onRemoveThumbnail"
              />
              <p class="mt-1 text-[12px]" style="color: var(--mds-text-secondary)">
                Chỉ xem trước trong phiên làm việc này — chưa lưu lên server (đến ở giai đoạn Storage
                &amp; Thumbnail). Kho phim hiện dùng ảnh gradient theo chuyên mục.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Footer sticky: Hủy trái, Lưu/Xuất bản phải (Primary ngoài cùng) -->
    <footer class="flex shrink-0 items-center justify-between bg-white px-4 py-3">
      <MButton variant="secondary" :disabled="submitting" @click="cancel">Hủy</MButton>
      <MButton variant="primary" :loading="submitting" @click="publish">
        {{ isEditMode ? 'Lưu thay đổi' : 'Xuất bản' }}
      </MButton>
    </footer>

    <!-- Xác nhận cập nhật bản mới khi trùng tiêu đề -->
    <MDialog v-model="confirmDialogOpen" title="Phim đã tồn tại" type="confirm" :width="480">
      <p class="text-[13px]" style="color: var(--mds-text-primary)">
        Đã có phim <strong>"{{ duplicateFilm?.title }}"</strong> trong kho. Bạn có muốn cập nhật
        thành <strong>bản mới</strong> của phim này không? Phim sẽ được gắn lại tag
        <strong>Phim mới</strong>.
      </p>
      <template #footer>
        <MButton variant="secondary" @click="confirmDialogOpen = false">Hủy</MButton>
        <MButton variant="primary" @click="confirmUpdateVersion">Cập nhật bản mới</MButton>
      </template>
    </MDialog>
  </div>
</template>
