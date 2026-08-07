<script setup lang="ts">
import { computed } from 'vue'
import MTag from '@/components/mds/MTag.vue'
import MIcon from '@/components/mds/MIcon.vue'
import MDropdownMenu from '@/components/mds/MDropdownMenu.vue'
import { useToast } from '@/components/mds/toast.js'
import { filmSources, type ApiFilm } from './filmsApi'
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
    /** 'list' = thẻ dọc full-width trong danh sách · 'shelf' = thẻ hẹp trong kệ cuộn ngang. */
    variant?: 'list' | 'shelf'
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
  const items: Array<Record<string, unknown>> = filmSources(props.film).map((s) => ({
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
  if (!key) return
  if (key === 'edit') return emit('edit', props.film)
  if (key === 'delete') return emit('delete', props.film)
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
  <article
    class="relative flex flex-col overflow-hidden rounded-lg bg-white active:bg-[var(--mds-bg-hover-soft,#F2F4F7)]"
    :class="variant === 'shelf' ? 'w-[168px] shrink-0' : 'w-full'"
    style="box-shadow: var(--mds-shadow-card, 0 0 2px 0 rgba(0, 0, 0, 0.1))"
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
        class="absolute bottom-1.5 right-1.5 rounded px-1.5 py-0.5 text-[11px] font-medium text-white"
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

    <div class="flex flex-1 flex-col gap-1.5 p-2.5">
      <h3
        class="line-clamp-2 text-[14px] font-medium leading-[19px]"
        style="color: var(--mds-text-primary)"
        :title="film.title"
      >
        {{ film.title }}
      </h3>

      <div class="flex flex-wrap items-center gap-1">
        <!-- Nhãn "Phim mới" do BACKEND quyết định (ADR-052) -->
        <MTag v-if="film.isNew" color="danger" size="sm">Phim mới</MTag>
        <MTag v-if="film.categoryName" :color="categoryColorFor(film.categoryId)" size="sm">
          {{ film.categoryName }}
        </MTag>
      </div>

      <div v-if="film.hashtags.length" class="flex flex-wrap gap-1">
        <span
          v-for="tag in film.hashtags"
          :key="tag"
          class="text-[12px]"
          style="color: var(--mds-brand-600)"
        >
          #{{ tag }}
        </span>
      </div>

      <!-- Số liệu: xếp dọc thay vì một hàng ngang để 320px không bao giờ phải ngắt dòng xấu -->
      <div class="mt-auto flex flex-wrap items-center gap-x-3 gap-y-0.5 pt-0.5 text-[12px]" style="color: var(--mds-text-secondary)">
        <span class="flex items-center gap-1">
          <MIcon name="eye" :size="12" />
          {{ formatViews(film.viewCount) }}
        </span>
        <span class="flex items-center gap-1">
          <MIcon name="calendar" :size="12" />
          {{ formatVNDate(film.publishedAt) }}
        </span>
      </div>
      <div class="truncate text-[12px]" style="color: var(--mds-text-placeholder)">
        {{ film.uploaderName }}
      </div>
    </div>
  </article>
</template>
