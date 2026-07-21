import { apiFetch } from '@/lib/http'

export type NotificationType = 'new_film' | 'updated'

/** Khớp `PublicNotification` của backend (GĐ5). */
export interface ApiNotification {
  id: number
  notificationId: number
  type: NotificationType
  filmId: number
  filmSlug: string | null
  filmTitle: string
  isRead: boolean
  createdAt: string
}

export const notificationsApi = {
  list: () => apiFetch<ApiNotification[]>('/notifications'),
  unreadCount: () => apiFetch<{ count: number }>('/notifications/unread-count'),
  markRead: (id: number) => apiFetch<{ ok: boolean }>(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead: () => apiFetch<{ ok: boolean }>('/notifications/read-all', { method: 'PATCH' }),
}
