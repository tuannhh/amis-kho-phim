<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter, onBeforeRouteLeave } from 'vue-router'
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
 * FilmForm — TOÀN BỘ form Thêm/Sửa phim, tách khỏi `FilmUploadView.vue` ở đợt 2 (việc 10) để
 * dùng lại được ở HAI nơi mà không nhân đôi code:
 *
 *   1. Trang riêng `/upload` (`FilmUploadView.vue` nay chỉ còn là vỏ trang) — giữ nguyên để
 *      link cũ và luồng "Thêm phim" từ menu không đổi.
 *   2. Trong `MDialog` ở màn Kho phim / Phim tôi quản lý — bấm Sửa mở popup ngay tại chỗ,
 *      không phải rời trang rồi bấm quay lại.
 *
 * Khác biệt duy nhất giữa hai chế độ nằm ở prop `embedded`:
 *   - `false` (trang): lưu xong thì điều hướng sang trang xem phim; có cảnh báo rời trang khi
 *     còn nội dung chưa lưu.
 *   - `true` (popup): lưu xong thì `emit('saved')` để màn cha tự đóng popup và tải lại danh
 *     sách; KHÔNG đăng ký cảnh báo rời trang, vì popup nằm trong một route khác và MDS cấm
 *     chồng hai dialog lên nhau (`references/communication.md` §3).
 *
 * Luồng upload (GĐ3 + ADR-055): lưu metadata → xin presigned URL → upload video VÀ ảnh bìa
 * thẳng lên MinIO (có progress) → xác nhận tạo bản mới (film_versions).
 */
const props = withDefaults(
  defineProps<{
    /** Slug phim đang sửa. Rỗng = thêm mới. */
    editingSlug?: string
    /** Đang nhúng trong dialog thay vì đứng thành một trang riêng. */
    embedded?: boolean
    /**
     * Ẩn thanh nút Hủy/Lưu của form. Dùng khi màn cha (dialog) tự dựng footer riêng — nếu
     * không, nút Lưu sẽ nằm lọt trong vùng cuộn của dialog, trái quy tắc MDS "form Thêm/Sửa
     * phải ghim Lưu/Hủy ở cuối", và người dùng phải cuộn hết form mới thấy nút chính.
     * Khi bật, màn cha gọi `publish()` qua `defineExpose`.
     */
    hideFooter?: boolean
  }>(),
  { editingSlug: '', embedded: false, hideFooter: false },
)

const emit = defineEmits<{
  /** Đã lưu thành công — màn cha đóng popup và tải lại danh sách. */
  (e: 'saved'): void
  /** Người dùng bấm Huỷ. */
  (e: 'cancel'): void
}>()

const toast = useToast()
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

const editingSlug = computed(() => props.editingSlug || '')
const editingFilm = computed(() => store.films.find((f) => f.slug === editingSlug.value))
const isEditMode = computed(() => !!editingFilm.value)

