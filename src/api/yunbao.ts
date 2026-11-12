import { API_ORIGIN } from './config'
import type { PersonaMemory, PersonaMessage, PersonaThread } from './personas'

export type YunbaoState = {
  key: string
  label: string
  description: string
  prompt_hint: string
}

export type YunbaoGrowth = {
  id: string
  date: string
  title: string
  content: string
}

export type YunbaoProfile = {
  id: string
  system_key: string
  owner_user_id: string
  definition_id?: string | null
  version_id?: string | null
  instance_id?: string | null
  name: string
  identity: string
  description: string
  avatar: string
  maturity: string
  biography: string
  growth_experience: YunbaoGrowth[]
  states: YunbaoState[]
  active_state: string
  current_state: YunbaoState
  esa: Record<string, number>
  traits: string[]
  cognition: Record<string, any>
  expression: Record<string, any>
  interaction: Record<string, any>
  memory_policy: Record<string, any>
  public_profile: Record<string, any>
  tools: string[]
  seed_character_id?: string | null
  status: string
  created_at?: string
  updated_at?: string
  can_edit: boolean
  is_owner: boolean
  read_only: boolean
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

export const getYunbao = () => request<YunbaoProfile>('/yunbao')

export const getYunbaoSeedCharacter = () =>
  request<{ character_id: string; world_id: string; name: string }>('/yunbao/seed-character')

export const updateYunbao = (payload: Partial<YunbaoProfile>) =>
  request<YunbaoProfile>('/yunbao', { method: 'PATCH', body: JSON.stringify(payload) })

export const switchYunbaoState = (state: string) =>
  request<{ state: YunbaoState; active_state: string; can_edit: boolean; persona_id: string; instance_id?: string }>(
    '/yunbao/state',
    { method: 'POST', body: JSON.stringify({ state }) },
  )

export const listYunbaoThreads = () => request<PersonaThread[]>('/yunbao/threads')
export const createYunbaoThread = (title = '与云宝的对话') =>
  request<PersonaThread>('/yunbao/threads', { method: 'POST', body: JSON.stringify({ title }) })
export const listYunbaoMessages = (threadId: string) =>
  request<PersonaMessage[]>(`/yunbao/threads/${encodeURIComponent(threadId)}/messages`)
export const deleteYunbaoThread = (threadId: string) =>
  request<{ status: string }>(`/yunbao/threads/${encodeURIComponent(threadId)}`, { method: 'DELETE' })

export const listYunbaoMemories = () => request<PersonaMemory[]>('/yunbao/memories')
export const createYunbaoMemory = (content: string, importance = 0.6) =>
  request<PersonaMemory>('/yunbao/memories', { method: 'POST', body: JSON.stringify({ content, importance }) })
export const deleteYunbaoMemory = (memoryId: string) =>
  request<{ status: string }>(`/yunbao/memories/${encodeURIComponent(memoryId)}`, { method: 'DELETE' })
