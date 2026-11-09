/**
 * 世界结构 API 客户端：目录、地理、组织、规则、时空、社会、资源、历史。
 * 统一走 FastAPI /api 前缀，错误信息直接取后端 detail。
 */

const API_BASE = 'http://127.0.0.1:8000/api'

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
      /* 非 JSON 错误体，保留状态码 */
    }
    throw new Error(message)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

const get = <T,>(path: string) => request<T>(path)
const post = <T,>(path: string, body?: unknown) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) })
const patch = <T,>(path: string, body?: unknown) =>
  request<T>(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) })
const put = <T,>(path: string, body?: unknown) =>
  request<T>(path, { method: 'PUT', body: JSON.stringify(body ?? {}) })
const del = <T,>(path: string) => request<T>(path, { method: 'DELETE' })

// ---------------------------------------------------------------- 类型

export interface WorldNode {
  id: string
  world_id: string
  parent_id: string | null
  branch: string
  node_type: 'folder' | 'entity_ref' | 'note'
  name: string
  sort_order: number
  description: string
  ref_type: string | null
  ref_id: string | null
  children?: WorldNode[]
}

export interface LocationNode {
  id: string
  world_id: string
  parent_location_id: string | null
  name: string
  location_type_id: string | null
  location_type_name: string
  description: string
  status: string
  x: number
  y: number
  population: number | null
  children: LocationNode[]
}

export interface LocationType {
  id: string
  world_id: string | null
  name: string
  allowed_parent_type_ids: string[]
  system: boolean
}

export interface Organization {
  id: string
  world_id: string
  name: string
  description: string
  organization_type: string
  mission: string
  status: string
  headquarters_location_id: string | null
  society_id: string | null
}

export interface PositionHolder {
  appointment_id: string
  character_id: string
  character_name: string
  start_time: string
}

export interface Position {
  id: string
  name: string
  unit_id: string
  position_level: string | null
  holders: PositionHolder[]
}

export interface UnitNode {
  id: string
  name: string
  unit_type: string
  parent_unit_id: string | null
  description: string
  status?: string
  sort_order?: number
  positions: Position[]
  children: UnitNode[]
}

export interface OrgTree {
  organization: Organization
  units: UnitNode[]
  unit_count: number
  position_count: number
  active_appointments: number
}

export interface RuleScope {
  id: string
  scope_type: string
  scope_id: string
}

export interface WorldRule {
  id: string
  name: string
  rule_category: string
  description: string
  conditions: string
  consequences: string
  priority: number
  status: string
  scopes: RuleScope[]
}

export interface ResourceItem {
  id: string
  name: string
  resource_type_id: string
  quantity: number
  unit: string
  description: string
  status: string
}

export interface ResourceType {
  id: string
  name: string
  category: string
  unit: string
  system: boolean
}

export interface ResourceHolding {
  id: string
  resource_id: string
  holder_type: string
  holder_id: string
  role: string
  status: string
}

export interface SocietyItem {
  id: string
  name: string
  society_type: string
  government_form: string
  description: string
}

export interface SocialGroupItem {
  id: string
  name: string
  group_type: string
  society_id: string | null
  description?: string
}

export interface TimeSettings {
  world_id: string
  calendar_type: string
  current_time: string
  time_mode: 'manual' | 'realtime'
  real_seconds_per_world_day: number
  day_length_hours: number
  timezone: string
}

export interface HistoryItem {
  id: string
  entity_type: string
  entity_id: string
  entity_name: string | null
  field: string
  old_value: unknown
  new_value: unknown
  reason: string
  occurred_at: string
}

export interface CharacterLite {
  id: string
  name: string
  world_id: string
}

export interface WorldLite {
  id: string
  name: string
  description: string
  type: string
  background: string
  world_scale?: string
  status?: string
  createdAt: string
}

// ---------------------------------------------------------------- 目录

export const listNodes = (worldId: string, branch?: string) =>
  get<WorldNode[]>(`/worlds/${worldId}/nodes${branch ? `?branch=${branch}` : ''}`)

