<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MButton from '@/components/mds/MButton.vue'
import MIcon from '@/components/mds/MIcon.vue'
import MTag from '@/components/mds/MTag.vue'
import MEmptyState from '@/components/mds/MEmptyState.vue'
import MDialog from '@/components/mds/MDialog.vue'
import MSpinner from '@/components/mds/MSpinner.vue'
import VideoPlayer from '@/components/VideoPlayer.vue'
import { useToast } from '@/components/mds/toast.js'
import { filmsApi, filmSources, type ApiFilm } from './filmsApi'
import { loadFilmByRoute } from './filmRouteResolve'
import { categoryColorFor, formatVNDate } from './filmTypes'
import { useAuthStore } from '@/features/auth/authStore'
import { canManageFilm } from '@/features/auth/permissions'

/**
 * Chi tiết/Xem phim — URL riêng `ten-chuyen-muc/ten-phim-ngay-phat-hanh-version` (2026-08-13),
 * vẫn nhận cả route cũ `/films/:slug` (xem `filmRouteResolve.ts`). GĐ2: fetch trực tiếp theo
 * route (không phụ thuộc filmsStore đã load hay chưa — vào thẳng link vẫn đúng).
 */
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const toast = useToast()

const film = ref<ApiFilm | null>(null)
const loading = ref(true)
const notFound = ref(false)

/**
 * Đếm lượt xem (GĐ4): gọi 1 lần mỗi khi vào phim khác (đổi slug), KHÔNG gọi lại
 * khi component chỉ re-render — dùng biến này để nhớ đã tính lượt xem cho slug
 * nào rồi, tránh double-count khi các phần khác của trang khiến `film` đổi tham
 * chiếu. BE vẫn là nguồn dedupe thật (30'), đây chỉ là tránh gọi API thừa ở FE.
 */
let viewedSlug: string | null = null

async function load() {
  loading.value = true
  notFound.value = false
  film.value = null
  try {
    film.value = await loadFilmByRoute(route, router)
    await recordViewOnce()
  } catch {
    notFound.value = true
  } finally {
    loading.value = false
  }
}

async function recordViewOnce() {
  if (!film.value || viewedSlug === film.value.slug) return
  viewedSlug = film.value.slug
  try {
    const { viewCount } = await filmsApi.recordView(film.value.id)
    if (film.value && film.value.slug === viewedSlug) film.value.viewCount = viewCount
  } catch {
    // Không chặn xem phim nếu API đếm view lỗi — chỉ bỏ qua, không toast.
  }
}

onMounted(load)
watch(() => [route.params.categorySlug, route.params.filmSlug, route.params.slug], load)

// Quyền sửa/xoá theo RBAC 4 cấp có scope phòng ban (ADR-040) — dùng helper DÙNG CHUNG với
// FilmListView để hai màn không lệch nhau. FE chỉ ẩn/hiện; backend
// (FilmsService.assertCanManage) mới là nguồn kiểm quyền thật.
const canManage = computed(() => canManageFilm(auth.user, film.value))

function formatViews(n: number) {
  return n.toLocaleString('vi-VN')
}

function goBack() {
  router.push({ name: 'films' })
}
function goEdit() {
  if (film.value) router.push({ name: 'upload', query: { edit: film.value.slug } })
}

/**
 * Đếm lượt tải (đợt 2 việc 8). Chạy SONG SONG với việc trình duyệt tải file: thẻ `<a download>`
 * vẫn hoạt động bình thường, hàm này chỉ bắn thêm một request đếm và KHÔNG chặn/không
 * `preventDefault`. Lỗi đếm tuyệt đối không được cản trở việc tải phim → nuốt lỗi, không toast.
 */
async function onDownload() {
  if (!film.value) return
  try {
    const { downloadCount } = await filmsApi.recordDownload(film.value.id)
    if (film.value) film.value.downloadCount = downloadCount
  } catch {
    // bỏ qua có chủ đích — xem giải thích ở trên
  }
}

const deleteOpen = ref(false)
const deleting = ref(false)
async function confirmDelete() {
  if (!film.value) return
  deleting.value = true
  try {
    await filmsApi.remove(film.value.id)
    toast.success(`Đã xoá phim "${film.value.title}"`)
    router.push({ name: 'films' })
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'Xoá phim không thành công')
  } finally {
    deleting.value = false
    deleteOpen.value = false
  }
}
</script>

