import { ref } from 'vue'

/**
 * Ô tìm kiếm DUY NHẤT của app: ô tìm kiếm trên MHeaderBar (App.vue) ghi vào
 * đây khi bấm Enter; FilmListView đọc để lọc — tránh 2 ô tìm kiếm trùng chức
 * năng (1 ở header, 1 ở toolbar danh sách).
 */
export const filmSearchQuery = ref('')
