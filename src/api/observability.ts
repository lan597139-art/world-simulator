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

export interface ClientErrorRow {
  id: string
  user_id?: string | null
  message: string
  stack?: string
  url?: string
  page?: string
  user_agent?: string
  created_at?: string
}

export function reportClientError(payload: { message: string; stack?: string; page?: string; url?: string }) {
  return request<{ ok: boolean }>('/client-errors', {
    method: 'POST',
    body: JSON.stringify({ ...payload, url: payload.url || window.location.href }),
  }).catch(() => null)
}

export function listClientErrors(limit = 80) {
  return request<{ items: ClientErrorRow[]; total: number }>(`/admin/client-errors?limit=${limit}`)
}

export function clearClientErrors() {
  return request<{ ok: boolean; deleted: number }>('/admin/client-errors', { method: 'DELETE' })
}
