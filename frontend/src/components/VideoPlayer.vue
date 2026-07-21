<script setup lang="ts">
import { computed, ref } from 'vue'
import MButton from '@/components/mds/MButton.vue'
import MIcon from '@/components/mds/MIcon.vue'
import { useToast } from '@/components/mds/toast.js'
import type { FilmSource } from '@/features/films/mockFilms'
import { SOURCE_LABEL } from '@/features/films/mockFilms'

const toast = useToast()

/**
 * VideoPlayer — "catch" phát phim từ nhiều nguồn (file storage / YouTube /
 * Vimeo / Google Drive / MISA Drive). MDS chưa có control Player chuyên dụng
 * (Đợt 3.5) → dựng inline theo token, TODO đề xuất bổ sung vào bộ MDS chung.
 *
 * - storage: <video controls> gốc trình duyệt → có sẵn play/pause/tua/
 *   âm lượng/toàn màn hình, không cần dựng lại control tay.
 * - youtube/vimeo: nhúng iframe player chính thức (đã có đủ điều khiển).
 * - gdrive/misadrive: không nhúng được ổn định → hiện nút mở link ngoài.
 */
const props = defineProps<{
  title: string
  sources: FilmSource[]
  links: Partial<Record<FilmSource, string>>
}>()

// Ưu tiên storage làm nguồn phát mặc định (không phải rời khỏi app)
const preferredOrder: FilmSource[] = ['storage', 'youtube', 'vimeo', 'gdrive', 'misadrive']
const orderedSources = computed(() =>
  preferredOrder.filter((s) => props.sources.includes(s))
)
const activeSource = ref<FilmSource>(orderedSources.value[0])

function selectSource(s: FilmSource) {
  activeSource.value = s
}

function extractYoutubeId(url?: string) {
  if (!url) return ''
  const m = url.match(/(?:v=|youtu\.be\/)([\w-]{6,})/)
  return m ? m[1] : ''
}
function extractVimeoId(url?: string) {
  if (!url) return ''
  const m = url.match(/vimeo\.com\/(\d+)/)
  return m ? m[1] : ''
}

const youtubeEmbed = computed(() => {
  const id = extractYoutubeId(props.links.youtube)
  return id ? `https://www.youtube.com/embed/${id}` : ''
})
const vimeoEmbed = computed(() => {
  const id = extractVimeoId(props.links.vimeo)
  return id ? `https://player.vimeo.com/video/${id}` : ''
})

const isEmbeddable = computed(() =>
  ['storage', 'youtube', 'vimeo'].includes(activeSource.value)
)

// Copy nhanh link phim theo từng nguồn (YouTube/Vimeo/Google Drive/MISA Drive)
async function copyLink(url: string | undefined, label: string) {
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
  <div class="flex flex-col gap-3">
    <!-- Vùng phát -->
    <div class="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
      <!-- Chưa có nguồn phát nào (chưa tải file/chưa nhập link) -->
      <div
        v-if="!orderedSources.length"
        class="flex h-full w-full flex-col items-center justify-center gap-2 text-white"
      >
        <MIcon name="alert-circle" :size="28" />
        <p class="text-[13px]" style="color: rgba(255,255,255,0.75)">Phim chưa có nguồn phát nào</p>
      </div>
      <video
        v-else-if="activeSource === 'storage'"
        :key="links.storage"
        controls
        class="h-full w-full"
        :src="links.storage"
      />
      <iframe
        v-else-if="activeSource === 'youtube' && youtubeEmbed"
        :key="youtubeEmbed"
        class="h-full w-full"
        :src="youtubeEmbed"
        :title="title"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowfullscreen
      />
      <iframe
        v-else-if="activeSource === 'vimeo' && vimeoEmbed"
        :key="vimeoEmbed"
        class="h-full w-full"
        :src="vimeoEmbed"
        :title="title"
        frameborder="0"
        allow="autoplay; fullscreen; picture-in-picture"
        allowfullscreen
      />
      <!-- Google Drive / MISA Drive: mở link ngoài thay vì nhúng -->
      <div
        v-else
        class="flex h-full w-full flex-col items-center justify-center gap-3 text-white"
      >
        <MIcon name="external-link" :size="32" />
        <p class="text-[13px]" style="color: rgba(255,255,255,0.75)">
          Phim này lưu trên {{ SOURCE_LABEL[activeSource] }}, mở bằng liên kết ngoài
        </p>
        <div class="flex items-center gap-2">
          <a :href="links[activeSource]" target="_blank" rel="noopener noreferrer">
            <MButton variant="secondary">
              <template #icon><MIcon name="external-link" :size="16" /></template>
              Mở trên {{ SOURCE_LABEL[activeSource] }}
            </MButton>
          </a>
          <MButton variant="secondary" @click="copyLink(links[activeSource], SOURCE_LABEL[activeSource])">
            <template #icon><MIcon name="copy" :size="16" /></template>
            Copy link
          </MButton>
        </div>
      </div>
    </div>

    <!-- Nút chọn nguồn — hiện đúng nguồn nào phim có -->
    <div v-if="orderedSources.length > 1" class="flex flex-wrap items-center gap-2">
      <span class="text-[12px]" style="color: var(--mds-text-secondary)">Xem từ:</span>
      <button
        v-for="s in orderedSources"
        :key="s"
        type="button"
        class="rounded-md border px-2.5 py-1 text-[12px] font-medium transition"
        :style="
          s === activeSource
            ? 'background: var(--mds-brand-50); border-color: var(--mds-brand-600); color: var(--mds-brand-600)'
            : 'background: var(--mds-bg); border-color: var(--mds-border,#CED1D6); color: var(--mds-text-secondary)'
        "
        @click="selectSource(s)"
      >
        {{ SOURCE_LABEL[s] }}
      </button>
    </div>

    <!-- Nút mở nguồn ngoài song song (luôn hiện, kể cả khi đang xem nhúng) + copy link -->
    <div v-if="orderedSources.length" class="flex flex-wrap items-center gap-3">
      <div
        v-for="s in orderedSources.filter((x) => x !== 'storage')"
        :key="'ext-' + s"
        class="flex items-center gap-0.5"
      >
        <a :href="links[s]" target="_blank" rel="noopener noreferrer">
          <MButton variant="link" size="md">
            <template #icon><MIcon name="external-link" :size="12" /></template>
            {{ SOURCE_LABEL[s] }}
          </MButton>
        </a>
        <button
          type="button"
          :title="`Copy link ${SOURCE_LABEL[s]}`"
          class="flex h-6 w-6 items-center justify-center rounded hover:bg-[var(--mds-bg-hover-soft)]"
          style="color: var(--mds-icon-neutral)"
          @click="copyLink(links[s], SOURCE_LABEL[s])"
        >
          <MIcon name="copy" :size="12" />
        </button>
      </div>
    </div>
  </div>
</template>
