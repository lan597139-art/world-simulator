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

export type StoryAct = 'setup' | 'develop' | 'turn' | 'climax'

export interface WritingVolume {
  id: string
  world_id: string
  title: string
  summary: string
  act: StoryAct
  outline_goal: string
  target_words: number
  sort_order: number
  word_count: number
  chapter_count: number
  created_at: string
  updated_at: string
}

export interface WritingChapter {
  id: string
  title: string
  volume_id: string | null
  sort_order: number
  word_count: number
  status: string
  mode: string
  summary: string
  outline_goal: string
  target_words: number
  updated_at: string
  created_at: string
}

export interface WritingTree {
  volumes: WritingVolume[]
  chapters: WritingChapter[]
}

export const getWritingTree = (worldId: string) =>
  request<WritingTree>(`/worlds/${encodeURIComponent(worldId)}/writing-tree`)

export const createWritingVolume = (worldId: string, body: {
  title?: string
  act?: StoryAct
  summary?: string
  outline_goal?: string
  target_words?: number
}) => request<WritingVolume>(`/worlds/${encodeURIComponent(worldId)}/writing-volumes`, {
  method: 'POST',
  body: JSON.stringify(body),
})

export const updateWritingVolume = (id: string, body: Partial<Pick<WritingVolume, 'title' | 'summary' | 'act' | 'outline_goal' | 'target_words' | 'sort_order'>>) =>
  request<WritingVolume>(`/writing-volumes/${id}`, { method: 'PATCH', body: JSON.stringify(body) })

export const deleteWritingVolume = (id: string) =>
  request<{ status: string; deleted: boolean }>(`/writing-volumes/${id}`, { method: 'DELETE' })

export const reorderWritingVolumes = (ids: string[]) =>
  request<{ status: string; count: number }>('/writing-volumes/reorder', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  })

export const moveWritingChapter = (storyId: string, volumeId: string | null, sortOrder = 0) =>
  request<WritingChapter>(`/writings/${storyId}/move`, {
    method: 'PATCH',
    body: JSON.stringify({ volume_id: volumeId, sort_order: sortOrder }),
  })

export const reorderWritingChapters = (volumeId: string | null, storyIds: string[]) =>
  request<{ status: string; count: number }>('/writings/reorder', {
    method: 'POST',
    body: JSON.stringify({ volume_id: volumeId, story_ids: storyIds }),
  })
