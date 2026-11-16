import { API_ORIGIN } from './config'

const BASE = `${API_ORIGIN}/api`

export type WorkScene = 'game' | 'literature' | 'comic' | 'companion' | 'diary'
export type WorkStatus = 'draft' | 'in_progress' | 'completed' | 'archived'

export interface CreativeWork {
  id: string
  owner_user_id: string
  scene: WorkScene
  title: string
  summary: string
  category: string
  status: WorkStatus
  cover_url: string
  world_ids: string[]
  character_ids: string[]
  settings: Record<string, unknown>
  created_at?: string | null
  updated_at?: string | null
}

export interface WorkSummary {
  total: number
  by_scene: Record<WorkScene, number>
  by_status: Record<WorkStatus, number>
}

export const SCENE_CATEGORIES: Record<WorkScene, string[]> = {
  game: ['世界观', '角色扮演', '剧情互动', '模拟经营', '其他'],
  literature: ['长篇小说', '短篇小说', '系列作品', '同人创作', '其他'],
  comic: ['长篇漫画', '短篇漫画', '条漫', '分镜稿', '其他'],
  companion: ['AI 角色', '陪伴角色', '群像角色', '其他'],
  diary: ['日记', '人物传记', '回忆录', '人生记录', '其他'],
}

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
    } catch { /* keep status */ }
    throw new Error(message)
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export function listWorks(params: { scene?: WorkScene; status?: WorkStatus; world_id?: string; q?: string } = {}) {
  const search = new URLSearchParams()
  if (params.scene) search.set('scene', params.scene)
  if (params.status) search.set('status', params.status)
  if (params.world_id) search.set('world_id', params.world_id)
  if (params.q) search.set('q', params.q)
  const qs = search.toString()
  return request<CreativeWork[]>(`/creative-works${qs ? `?${qs}` : ''}`)
}

export const getWorkSummary = () => request<WorkSummary>('/creative-works/summary')
export const getWork = (workId: string) => request<CreativeWork>(`/creative-works/${workId}`)

export const createWork = (payload: {
  scene: WorkScene
  title: string
  summary?: string
  category?: string
  status?: WorkStatus
  cover_url?: string
  world_ids?: string[]
  character_ids?: string[]
}) => request<CreativeWork>('/creative-works', { method: 'POST', body: JSON.stringify(payload) })

export const updateWork = (workId: string, payload: Partial<{
  scene: WorkScene
  title: string
  summary: string
  category: string
  status: WorkStatus
  cover_url: string
  world_ids: string[]
  character_ids: string[]
}>) => request<CreativeWork>(`/creative-works/${workId}`, { method: 'PATCH', body: JSON.stringify(payload) })

export const deleteWork = (workId: string) =>
  request<{ status: string }>(`/creative-works/${workId}`, { method: 'DELETE' })
