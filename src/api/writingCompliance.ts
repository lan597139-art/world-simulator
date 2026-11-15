import { API_ORIGIN } from './config'

const API_BASE = `${API_ORIGIN}/api`

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`
    try {
      const body = await res.json()
      if (body?.detail) message = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
    } catch {
      /* keep status text */
    }
    throw new Error(message)
  }
  return (await res.json()) as T
}

export interface SensitiveWord {
  id: string
  word: string
  category: string
  severity: 'warn' | 'block'
  created_at: string
}

export interface SensitiveHit {
  word: string
  count: number
  severity: 'warn' | 'block'
  category: string
  positions: number[]
}

export interface SensitiveScan {
  hits: SensitiveHit[]
  total: number
  word_count: number
  text_length: number
}

export const listSensitiveWords = () => request<SensitiveWord[]>('/writing/sensitive-words')

export const saveSensitiveWords = (words: Array<string | { word: string; category?: string; severity?: 'warn' | 'block' }>, replace = false) =>
  request<{ status: string; count: number }>('/writing/sensitive-words', {
    method: 'PUT',
    body: JSON.stringify({ words, replace }),
  })

export const deleteSensitiveWord = (id: string) =>
  request<{ status: string; deleted: boolean }>(`/writing/sensitive-words/${id}`, { method: 'DELETE' })

export const scanSensitiveText = (text: string) =>
  request<SensitiveScan>('/writing/sensitive-scan', { method: 'POST', body: JSON.stringify({ text }) })
