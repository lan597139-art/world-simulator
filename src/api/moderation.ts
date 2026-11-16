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

export type ReportTargetType = 'post' | 'comment' | 'topic' | 'work' | 'user' | 'message'
export type ReportReason = 'spam' | 'harassment' | 'illegal' | 'adult' | 'misinformation' | 'other'

export type ContentReport = {
  id: string
  target_type: ReportTargetType
  target_id: string
  reason: ReportReason
  detail: string
  status: 'pending' | 'resolved' | 'dismissed'
  reporter?: { id: string; name: string } | null
  target_author?: { id: string; name: string } | null
  resolution_note: string
  created_at?: string | null
  resolved_at?: string | null
}

export const reportContent = (payload: {
  target_type: ReportTargetType
  target_id: string
  reason: ReportReason
  detail?: string
}) => request<{ ok: boolean; duplicate: boolean; report: ContentReport }>('/reports', {
  method: 'POST',
  body: JSON.stringify(payload),
})

export const listAdminReports = (status: 'pending' | 'resolved' | 'dismissed' = 'pending') =>
  request<{ items: ContentReport[]; status: string }>(`/admin/reports?status=${status}`)

export const resolveReport = (id: string, status: 'resolved' | 'dismissed', note = '') =>
  request<ContentReport>(`/admin/reports/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, note }),
  })