export const createNode = (worldId: string, body: Partial<WorldNode>) =>
  post<WorldNode>(`/worlds/${worldId}/nodes`, body)

export const updateNode = (nodeId: string, body: Partial<WorldNode>) =>
  patch<WorldNode>(`/nodes/${nodeId}`, body)

export const deleteNode = (nodeId: string) => del<{ status: string }>(`/nodes/${nodeId}`)

// ---------------------------------------------------------------- 地理

export const listLocationTypes = (worldId: string) =>
  get<LocationType[]>(`/worlds/${worldId}/location-types`)

export const listLocations = (worldId: string) =>
  get<{ id: string; name: string; parent_location_id: string | null }[]>(`/worlds/${worldId}/locations`)

export const getLocationTree = (worldId: string) =>
  get<LocationNode[]>(`/worlds/${worldId}/locations/tree`)

export const createLocation = (body: Record<string, unknown>) =>
  post<LocationNode>('/locations', body)

export const updateLocation = (id: string, body: Record<string, unknown>) =>
  patch<LocationNode>(`/locations/${id}`, body)

export const moveLocation = (id: string, parentLocationId: string | null) =>
  post<LocationNode>(`/locations/${id}/move`, { parent_location_id: parentLocationId })

export const deleteLocation = (id: string) => del<{ status: string }>(`/locations/${id}`)

// ---------------------------------------------------------------- 组织

export const listOrganizations = (worldId: string) =>
  get<Organization[]>(`/worlds/${worldId}/organizations`)

export const createOrganization = (body: Record<string, unknown>) =>
  post<Organization>('/organizations', body)

export const updateOrganization = (id: string, body: Record<string, unknown>) =>
  patch<Organization>(`/organizations/${id}`, body)

export const getOrgTree = (orgId: string) => get<OrgTree>(`/organizations/${orgId}/tree`)

export const createUnit = (body: Record<string, unknown>) =>
  post<UnitNode>('/organization-units', body)

export const updateUnit = (id: string, body: Record<string, unknown>) =>
  patch<UnitNode>(`/organization-units/${id}`, body)

export const createPosition = (body: Record<string, unknown>) =>
  post<Position>('/organization-positions', body)

export const updatePosition = (id: string, body: Record<string, unknown>) =>
  patch<Position>(`/organization-positions/${id}`, body)

export const deletePosition = (id: string) => del<{ status: string }>(`/organization-positions/${id}`)

export const createAppointment = (body: Record<string, unknown>) =>
  post<{ id: string }>('/appointments', body)

export const endAppointment = (appointmentId: string, endTime?: string | null) =>
  patch<{ id: string }>(
    `/appointments/${appointmentId}/end`,
    endTime ? { end_time: endTime, reason: '调整任职' } : {},
  )

export const deleteUnit = (unitId: string) => del<{ status: string }>(`/organization-units/${unitId}`)

// ---------------------------------------------------------------- 关系

export interface RelationshipItem {
  id: string
  source_type: string
  source_id: string
  target_type: string
  target_id: string
  relation_type: string
  status: string
  description: string
  history: { time: string; old_status: unknown; new_status: unknown; reason: string }[]
}

export const listRelationships = (worldId: string) =>
  get<RelationshipItem[]>(`/worlds/${worldId}/relationships`)

export const updateRelationship = (id: string, body: Record<string, unknown>) =>
  patch<RelationshipItem>(`/relationships/${id}`, body)

// ---------------------------------------------------------------- 规则

export const listRules = (worldId: string) => get<WorldRule[]>(`/worlds/${worldId}/rules`)

export const createRule = (worldId: string, body: Record<string, unknown>) =>
  post<WorldRule>(`/worlds/${worldId}/rules`, body)

export const deleteRule = (ruleId: string) => del<{ status: string }>(`/rules/${ruleId}`)

// ---------------------------------------------------------------- 时空

export const getTimeSettings = (worldId: string) =>
  get<TimeSettings>(`/worlds/${worldId}/time-settings`)

