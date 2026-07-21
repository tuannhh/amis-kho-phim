<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
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
import {
  mockFilms,
  toSlug,
  listCategories,
  listHashtags,
  colorForCategory,
  CURRENT_MOCK_USER,
  type FilmSource,
} from '@/features/films/mockFilms'

/**
 * Thêm/Sửa phim — GĐ 0.5 (mock, không backend thật):
 * - Upload file lên "storage nội bộ" + chèn link riêng cho từng nền tảng ngoài.
 * - Thumbnail 16:9.
 * - Phát hiện trùng tiêu đề → cảnh báo + hỏi cập nhật bản mới (MDialog).
 * GĐ 3 gắn upload MinIO thật; GĐ 2 gắn API films/categories thật.
 */
const toast = useToast()
const route = useRoute()
const router = useRouter()

// Sửa phim: /upload?edit=<slug>
const editingSlug = computed(() => (route.query.edit as string) || '')
const editingFilm = computed(() => mockFilms.find((f) => f.slug === editingSlug.value))
const isEditMode = computed(() => !!editingFilm.value)

const categoryOptions = computed(() => listCategories().map((c) => ({ label: c, value: c })))
const hashtagOptions = computed(() => listHashtags().map((h) => ({ label: `#${h}`, value: h })))

const form = reactive({
  title: '',
  category: null as string | null,
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
  form.category = f.category
  form.description = f.description
  form.hashtags = [...f.hashtags]
  form.youtube = f.links.youtube || ''
  form.vimeo = f.links.vimeo || ''
  form.gdrive = f.links.gdrive || ''
  form.misadrive = f.links.misadrive || ''
  thumbnailUrl.value = f.thumbnailUrl || ''
}
loadEditingFilm()

const { errors, validate } = useFormValidation({
  title: [rules.required('Tên phim không được để trống')],
  category: [rules.required('Vui lòng chọn chuyên mục')],
})

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
  return mockFilms.find(
    (f) => f.title.trim().toLowerCase() === t && f.slug !== editingSlug.value
  )
})

const confirmDialogOpen = ref(false)

function collectLinks(): Partial<Record<FilmSource, string>> {
  const links: Partial<Record<FilmSource, string>> = {}
  if (videoFile.value || (isEditMode.value && editingFilm.value?.links.storage)) {
    links.storage = editingFilm.value?.links.storage || 'blob:mock-storage-upload'
  }
  if (form.youtube.trim()) links.youtube = form.youtube.trim()
  if (form.vimeo.trim()) links.vimeo = form.vimeo.trim()
  if (form.gdrive.trim()) links.gdrive = form.gdrive.trim()
  if (form.misadrive.trim()) links.misadrive = form.misadrive.trim()
  return links
}

function today() {
  return new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function applyUpdateToFilm(target: (typeof mockFilms)[number]) {
  target.title = form.title.trim()
  target.category = form.category!
  target.categoryColor = colorForCategory(form.category!, listCategories())
  target.description = form.description.trim()
  target.hashtags = [...form.hashtags]
  target.links = { ...target.links, ...collectLinks() }
  target.sources = Object.keys(target.links) as FilmSource[]
  if (thumbnailUrl.value) target.thumbnailUrl = thumbnailUrl.value
  // publishedAt = hôm nay → tự động được tính là "Phim mới" (isFilmNew), không cần cờ riêng
  target.publishedAt = today()
}

function hasAtLeastOneSource() {
  const editingHasStorage = isEditMode.value && !!editingFilm.value?.links.storage
  return !!videoFile.value || editingHasStorage || Object.keys(collectLinks()).length > 0
}

function publish() {
  if (!validate(form)) return

  if (!hasAtLeastOneSource()) {
    toast.error('Cần tải phim lên storage nội bộ hoặc nhập ít nhất một link ngoài')
    return
  }

  // Sửa phim đang có sẵn (không phải do trùng tiêu đề phát hiện lúc gõ)
  if (isEditMode.value && editingFilm.value) {
    applyUpdateToFilm(editingFilm.value)
    toast.success(`Đã cập nhật phim "${form.title}"`)
    router.push({ name: 'film-detail', params: { slug: editingFilm.value.slug } })
    return
  }

  // Phát hiện trùng tiêu đề khi tạo mới → hỏi xác nhận trước khi ghi đè bản mới
  if (duplicateFilm.value) {
    confirmDialogOpen.value = true
    return
  }

  createNewFilm()
}

function createNewFilm() {
  const slug = toSlug(form.title) || `phim-${Date.now()}`
  const newFilm = {
    id: Math.max(0, ...mockFilms.map((f) => f.id)) + 1,
    slug,
    title: form.title.trim(),
    description: form.description.trim(),
    category: form.category!,
    categoryColor: colorForCategory(form.category!, listCategories()),
    duration: videoFile.value ? '--:--' : '00:00',
    viewCount: 0,
    hashtags: [...form.hashtags],
    sources: Object.keys(collectLinks()) as FilmSource[],
    links: collectLinks(),
    uploader: CURRENT_MOCK_USER.name,
    uploaderId: CURRENT_MOCK_USER.id,
    publishedAt: today(),
    thumbnailFrom: '#245FDF',
    thumbnailTo: '#68A6F2',
    thumbnailUrl: thumbnailUrl.value || undefined,
  }
  mockFilms.push(newFilm)
  toast.success(`Đã xuất bản phim mới "${newFilm.title}"`)
  router.push({ name: 'film-detail', params: { slug } })
}

function confirmUpdateVersion() {
  if (!duplicateFilm.value) return
  applyUpdateToFilm(duplicateFilm.value)
  confirmDialogOpen.value = false
  toast.success(`Đã cập nhật bản mới cho "${duplicateFilm.value.title}", gắn tag Phim mới`)
  router.push({ name: 'film-detail', params: { slug: duplicateFilm.value.slug } })
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
              Tải lên bởi {{ duplicateFilm.uploader }} ngày {{ duplicateFilm.publishedAt }}. Khi bấm
              "Xuất bản", bạn sẽ được hỏi có muốn cập nhật thành bản mới của phim này không.
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

            <div data-field="category">
              <label class="mb-1 block text-[13px] font-medium" style="color: var(--mds-text-primary)">
                Chuyên mục <span style="color: var(--mds-danger)">*</span>
              </label>
              <MSelect v-model="form.category" :options="categoryOptions" placeholder="Chọn chuyên mục" :error="errors.category" />
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
            <MUpload
              label="Tải phim lên storage nội bộ"
              accept="video/*"
              :multiple="false"
              :maxSizeMB="2048"
              :model-value="videoFileMeta"
              @select-files="onSelectVideo"
              @remove="onRemoveVideo"
            />

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

            <MUpload
              label="Tải ảnh bìa"
              accept="image/*"
              :multiple="false"
              :maxSizeMB="10"
              :model-value="thumbnailMeta"
              @select-files="onSelectThumbnail"
              @remove="onRemoveThumbnail"
            />
          </div>
        </div>
      </div>
    </main>

    <!-- Footer sticky: Hủy trái, Lưu/Xuất bản phải (Primary ngoài cùng) -->
    <footer class="flex shrink-0 items-center justify-between bg-white px-4 py-3">
      <MButton variant="secondary" @click="cancel">Hủy</MButton>
      <MButton variant="primary" @click="publish">
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
