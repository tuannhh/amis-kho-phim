<script setup lang="ts">
import { computed } from 'vue'
import MTag from '@/components/mds/MTag.vue'
import MIcon from '@/components/mds/MIcon.vue'
import MDropdownMenu from '@/components/mds/MDropdownMenu.vue'
import { useToast } from '@/components/mds/toast.js'
import { filmSources, type ApiFilm } from './filmsApi'
import { canonicalFilmUrl } from './filmShareLink'
import { SOURCE_LABEL, categoryColorFor, thumbnailGradient, formatVNDate } from './filmTypes'
import { useAuthStore } from '@/features/auth/authStore'
import { canManageFilm } from '@/features/auth/permissions'

/**
 * Thẻ phim bản MOBILE (GĐ8). Không phải FilmCard desktop thu nhỏ — khác ở ba điểm bắt buộc
 * theo `mobile-pwa.md`:
 *
 *  1. Không có thao tác nào phụ thuộc HOVER (§1). Desktop hiện nút Sửa/Xoá khi rê chuột;
 *     màn cảm ứng không có trạng thái đó nên mọi thao tác gom vào nút "⋯" LUÔN HIỂN THỊ.
 *  2. Không dàn nút chữ ngang hàng (§4.3) — các nút "Copy link YouTube/Vimeo/..." của bản
 *     desktop chuyển thành mục trong menu "⋯", nên card hẹp 320px vẫn không bị ngắt dòng.
 *  3. Giữ ĐỦ trường nhận diện của bản desktop: ảnh bìa, thời lượng, tên phim, nhãn "Phim mới",
 *     chuyên mục, hashtag, lượt xem, ngày đăng, người đăng (§4.1 "Card không được làm mất
 *     trường nhận diện, trạng thái, số liệu chính hoặc row action").
 *
 * Quyền Sửa/Xoá dùng đúng helper `canManageFilm` như desktop — KHÔNG có bản sao quy tắc RBAC
 * riêng cho mobile.
 */
const props = withDefaults(
  defineProps<{
    film: ApiFilm
    /** 'list' = thẻ dọc full-width trong danh sách · 'shelf' = thẻ hẹp trong kệ cuộn ngang
     *  (không dùng nữa từ ADR-068, còn giữ code cho chỗ khác lỡ dùng lại) · 'row' = dòng
     *  ngang gọn (thumbnail trái + chữ phải) cho danh sách dọc kiểu YouTube trong kệ chuyên
     *  mục (ADR-068). */
    variant?: 'list' | 'shelf' | 'row'
  }>(),
  { variant: 'list' },
)

const emit = defineEmits<{
  (e: 'open', film: ApiFilm): void
  (e: 'edit', film: ApiFilm): void
  (e: 'delete', film: ApiFilm): void
}>()

const auth = useAuthStore()
const toast = useToast()

const canManage = computed(() => canManageFilm(auth.user, props.film))

/**
 * Menu "⋯": nhãn viết riêng cho màn hẹp (ngắn, không lặp lại tên phim).
 * Mục Sửa/Xoá chỉ xuất hiện khi thực sự có quyền — backend vẫn là nơi kiểm quyền thật.
 */
const menuItems = computed(() => {
  const items: Array<Record<string, unknown>> = [
    { key: 'share', label: 'Chia sẻ liên kết phim', icon: 'share' },
    ...filmSources(props.film).map((s) => ({
      key: `copy:${s}`,
      label: `Copy link ${SOURCE_LABEL[s]}`,
      icon: 'copy',
    })),
  ]
  if (canManage.value) {
    if (items.length) items.push({ divider: true })
    items.push({ key: 'edit', label: 'Sửa thông tin', icon: 'pencil' })
    items.push({ key: 'delete', label: 'Xoá phim', icon: 'trash', danger: true })
  }
  return items
})

