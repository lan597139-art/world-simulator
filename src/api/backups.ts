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

export interface BackupRow {
  name: string
  size: number
  created_at?: string
}

export function createBackup() {
  return request<{ ok: boolean; name: string; size: number; uploads: number }>('/admin/backups', { method: 'POST', body: '{}' })
}

export function listBackups() {
  return request<{ items: BackupRow[]; keep: number }>('/admin/backups')
}

export async function downloadBackup(name: string) {
  const token = getAuthToken()
  const res = await fetch(`${API_ORIGIN}/api/admin/backups/${encodeURIComponent(name)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) throw new Error(`下载失败（HTTP ${res.status}）`)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
