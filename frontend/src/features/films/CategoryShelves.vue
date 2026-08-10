<script setup lang="ts">
import { computed } from 'vue'
import MIcon from '@/components/mds/MIcon.vue'
import FilmCard from './FilmCard.vue'
import FilmCardMobile from './FilmCardMobile.vue'
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
const props = withDefaults(
  defineProps<{
    films: ApiFilm[]
    categories: ApiCategoryNode[]
    /**
     * GĐ8 — Compact dùng thẻ phim bản mobile (thao tác trong menu "⋯" thay vì hiện khi rê
     * chuột) và mật độ dày hơn. Cách gom phim thành kệ thì DÙNG CHUNG, không tách file
     * riêng cho mobile: đó mới là phần logic dễ lệch nhau khi sửa.
     */
    mobile?: boolean
  }>(),
  { mobile: false },
)

const emit = defineEmits<{
  (e: 'open', film: ApiFilm): void
  (e: 'edit', film: ApiFilm): void
  (e: 'delete', film: ApiFilm): void
  /** Bấm "Xem tất cả" trên một kệ — trả id chuyên mục cha. */
  (e: 'showAll', categoryId: number): void
}>()

/** Số phim tối đa hiển thị trên một kệ; muốn xem hết thì bấm "Xem tất cả".
 *  Mobile ít hơn desktop (ADR-068): kệ mobile là danh sách DỌC theo hàng, 12 phim/kệ sẽ
 *  đẩy các kệ sau xuống quá xa; 3 phim mới nhất là đủ "nếm thử" trước khi bấm "Xem tất cả". */
const MAX_PER_SHELF = computed(() => (props.mobile ? 3 : 12))

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
      return {
        id: parent.id,
        name: parent.name,
        films: films.slice(0, MAX_PER_SHELF.value),
        total: films.length,
      }
    })
    // Chuyên mục chưa có phim nào thì không dựng kệ rỗng — một hàng trống không nói lên điều gì.
    .filter((s) => s.total > 0)
})
</script>

<template>
  <div v-if="shelves.length" class="flex flex-col" :class="mobile ? 'gap-5' : 'gap-4'">
    <!-- Mobile (GĐ8-B): kệ KHÔNG nằm trong hộp trắng. Thẻ phim đã là hộp trắng nổi khối, lồng
         thêm một hộp trắng nữa chỉ tạo hai lớp trắng chồng nhau nhìn bẹt. Tiêu đề kệ đứng
         thẳng trên nền trang, thẻ phim "trôi" bên dưới — đúng nhịp của app di động.
         Desktop giữ NGUYÊN hộp trắng + shadow-card như cũ. -->
    <section
      v-for="shelf in shelves"
      :key="shelf.id"
      :class="mobile ? '' : 'rounded-lg bg-white p-4'"
      :style="mobile ? '' : 'box-shadow: var(--mds-shadow-card, 0 0 2px 0 rgba(0,0,0,0.1))'"
    >
      <div class="mb-3 flex items-center justify-between gap-2">
        <h2
          class="min-w-0 truncate font-semibold"
          :class="mobile ? 'text-[15px]' : 'text-[14px]'"
          style="color: var(--mds-text)"
        >
          {{ shelf.name }}
          <span class="font-normal" style="color: var(--mds-text-secondary)">
            ({{ shelf.total }} phim)
          </span>
        </h2>
        <!-- Mobile: nhãn rút gọn "Tất cả" + vùng chạm cao 48px, không để nút bị ngắt dòng -->
        <button
          type="button"
          class="flex shrink-0 items-center gap-0.5 rounded px-1 text-[13px] font-medium hover:underline"
          :class="mobile ? 'min-h-12' : ''"
          style="color: var(--mds-brand-600)"
          @click="emit('showAll', shelf.id)"
        >
          <span class="whitespace-nowrap">{{ mobile ? 'Tất cả' : 'Xem tất cả' }}</span>
          <MIcon name="chevron-right" :size="14" />
        </button>
      </div>

      <!-- Mobile (ADR-068): danh sách DỌC từng dòng kiểu YouTube, không cuộn ngang nữa —
           người dùng phản hồi kiểu thẻ cuộn ngang cũ "nhìn hơi xấu". Desktop giữ NGUYÊN hàng
           cuộn ngang bằng thẻ `FilmCard` như trước. -->
      <div v-if="mobile" class="flex flex-col divide-y" style="border-color: var(--mds-border-light, #e9eaeb)">
        <FilmCardMobile
          v-for="film in shelf.films"
          :key="film.id"
          :film="film"
          variant="row"
          @open="emit('open', $event)"
          @edit="emit('edit', $event)"
          @delete="emit('delete', $event)"
        />
      </div>

      <!-- Cuộn ngang bị giới hạn trong đúng container này. `pb-1` chừa chỗ cho thanh cuộn để
           nó không đè lên viền thẻ phim. -->
      <div v-else class="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
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
