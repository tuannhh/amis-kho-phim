<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import MButton from '@/components/mds/MButton.vue'
import MInput from '@/components/mds/MInput.vue'
import MSelect from '@/components/mds/MSelect.vue'
import MTextarea from '@/components/mds/MTextarea.vue'
import HashtagInput from '@/components/HashtagInput.vue'
import MUpload from '@/components/mds/MUpload.vue'
import MDialog from '@/components/mds/MDialog.vue'
import MIcon from '@/components/mds/MIcon.vue'
import { useToast } from '@/components/mds/toast.js'
import { useFormValidation, rules } from '@/components/mds/useFormValidation.js'
import { useFilmsStore } from '@/features/films/filmsStore'
import { filmsApi, type UpsertFilmPayload, type ConfirmVersionPayload } from '@/features/films/filmsApi'
import { putToStorage, readVideoDuration, formatDuration } from '@/features/films/storageUpload'
import { categoriesApi, flattenCategoryTree, type ApiCategoryNode } from '@/features/categories/categoriesApi'
import { useAuthStore } from '@/features/auth/authStore'
import { buildDraftKey, purgeLegacyDrafts } from './draftKey'

/**
 * Thêm/Sửa phim — GĐ3 (API thật, storage MinIO thật). Luồng upload:
 * lưu metadata → xin presigned URL → upload video thẳng lên MinIO (progress) →
 * upload ảnh bìa 16:9 qua backend → xác nhận tạo bản mới (film_versions).
 */
const toast = useToast()
const route = useRoute()
const router = useRouter()
const store = useFilmsStore()
const auth = useAuthStore()

const categoriesTree = ref<ApiCategoryNode[]>([])
onMounted(async () => {
  // Dọn nháp ghi bằng định dạng cũ (không gắn userId) trước khi làm gì khác — không tài khoản
  // nào được phép khôi phục chúng (ADR-050).
  purgeLegacyDrafts(localStorage)
  await Promise.all([store.load(), categoriesApi.tree().then((t) => (categoriesTree.value = t))])
  loadEditingFilm()
  // Baseline để so sánh "có thay đổi chưa lưu" — lấy SAU khi đã nạp dữ liệu phim đang sửa
  // (hoặc rỗng nếu thêm mới), rồi mới khôi phục nháp (nếu có) đè lên baseline này.
  pristineSnapshot.value = JSON.stringify(snapshotFields())
  restoreDraftIfAny()
})

const editingSlug = computed(() => (route.query.edit as string) || '')
const editingFilm = computed(() => store.films.find((f) => f.slug === editingSlug.value))
const isEditMode = computed(() => !!editingFilm.value)

const categoryOptions = computed(() =>
  flattenCategoryTree(categoriesTree.value).map((c) => ({ label: c.name, value: c.id })),
)
// Hashtag đã có sẵn trong kho — đổ vào HashtagInput làm gợi ý bấm nhanh (tránh tạo trùng
// kiểu "MISA" / "misa" do gõ tay mỗi lúc một khác).
const hashtagSuggestions = computed(() =>
  Array.from(new Set(store.films.flatMap((f) => f.hashtags))),
)

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

type UploadStatus = 'done' | 'uploading' | 'error'
interface UploadMeta {
  id: string
  name: string
  size: number
  status: UploadStatus
  progress?: number
  errorMessage?: string
}

const videoFile = ref<File | null>(null)
const videoFileMeta = ref<UploadMeta[]>([])
const thumbnailFile = ref<File | null>(null)
const thumbnailUrl = ref<string>('')
const thumbnailMeta = ref<UploadMeta[]>([])
// Phim đang sửa đã có sẵn video/ảnh bìa trên storage hay chưa (để không bắt buộc chọn lại).
const hasExistingStorage = ref(false)

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
  hasExistingStorage.value = !!f.links.storage
  if (f.thumbnailUrl) thumbnailUrl.value = f.thumbnailUrl
}

const { errors, validate } = useFormValidation({
  title: [rules.required('Tên phim không được để trống')],
  categoryId: [rules.required('Vui lòng chọn chuyên mục')],
}) as {
  errors: Record<string, string>
  validate: (values: Record<string, unknown>) => boolean
}

const MAX_UPLOAD_MB = 2048
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-matroska']

