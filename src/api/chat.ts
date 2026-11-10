import { API_ORIGIN } from './config'

const BASE = `${API_ORIGIN}/api`

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
    } catch {
      /* keep status */
    }
    throw new Error(message)
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export interface AiRole {
  id?: string
  world_id?: string
  character_id: string
  exists?: boolean
  enabled: boolean
  display_name: string
  persona: any
  source?: 'auto' | 'manual'
  version?: number
  preview?: any
}

export interface ChatParticipant {
  id: string
  character_id: string
  character_name: string
  display_name: string
  order_index: number
  speak_policy: string
  enabled: boolean
}

export interface ChatMessage {
  id: string
  thread_id: string
  sender_type: 'user' | 'character' | 'system'
  character_id?: string | null
  content: string
  reply_to_id?: string | null
  meta: Record<string, unknown>
  created_at?: string
}

export interface ChatThread {
  id: string
  world_id: string
  kind: 'private' | 'group'
  title: string
  status: string
  settings: Record<string, unknown>
  summary: string
  last_message_at?: string | null
  participants: ChatParticipant[]
  last_message?: ChatMessage | null
  message_count: number
  messages?: ChatMessage[]
}

export interface ChatMemory {
  id: string
  character_id: string
  thread_id?: string | null
  scope: string
  content: string
  importance: number
  created_at?: string
}

export const getAiRole = (characterId: string) => request<AiRole>(`/characters/${characterId}/ai-role`)
export const buildAiRole = (characterId: string) =>
  request<AiRole>(`/characters/${characterId}/ai-role/build`, { method: 'POST' })
export const saveAiRole = (characterId: string, payload: { display_name?: string; enabled?: boolean; persona?: any }) =>
  request<AiRole>(`/characters/${characterId}/ai-role`, { method: 'PUT', body: JSON.stringify(payload) })

export const listThreads = (worldId: string) => request<ChatThread[]>(`/worlds/${worldId}/chat/threads`)
export const createThread = (payload: { world_id: string; kind: string; character_id?: string; character_ids?: string[]; title?: string }) =>
  request<ChatThread>('/chat/threads', { method: 'POST', body: JSON.stringify(payload) })
export const getThread = (id: string) => request<ChatThread>(`/chat/threads/${id}`)
export const updateThread = (id: string, payload: { title?: string; status?: string }) =>
  request<ChatThread>(`/chat/threads/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
export const sendMessage = (threadId: string, content: string) =>
  request<{ user_message: ChatMessage; reply: ChatMessage }>(`/chat/threads/${threadId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  })
export const groupTurn = (threadId: string, content: string) =>
  request<{ user_message: ChatMessage; replies: ChatMessage[]; plan: any[] }>(`/chat/threads/${threadId}/turns`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  })
export const previewImpact = (threadId: string) =>
  request<any>(`/chat/threads/${threadId}/impact/preview`, { method: 'POST' })
export const applyImpact = (impactId: string) =>
  request<{ impact: any; relationship_ids: string[]; six_axis: Record<string, number> }>(`/chat/impact/${impactId}/apply`, {
    method: 'POST',
    body: JSON.stringify({ relationships: true, six_axis: true }),
  })
export const dismissImpact = (impactId: string) =>
  request<{ status: string }>(`/chat/impact/${impactId}/dismiss`, { method: 'POST' })
export const chatToEvent = (threadId: string, payload: { title?: string; description?: string; message_count?: number }) =>
  request<{ event: any }>(`/chat/threads/${threadId}/to-event`, { method: 'POST', body: JSON.stringify(payload) })
export const chatToExperience = (threadId: string, payload: { character_id: string; title?: string; summary?: string }) =>
  request<{ character_id: string; life_history_count: number }>(`/chat/threads/${threadId}/to-experience`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
export const summarizeMemories = (threadId: string, characterId?: string) =>
  request<ChatMemory>(`/chat/threads/${threadId}/memories/summarize`, {
    method: 'POST',
    body: JSON.stringify(characterId ? { character_id: characterId } : {}),
  })
export const listMemories = (threadId: string) => request<ChatMemory[]>(`/chat/threads/${threadId}/memories`)
export const deleteMemory = (id: string) => request<{ status: string }>(`/chat/memories/${id}`, { method: 'DELETE' })
