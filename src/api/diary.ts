import { API_ORIGIN } from './config'

const BASE = `${API_ORIGIN}/api`

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, { headers: { 'Content-Type': 'application/json' }, ...init })
  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`
    try { const body = await response.json(); if (body?.detail) message = body.detail } catch { /* status */ }
    throw new Error(message)
  }
  return (await response.json()) as T
}

export type DiarySource =
  | 'user' | 'chat' | 'event' | 'branch' | 'import' | 'ai_draft'
  | 'self_memory' | 'other_account' | 'evidence' | 'ai_inference'

export interface DiaryEntry {
  id: string
  product_key?: string
  world_id?: string | null
  character_id?: string | null
  entry_date: string
  title: string
  content: string
  mood: string
  tags: string[]
  source_type: DiarySource
  source_ref: Record<string, unknown>
  visibility: string
  created_at?: string | null
  updated_at?: string | null
}

export const listDiary = (params: { product?: string; source_type?: string; world_id?: string } = {}) => {
  const query = new URLSearchParams()
  query.set('product', params.product || 'diary')
  if (params.source_type) query.set('source_type', params.source_type)
  if (params.world_id) query.set('world_id', params.world_id)
  return request<DiaryEntry[]>(`/diary/entries?${query}`)
}

export const createDiary = (payload: Partial<DiaryEntry> & { content: string }) =>
  request<DiaryEntry>('/diary/entries', { method: 'POST', body: JSON.stringify(payload) })
export const updateDiary = (id: string, payload: Partial<DiaryEntry>) =>
  request<DiaryEntry>(`/diary/entries/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
export const deleteDiary = (id: string) =>
  request<{ status: string }>(`/diary/entries/${id}`, { method: 'DELETE' })
