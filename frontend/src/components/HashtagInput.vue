<script setup lang="ts">
import { computed, ref } from 'vue'
import MInput from '@/components/mds/MInput.vue'
import MTag from '@/components/mds/MTag.vue'
import { parseHashtags } from '@/features/upload/hashtags'

/**
 * HashtagInput — ô nhập hashtag kiểu "gõ tự do, ngăn cách bằng dấu phẩy" (ADR-047).
 *
 * Vì sao KHÔNG dùng `MCombobox`: combobox chuẩn MDS là control CHỌN trong một tập lựa chọn có
 * sẵn (xem `references/components/combobox.md`) — một lần Enter = một lựa chọn. Nghiệp vụ ở đây
 * ngược lại: người dùng gõ một chuỗi tự do rồi hệ thống tách ra NHIỀU hashtag theo dấu phẩy,
 * và hashtag nhiều chữ ("Agentic AI") phải giữ nguyên khoảng trắng. Nhồi hành vi này vào
 * combobox sẽ làm lệch hành vi chuẩn của control dùng chung.
 *
 * Thay vào đó control này được LẮP RÁP từ 2 control MDS có sẵn (đúng ưu tiên 1 của quy tắc
 * "control chưa có trong bộ"): `MInput` để nhập + `MTag` closable để hiện hashtag đã chọn.
 * Không viết HTML thô cho input/nút.
 *
 * Commit hashtag khi: gõ dấu phẩy · nhấn Enter · rời khỏi ô (blur). Backspace ở ô rỗng xoá
 * hashtag cuối — hành vi quen thuộc của mọi ô nhập dạng chip.
 */
const props = withDefaults(
  defineProps<{
    /** Danh sách hashtag đã chọn. */
    modelValue: string[]
    /**
     * VÍ DỤ MINH HOẠ cách gõ hashtag — danh sách TĨNH, cố ý KHÔNG lấy từ dữ liệu thật.
     *
     * Trước đây chỗ này đổ toàn bộ hashtag mọi người từng thêm trong kho phim vào. Sai về ý
     * nghĩa: khu vực "Gợi ý:" nằm ngay dưới ô nhập là chỗ dạy người dùng ĐỊNH DẠNG (một chữ,
     * nhiều chữ có khoảng trắng), không phải chỗ liệt kê kho hashtag — danh sách thật sẽ dài
     * vô hạn theo thời gian và đẩy form dài ra. Nếu sau này cần autocomplete theo dữ liệu
     * thật thì làm bằng dropdown lọc theo phần đang gõ, KHÔNG quay lại đổ hết vào đây.
     */
    examples?: string[]
    placeholder?: string
    disabled?: boolean
  }>(),
  {
    examples: () => ['MISA', 'Agentic AI'],
    placeholder: 'Nhập hashtag, cách nhau bằng dấu phẩy. Ví dụ: MISA, Agentic AI',
    disabled: false,
  },
)

const emit = defineEmits<{ (e: 'update:modelValue', v: string[]): void }>()

const draft = ref('')

/** Thêm tất cả hashtag tách được từ `raw` vào danh sách (bỏ rỗng/trùng — xem `parseHashtags`). */
function commit(raw: string) {
  const added = parseHashtags(raw, props.modelValue)
  if (added.length) emit('update:modelValue', [...props.modelValue, ...added])
}

/**
 * Gõ dấu phẩy là chốt ngay hashtag đứng trước nó — người dùng thấy chip hiện ra lập tức nên
 * hiểu ngay quy tắc "phẩy ngăn cách" mà không cần đọc hướng dẫn. Phần sau dấu phẩy cuối cùng
 * còn dở dang thì giữ lại trong ô để gõ tiếp.
 */
function onInput(value: string) {
  if (!value.includes(',')) {
    draft.value = value
    return
  }
  const lastComma = value.lastIndexOf(',')
  commit(value.slice(0, lastComma))
  draft.value = value.slice(lastComma + 1).replace(/^\s+/, '')
}

function onEnter() {
  commit(draft.value)
  draft.value = ''
}

function onBlur() {
  // Rời ô mà còn chữ chưa chốt thì vẫn tính — tránh mất hashtag người dùng tưởng đã nhập xong.
  if (draft.value.trim()) {
    commit(draft.value)
    draft.value = ''
  }
}

function onBackspace() {
  if (draft.value === '' && props.modelValue.length) {
    emit('update:modelValue', props.modelValue.slice(0, -1))
  }
}

function removeAt(index: number) {
  emit(
    'update:modelValue',
    props.modelValue.filter((_, i) => i !== index),
  )
}

function addSuggestion(tag: string) {
  commit(tag)
}

/**
 * Ví dụ hiển thị = danh sách tĩnh, bỏ đi cái nào người dùng đã chọn rồi (hiện lại một chip đã
 * có trong danh sách chọn thì bấm vào không có tác dụng gì, chỉ gây nhiễu).
 * KHÔNG lọc theo phần đang gõ: đây là ví dụ minh hoạ định dạng nên phải luôn nhìn thấy được.
 */
const visibleExamples = computed(() => {
  const chosen = new Set(props.modelValue.map((h) => h.toLowerCase()))
  return props.examples.filter((h) => !chosen.has(h.toLowerCase()))
})
</script>

<template>
  <div class="flex flex-col gap-2">
    <MInput
      :model-value="draft"
      :placeholder="placeholder"
      :disabled="disabled"
      @update:model-value="onInput"
      @keydown.enter.prevent="onEnter"
      @keydown.delete="onBackspace"
      @blur="onBlur"
    />

    <!-- Hashtag đã chọn: chip MTag closable (bấm × để bỏ) -->
    <div v-if="modelValue.length" class="flex flex-wrap gap-1.5">
      <MTag
        v-for="(tag, i) in modelValue"
        :key="`${tag}-${i}`"
        color="brand"
        size="sm"
        closable
        @close="removeAt(i)"
      >
        #{{ tag }}
      </MTag>
    </div>

    <!-- Ví dụ TĨNH minh hoạ cách gõ (một chữ / nhiều chữ) — bấm vào cũng thêm được luôn -->
    <div v-if="!disabled && visibleExamples.length" class="flex flex-wrap items-center gap-1.5">
      <span class="text-[12px]" style="color: var(--mds-text-secondary)">Gợi ý:</span>
      <button
        v-for="tag in visibleExamples"
        :key="tag"
        type="button"
        class="flex min-h-[44px] items-center rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mds-brand-600)] sm:min-h-0"
        @click="addSuggestion(tag)"
      >
        <MTag color="neutral" size="sm">#{{ tag }}</MTag>
      </button>
    </div>
  </div>
</template>
