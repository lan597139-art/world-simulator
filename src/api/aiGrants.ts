import { API_ORIGIN } from './config'

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

export type GrantScope = {
  id?: string
  scope_type: string
  scope_id?: string
  scope_key?: string
  scope_label?: string
}

export type AiGrant = {
  id: string
  grantee_instance_id: string
  access_level: number
  access_level_label: string
  allowed_purposes: string[]
  allow_memory: boolean
  redaction: string
  status: string
  expires_at?: string | null
  grant_version: number
  scopes: GrantScope[]
  created_at?: string | null
  revoked_at?: string | null
}

export type AiAccessLog = {
  id: string
  instance_id: string
  grant_id?: string | null
  scope_type: string
  scope_id: string
  purpose: string
  action: string
  allowed: boolean
  reason: string
  memory_ids: string[]
  created_at?: string | null
}

export const listGrants = (instanceId = '') =>
  request<AiGrant[]>(`/ai-grants${instanceId ? `?instance_id=${encodeURIComponent(instanceId)}` : ''}`)
export const createGrant = (payload: {
  instance_id: string; access_level: number; allowed_purposes: string[];
  allow_memory: boolean; redaction?: string; scopes: GrantScope[]; expires_at?: string;
}) => request<AiGrant>('/ai-grants', { method: 'POST', body: JSON.stringify(payload) })
export const pauseGrant = (id: string) => request<AiGrant>(`/ai-grants/${id}/pause`, { method: 'POST' })
export const resumeGrant = (id: string) => request<AiGrant>(`/ai-grants/${id}/resume`, { method: 'POST' })
export const revokeGrant = (id: string) =>
  request<AiGrant & { memory_ids: string[] }>(`/ai-grants/${id}/revoke`, { method: 'POST' })
export const grantAccessLogs = () => request<AiAccessLog[]>('/ai-grants/audit/logs')