export const updateTimeSettings = (worldId: string, body: Record<string, unknown>) =>
  put<TimeSettings>(`/worlds/${worldId}/time-settings`, body)

export interface EraItem {
  id: string
  name: string
  start_time: string | null
  end_time: string | null
  description: string
}

export const listEras = (worldId: string) => get<EraItem[]>(`/worlds/${worldId}/eras`)

export const advanceTime = (worldId: string, body: Record<string, number>) =>
  post<TimeSettings>(`/worlds/${worldId}/time/advance`, body)

// ---------------------------------------------------------------- 社会

export const listSocieties = (worldId: string) =>
  get<SocietyItem[]>(`/worlds/${worldId}/societies`)

export const createSociety = (worldId: string, body: Record<string, unknown>) =>
  post<SocietyItem>(`/worlds/${worldId}/societies`, body)

export const listSocialGroups = (worldId: string) =>
  get<SocialGroupItem[]>(`/worlds/${worldId}/social-groups`)

export const createSocialGroup = (worldId: string, body: Record<string, unknown>) =>
  post<SocialGroupItem>(`/worlds/${worldId}/social-groups`, body)

// ---------------------------------------------------------------- 资源

export const listResourceTypes = (worldId: string) =>
  get<ResourceType[]>(`/worlds/${worldId}/resource-types`)

export const listResources = (worldId: string) =>
  get<ResourceItem[]>(`/worlds/${worldId}/resources`)

export const createResource = (worldId: string, body: Record<string, unknown>) =>
  post<ResourceItem>(`/worlds/${worldId}/resources`, body)

export const listHoldings = (worldId: string) =>
  get<ResourceHolding[]>(`/worlds/${worldId}/resource-holdings`)

export const createHolding = (body: Record<string, unknown>) =>
  post<ResourceHolding>('/resource-holdings', body)

export const createTransaction = (body: Record<string, unknown>) =>
  post<{ id: string; quantity: number }>('/resource-transactions', body)

// ---------------------------------------------------------------- 其他

export const listHistories = (worldId: string, entityType?: string, entityId?: string) => {
  const params = new URLSearchParams()
  if (entityType) params.set('entity_type', entityType)
  if (entityId) params.set('entity_id', entityId)
  const qs = params.toString()
  return get<HistoryItem[]>(`/worlds/${worldId}/histories${qs ? `?${qs}` : ''}`)
}

export interface TimelineItem {
  kind: 'event' | 'history' | 'transaction'
  id: string
  occurred_at: string | null
  title: string
  description: string
  entity_type: string
  entity_id: string
  event_id: string | null
  meta: Record<string, any>
}

export const getTimeline = (
  worldId: string,
  scope: string,
  entityId?: string,
  kinds?: string,
) => {
  const params = new URLSearchParams({ scope, kinds: kinds || 'event,history,transaction' })
  if (entityId) params.set('entity_id', entityId)
  return get<{ scope: string; counts: Record<string, number>; items: TimelineItem[] }>(
    `/worlds/${worldId}/timeline?${params.toString()}`,
  )
}

export const listCharacters = (worldId: string) =>
  get<CharacterLite[]>(`/characters?world_id=${worldId}`)

export const getWorld = (worldId: string) => get<WorldLite>(`/worlds/${worldId}`)

export const getWorldSettings = (worldId: string) =>
  get<{ selections: Record<string, string[]>; parameters: Record<string, unknown>; revision: number }>(
    `/worlds/${worldId}/settings`,
  )

export const importWorldSettings = (
  worldId: string,
  body: { selections: Record<string, string[]>; parameters: Record<string, unknown> },
) => post<{ status: string; revision: number }>(`/worlds/${worldId}/settings/import`, body)

export const saveWorldSettings = (
  worldId: string,
  body: { selections: Record<string, string[]>; parameters: Record<string, unknown> },
) => put<{ status: string; revision: number }>(`/worlds/${worldId}/settings`, body)
