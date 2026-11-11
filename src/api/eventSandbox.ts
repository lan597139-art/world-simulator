import { API_ORIGIN } from './config'

export type SandboxItem = { text: string; kind?: string; status?: string; [key: string]: any }
export type SandboxScenario = {
  id: string; world_id: string; event_id: string; title: string; note: string
  preset_options: SandboxItem[]; constraints: SandboxItem[]; supports: SandboxItem[]
  potentials: SandboxItem[]; factors: SandboxItem[]; branch_id?: string | null
  status: string; created_at?: string; updated_at?: string
}
export type SandboxPresets = {
  preset_options: SandboxItem[]; constraint_candidates: SandboxItem[]
  support_candidates: SandboxItem[]; potential_candidates: SandboxItem[]
  factors: SandboxItem[]
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

export const listSandboxScenarios = (eventId: string) =>
  request<SandboxScenario[]>(`/events/${eventId}/sandbox-scenarios`)
export const getSandboxPresets = (eventId: string) =>
  request<SandboxPresets>(`/events/${eventId}/sandbox-presets`)
export const createSandboxScenario = (eventId: string, payload: Partial<SandboxScenario>) =>
  request<SandboxScenario>(`/events/${eventId}/sandbox-scenarios`, { method: 'POST', body: JSON.stringify(payload) })
export const updateSandboxScenario = (id: string, payload: Partial<SandboxScenario>) =>
  request<SandboxScenario>(`/sandbox-scenarios/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
export const deleteSandboxScenario = (id: string) =>
  request<{ status: string }>(`/sandbox-scenarios/${id}`, { method: 'DELETE' })
export const compareSandboxScenarios = (ids: string[]) =>
  request<{ scenarios: any[] }>('/sandbox-scenarios/compare', { method: 'POST', body: JSON.stringify({ ids }) })
