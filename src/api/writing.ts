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
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

const get = <T,>(path: string) => request<T>(path)
const post = <T,>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) })
const patch = <T,>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) })
const del = <T,>(path: string) => request<T>(path, { method: 'DELETE' })

export interface StoryItem {
  id: string
  world_id: string | null
  title: string
  content: string
  plain_text: string
  word_count: number
  mode: 'architect' | 'explorer'
  status: 'draft' | 'published'
  source_event_ids: string[]
  source_simulation_ids: string[]
  created_at: string
  updated_at: string
}

export interface DraftItem {
  id: string
  world_id: string
  story_id: string | null
  story_title: string | null
  entity_type: 'character' | 'location' | 'event' | 'organization' | 'relationship'
  name: string
  summary: string
  payload: Record<string, unknown>
  evidence: string
  confidence: number
  status: 'pending' | 'accepted' | 'ignored'
  target_label?: string
  target_branch?: string
  target_detail?: string
  approved_entity_id?: string | null
  created_at: string
  updated_at: string
}

export interface AnalyzeResult {
  engine: 'ai' | 'heuristic'
  count: number
  drafts: DraftItem[]
}

export const listStories = (worldId?: string) =>
  get<StoryItem[]>(`/writings${worldId ? `?world_id=${encodeURIComponent(worldId)}` : ''}`)

export const getStory = (id: string) => get<StoryItem>(`/writings/${id}`)

export const createStory = (body: {
  world_id?: string
  title?: string
  content?: string
  plain_text?: string
  mode?: 'architect' | 'explorer'
  status?: 'draft' | 'published'
  source_event_ids?: string[]
}) => post<StoryItem>('/writings', body)

export const updateStory = (
  id: string,
  body: Partial<Pick<StoryItem, 'title' | 'content' | 'plain_text' | 'mode' | 'status' | 'source_event_ids'>>
) => patch<StoryItem>(`/writings/${id}`, body)

export const deleteStory = (id: string) => del<{ status: string }>(`/writings/${id}`)

export const analyzeStory = (
  id: string,
  body: { text?: string; target_types?: string[] }
) => post<AnalyzeResult>(`/writings/${id}/analyze`, body)

export const listStoryDrafts = (storyId: string, status = 'all') =>
  get<DraftItem[]>(`/writings/${storyId}/drafts?status=${encodeURIComponent(status)}`)

export const listWorldDrafts = (worldId: string, status = 'pending') =>
  get<DraftItem[]>(`/worlds/${worldId}/drafts?status=${encodeURIComponent(status)}`)

export const updateDraft = (
  id: string,
  body: { name?: string; summary?: string; payload?: Record<string, unknown>; status?: DraftItem['status'] }
) => patch<DraftItem>(`/drafts/${id}`, body)

export const approveDraft = (id: string, fields?: Record<string, unknown>) =>
  post<{
    status: string
    entity_type: string
    entity_id: string
    node_id: string | null
    target_label: string
    target_branch: string
    target_detail: string
    message: string
  }>(`/drafts/${id}/approve`, { fields: fields ?? {} })

export const ignoreDraft = (id: string) => post<{ status: string }>(`/drafts/${id}/ignore`)

export const deleteDraft = (id: string) => del<{ status: string }>(`/drafts/${id}`)

export const undoDraftApproval = (id: string) =>
  post<{ status: string; removed_entity: boolean; target_label: string; message: string }>(
    `/drafts/${id}/undo`
  )

async function streamText(
  path: string,
  body: unknown,
  onChunk: (text: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`
    try {
      const data = await res.json()
      if (data?.detail) message = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail)
    } catch {
      /* keep status text */
    }
    throw new Error(message)
  }
  const reader = res.body?.getReader()
  if (!reader) throw new Error('浏览器不支持流式读取')
  const decoder = new TextDecoder('utf-8')
  let full = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    const text = decoder.decode(value, { stream: true })
    full += text
    onChunk(text)
  }
  return full
}

export const streamGenerate = (
  body: { world_id?: string; event_ids?: string[]; user_direction?: string; perspective?: string; branch_id?: string },
  onChunk: (text: string) => void,
  signal?: AbortSignal
) => streamText('/writing/generate', body, onChunk, signal)

export const streamAssist = (
  body: { action: string; text: string; context?: string },
  onChunk: (text: string) => void,
  signal?: AbortSignal
) => streamText('/writing/assist', body, onChunk, signal)
