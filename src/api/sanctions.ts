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

export type SanctionAction = 'warning' | 'mute' | 'ban'

export interface SanctionRow {
  id: string
  user_id: string
  user_name: string
  action: SanctionAction
  reason: string
  report_id?: string
  created_by_name?: string
  starts_at?: string
  expires_at?: string
  revoked_at?: string
  revoke_note?: string
  appeal_note?: string
  appealed_at?: string
  active: boolean
  created_at?: string
}

export function sanctionReport(reportId: string, payload: { action: SanctionAction; reason: string; hours?: number }) {
  return request<SanctionRow>(`/admin/reports/${reportId}/sanction`, { method: 'POST', body: JSON.stringify(payload) })
}

export function sanctionUser(userId: string, payload: { action: SanctionAction; reason: string; hours?: number }) {
  return request<SanctionRow>(`/admin/users/${userId}/sanctions`, { method: 'POST', body: JSON.stringify(payload) })
}

export function listSanctions(active = false) {
  return request<{ items: SanctionRow[] }>(`/admin/sanctions?active=${active ? 'true' : 'false'}`)
}

export function revokeSanction(id: string, note = '') {
  return request<SanctionRow>(`/admin/sanctions/${id}/revoke`, { method: 'POST', body: JSON.stringify({ note }) })
}

export function mySanctions() {
  return request<{ items: SanctionRow[]; active: SanctionRow[] }>('/account/sanctions')
}

export function appealSanction(id: string, note: string) {
  return request<SanctionRow>(`/account/sanctions/${id}/appeal`, { method: 'POST', body: JSON.stringify({ note }) })
}
