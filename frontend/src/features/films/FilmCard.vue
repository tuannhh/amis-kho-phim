<script setup lang="ts">
import { computed } from 'vue'
import MTag from '@/components/mds/MTag.vue'
import MIcon from '@/components/mds/MIcon.vue'
import { useToast } from '@/components/mds/toast.js'
import { filmSources, type ApiFilm } from './filmsApi'
import { SOURCE_LABEL, categoryColorFor, thumbnailGradient, formatVNDate } from './filmTypes'
import { useAuthStore } from '@/features/auth/authStore'
import { canManageFilm } from '@/features/auth/permissions'

/**
 * Thẻ phim dùng chung cho Kho phim (lưới + kệ ngang) và màn "Phim tôi quản lý" — gom lại ở
 * đợt 2 vì cùng một thẻ đang phải hiện ở ba nơi; chép ba bản là chắc chắn lệch nhau sau vài
 * lần sửa.
 *
 * Nút Sửa/Xoá hiện khi rê chuột và CHỈ khi người dùng thực sự có quyền (`canManageFilm`, bản
 * sao có chủ đích của quy tắc backend). Bấm vào nút KHÔNG mở trang chi tiết — mọi handler đều
 * `stopPropagation`, vì cả thẻ là một vùng bấm được.
 */
const props = withDefaults(
  defineProps<{
    film: ApiFilm
    /** Cho phép hiện nút Sửa/Xoá khi rê chuột (màn nào không cần thì tắt). */
    manageable?: boolean
    /** Thẻ nằm trong kệ cuộn ngang → cần bề rộng cố định thay vì co theo lưới. */
    shelf?: boolean
  }>(),
  { manageable: true, shelf: false },
)

const emit = defineEmits<{
  (e: 'open', film: ApiFilm): void
  (e: 'edit', film: ApiFilm): void
  (e: 'delete', film: ApiFilm): void
}>()

const auth = useAuthStore()
const toast = useToast()

const canManage = computed(() => props.manageable && canManageFilm(auth.user, props.film))

function formatViews(n: number) {
  return n.toLocaleString('vi-VN')
}

async function copyLink(url: string | undefined, label: string, event: Event) {
  event.stopPropagation()
  if (!url) return
  try {
    await navigator.clipboard.writeText(url)
    toast.success(`Đã copy link ${label}`)
  } catch {
    toast.error('Không thể copy link — trình duyệt chặn quyền clipboard')
  }
}
</script>

<template>
  <article
    class="group relative flex cursor-pointer flex-col overflow-hidden rounded-lg bg-white ring-1 ring-transparent transition hover:ring-[var(--mds-brand-600)]"
    :class="shelf ? 'w-[240px] shrink-0' : ''"
    style="box-shadow: var(--mds-shadow-card, 0 0 2px 0 rgba(0,0,0,0.1))"
    @click="emit('open', film)"
  >
    <!-- Thumbnail 16:9 — ảnh bìa thật (MinIO) nếu có, fallback gradient theo chuyên mục -->
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
        class="absolute bottom-2 right-2 rounded px-1.5 py-0.5 text-[11px] font-medium text-white"
        style="background: rgba(0, 0, 0, 0.55)"
      >
        {{ film.duration }}
      </span>
      <span
        class="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100"
        style="background: rgba(0, 0, 0, 0.15)"
      >
        <span
          class="flex h-11 w-11 items-center justify-center rounded-full"
          style="background: rgba(255, 255, 255, 0.9)"
        >
          <span
            class="ml-0.5 h-0 w-0 border-y-[7px] border-l-[11px] border-y-transparent"
            style="border-left-color: var(--mds-brand-600)"
          />
        </span>
      </span>

      <!-- Thao tác nhanh: mở popup Sửa / popup xác nhận Xoá, không rời trang (việc 10) -->
      <div
        v-if="canManage"
        class="absolute right-2 top-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
      >
        <button
          type="button"
          class="flex h-7 w-7 items-center justify-center rounded-md"
          style="background: rgba(255, 255, 255, 0.92); color: var(--mds-icon-neutral)"
          title="Sửa thông tin phim"
          aria-label="Sửa thông tin phim"
          @click.stop="emit('edit', film)"
        >
          <MIcon name="pencil" :size="14" />
        </button>
        <button
          type="button"
          class="flex h-7 w-7 items-center justify-center rounded-md"
          style="background: rgba(255, 255, 255, 0.92); color: var(--mds-danger)"
          title="Xoá phim"
          aria-label="Xoá phim"
          @click.stop="emit('delete', film)"
        >
          <MIcon name="trash" :size="14" />
        </button>
      </div>
    </div>

    <div class="flex flex-1 flex-col gap-2 p-3">
      <h3
        class="line-clamp-2 text-[14px] font-medium leading-[19px]"
        style="color: var(--mds-text-primary)"
        :title="film.title"
      >
        {{ film.title }}
      </h3>

      <div class="flex flex-wrap items-center gap-1.5">
        <!-- Nhãn do BACKEND quyết định (ADR-052) — phim cũ trùng tên đã bị bỏ nhãn từ server. -->
        <MTag v-if="film.isNew" color="danger" size="sm">Phim mới</MTag>
        <MTag v-if="film.categoryName" :color="categoryColorFor(film.categoryId)" size="sm">
          {{ film.categoryName }}
        </MTag>
        <button
          v-for="src in filmSources(film)"
          :key="src"
          type="button"
          class="inline-flex h-5 items-center gap-1 rounded px-2 text-[12px] font-medium transition hover:brightness-95"
          style="background: var(--mds-bg-disabled); color: var(--mds-text-secondary)"
          :title="`Copy link ${SOURCE_LABEL[src]}`"
          @click="copyLink(film.links[src], SOURCE_LABEL[src], $event)"
        >
          {{ SOURCE_LABEL[src] }}
          <MIcon name="copy" :size="12" />
        </button>
      </div>

      <div class="flex flex-wrap gap-1">
        <span
          v-for="tag in film.hashtags"
          :key="tag"
          class="text-[12px]"
          style="color: var(--mds-brand-600)"
        >
          #{{ tag }}
        </span>
      </div>

      <div
        class="mt-auto flex items-center justify-between pt-1 text-[12px]"
        style="color: var(--mds-text-secondary)"
      >
        <span class="flex items-center gap-1">
          <MIcon name="eye" :size="12" />
          {{ formatViews(film.viewCount) }} lượt xem
        </span>
        <span>{{ formatVNDate(film.publishedAt) }}</span>
      </div>
      <div class="truncate text-[12px]" style="color: var(--mds-text-placeholder)">
        {{ film.uploaderName }}
      </div>
    </div>
  </article>
</template>