const categoryOptions = computed(() =>
  flattenCategoryTree(categoriesTree.value).map((c) => ({ label: c.name, value: c.id })),
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

  // 2) Ảnh bìa 16:9 → presigned PUT thẳng lên MinIO, GIỐNG HỆT video (ADR-055).
  //    Trước đây bước này gửi multipart qua backend; backend buffer cả file trong RAM nên
  //    nhiều người đăng phim cùng lúc là nghẽn. Việc kiểm ảnh (16:9 + magic bytes) không mất
  //    đi mà chuyển sang bước confirmVersion ở server.
  if (thumbnailFile.value) {
    const file = thumbnailFile.value
    const contentType = file.type || 'image/jpeg'
    thumbnailMeta.value = [
      { id: 'thumb', name: file.name, size: file.size, status: 'uploading', progress: 0 },
    ]
    try {
      const { uploadUrl, thumbnailKey } = await filmsApi.createThumbnailUploadUrl(
        filmId,
        contentType,
        file.size,
      )
      await putToStorage(uploadUrl, file, contentType, (p) => {
        if (thumbnailMeta.value[0]) thumbnailMeta.value[0].progress = p
      })
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
    finishSuccess(created.slug)
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
    finishSuccess(updated.slug)
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

/**
 * Kết thúc thành công. Trong popup thì báo lên cho màn cha xử lý (đóng popup, danh sách đã
 * được `store.load()` làm mới); ở trang riêng thì điều hướng sang trang xem phim như cũ.
 */
function finishSuccess(slug: string) {
  if (props.embedded) {
    emit('saved')
    return
  }
  router.push({ name: 'film-detail', params: { slug } })
}

function cancel() {
  if (props.embedded) {
    emit('cancel')
    return
  }
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

// Chỉ đăng ký ở chế độ TRANG. Ở chế độ popup, cảnh báo này sẽ bật lên khi người dùng rời
// trang danh sách — trong khi dialog form đang mở → hai dialog chồng nhau, MDS cấm.
onBeforeRouteLeave(() => {
  if (props.embedded) return true
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

// Cho dialog cha điều khiển nút Lưu ở footer của nó (xem prop `hideFooter`).
defineExpose({ publish, cancel, submitting, isEditMode })
</script>

<template>
  <!-- `h-full` để ở chế độ trang form chiếm hết chiều cao; trong dialog thì cha giới hạn
       chiều cao nên phần thân vẫn tự cuộn được. -->
  <div class="flex h-full min-h-0 flex-col overflow-hidden">
    <!-- Body cuộn được -->
    <main class="min-h-0 flex-1 overflow-y-auto">
      <div class="mx-auto w-full max-w-3xl" :class="embedded ? 'px-1 py-1' : 'px-4 py-6'">
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
              <HashtagInput v-model="form.hashtags" />
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
          <h3 class="mb-4 flex flex-wrap items-baseline gap-x-2 text-[16px] font-semibold" style="color: var(--mds-text-primary)">
            Tệp phim &amp; liên kết ngoài
            <!-- Quy tắc nghiệp vụ duy nhất còn phải nói ra (validate chặn theo đúng câu này) —
                 phần mô tả định dạng đã chuyển vào trong dropzone qua prop `formats`. -->
            <span class="text-[12px] font-normal" style="color: var(--mds-text-secondary)">
              Cần ít nhất một nguồn, dùng được nhiều nguồn cùng lúc
            </span>
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
                formats="MP4/WebM/OGG/MOV/MKV"
                @select-files="onSelectVideo"
                @remove="onRemoveVideo"
              />
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
              class="aspect-video w-full shrink-0 overflow-hidden rounded-lg sm:max-w-[280px]"
              style="background: var(--mds-bg-disabled); border: 1px solid var(--mds-border,#CED1D6)"
            >
              <img v-if="thumbnailUrl" :src="thumbnailUrl" class="h-full w-full object-cover" alt="Xem trước ảnh bìa" />
              <div v-else class="flex h-full w-full flex-col items-center justify-center gap-1" style="color: var(--mds-text-placeholder)">
                <MIcon name="photo" :size="28" />
                <!-- Gộp luôn lời giải thích "bỏ trống thì dùng ảnh mặc định" vào đây thay vì
                     một đoạn văn riêng bên dưới khung tải lên. -->
                <span class="text-[12px]">Chưa có ảnh bìa</span>
                <span class="px-2 text-center text-[11px]">Bỏ trống: dùng ảnh mặc định theo chuyên mục</span>
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
                full-width
                hint-inside
                formats="JPG/PNG/WebP · 16:9"
                @select-files="onSelectThumbnail"
                @remove="onRemoveThumbnail"
              />
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Footer sticky: Hủy trái, Lưu/Xuất bản phải (Primary ngoài cùng). padding-bottom
         chừa env(safe-area-inset-bottom) (mobile-pwa.md §2.6/§6) để không bị thanh cử chỉ
         iOS/Android che khi PWA chạy standalone. -->
    <footer
      v-if="!hideFooter"
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
