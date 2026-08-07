<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MButton from '@/components/mds/MButton.vue'
import MIcon from '@/components/mds/MIcon.vue'
import MTag from '@/components/mds/MTag.vue'
import MEmptyState from '@/components/mds/MEmptyState.vue'
import MDialog from '@/components/mds/MDialog.vue'
import MSpinner from '@/components/mds/MSpinner.vue'
import MDropdownMenu from '@/components/mds/MDropdownMenu.vue'
import MMobileTopBar from '@/components/mds/MMobileTopBar.vue'
import VideoPlayer from '@/components/VideoPlayer.vue'
import { useToast } from '@/components/mds/toast.js'
import { filmsApi, filmSources, type ApiFilm } from './filmsApi'
import { SOURCE_LABEL, categoryColorFor, formatVNDate } from './filmTypes'
import { useAuthStore } from '@/features/auth/authStore'
import { canManageFilm } from '@/features/auth/permissions'

/**
 * Xem phim — BẢN MOBILE (Compact <600px, GĐ8). Dựng từ khung
 * `ui/templates/mobile/DetailPageMobile.vue` của skill misa-design-system.
 *
 * Khác bản desktop (`FilmDetailView.vue`) ở cách trình bày, KHÔNG khác ở nghiệp vụ — cùng
 * `filmsApi`, cùng quy tắc đếm view/đếm download, cùng helper quyền `canManageFilm`:
 *  - Top bar Back + tiêu đề rút gọn + "⋯" (mobile-pwa.md §4.3: "Không dồn 4-5 text button
 *    lên header"). Desktop đang đặt hai nút chữ Sửa/Xoá ngay trên header — ở 320px cụm đó
 *    đẩy tiêu đề xuống dòng.
 *  - Player FULL-BLEED hết bề ngang màn hình, không nằm trong thẻ trắng có padding.
 *  - Thông tin phim xếp DỌC dưới player thay vì một hàng ngang gồm 4-5 số liệu.
 *  - Hành động chính (Tải xuống) là nút full-width sticky đáy, đứng RIÊNG một hàng.
 */
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const toast = useToast()

const film = ref<ApiFilm | null>(null)
const loading = ref(true)
const notFound = ref(false)

/** Đếm lượt xem 1 lần mỗi slug — cùng cơ chế chống double-count như bản desktop. */
let viewedSlug: string | null = null

async function load() {
  loading.value = true
  notFound.value = false
  film.value = null
  try {
    film.value = await filmsApi.getBySlug(route.params.slug as string)
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
    // Không chặn xem phim nếu API đếm view lỗi.
  }
}

onMounted(load)
watch(() => route.params.slug, load)

// RBAC 4 cấp (ADR-040) — DÙNG CHUNG helper với desktop, không có bản sao quy tắc cho mobile.
const canManage = computed(() => canManageFilm(auth.user, film.value))

/** Menu "⋯": gom mọi hành động phụ. Nhãn viết ngắn cho màn hẹp. */
const menuItems = computed(() => {
  if (!film.value) return []
  const items: Array<Record<string, unknown>> = filmSources(film.value).map((s) => ({
    key: `copy:${s}`,
    label: `Copy link ${SOURCE_LABEL[s]}`,
    icon: 'copy',
  }))
  if (canManage.value) {
    if (items.length) items.push({ divider: true })
    items.push({ key: 'edit', label: 'Sửa thông tin', icon: 'pencil' })
    items.push({ key: 'delete', label: 'Xoá phim', icon: 'trash', danger: true })
  }
  return items
})

async function onMenuSelect(item: { key?: string }) {
  const key = item?.key
  if (!key || !film.value) return
  if (key === 'edit') return goEdit()
  if (key === 'delete') {
    deleteOpen.value = true
    return
  }
  if (key.startsWith('copy:')) {
    const source = key.slice(5) as keyof typeof SOURCE_LABEL
    const url = film.value.links[source]
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      toast.success(`Đã copy link ${SOURCE_LABEL[source]}`)
    } catch {
      toast.error('Không thể copy link — trình duyệt chặn quyền clipboard')
    }
  }
}

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
 * Tải xuống. Desktop dùng thẻ `<a download>` thật; ở mobile nút nằm trong footer sticky nên
 * bọc bằng `<a>` sẽ phá bố cục full-width — thay bằng tạo thẻ `<a>` tạm rồi click. Link
 * storage là same-origin (/media/...) nên thuộc tính `download` vẫn có hiệu lực.
 *
 * Việc đếm lượt tải chạy SONG SONG và tuyệt đối không được chặn việc tải file → nuốt lỗi.
 */
