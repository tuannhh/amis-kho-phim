<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MIcon from '@/components/mds/MIcon.vue'
import FilmForm from './FilmForm.vue'
import { useFilmsStore } from '@/features/films/filmsStore'

/**
 * Trang Thêm/Sửa phim (`/upload`). Từ đợt 2 (việc 10) đây chỉ còn là VỎ TRANG: tiêu đề, nút
 * quay lại, và nhúng `FilmForm.vue` — nơi chứa toàn bộ logic form.
 *
 * Vì sao giữ trang này lại thay vì chuyển hẳn sang popup: link cũ dạng
 * `/upload?edit=<slug>` đã được chia sẻ/đánh dấu, và luồng "Thêm phim" từ menu trái vốn là
 * một trang đầy đủ, ép hết vào dialog sẽ làm form dài phải cuộn trong khung nhỏ. Popup là
 * lối tắt THÊM VÀO, không thay thế.
 */
const route = useRoute()
const router = useRouter()
const store = useFilmsStore()

const editingSlug = computed(() => (route.query.edit as string) || '')
// Chỉ để hiển thị đúng tiêu đề trang; bản thân form tự nạp lại dữ liệu phim đang sửa.
const isEditMode = computed(
  () => !!editingSlug.value && store.films.some((f) => f.slug === editingSlug.value),
)

/**
 * Nút quay lại về đúng Kho phim, giống hệt nút "Hủy" ở chân form — không dùng
 * `history.back()` vì lịch sử có thể đang đứng ở một trang ngoài ứng dụng. Cảnh báo "nội dung
 * chưa lưu" vẫn chạy: nó là route guard trong `FilmForm`, kích hoạt bởi chính lần điều hướng này.
 */
function goBack() {
  router.push({ name: 'films' })
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <header class="flex h-14 shrink-0 items-center gap-2 bg-white px-4">
      <button
        type="button"
        class="flex h-12 w-12 items-center justify-center rounded-lg hover:opacity-80 sm:h-8 sm:w-8"
        style="color: var(--mds-icon-neutral)"
        aria-label="Quay lại"
        @click="goBack"
      >
        <MIcon name="chevron-left" :size="20" />
      </button>
      <h1 class="text-[16px] font-semibold" style="color: var(--mds-text-primary)">
        {{ isEditMode ? 'Sửa thông tin phim' : 'Thêm phim' }}
      </h1>
    </header>

    <div class="min-h-0 flex-1">
      <FilmForm :editing-slug="editingSlug" />
    </div>
  </div>
</template>
