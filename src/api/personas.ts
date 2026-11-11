import { API_ORIGIN } from './config'

export type Persona = {
  id: string; product_key?: string; name: string; identity: string; description: string
  esa: Record<string, any>; traits: string[]; cognition: Record<string, any>
  expression: Record<string, any>; interaction: Record<string, any>
  memory_policy: Record<string, any>; public_profile: Record<string, any>
  tools: string[]; status: string; created_at?: string
}
export type PersonaThread = { id: string; title: string; summary?: string; message_count?: number; updated_at?: string }
export type PersonaMessage = { id: string; thread_id: string; role: 'user' | 'persona' | 'system'; content: string; created_at?: string }
export type PersonaMemory = { id: string; content: string; importance: number; kind?: string; thread_id?: string | null; source?: string }

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

export const listPersonas = (product = 'companion') =>
  request<Persona[]>(`/personas?product=${encodeURIComponent(product)}`)
export const createPersona = (payload: Partial<Persona>) =>
  request<Persona>('/personas', { method: 'POST', body: JSON.stringify(payload) })
export const updatePersona = (id: string, payload: Partial<Persona>) =>
  request<Persona>(`/personas/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
export const deletePersona = (id: string) =>
  request<{ status: string }>(`/personas/${id}`, { method: 'DELETE' })
export const listPersonaThreads = (id: string) => request<PersonaThread[]>(`/personas/${id}/threads`)
export const createPersonaThread = (id: string, title = '新对话') =>
  request<{ id: string; title: string }>(`/personas/${id}/threads`, { method: 'POST', body: JSON.stringify({ title }) })
export const listPersonaMessages = (id: string, threadId: string) =>
  request<PersonaMessage[]>(`/personas/${id}/threads/${threadId}/messages`)
export const deletePersonaThread = (id: string, threadId: string) =>
  request<{ status: string }>(`/personas/${id}/threads/${threadId}`, { method: 'DELETE' })
export const chatWithPersona = (id: string, message: string, threadId?: string) =>
  request<{ reply: string; thread_id: string; persona: { id: string; name: string } }>(`/personas/${id}/chat`, {
    method: 'POST',
    body: JSON.stringify({ message, thread_id: threadId || null }),
  })
export const listPersonaMemories = (id: string) => request<PersonaMemory[]>(`/personas/${id}/memories`)
export const createPersonaMemory = (id: string, content: string, importance = 0.6) =>
  request<PersonaMemory>(`/personas/${id}/memories`, { method: 'POST', body: JSON.stringify({ content, importance }) })
export const deletePersonaMemory = (id: string, memoryId: string) =>
  request<{ status: string }>(`/personas/${id}/memories/${memoryId}`, { method: 'DELETE' })