function onSelectVideo(files: File[]) {
  const file = files[0]
  if (!file) return
  if (file.type && !ALLOWED_VIDEO_TYPES.includes(file.type)) {
    toast.error('Định dạng video không được hỗ trợ (mp4/webm/ogg/mov/mkv)')
    return
  }
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
    toast.error(`Tệp vượt giới hạn ${MAX_UPLOAD_MB}MB`)
    return
  }
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
  if (thumbnailUrl.value && thumbnailUrl.value.startsWith('blob:')) URL.revokeObjectURL(thumbnailUrl.value)
  thumbnailFile.value = file
  thumbnailUrl.value = URL.createObjectURL(file)
  thumbnailMeta.value = [{ id: 'thumb', name: file.name, size: file.size, status: 'done' }]
}
function onRemoveThumbnail() {
  if (thumbnailUrl.value && thumbnailUrl.value.startsWith('blob:')) URL.revokeObjectURL(thumbnailUrl.value)
  thumbnailFile.value = null
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
  return !!(
    videoFile.value ||
    hasExistingStorage.value ||
    form.youtube.trim() ||
    form.vimeo.trim() ||
    form.gdrive.trim() ||
    form.misadrive.trim()
  )
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
    toast.error('Cần ít nhất một nguồn: tải video lên hoặc nhập link ngoài (YouTube/Vimeo/Google Drive/MISA Drive)')
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

/**
 * Upload video (presigned PUT + progress) và/hoặc ảnh bìa (multipart), rồi xác
 * nhận tạo bản mới. Trả true nếu OK, false nếu có lỗi (đã hiện toast).
 */
async function uploadAssets(filmId: number): Promise<boolean> {
  const payload: ConfirmVersionPayload = {}
  let hasNewAsset = false

  // 1) Video → presigned PUT thẳng lên MinIO
  if (videoFile.value) {
    const file = videoFile.value
    const contentType = file.type || 'video/mp4'
    videoFileMeta.value = [{ id: 'video', name: file.name, size: file.size, status: 'uploading', progress: 0 }]
    try {
      const { uploadUrl, storageKey } = await filmsApi.createUploadUrl(filmId, contentType, file.size)
      await putToStorage(uploadUrl, file, contentType, (p) => {
        if (videoFileMeta.value[0]) videoFileMeta.value[0].progress = p
      })
      videoFileMeta.value[0].status = 'done'
      payload.storageKey = storageKey
      const secs = await readVideoDuration(file)
      if (secs != null) payload.duration = formatDuration(secs)
      hasNewAsset = true
    } catch (e: unknown) {
      videoFileMeta.value[0].status = 'error'
      videoFileMeta.value[0].errorMessage = e instanceof Error ? e.message : 'Tải phim lên không thành công'
      toast.error(videoFileMeta.value[0].errorMessage!)
      return false
    }
  }

  // 2) Ảnh bìa 16:9 → multipart qua backend (validate phía server)
  if (thumbnailFile.value) {
    thumbnailMeta.value = [
      { id: 'thumb', name: thumbnailFile.value.name, size: thumbnailFile.value.size, status: 'uploading', progress: 50 },
    ]
    try {
      const { thumbnailKey } = await filmsApi.uploadThumbnail(filmId, thumbnailFile.value)
      thumbnailMeta.value[0].status = 'done'
      payload.thumbnailKey = thumbnailKey
      hasNewAsset = true
    } catch (e: unknown) {
      thumbnailMeta.value[0].status = 'error'
      thumbnailMeta.value[0].errorMessage = e instanceof Error ? e.message : 'Tải ảnh bìa lên không thành công'
      toast.error(thumbnailMeta.value[0].errorMessage!)
      return false
    }
  }

  // 3) Xác nhận tạo bản mới (chỉ khi có asset mới)
  if (hasNewAsset) {
    await filmsApi.confirmVersion(filmId, payload)
  }
  return true
}

async function createNewFilm() {
  submitting.value = true
  try {
    const created = await filmsApi.create(buildPayload())
    const ok = await uploadAssets(created.id)
    if (!ok) {
      // Phim metadata đã tạo nhưng upload lỗi — báo rõ, giữ nguyên form để thử lại.
      await store.load()
      submitting.value = false
      return
    }
    clearDraft()
    pristineSnapshot.value = JSON.stringify(snapshotFields())
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
    const ok = await uploadAssets(id)
    if (!ok) {
      await store.load()
      submitting.value = false
      return
    }
    clearDraft()
    pristineSnapshot.value = JSON.stringify(snapshotFields())
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

// ── Nháp & cảnh báo rời trang khi chưa lưu ──────────────────────────────
// Chỉ lưu các trường văn bản (không lưu được video/ảnh đã chọn — File không
// thể serialize bền qua localStorage), nên khi khôi phục người dùng vẫn cần
// chọn lại tệp nếu có.
// Khoá nháp GẮN THEO NGƯỜI DÙNG (ADR-050) — xem `draftKey.ts` để biết lỗi rò nháp giữa hai
// tài khoản trên cùng máy mà cách đặt khoá này khắc phục. `null` = chưa biết là ai → không
// đọc/ghi nháp.
const draftKey = computed(() => buildDraftKey(auth.user?.id, editingSlug.value))

function snapshotFields() {
  return {
    title: form.title,
    categoryId: form.categoryId,
    description: form.description,
    hashtags: [...form.hashtags],
    youtube: form.youtube,
    vimeo: form.vimeo,
    gdrive: form.gdrive,
    misadrive: form.misadrive,
  }
}

const pristineSnapshot = ref('')

function isDirty() {
  return JSON.stringify(snapshotFields()) !== pristineSnapshot.value
}

function saveDraft() {
  if (!draftKey.value) return
  localStorage.setItem(draftKey.value, JSON.stringify(snapshotFields()))
}
function clearDraft() {
  if (!draftKey.value) return
  localStorage.removeItem(draftKey.value)
}
function restoreDraftIfAny() {
  if (!draftKey.value) return
  const raw = localStorage.getItem(draftKey.value)
  if (!raw) return
  try {
    Object.assign(form, JSON.parse(raw))
    toast.info('Đã khôi phục nội dung nháp chưa lưu trước đó (cần chọn lại video/ảnh bìa nếu có)')
  } catch {
    clearDraft()
  }
}

const leaveDialogOpen = ref(false)
let leaveResolve: ((v: boolean) => void) | null = null

onBeforeRouteLeave(() => {
  if (submitting.value || !isDirty()) return true
  leaveDialogOpen.value = true
  return new Promise<boolean>((resolve) => {
    leaveResolve = resolve
  })
})

function resolveLeave(shouldLeave: boolean) {
  leaveDialogOpen.value = false
  leaveResolve?.(shouldLeave)
  leaveResolve = null
}
function onLeaveStay() {
  resolveLeave(false)
}
function onLeaveDiscard() {
  clearDraft()
  resolveLeave(true)
}
function onLeaveSaveDraft() {
  saveDraft()
  toast.success('Đã lưu nháp — quay lại màn hình này sẽ còn nguyên nội dung')
  resolveLeave(true)
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
              <HashtagInput v-model="form.hashtags" :suggestions="hashtagSuggestions" />
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
                label="Tải phim lên"
                accept="video/mp4,video/webm,video/ogg,video/quicktime,video/x-matroska"
                :multiple="false"
                :maxSizeMB="2048"
                :model-value="videoFileMeta"
                :disabled="submitting"
                full-width
                hint-inside
                @select-files="onSelectVideo"
                @remove="onRemoveVideo"
              />
              <p class="mt-2 text-[12px]" style="color: var(--mds-text-secondary)">
                Dùng được cùng lúc nhiều nguồn: vừa tải tệp phim lên (MP4/WebM/OGG/MOV/MKV), vừa dán
                link YouTube/Vimeo/Google Drive/MISA Drive ở bên dưới. Chỉ cần có ít nhất một nguồn.
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
                accept="image/jpeg,image/png,image/webp"
                :multiple="false"
                :maxSizeMB="15"
                :model-value="thumbnailMeta"
                :disabled="submitting"
                paste-image
                @select-files="onSelectThumbnail"
                @remove="onRemoveThumbnail"
              />
              <p class="mt-1 text-[12px]" style="color: var(--mds-text-secondary)">
                JPG/PNG/WebP, bắt buộc tỷ lệ 16:9 (vd 1280×720, 1920×1080). Bỏ trống thì hệ thống tự
                dùng ảnh mặc định theo chuyên mục.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Footer sticky: Hủy trái, Lưu/Xuất bản phải (Primary ngoài cùng). padding-bottom
         chừa env(safe-area-inset-bottom) (mobile-pwa.md §2.6/§6) để không bị thanh cử chỉ
         iOS/Android che khi PWA chạy standalone. -->
    <footer
      class="flex shrink-0 items-center justify-between bg-white px-4 pt-3"
      style="padding-bottom: max(12px, env(safe-area-inset-bottom))"
    >
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

    <!-- Cảnh báo rời trang khi còn nội dung chưa lưu -->
    <MDialog v-model="leaveDialogOpen" title="Nội dung chưa lưu" @cancel="onLeaveStay">
      <p class="text-[13px]" style="color: var(--mds-text-primary)">
        Bạn có thông tin chưa lưu ở màn hình này. Lưu nháp lại để khi quay lại vẫn còn nguyên các
        trường đã nhập (video/ảnh bìa đã chọn sẽ cần chọn lại)?
      </p>
      <template #footer>
        <MButton variant="secondary" @click="onLeaveStay">Ở lại</MButton>
        <MButton variant="secondary" @click="onLeaveDiscard">Không lưu</MButton>
        <MButton variant="primary" @click="onLeaveSaveDraft">Lưu nháp</MButton>
      </template>
    </MDialog>
  </div>
</template>
