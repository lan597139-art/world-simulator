import { API_ORIGIN } from './config'

const BASE = `${API_ORIGIN}/api`

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`
    try {
      const body = await response.json()
      if (body?.detail) message = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
    } catch {
      /* keep status */
    }
    throw new Error(message)
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export interface StoryProject {
  id: string
  world_id: string
  title: string
  premise: string
  status: 'planning' | 'active' | 'completed' | 'archived'
  settings: Record<string, unknown>
  official_key?: string | null
  created_at?: string
}

export interface StorySpace {
  id: string
  story_id: string
  name: string
  is_original: boolean
  parent_space_id?: string | null
  fork_choice_id?: string | null
  branch_id?: string | null
  base_node_id?: string | null
  status: 'active' | 'archived'
  summary: string
  node_count: number
  unit_count: number
  ending_count: number
  created_at?: string
}

export interface StoryUnit {
  id: string
  story_id: string
  space_id: string
  parent_unit_id?: string | null
  kind: 'mainline' | 'side' | 'instance' | 'phase'
  title: string
  summary: string
  order_index: number
  status: string
  event_count: number
  meta: Record<string, unknown>
}

export interface StoryUnitEvent {
  id: string
  unit_id: string
  event_id: string
  role: string
  order_index: number
  is_shared: boolean
  note: string
  event_name: string
  event_polarity: string
  event_intensity: string
  branch_id?: string | null
}

export interface StoryOption {
  id: string
  choice_id: string
  label: string
  description: string
  consequence: string
  target_space_id?: string | null
  source: 'user' | 'ai'
  confirmed: boolean
  order_index: number
}

export interface StoryChoice {
  id: string
  story_id: string
  space_id: string
  anchor_event_id?: string | null
  title: string
  description: string
  precondition: Record<string, unknown>
  allow_rejoin: boolean
  status: 'open' | 'resolved' | 'abandoned'
  resolved_option_id?: string | null
  options: StoryOption[]
}

export interface StoryEnding {
  id: string
  story_id: string
  space_id: string
  node_id?: string | null
  name: string
  content: string
  kind: 'final' | 'stage' | 'open'
  is_final: boolean
  path_event_ids: string[]
  path_node_ids: string[]
  precondition: Record<string, unknown>
  source_ending_id?: string | null
}

export interface StoryDetail extends StoryProject {
  space_count: number
  original_space_id?: string | null
  spaces: StorySpace[]
  endings: StoryEnding[]
}

export const listStories = (worldId: string) => request<StoryProject[]>(`/worlds/${worldId}/stories`)
export const createStory = (payload: { world_id: string; title: string; premise?: string }) =>
  request<StoryProject>('/stories', { method: 'POST', body: JSON.stringify(payload) })
export const getStory = (id: string) => request<StoryDetail>(`/stories/${id}`)
export const updateStory = (id: string, payload: Partial<StoryProject>) =>
  request<StoryProject>(`/stories/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })

export const createSpace = (storyId: string, payload: {
  name: string
  is_original?: boolean
  parent_space_id?: string
  fork_choice_id?: string
  anchor_event_id?: string
  base_node_id?: string
  summary?: string
}) => request<StorySpace>(`/stories/${storyId}/spaces`, { method: 'POST', body: JSON.stringify(payload) })
export const listSpaces = (storyId: string) => request<StorySpace[]>(`/stories/${storyId}/spaces`)
export const updateSpace = (id: string, payload: { name?: string; summary?: string; status?: string }) =>
  request<StorySpace>(`/spaces/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
export const rollbackSpace = (id: string, nodeId: string, reason?: string) =>
  request<{ space: StorySpace; rollback: any }>(`/spaces/${id}/rollback`, {
    method: 'POST',
    body: JSON.stringify({ node_id: nodeId, reason }),
  })

export const listUnits = (spaceId: string) => request<StoryUnit[]>(`/spaces/${spaceId}/units`)
export const createUnit = (spaceId: string, payload: {
  kind: string
  title: string
  summary?: string
  parent_unit_id?: string
  order_index?: number
}) => request<StoryUnit>(`/spaces/${spaceId}/units`, { method: 'POST', body: JSON.stringify(payload) })
export const updateUnit = (id: string, payload: Partial<StoryUnit>) =>
  request<StoryUnit>(`/units/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
export const deleteUnit = (id: string) => request<{ status: string }>(`/units/${id}`, { method: 'DELETE' })

export const listUnitEvents = (unitId: string) => request<StoryUnitEvent[]>(`/units/${unitId}/events`)
export const addUnitEvent = (unitId: string, payload: { event_id: string; role?: string; is_shared?: boolean; note?: string }) =>
  request<StoryUnitEvent>(`/units/${unitId}/events`, { method: 'POST', body: JSON.stringify(payload) })
export const removeUnitEvent = (unitId: string, eventId: string) =>
  request<{ status: string }>(`/units/${unitId}/events/${eventId}`, { method: 'DELETE' })

export const listChoices = (spaceId: string) => request<StoryChoice[]>(`/spaces/${spaceId}/choices`)
export const createChoice = (spaceId: string, payload: { title: string; anchor_event_id?: string; description?: string }) =>
  request<StoryChoice>(`/spaces/${spaceId}/choices`, { method: 'POST', body: JSON.stringify(payload) })
export const addOption = (choiceId: string, payload: { label: string; consequence?: string; source?: string }) =>
  request<StoryOption>(`/choices/${choiceId}/options`, { method: 'POST', body: JSON.stringify(payload) })
export const resolveChoice = (choiceId: string, payload: { option_id?: string; space_name?: string }) =>
  request<{ choice: StoryChoice; space: StorySpace }>(`/choices/${choiceId}/resolve`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const listEndings = (spaceId: string) => request<StoryEnding[]>(`/spaces/${spaceId}/endings`)
export const createEnding = (spaceId: string, payload: {
  name: string
  content?: string
  kind?: string
  is_final?: boolean
  node_id?: string
}) => request<StoryEnding>(`/spaces/${spaceId}/endings`, { method: 'POST', body: JSON.stringify(payload) })

export const compareSpaces = (spaceIds: string[]) =>
  request<{ spaces: any[]; differences: any }>('/stories/compare-spaces', {
    method: 'POST',
    body: JSON.stringify({ space_ids: spaceIds }),
  })
export const importBranch = (storyId: string, branchId: string, name?: string) =>
  request<StorySpace>(`/stories/${storyId}/import-branch`, {
    method: 'POST',
    body: JSON.stringify({ branch_id: branchId, name }),
  })
