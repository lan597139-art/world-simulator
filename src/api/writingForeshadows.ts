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

export type ForeshadowStatus = 'pending' | 'planted' | 'paid' | 'abandoned'
export type ForeshadowPayoff = '信息' | '情绪' | '危机'

export interface ForeshadowItem {
  id: string
  world_id: string
  story_id: string | null
  story_title: string
  event_id: string | null
  text: string
  promise: string
  cost: string
  planned_story_id: string | null
  planned_story_title: string
  resolved_story_id: string | null
  resolved_story_title: string
  payoff_form: ForeshadowPayoff
  status: ForeshadowStatus
  tags: string[]
  created_at: string
  updated_at: string
}

export const listForeshadows = (worldId: string, status = 'all') =>
  request<ForeshadowItem[]>(`/worlds/${encodeURIComponent(worldId)}/writing-foreshadows?status=${encodeURIComponent(status)}`)

export const listStoryForeshadows = (storyId: string) =>
  request<ForeshadowItem[]>(`/writings/${storyId}/foreshadows`)

export const createForeshadow = (storyId: string, body: {
  text: string
  promise?: string
  cost?: string
  planned_story_id?: string
  event_id?: string
  payoff_form?: ForeshadowPayoff
  tags?: string[]
}) => request<ForeshadowItem>(`/writings/${storyId}/foreshadows`, {
  method: 'POST',
  body: JSON.stringify(body),
})

export const updateForeshadow = (id: string, body: Partial<Pick<ForeshadowItem, 'text' | 'promise' | 'cost' | 'planned_story_id' | 'resolved_story_id' | 'payoff_form' | 'status'>>) =>
  request<ForeshadowItem>(`/writing-foreshadows/${id}`, { method: 'PATCH', body: JSON.stringify(body) })

export const resolveForeshadow = (id: string, storyId?: string) =>
  request<ForeshadowItem>(`/writing-foreshadows/${id}/resolve`, {
    method: 'POST',
    body: JSON.stringify({ story_id: storyId }),
  })

export const deleteForeshadow = (id: string) =>
  request<{ status: string; deleted: boolean }>(`/writing-foreshadows/${id}`, { method: 'DELETE' })
