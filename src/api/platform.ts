import { API_ORIGIN } from './config'
import { getAuthToken } from './authToken'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken()
  const res = await fetch(`${API_ORIGIN}/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(String(body?.detail || `请求失败（HTTP ${res.status}）`))
  }
  return res.json() as Promise<T>
}

export type GlobalNotification = {
  id: string
  type: string
  title: string
  body: string
  page: string
  read: boolean
  created_at?: string | null
}

export type NotificationSummary = {
  items: GlobalNotification[]
  counts: {
    unread: number
    community: number
    friend_requests: number
    messages: number
  }
}

export type SearchHit = {
  id: string
  title: string
  subtitle?: string
  page: string
  kind: string
}

export type SearchGroup = {
  key: string
  label: string
  items: SearchHit[]
}

export const listGlobalNotifications = () => request<NotificationSummary>('/notifications')

export const readAllGlobalNotifications = () => request<{ ok: boolean }>('/notifications/read-all', { method: 'POST', body: '{}' })

export const searchGlobal = (q: string) => {
  const params = new URLSearchParams({ q, limit: '5' })
  return request<{ query: string; groups: SearchGroup[] }>(`/search?${params.toString()}`)
}