<template>
  <section v-if="loading" class="flex h-full items-center justify-center">
    <MSpinner :size="24" />
  </section>

  <section v-else-if="film" class="flex h-full flex-col overflow-hidden">
    <!-- Header trắng: back + tiêu đề — nút thao tác ghim góc trên phải -->
    <header class="flex shrink-0 flex-wrap items-center justify-between gap-3 bg-white px-4 py-3">
      <div class="flex min-w-0 items-center gap-2">
        <button
          type="button"
          class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:opacity-80"
          style="color: var(--mds-icon-neutral)"
          aria-label="Quay lại"
          @click="goBack"
        >
          <MIcon name="chevron-left" :size="20" />
        </button>
        <h1 class="truncate text-[18px] font-semibold" style="color: var(--mds-text-primary)">
          {{ film.title }}
        </h1>
        <!-- Nhãn do BACKEND quyết định (ADR-052): phim cũ trùng tên đã bị bỏ nhãn từ server,
             FE không tự suy từ publishedAt nữa vì trang này chỉ tải đúng một phim. -->
        <MTag v-if="film.isNew" color="danger" size="sm">Phim mới</MTag>
      </div>

      <div v-if="canManage" class="flex items-center gap-2">
        <MButton variant="secondary" @click="goEdit">
          <template #icon><MIcon name="pencil" :size="16" /></template>
          Sửa
        </MButton>
        <MButton variant="danger" @click="deleteOpen = true">
          <template #icon><MIcon name="trash" :size="16" /></template>
          Xoá
        </MButton>
      </div>
    </header>

    <div class="flex-1 overflow-auto p-4">
      <div class="mx-auto flex max-w-5xl flex-col gap-4">
        <!-- Player -->
        <div
          class="rounded-lg bg-white p-3"
          style="box-shadow: var(--mds-shadow-card, 0 0 2px 0 rgba(0,0,0,0.1))"
        >
          <VideoPlayer :title="film.title" :sources="filmSources(film)" :links="film.links" />
        </div>

        <!-- Thông tin phim -->
        <div
          class="flex flex-col gap-3 rounded-lg bg-white p-4"
          style="box-shadow: var(--mds-shadow-card, 0 0 2px 0 rgba(0,0,0,0.1))"
        >
          <div class="flex flex-wrap items-center gap-2">
            <MTag v-if="film.categoryName" :color="categoryColorFor(film.categoryId)" size="sm">{{ film.categoryName }}</MTag>
            <span
              v-for="tag in film.hashtags"
              :key="tag"
              class="text-[12px]"
              style="color: var(--mds-brand-600)"
            >
              #{{ tag }}
            </span>
          </div>

          <p v-if="film.description" class="text-[13px] leading-[19px]" style="color: var(--mds-text-primary)">
            {{ film.description }}
          </p>

          <div
            class="flex flex-wrap items-center gap-4 border-t pt-3 text-[12px]"
            style="border-color: var(--mds-border-light,#E9EAEB); color: var(--mds-text-secondary)"
          >
            <span class="flex items-center gap-1">
              <MIcon name="eye" :size="12" />
              {{ formatViews(film.viewCount) }} lượt xem
            </span>
            <span class="flex items-center gap-1">
              <MIcon name="user" :size="12" />
              {{ film.uploaderName }}
            </span>
            <span class="flex items-center gap-1">
              <MIcon name="calendar" :size="12" />
              {{ formatVNDate(film.publishedAt) }}
            </span>

            <span class="flex items-center gap-1">
              <MIcon name="download" :size="12" />
              {{ formatViews(film.downloadCount) }} lượt tải
            </span>

            <!-- Nút Tải xuống CHỈ hiện khi phim có bản lưu trữ nội bộ trên MinIO. Phim chỉ có
                 link ngoài (YouTube/Vimeo/Drive) không hiện nút này — các nguồn đó đã có nút
                 mở/tải riêng trong player theo từng nền tảng. -->
            <a
              v-if="film.links.storage"
              :href="film.links.storage"
              download
              class="ml-auto"
              @click="onDownload"
            >
              <MButton variant="secondary" size="md">
                <template #icon><MIcon name="download" :size="16" /></template>
                Tải xuống
              </MButton>
            </a>
          </div>
        </div>
      </div>
    </div>

    <!-- Xác nhận xoá phim — lời văn theo communication.md §3: tiêu đề là câu hỏi ngắn, mô tả
         nêu hệ quả, không dùng "Bạn có chắc…" và không lặp lại tiêu đề. Giống hệt popup ở
         Kho phim để hai chỗ không nói hai kiểu. -->
    <MDialog v-model="deleteOpen" title="Xoá vĩnh viễn phim này?" type="danger" :width="440">
      <p class="text-[13px]" style="color: var(--mds-text-primary)">
        <strong>"{{ film.title }}"</strong> sẽ bị gỡ khỏi kho phim. Hành động không thể hoàn tác.
      </p>
      <template #footer>
        <MButton variant="secondary" :disabled="deleting" @click="deleteOpen = false">Huỷ</MButton>
        <MButton variant="danger" :loading="deleting" @click="confirmDelete">Xoá</MButton>
      </template>
    </MDialog>
  </section>

  <!-- Không tìm thấy phim (slug sai/đã xoá) -->
  <section v-else class="flex h-full items-center justify-center p-4">
    <MEmptyState
      type="no-result"
      title="Không tìm thấy phim"
      description="Phim có thể đã bị xoá hoặc đường dẫn không đúng."
    >
      <template #actions>
        <MButton variant="primary" @click="goBack">Về Kho phim</MButton>
      </template>
    </MEmptyState>
  </section>
</template>
