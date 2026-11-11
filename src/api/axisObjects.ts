import { API_ORIGIN } from './config'

export type AxisObject = {
  id: string; axis: string; axis_label?: string; name: string; category?: string
  description?: string; value: number; scope_type: string; scope_id?: string | null
  event_id?: string | null; branch_id?: string | null; linked_factors?: any[]
  source?: string; status?: string; inherited?: boolean
}
export type AxisPresetGroup = {
  key: string; label: string; pressure: boolean
  presets: { category: string; name: string; description: string }[]
}
export type AxisPayload = {
  objects: AxisObject[]; effective: AxisObject[]
  aggregate: Record<string, number>
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_ORIGIN}/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(String(data?.detail || `请求失败（HTTP ${response.status}）`))
  }
  return response.json() as Promise<T>
}

export const getAxisPresets = () => request<{ axes: AxisPresetGroup[] }>('/axis-objects/presets')
export const listAxisObjects = (worldId: string, eventId?: string, branchId?: string) => {
  const params = new URLSearchParams()
  if (eventId) params.set('event_id', eventId)
  if (branchId) params.set('branch_id', branchId)
  const suffix = params.toString() ? `?${params.toString()}` : ''
  return request<AxisPayload>(`/worlds/${worldId}/axis-objects${suffix}`)
}
export const createAxisObject = (worldId: string, payload: Partial<AxisObject>) =>
  request<AxisObject>(`/worlds/${worldId}/axis-objects`, { method: 'POST', body: JSON.stringify(payload) })
export const updateAxisObject = (objectId: string, payload: Partial<AxisObject>) =>
  request<AxisObject>(`/axis-objects/${objectId}`, { method: 'PATCH', body: JSON.stringify(payload) })
export const deleteAxisObject = (objectId: string) =>
  request<{ status: string }>(`/axis-objects/${objectId}`, { method: 'DELETE' })
