<script setup lang="ts">
import { computed } from 'vue'
import MIcon from '@/components/mds/MIcon.vue'
import FilmCard from './FilmCard.vue'
import { publishedTime } from './filmTypes'
import type { ApiFilm } from './filmsApi'
import { flattenCategoryTree, type ApiCategoryNode } from '@/features/categories/categoriesApi'

/**
 * "Kệ" phim theo chuyên mục (đợt 2 việc 14) — mỗi chuyên mục CHA là một hàng ngang cuộn được,
 * gồm cả phim nằm trong các chuyên mục CON của nó.
 *
 * Chỉ mượn Ý TƯỞNG BỐ CỤC (hàng ngang theo danh mục + link "Xem tất cả") vốn phổ biến ở các
 * trang xem video; toàn bộ chữ, màu, thẻ phim đều là tài sản MISA sẵn có, không sao chép nội
 * dung hay thương hiệu của bên nào.
 *
 * Cuộn ngang nằm TRONG từng kệ (`overflow-x-auto` trên đúng một container), không để tràn
 * ngang cả trang — nguyên tắc bắt buộc từ GĐ6 (`mobile-pwa.md`).
 */
const props = defineProps<{
  films: ApiFilm[]
  categories: ApiCategoryNode[]
}>()

const emit = defineEmits<{
  (e: 'open', film: ApiFilm): void
  (e: 'edit', film: ApiFilm): void
  (e: 'delete', film: ApiFilm): void
  /** Bấm "Xem tất cả" trên một kệ — trả id chuyên mục cha. */
  (e: 'showAll', categoryId: number): void
}>()

/** Số phim tối đa hiển thị trên một kệ; muốn xem hết thì bấm "Xem tất cả". */
const MAX_PER_SHELF = 12

interface Shelf {
  id: number
  name: string
  films: ApiFilm[]
  total: number
}

const shelves = computed<Shelf[]>(() => {
  const byCategory = new Map<number, ApiFilm[]>()
  for (const f of props.films) {
    if (f.categoryId == null) continue
    const list = byCategory.get(f.categoryId) || []
    list.push(f)
    byCategory.set(f.categoryId, list)
  }

  return props.categories
    .map((parent) => {
      // Gom phim của chính chuyên mục cha VÀ mọi chuyên mục con cháu của nó.
      const ids = flattenCategoryTree([parent]).map((c) => c.id)
      const films = ids
        .flatMap((id) => byCategory.get(id) || [])
        .sort((a, b) => publishedTime(b.publishedAt) - publishedTime(a.publishedAt))
      return { id: parent.id, name: parent.name, films: films.slice(0, MAX_PER_SHELF), total: films.length }
    })
    // Chuyên mục chưa có phim nào thì không dựng kệ rỗng — một hàng trống không nói lên điều gì.
    .filter((s) => s.total > 0)
})
</script>

<template>
  <div v-if="shelves.length" class="flex flex-col gap-4">
    <section
      v-for="shelf in shelves"
      :key="shelf.id"
      class="rounded-lg bg-white p-4"
      style="box-shadow: var(--mds-shadow-card, 0 0 2px 0 rgba(0,0,0,0.1))"
    >
      <div class="mb-3 flex items-center justify-between gap-3">
        <h2 class="text-[14px] font-semibold" style="color: var(--mds-text-primary)">
          {{ shelf.name }}
          <span class="font-normal" style="color: var(--mds-text-secondary)">
            ({{ shelf.total }} phim)
          </span>
        </h2>
        <button
          type="button"
          class="flex shrink-0 items-center gap-1 rounded px-1 text-[13px] font-medium hover:underline"
          style="color: var(--mds-brand-600)"
          @click="emit('showAll', shelf.id)"
        >
          Xem tất cả
          <MIcon name="chevron-right" :size="14" />
        </button>
      </div>

      <!-- Cuộn ngang bị giới hạn trong đúng container này. `pb-1` chừa chỗ cho thanh cuộn để
           nó không đè lên viền thẻ phim. -->
      <div class="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
        <FilmCard
          v-for="film in shelf.films"
          :key="film.id"
          :film="film"
          shelf
          @open="emit('open', $event)"
          @edit="emit('edit', $event)"
          @delete="emit('delete', $event)"
        />
      </div>
    </section>
  </div>
</template>