async function onMenuSelect(item: { key?: string }) {
  const key = item?.key
  if (!key) return
  if (key === 'edit') return emit('edit', props.film)
  if (key === 'delete') return emit('delete', props.film)
  if (key === 'share') {
    try {
      await navigator.clipboard.writeText(canonicalFilmUrl(props.film))
      toast.success('Đã copy liên kết phim')
    } catch {
      toast.error('Không thể copy liên kết phim — trình duyệt chặn quyền clipboard')
    }
    return
  }
  if (key.startsWith('copy:')) {
    const source = key.slice(5) as keyof typeof SOURCE_LABEL
    const url = props.film.links[source]
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
</script>

<template>
  <!-- Dòng ngang gọn kiểu YouTube (thumbnail trái + chữ phải) — dùng cho danh sách dọc trong
       kệ chuyên mục (ADR-068). Chỉ giữ đúng 3 trường người dùng yêu cầu: thumbnail, tên phim,
       nhãn "Phim mới", ngày đăng — KHÔNG nhồi thêm hashtag/lượt xem/chuyên mục như thẻ 'list'
       để hàng không cao quá, đúng tinh thần "danh sách" chứ không phải "thẻ" thu nhỏ. Vẫn giữ
       nút "⋯" cho Sửa/Xoá — quy tắc "card không được mất row action" áp dụng cả ở dạng dòng. -->
  <article
    v-if="variant === 'row'"
    class="relative flex items-start gap-3 bg-white py-2.5 transition-colors active:bg-[var(--mds-bg-hover-soft)]"
    @click="emit('open', film)"
  >
    <div
      class="relative aspect-video w-[124px] shrink-0 overflow-hidden rounded-lg"
      :style="{
        background: `linear-gradient(135deg, ${thumbnailGradient(film.categoryId)[0]}, ${thumbnailGradient(film.categoryId)[1]})`,
      }"
    >
      <img
        v-if="film.thumbnailUrl"
        :src="film.thumbnailUrl"
        :alt="film.title"
        class="absolute inset-0 h-full w-full object-cover"
        loading="lazy"
      />
      <span
        class="absolute bottom-1 right-1 rounded px-1 py-0.5 text-[10px] font-semibold tabular-nums text-white backdrop-blur-sm"
        style="background: rgba(0, 0, 0, 0.55)"
      >
        {{ film.duration }}
      </span>
    </div>

    <div class="flex min-w-0 flex-1 flex-col gap-1 pr-9">
      <h3
        class="line-clamp-2 text-[13.5px] font-semibold leading-[18px]"
        style="color: var(--mds-text)"
        :title="film.title"
      >
        {{ film.title }}
      </h3>
      <div class="flex flex-wrap items-center gap-1.5">
        <MTag v-if="film.isNew" color="danger" size="sm">Phim mới</MTag>
        <span class="flex items-center gap-1 text-[11.5px]" style="color: var(--mds-text-secondary)">
          <MIcon name="calendar" :size="12" />
          {{ formatVNDate(film.publishedAt) }}
        </span>
      </div>
    </div>

    <!-- Vùng chạm 48px đặt tuyệt đối để không kéo giãn chiều cao hàng theo nội dung text ngắn -->
    <div v-if="menuItems.length" class="absolute right-0 top-1/2 -translate-y-1/2" @click.stop>
      <MDropdownMenu :items="menuItems" placement="bottom-end" @select="onMenuSelect">
        <template #activator>
          <button type="button" class="grid h-12 w-9 place-items-center" aria-label="Thao tác với phim">
            <MIcon name="dots-vertical" :size="18" style="color: var(--mds-icon-neutral)" />
          </button>
        </template>
      </MDropdownMenu>
    </div>
  </article>

  <!-- GĐ8-B: bo góc 18px + đổ bóng mềm khuếch tán thay cho `--mds-shadow-card` (2px, gần như
       phẳng). Trên desktop card nằm sát nhau trong lưới nên viền mảnh là đủ; trên điện thoại
       card là đối tượng chạm chính, cần nổi khối rõ để ngón tay "thấy" ranh giới thẻ. -->
  <article
    v-else
    class="relative flex flex-col overflow-hidden bg-white transition-transform active:scale-[0.985]"
    :class="variant === 'shelf' ? 'w-[172px] shrink-0' : 'w-full'"
    style="border-radius: 18px; box-shadow: 0 4px 16px -4px rgba(16, 24, 40, 0.14), 0 1px 3px rgba(16, 24, 40, 0.05)"
    @click="emit('open', film)"
  >
    <!-- Ảnh bìa 16:9 full-bleed trong thẻ — bố cục quen thuộc của app xem phim trên điện thoại -->
    <div
      class="relative aspect-video w-full overflow-hidden"
      :style="{
        background: `linear-gradient(135deg, ${thumbnailGradient(film.categoryId)[0]}, ${thumbnailGradient(film.categoryId)[1]})`,
      }"
    >
      <img
        v-if="film.thumbnailUrl"
        :src="film.thumbnailUrl"
        :alt="film.title"
        class="absolute inset-0 h-full w-full object-cover"
        loading="lazy"
      />
      <span
        class="absolute bottom-2 right-2 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white backdrop-blur-sm"
        style="background: rgba(0, 0, 0, 0.55)"
      >
        {{ film.duration }}
      </span>

      <!-- Nút "⋯" luôn hiện (không phụ thuộc hover). Vùng chạm 48px, glyph 20px. -->
      <div v-if="menuItems.length" class="absolute right-0 top-0" @click.stop>
        <MDropdownMenu :items="menuItems" placement="bottom-end" @select="onMenuSelect">
          <template #activator>
            <button
              type="button"
              class="grid h-12 w-12 place-items-center"
              aria-label="Thao tác với phim"
            >
              <span
                class="grid h-8 w-8 place-items-center rounded-full text-white"
                style="background: rgba(0, 0, 0, 0.45)"
              >
                <MIcon name="dots-vertical" :size="18" />
              </span>
            </button>
          </template>
        </MDropdownMenu>
      </div>
    </div>

    <div class="flex flex-1 flex-col gap-2 p-3.5">
      <h3
        class="line-clamp-2 text-[14.5px] font-semibold leading-[20px]"
        style="color: var(--mds-text)"
        :title="film.title"
      >
        {{ film.title }}
      </h3>

      <div class="flex flex-wrap items-center gap-1.5">
        <!-- Nhãn "Phim mới" do BACKEND quyết định (ADR-052) -->
        <MTag v-if="film.isNew" color="danger" size="sm">Phim mới</MTag>
        <!-- MTag cao cố định 20px; tên chuyên mục dài (vd "Phim Giới thiệu công ty") sẽ xuống
             dòng và TRÀN RA NGOÀI viên tag, rõ nhất ở thẻ kệ rộng 172px. Cắt bằng truncate
             ngay trong slot thay vì sửa MTag toàn cục — desktop có chỗ rộng, không cần cắt. -->
        <MTag v-if="film.categoryName" :color="categoryColorFor(film.categoryId)" size="sm">
          <span
            class="block truncate"
            :class="variant === 'shelf' ? 'max-w-[110px]' : 'max-w-[190px]'"
            :title="film.categoryName"
          >
            {{ film.categoryName }}
          </span>
        </MTag>
      </div>

      <div v-if="film.hashtags.length" class="flex flex-wrap gap-x-2 gap-y-1">
        <span
          v-for="tag in film.hashtags"
          :key="tag"
          class="text-[12px] font-medium"
          style="color: var(--mds-brand-600)"
        >
          #{{ tag }}
        </span>
      </div>

      <!-- Chân thẻ: một đường kẻ rất nhạt tách phần số liệu khỏi phần nội dung, cho thẻ có
           nhịp đọc rõ thay vì một khối chữ đều nhau. -->
      <div
        class="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-2.5 text-[12px]"
        style="border-color: var(--mds-border-light); color: var(--mds-text-secondary)"
      >
        <span class="flex items-center gap-1">
          <MIcon name="eye" :size="13" />
          {{ formatViews(film.viewCount) }}
        </span>
        <span class="flex items-center gap-1">
          <MIcon name="calendar" :size="13" />
          {{ formatVNDate(film.publishedAt) }}
        </span>
        <!-- Người đăng chỉ hiện ở thẻ danh sách (full-width). Thẻ kệ rộng 172px đã kín chỗ với
             lượt xem + ngày; nhồi thêm tên người đăng chỉ ra một chuỗi bị cắt cụt vô nghĩa. -->
        <span
          v-if="variant === 'list'"
          class="ml-auto min-w-0 max-w-[50%] truncate"
          style="color: var(--mds-text-placeholder)"
        >
          {{ film.uploaderName }}
        </span>
      </div>
    </div>
  </article>
</template>
