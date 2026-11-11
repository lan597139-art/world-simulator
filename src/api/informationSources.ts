import { API_ORIGIN } from './config'

export type InformationSource = {
  id: string
  product_key: string
  world_id?: string | null
  character_id?: string | null
  event_id?: string | null
  title: string
  source_type: string
  source_type_label: string
  content: string
  source_date: string
  status: 'confirmed' | 'unconfirmed' | 'inference'
  confirmed: boolean
  confidence: number
  citation: string
  visibility: string
  created_at?: string
  updated_at?: string
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_ORIGIN}/api${path}`, {
    ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(String(body?.detail || `请求失败（HTTP ${res.status}）`))
  }
  return res.json() as Promise<T>
}

export const listInformationSources = (params: {
  product?: string; character_id?: string; event_id?: string; source_type?: string; status?: string
} = {}) => {
  const q = new URLSearchParams()
  q.set('product', params.product || 'diary')
  for (const key of ['character_id', 'event_id', 'source_type', 'status'] as const) {
    if (params[key]) q.set(key, String(params[key]))
  }
  return request<InformationSource[]>(`/information-sources?${q.toString()}`)
}

export const createInformationSource = (payload: Record<string, unknown>) =>
  request<InformationSource>('/information-sources', { method: 'POST', body: JSON.stringify(payload) })

export const updateInformationSource = (id: string, payload: Record<string, unknown>) =>
  request<InformationSource>(`/information-sources/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })

export const confirmInformationSource = (id: string) =>
  request<InformationSource>(`/information-sources/${id}/confirm`, { method: 'POST' })

export const deleteInformationSource = (id: string) =>
  request<{ status: string }>(`/information-sources/${id}`, { method: 'DELETE' })
