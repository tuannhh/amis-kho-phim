import { reactive } from 'vue'

export type FilmSource = 'storage' | 'youtube' | 'vimeo' | 'gdrive' | 'misadrive'

export interface MockFilm {
  id: number
  slug: string
  title: string
  description: string
  category: string
  categoryColor: 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'
  duration: string
  viewCount: number
  hashtags: string[]
  sources: FilmSource[]
  /** URL thật theo từng nguồn — GĐ 0.5 dùng mẫu công khai để demo player/link. */
  links: Partial<Record<FilmSource, string>>
  uploader: string
  uploaderId: number
  publishedAt: string // dd/MM/yyyy
  thumbnailFrom: string
  thumbnailTo: string
  /** Ảnh bìa 16:9 do người dùng tải lên (object URL) — ưu tiên hơn gradient mock. */
  thumbnailUrl?: string
}

/** Bỏ dấu tiếng Việt + chuẩn hoá slug (dùng cho URL /films/:slug). */
export function toSlug(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

const CATEGORY_COLORS: MockFilm['categoryColor'][] = [
  'brand',
  'success',
  'warning',
  'danger',
  'info',
  'neutral',
]
export function colorForCategory(category: string, categories: string[]): MockFilm['categoryColor'] {
  const idx = categories.indexOf(category)
  return CATEGORY_COLORS[idx % CATEGORY_COLORS.length] || 'neutral'
}

export const SOURCE_LABEL: Record<FilmSource, string> = {
  storage: 'Nội bộ',
  youtube: 'YouTube',
  vimeo: 'Vimeo',
  gdrive: 'Google Drive',
  misadrive: 'MISA Drive',
}

export const SOURCE_ICON: Record<FilmSource, string> = {
  storage: 'cloud-download',
  youtube: 'external-link',
  vimeo: 'external-link',
  gdrive: 'external-link',
  misadrive: 'external-link',
}

// Mock "người dùng đang đăng nhập" GĐ 0.5 — thay bằng auth thật ở GĐ 1.
export const CURRENT_MOCK_USER = { id: 1, name: 'Super Admin', role: 'super_admin' as const }

/**
 * Dữ liệu mock GĐ 0.5 — thay bằng API thật ở GĐ 2 (films module).
 * `reactive` để form Thêm/Sửa phim (GĐ 0.5) mô phỏng được publish/update thật
 * trong phiên làm việc, không cần backend.
 */
export const mockFilms: MockFilm[] = reactive([
  {
    id: 1,
    slug: 'gioi-thieu-amis-ke-toan-2026',
    title: 'Giới thiệu tính năng mới AMIS Kế toán 2026',
    description:
      'Video giới thiệu các tính năng nổi bật của AMIS Kế toán phiên bản 2026: tự động hạch toán, báo cáo thuế thông minh và đồng bộ hoá đa chi nhánh.',
    category: 'Giới thiệu sản phẩm',
    categoryColor: 'brand',
    duration: '04:32',
    viewCount: 15420,
    hashtags: ['amis-ketoan', 'san-pham-moi'],
    sources: ['storage', 'youtube'],
    links: {
      storage: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
      youtube: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
    },
    uploader: 'Nguyễn Thị Hồng Nhung',
    uploaderId: 2,
    publishedAt: '18/07/2026',
    thumbnailFrom: '#245FDF',
    thumbnailTo: '#4584EC',
  },
  {
    id: 2,
    slug: 'le-ky-niem-30-nam-thanh-lap-misa',
    title: 'Lễ kỷ niệm 30 năm thành lập MISA',
    description:
      'Toàn cảnh chương trình Lễ kỷ niệm 30 năm thành lập MISA với sự tham gia của toàn thể cán bộ nhân viên và khách mời.',
    category: 'Phim sự kiện',
    categoryColor: 'warning',
    duration: '18:45',
    viewCount: 8934,
    hashtags: ['30-nam-misa', 'su-kien'],
    sources: ['storage', 'gdrive'],
    links: {
      storage: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
      gdrive: 'https://drive.google.com/file/d/0B__example__/view',
    },
    uploader: 'Phòng Truyền thông',
    uploaderId: 1,
    publishedAt: '15/07/2026',
    thumbnailFrom: '#F79009',
    thumbnailTo: '#FDB022',
  },
  {
    id: 3,
    slug: 'dao-tao-ky-nang-ban-hang-b2b',
    title: 'Đào tạo kỹ năng bán hàng B2B cho nhân viên kinh doanh',
    description:
      'Khoá đào tạo nội bộ về kỹ năng bán hàng B2B, quy trình chăm sóc khách hàng doanh nghiệp và kỹ thuật đàm phán hợp đồng.',
    category: 'Phim đào tạo',
    categoryColor: 'info',
    duration: '32:10',
    viewCount: 2103,
    hashtags: ['dao-tao', 'ban-hang'],
    sources: ['misadrive'],
    links: { misadrive: 'https://drive.misa.vn/example-training-b2b' },
    uploader: 'Trần Văn Khoa',
    uploaderId: 3,
    publishedAt: '02/07/2026',
    thumbnailFrom: '#2E90FA',
    thumbnailTo: '#84CAFF',
  },
  {
    id: 4,
    slug: 'giai-bong-da-misa-cup-2026',
    title: 'Giải bóng đá MISA Cup 2026 — Chung kết',
    description:
      'Trận chung kết đầy kịch tính của Giải bóng đá MISA Cup 2026 giữa hai đội xuất sắc nhất mùa giải.',
    category: 'Văn thể mỹ',
    categoryColor: 'success',
    duration: '45:00',
    viewCount: 5672,
    hashtags: ['van-the-my', 'bong-da', 'misa-cup'],
    sources: ['storage', 'youtube'],
    links: {
      storage: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
      youtube: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
    },
    uploader: 'Ban Công đoàn',
    uploaderId: 4,
    publishedAt: '28/06/2026',
    thumbnailFrom: '#12B76A',
    thumbnailTo: '#32D583',
  },
  {
    id: 5,
    slug: 'hanh-trinh-15-nam-hinh-thanh-phat-trien',
    title: 'Hành trình 15 năm hình thành và phát triển MISA JSC',
    description:
      'Phim tư liệu tái hiện chặng đường 15 năm hình thành và phát triển của MISA, từ những ngày đầu thành lập đến nay.',
    category: 'Tư liệu lịch sử',
    categoryColor: 'neutral',
    duration: '22:18',
    viewCount: 12089,
    hashtags: ['tu-lieu', 'lich-su-misa'],
    sources: ['storage'],
    links: { storage: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4' },
    uploader: 'Phòng Truyền thông',
    uploaderId: 1,
    publishedAt: '10/06/2026',
    thumbnailFrom: '#667085',
    thumbnailTo: '#98A2B3',
  },
  {
    id: 6,
    slug: 'gioi-thieu-cong-ty-misa-2026',
    title: 'MISA — Doanh nghiệp công nghệ hàng đầu Việt Nam',
    description:
      'Phim giới thiệu tổng quan về MISA: tầm nhìn, sứ mệnh, hệ sinh thái sản phẩm và đội ngũ nhân sự.',
    category: 'Giới thiệu công ty',
    categoryColor: 'brand',
    duration: '03:15',
    viewCount: 21044,
    hashtags: ['gioi-thieu-cong-ty'],
    sources: ['youtube', 'vimeo'],
    links: {
      youtube: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
      vimeo: 'https://vimeo.com/1084537',
    },
    uploader: 'Phòng Truyền thông',
    uploaderId: 1,
    publishedAt: '01/06/2026',
    thumbnailFrom: '#245FDF',
    thumbnailTo: '#68A6F2',
  },
  {
    id: 7,
    slug: 'huong-dan-su-dung-amis-cong-viec',
    title: 'Hướng dẫn sử dụng AMIS Công việc cho người mới',
    description:
      'Video hướng dẫn chi tiết cách tạo dự án, giao việc và theo dõi tiến độ trên AMIS Công việc dành cho nhân viên mới.',
    category: 'Phim đào tạo',
    categoryColor: 'info',
    duration: '12:40',
    viewCount: 3387,
    hashtags: ['dao-tao', 'amis-cong-viec'],
    sources: ['storage', 'gdrive'],
    links: {
      storage: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
      gdrive: 'https://drive.google.com/file/d/0B__example2__/view',
    },
    uploader: 'Lê Thị Thu Trang',
    uploaderId: 5,
    publishedAt: '20/05/2026',
    thumbnailFrom: '#2E90FA',
    thumbnailTo: '#53B1FD',
  },
  {
    id: 8,
    slug: 'dem-gala-vinh-danh-nhan-vien-xuat-sac',
    title: 'Đêm Gala vinh danh nhân viên xuất sắc năm 2026',
    description:
      'Ghi hình toàn bộ chương trình Gala vinh danh những nhân viên có thành tích xuất sắc trong năm 2026.',
    category: 'Phim sự kiện',
    categoryColor: 'warning',
    duration: '28:55',
    viewCount: 6754,
    hashtags: ['gala', 'vinh-danh', 'su-kien'],
    sources: ['storage'],
    links: { storage: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4' },
    uploader: 'Ban Nhân sự',
    uploaderId: 6,
    publishedAt: '15/05/2026',
    thumbnailFrom: '#F79009',
    thumbnailTo: '#FEC84B',
  },
  {
    id: 9,
    slug: 'gioi-thieu-amis-hop-dong-dien-tu',
    title: 'Giới thiệu AMIS Hợp đồng điện tử',
    description:
      'Video giới thiệu giải pháp AMIS Hợp đồng điện tử: ký số, quản lý vòng đời hợp đồng và tích hợp với AMIS Kế toán.',
    category: 'Giới thiệu sản phẩm',
    categoryColor: 'brand',
    duration: '05:47',
    viewCount: 9210,
    hashtags: ['amis-hop-dong', 'san-pham-moi'],
    sources: ['storage', 'youtube', 'vimeo'],
    links: {
      storage: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
      youtube: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
      vimeo: 'https://vimeo.com/1084537',
    },
    uploader: 'Nguyễn Thị Hồng Nhung',
    uploaderId: 2,
    publishedAt: '02/05/2026',
    thumbnailFrom: '#245FDF',
    thumbnailTo: '#99C5F7',
  },
])

/**
 * Số ngày phim được coi là "mới" kể từ ngày xuất bản/cập nhật bản mới
 * (khớp `NEW_FILM_TTL_DAYS` trong .env.example — GĐ 2+ backend sẽ tính đúng
 * giá trị này qua job/scheduled query; FE mock GĐ 0.5 tự tính để demo đúng
 * hành vi thay vì dùng cờ tĩnh không bao giờ hết hạn).
 */
export const NEW_FILM_TTL_DAYS = 14

export function parseVNDate(s: string): Date {
  const [d, m, y] = s.split('/').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

/** Mốc thời gian xuất bản (ms) — dùng để sắp phim mới nhất lên đầu danh sách. */
export function publishedTime(film: Pick<MockFilm, 'publishedAt'>): number {
  return parseVNDate(film.publishedAt).getTime()
}

/** Phim có được tính là "Phim mới" không — theo `publishedAt` + TTL, không phải cờ tĩnh. */
export function isFilmNew(film: Pick<MockFilm, 'publishedAt'>): boolean {
  const publishedMs = parseVNDate(film.publishedAt).getTime()
  const ageDays = (Date.now() - publishedMs) / (1000 * 60 * 60 * 24)
  return ageDays >= 0 && ageDays <= NEW_FILM_TTL_DAYS
}

/** Tên chuyên mục đang có — dùng cho MSelect ở form Thêm/Sửa phim. */
export function listCategories(): string[] {
  return Array.from(new Set(mockFilms.map((f) => f.category)))
}

/** Hashtag đang có — dùng gợi ý cho MCombobox (allowCreate cho hashtag mới). */
export function listHashtags(): string[] {
  return Array.from(new Set(mockFilms.flatMap((f) => f.hashtags)))
}