async function onDownload() {
  if (!film.value?.links.storage) return
  const a = document.createElement('a')
  a.href = film.value.links.storage
  a.download = ''
  document.body.appendChild(a)
  a.click()
  a.remove()
  try {
    const { downloadCount } = await filmsApi.recordDownload(film.value.id)
    if (film.value) film.value.downloadCount = downloadCount
  } catch {
    // bỏ qua có chủ đích
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

  <section
    v-else-if="film"
    class="flex h-full flex-col overflow-hidden"
    style="background: var(--mds-bg-canvas, #ecedef)"
  >
    <MMobileTopBar :title="film.title" :show-more="menuItems.length > 0" @back="goBack">
      <!-- Mọi hành động phụ nằm trong đúng một nút "⋯" — không có nút chữ nào trên header,
           nên tiêu đề dài đến mấy cũng chỉ truncate chứ không đẩy layout vỡ. -->
      <template v-if="menuItems.length" #actions>
        <MDropdownMenu :items="menuItems" placement="bottom-end" @select="onMenuSelect">
          <template #activator>
            <button
              type="button"
              class="grid h-12 w-12 shrink-0 place-items-center rounded-lg"
              style="color: var(--mds-icon-neutral)"
              aria-label="Thêm thao tác"
            >
              <MIcon name="dots-vertical" :size="20" />
            </button>
          </template>
        </MDropdownMenu>
      </template>
    </MMobileTopBar>

    <div class="min-h-0 flex-1 overflow-y-auto">
      <!-- Player full-bleed: sát hai mép màn hình, đúng cảm giác app xem phim -->
      <div class="bg-white pb-3">
        <VideoPlayer compact :title="film.title" :sources="filmSources(film)" :links="film.links" />
      </div>

      <!-- Thông tin phim: xếp dọc gọn -->
      <div class="flex flex-col gap-3 bg-white px-3 pb-4 pt-1">
        <h2 class="text-[16px] font-semibold leading-[22px]" style="color: var(--mds-text-primary)">
          {{ film.title }}
        </h2>

        <div class="flex flex-wrap items-center gap-1.5">
          <MTag v-if="film.isNew" color="danger" size="sm">Phim mới</MTag>
          <MTag v-if="film.categoryName" :color="categoryColorFor(film.categoryId)" size="sm">
            {{ film.categoryName }}
          </MTag>
        </div>

        <div v-if="film.hashtags.length" class="flex flex-wrap gap-1.5">
          <span
            v-for="tag in film.hashtags"
            :key="tag"
            class="text-[12px]"
            style="color: var(--mds-brand-600)"
          >
            #{{ tag }}
          </span>
        </div>

        <p
          v-if="film.description"
          class="whitespace-pre-line text-[13px] leading-[19px]"
          style="color: var(--mds-text-primary)"
        >
          {{ film.description }}
        </p>

        <!-- Số liệu dạng danh sách dọc: ở 320px một hàng ngang 4 số liệu chắc chắn vỡ -->
        <dl
          class="flex flex-col gap-2 border-t pt-3 text-[12px]"
          style="border-color: var(--mds-border-light, #e9eaeb); color: var(--mds-text-secondary)"
        >
          <div class="flex items-center gap-2">
            <MIcon name="eye" :size="14" />
            <dt class="sr-only">Lượt xem</dt>
            <dd>{{ formatViews(film.viewCount) }} lượt xem</dd>
          </div>
          <div class="flex items-center gap-2">
            <MIcon name="download" :size="14" />
            <dt class="sr-only">Lượt tải</dt>
            <dd>{{ formatViews(film.downloadCount) }} lượt tải</dd>
          </div>
          <div class="flex items-center gap-2">
            <MIcon name="user" :size="14" />
            <dt class="sr-only">Người đăng</dt>
            <dd class="min-w-0 truncate">{{ film.uploaderName }}</dd>
          </div>
          <div class="flex items-center gap-2">
            <MIcon name="calendar" :size="14" />
            <dt class="sr-only">Ngày đăng</dt>
            <dd>{{ formatVNDate(film.publishedAt) }}</dd>
          </div>
        </dl>
      </div>
    </div>

    <!-- Hành động chính: full-width, RIÊNG một hàng, không đứng cạnh nút nào khác.
         Chỉ hiện khi phim có bản lưu trữ nội bộ — giống điều kiện của bản desktop. -->
    <footer
      v-if="film.links.storage"
      class="shrink-0 border-t bg-white px-3 pt-3"
      style="border-color: var(--mds-border-light, #e9eaeb); padding-bottom: max(12px, env(safe-area-inset-bottom))"
    >
      <MButton variant="primary" class="min-h-12 w-full whitespace-nowrap" @click="onDownload">
        <template #icon><MIcon name="download" :size="16" /></template>
        Tải xuống
      </MButton>
    </footer>

    <!-- Xác nhận xoá — cùng lời văn với bản desktop để hai chỗ không nói hai kiểu -->
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
