import { defineStore } from 'pinia'
import { ref } from 'vue'
import { filmsApi, type ApiFilm } from './filmsApi'

/**
 * Danh sách phim dùng chung (List/Detail/Upload) — refetch toàn bộ sau mỗi
 * create/update/delete (dữ liệu prototype nhỏ, đơn giản hơn cập nhật cục bộ).
 */
export const useFilmsStore = defineStore('films', () => {
  const films = ref<ApiFilm[]>([])
  const loading = ref(false)
  const loaded = ref(false)

  async function load() {
    loading.value = true
    try {
      films.value = await filmsApi.list()
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  async function ensureLoaded() {
    if (!loaded.value && !loading.value) await load()
  }

  return { films, loading, loaded, load, ensureLoaded }
})
