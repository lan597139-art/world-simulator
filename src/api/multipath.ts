import { API_ORIGIN } from './config'

const BASE = `${API_ORIGIN}/api`

export interface Direction {
  id: string
  event_id: string
  name: string
  description: string
  trigger_conditions: string[]
  related_character_ids: string[]
  cognition: { meaning?: string; attribution?: string; certainty?: number | string }
  engine_activation: { competing?: string[]; dominant?: string[] }
  behavior_output: string
  reality_resistance: string
  direct_result: string
  future_impacts: string[]
  sort_order: number
  enabled: boolean
  source: 'user' | 'ai' | 'ai_confirmed'
  confirmed: boolean
  note: string
}

export interface Branch {
  id: string
  world_id: string
  root_event_id: string
  source_direction_id?: string | null
  parent_branch_id?: string | null
  parent_node_id?: string | null
  name: string
  note: string
  status: 'active' | 'paused' | 'archived'
  node_count: number
  ending_count: number
  created_at?: string
  updated_at?: string
}

export interface BranchNode {
  id: string
  branch_id: string
  seq: number
  kind: string
  event_id?: string | null
  run_id?: string | null
  summary: string
  source: string
  rollback_reason: string
  created_at?: string
}

export interface Ending {
  id: string
  world_id: string
  branch_id: string
  node_id: string
  name: string
  description: string
  key_reasons: string
  allow_continue: boolean
  created_at?: string
  path_node_ids?: string[]
  character_final_states?: any[]
  relationship_changes?: any[]
  resource_changes?: any[]
  world_changes?: any[]
}

export interface BranchDetail extends Branch {
  nodes: BranchNode[]
  endings: Ending[]
}

export interface SimulateResult {
  run: { id: string; world_changes: string; character_actions: any[]; direction: string; created_at?: string }
  node: BranchNode
  branch: Branch
  applied: { relationships: number; actions: number }
  state_hint: string
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  const text = await response.text()
  let data: any = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  if (!response.ok) {
    const detail = data && typeof data === 'object' ? data.detail || data.message : data
    throw new Error(String(detail || `请求失败（${response.status}）`))
  }
  return data as T
}

// ---- 方向 ----
export const listDirections = (eventId: string) =>
  request<Direction[]>(`/events/${eventId}/directions`)

export const createDirection = (eventId: string, payload: Partial<Direction>) =>
  request<Direction>(`/events/${eventId}/directions`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const updateDirection = (id: string, payload: Partial<Direction>) =>
  request<Direction>(`/directions/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })

export const deleteDirection = (id: string) =>
  request<{ status: string }>(`/directions/${id}`, { method: 'DELETE' })

export const duplicateDirection = (id: string) =>
  request<Direction>(`/directions/${id}/duplicate`, { method: 'POST' })

export const toggleDirection = (id: string) =>
  request<Direction>(`/directions/${id}/toggle`, { method: 'POST' })

export const reorderDirections = (eventId: string, ids: string[]) =>
  request<{ status: string }>(`/events/${eventId}/directions/reorder`, {
    method: 'PATCH',
    body: JSON.stringify({ ids }),
  })

export const suggestDirections = (eventId: string, count = 4) =>
  request<{ directions: Partial<Direction>[] }>(`/events/${eventId}/directions/suggest`, {
    method: 'POST',
    body: JSON.stringify({ count }),
  })

// ---- 分支 ----
export const listBranches = (worldId: string) => request<Branch[]>(`/worlds/${worldId}/branches`)

export const createBranch = (payload: {
  root_event_id: string
  source_direction_id?: string
  name?: string
  parent_branch_id?: string
  parent_node_id?: string
  note?: string
}) => request<Branch>('/branches', { method: 'POST', body: JSON.stringify(payload) })

export const getBranch = (id: string) => request<BranchDetail>(`/branches/${id}`)

export const updateBranch = (id: string, payload: Partial<Branch>) =>
  request<Branch>(`/branches/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })

export const pauseBranch = (id: string) => request<Branch>(`/branches/${id}/pause`, { method: 'POST' })

export const resumeBranch = (id: string) => request<Branch>(`/branches/${id}/resume`, { method: 'POST' })

export const duplicateBranch = (id: string) =>
  request<Branch>(`/branches/${id}/duplicate`, { method: 'POST', body: JSON.stringify({}) })

export const archiveBranch = (id: string) =>
  request<{ status: string }>(`/branches/${id}`, { method: 'DELETE' })

export const listNodes = (branchId: string) => request<BranchNode[]>(`/branches/${branchId}/nodes`)

export const simulateBranch = (
  branchId: string,
  payload: { event_id: string; direction_id?: string; perspective?: string }
) => request<SimulateResult>(`/branches/${branchId}/simulate`, { method: 'POST', body: JSON.stringify(payload) })

export const rollbackBranch = (branchId: string, nodeId: string, reason?: string) =>
  request<{ branch: Branch; node: BranchNode; rolled_back_to: BranchNode }>(
    `/branches/${branchId}/rollback`,
    { method: 'POST', body: JSON.stringify({ node_id: nodeId, reason }) }
  )

export const applyBranch = (branchId: string, nodeId?: string) =>
  request<{ status: string; applied_node: BranchNode; backup_snapshot: boolean }>(
    `/branches/${branchId}/apply`,
    { method: 'POST', body: JSON.stringify(nodeId ? { node_id: nodeId } : {}) }
  )

export const compareBranches = (branchIds: string[]) =>
  request<any>('/branches/compare', { method: 'POST', body: JSON.stringify({ branch_ids: branchIds }) })

// ---- 结局 ----
export const createEnding = (
  branchId: string,
  payload: { node_id?: string; name?: string; description?: string; key_reasons?: string }
) => request<Ending>(`/branches/${branchId}/endings`, { method: 'POST', body: JSON.stringify(payload) })

export const listEndings = (worldId: string) => request<Ending[]>(`/worlds/${worldId}/endings`)

export const getEnding = (id: string) => request<Ending>(`/endings/${id}`)

export const deleteEnding = (id: string) => request<{ status: string }>(`/endings/${id}`, { method: 'DELETE' })

export const compareEndings = (endingIds: string[]) =>
  request<any>('/endings/compare', { method: 'POST', body: JSON.stringify({ ending_ids: endingIds }) })

export const continueEnding = (endingId: string) =>
  request<Branch>(`/endings/${endingId}/continue`, { method: 'POST', body: JSON.stringify({}) })

// ---- 六轴 / C_profile ----
export const getSixAxis = (worldId: string) =>
  request<{ six_axis: Record<string, number>; negentropy?: number }>(`/worlds/${worldId}/six-axis`)

export const putSixAxis = (worldId: string, payload: { six_axis: Record<string, number>; negentropy?: number }) =>
  request<{ six_axis: Record<string, number>; negentropy?: number }>(`/worlds/${worldId}/six-axis`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })

export const getCProfile = (characterId: string) =>
  request<{ c_profile: Record<string, Record<string, number | string>> }>(`/characters/${characterId}/c-profile`)

export const putCProfile = (characterId: string, profile: Record<string, Record<string, number | string>>) =>
  request<{ c_profile: Record<string, Record<string, number | string>> }>(`/characters/${characterId}/c-profile`, {
    method: 'PUT',
    body: JSON.stringify({ c_profile: profile }),
  })
