/**
 * 世界创作导航 API：背景 / 地图册 / 插画集 / 共创选择 / 世界作品 / 世界社区。
 *
 * 与后端 backend/world_creation.py 一一对应，全部以世界为作用域。
 * 背景复用世界本体接口（/api/worlds/{id}），设定复用既有世界设定接口。
 */
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

// ---------------------------------------------------------------------------
// 世界本体（背景 / 描述）
// ---------------------------------------------------------------------------

export type WorldLite = {
  id: string
  name: string
  description?: string
  background?: string
  type?: string
  world_scale?: string
  status?: string
  time_status?: string
  map_image_url?: string
  product_scene?: string
  is_product_workspace?: boolean
  createdAt?: string
  updatedAt?: string
}

export const getWorld = (worldId: string) =>
  request<WorldLite>(`/worlds/${encodeURIComponent(worldId)}`)

export const updateWorld = (worldId: string, payload: Partial<WorldLite>) =>
  request<{ status: string }>(`/worlds/${encodeURIComponent(worldId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })

// ---------------------------------------------------------------------------
// 地图册
// ---------------------------------------------------------------------------

export type WorldMap = {
  id: string
  world_id: string
  name: string
  description: string
  image_url: string
  map_scale: string
  sort_order: number
  created_at?: string | null
  updated_at?: string | null
}

export type MapScale = 'world' | 'region' | 'city' | 'district' | 'building' | 'other'

export const listWorldMaps = (worldId: string) =>
  request<WorldMap[]>(`/worlds/${encodeURIComponent(worldId)}/maps`)

export const createWorldMap = (worldId: string, payload: Partial<WorldMap>) =>
  request<WorldMap>(`/worlds/${encodeURIComponent(worldId)}/maps`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const updateWorldMap = (worldId: string, mapId: string, payload: Partial<WorldMap>) =>
  request<WorldMap>(`/worlds/${encodeURIComponent(worldId)}/maps/${mapId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })

export const deleteWorldMap = (worldId: string, mapId: string) =>
  request<{ status: string }>(`/worlds/${encodeURIComponent(worldId)}/maps/${mapId}`, { method: 'DELETE' })

// ---------------------------------------------------------------------------
// 插画集
// ---------------------------------------------------------------------------

export type WorldIllustration = {
  id: string
  world_id: string
  title: string
  description: string
  image_url: string
  sort_order: number
  created_at?: string | null
  updated_at?: string | null
}

export const listWorldIllustrations = (worldId: string) =>
  request<WorldIllustration[]>(`/worlds/${encodeURIComponent(worldId)}/illustrations`)

export const createWorldIllustration = (worldId: string, payload: Partial<WorldIllustration>) =>
  request<WorldIllustration>(`/worlds/${encodeURIComponent(worldId)}/illustrations`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const updateWorldIllustration = (worldId: string, illustrationId: string, payload: Partial<WorldIllustration>) =>
  request<WorldIllustration>(`/worlds/${encodeURIComponent(worldId)}/illustrations/${illustrationId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })

export const deleteWorldIllustration = (worldId: string, illustrationId: string) =>
  request<{ status: string }>(`/worlds/${encodeURIComponent(worldId)}/illustrations/${illustrationId}`, { method: 'DELETE' })

// ---------------------------------------------------------------------------
// 共创开发选择
// ---------------------------------------------------------------------------

export type WorldCocreationChoice = {
  id: string
  world_id: string
  title: string
  description: string
  sort_order: number
  created_at?: string | null
  updated_at?: string | null
}

export const listCocreationChoices = (worldId: string) =>
  request<WorldCocreationChoice[]>(`/worlds/${encodeURIComponent(worldId)}/cocreation-choices`)

export const createCocreationChoice = (worldId: string, payload: Partial<WorldCocreationChoice>) =>
  request<WorldCocreationChoice>(`/worlds/${encodeURIComponent(worldId)}/cocreation-choices`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const updateCocreationChoice = (worldId: string, choiceId: string, payload: Partial<WorldCocreationChoice>) =>
  request<WorldCocreationChoice>(`/worlds/${encodeURIComponent(worldId)}/cocreation-choices/${choiceId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })

export const deleteCocreationChoice = (worldId: string, choiceId: string) =>
  request<{ status: string }>(`/worlds/${encodeURIComponent(worldId)}/cocreation-choices/${choiceId}`, { method: 'DELETE' })

// ---------------------------------------------------------------------------
// 世界作品
// ---------------------------------------------------------------------------

export type WorldWorkKind = 'main' | 'side' | 'fanfic' | 'biography'

export type WorldWork = {
  id: string
  owner_user_id: string
  scene: string
  title: string
  summary: string
  category: string
  status: string
  cover_url: string
  world_ids: string[]
  character_ids: string[]
  work_kind: WorldWorkKind
  created_at?: string | null
  updated_at?: string | null
}

export const listWorldWorks = (worldId: string) =>
  request<WorldWork[]>(`/worlds/${encodeURIComponent(worldId)}/works`)

// ---------------------------------------------------------------------------
// 世界社区
// ---------------------------------------------------------------------------

export type WorldTopic = {
  id: string
  owner_user_id: string
  category: string
  title: string
  body: string
  tags: string[]
  view_count: number
  created_at?: string | null
  updated_at?: string | null
}

export type WorldGroup = {
  id: string
  owner_user_id: string
  name: string
  description: string
  category: string
  visibility: string
  created_at?: string | null
}

export type WorldCommunity = {
  topics: WorldTopic[]
  groups: WorldGroup[]
}

export const listWorldCommunity = (worldId: string) =>
  request<WorldCommunity>(`/worlds/${encodeURIComponent(worldId)}/community`)

export const createWorldTopic = (worldId: string, payload: { title: string; body: string; category?: string; tags?: string[] }) =>
  request<WorldTopic>(`/worlds/${encodeURIComponent(worldId)}/community/topics`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const createWorldGroup = (worldId: string, payload: { name: string; description?: string; category?: string; visibility?: string }) =>
  request<WorldGroup>(`/worlds/${encodeURIComponent(worldId)}/community/groups`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
