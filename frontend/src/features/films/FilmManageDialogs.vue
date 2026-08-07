<script setup lang="ts">
import { ref } from 'vue'
import MButton from '@/components/mds/MButton.vue'
import MDialog from '@/components/mds/MDialog.vue'
import { useToast } from '@/components/mds/toast.js'
import FilmForm from '@/features/upload/FilmForm.vue'
import { filmsApi, type ApiFilm } from './filmsApi'

/**
 * Hai popup thao tác nhanh với phim (đợt 2 việc 10), gom vào MỘT component để màn Kho phim và
 * màn "Phim tôi quản lý" dùng chung, không chép đôi:
 *
 *   - Sửa  → mở `FilmForm` ở chế độ `embedded` ngay trong dialog, đúng form lúc tạo phim.
 *            Trước đây phải điều hướng sang trang `/upload?edit=...` rồi bấm quay lại.
 *   - Xoá  → dialog xác nhận kiểu `danger` theo `references/communication.md` §3: tiêu đề là
 *            câu hỏi ngắn, mô tả nêu HỆ QUẢ (không lặp lại tiêu đề, không dùng "Bạn có chắc…"),
 *            hai nút xếp theo ưu tiên từ phải sang: [Huỷ] [Xoá].
 *
 * Cách dùng ở màn cha: đặt `ref` rồi gọi `openEdit(film)` / `openDelete(film)`; nghe sự kiện
 * `changed` để tải lại danh sách. Cố ý KHÔNG dùng v-model nhiều chiều — màn cha chỉ cần ra
 * lệnh mở và biết lúc nào dữ liệu đã đổi.
 */
const emit = defineEmits<{
  /** Đã sửa hoặc xoá xong — màn cha tải lại danh sách. */
  (e: 'changed'): void
}>()

const toast = useToast()

const formRef = ref<InstanceType<typeof FilmForm> | null>(null)

const editOpen = ref(false)
const editingSlug = ref('')
const editingTitle = ref('')

const deleteOpen = ref(false)
const deleting = ref(false)
const target = ref<ApiFilm | null>(null)

function openEdit(film: ApiFilm) {
  editingSlug.value = film.slug
  editingTitle.value = film.title
  editOpen.value = true
}

function openDelete(film: ApiFilm) {
  target.value = film
  deleteOpen.value = true
}

function onSaved() {
  editOpen.value = false
  emit('changed')
}

async function confirmDelete() {
  const film = target.value
  if (!film) return
  deleting.value = true
  try {
    await filmsApi.remove(film.id)
    toast.success(`Đã xoá phim "${film.title}"`)
    deleteOpen.value = false
    emit('changed')
  } catch (e: unknown) {
    // Giữ dialog mở khi lỗi để người dùng thấy ngữ cảnh và thử lại, không đóng im lặng.
    toast.error(e instanceof Error ? e.message : 'Xoá phim không thành công')
  } finally {
    deleting.value = false
  }
}

defineExpose({ openEdit, openDelete })
</script>

<template>
  <!-- Sửa: form đầy đủ trong popup. Rộng 720px để lưới 2 cột của form không bị bó lại thành
       1 cột; chiều cao do FilmForm tự cuộn phần thân. -->
  <MDialog v-model="editOpen" :title="`Sửa phim: ${editingTitle}`" :width="720">
    <div class="max-h-[65vh] overflow-y-auto">
      <FilmForm
        v-if="editOpen"
        ref="formRef"
        :key="editingSlug"
        :editing-slug="editingSlug"
        embedded
        hide-footer
        @saved="onSaved"
        @cancel="editOpen = false"
      />
    </div>
    <!-- Footer của DIALOG, không phải của form: nút Lưu phải luôn nhìn thấy, không trôi theo
         nội dung cuộn (quy tắc MDS cho màn Thêm/Sửa). Thứ tự ưu tiên phải→trái. -->
    <template #footer>
      <MButton variant="secondary" :disabled="formRef?.submitting" @click="editOpen = false">
        Hủy
      </MButton>
      <MButton variant="primary" :loading="formRef?.submitting" @click="formRef?.publish()">
        Lưu thay đổi
      </MButton>
    </template>
  </MDialog>

  <!-- Xoá: xác nhận chuẩn MDS type=danger -->
  <MDialog v-model="deleteOpen" title="Xoá vĩnh viễn phim này?" type="danger" :width="440">
    <p class="text-[13px]" style="color: var(--mds-text-primary)">
      <strong>"{{ target?.title }}"</strong> sẽ bị gỡ khỏi kho phim. Hành động không thể hoàn tác.
    </p>
    <template #footer>
      <MButton variant="secondary" :disabled="deleting" @click="deleteOpen = false">Huỷ</MButton>
      <MButton variant="danger" :loading="deleting" @click="confirmDelete">Xoá</MButton>
    </template>
  </MDialog>
</template>
