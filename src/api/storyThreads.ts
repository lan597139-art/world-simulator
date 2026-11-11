import { API_ORIGIN } from './config'

const BASE = `${API_ORIGIN}/api`

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, { headers: { 'Content-Type': 'application/json' }, ...init })
  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`
    try { const body = await response.json(); if (body?.detail) message = body.detail } catch { /* status */ }
    throw new Error(message)
  }
  return (await response.json()) as T
}

export interface ThreadEvent { id: string; event_id: string; event_name: string; order_index: number; role: string }
export interface StoryThread {
  id: string; story_id: string; character_id?: string | null; character_name: string;
  parent_thread_id?: string | null; kind: string; title: string; order_index: number; status: string;
  events: ThreadEvent[];
}
export interface ThreadEdge {
  id: string; from_thread_id: string; to_thread_id: string; edge_type: string; note: string;
  from_event_id?: string | null; to_event_id?: string | null;
}

export const listThreads = (storyId: string) => request<StoryThread[]>(`/stories/${storyId}/threads`)
export const createThread = (storyId: string, payload: { title: string; kind?: string; character_id?: string }) =>
  request<StoryThread>(`/stories/${storyId}/threads`, { method: 'POST', body: JSON.stringify(payload) })
export const deleteThread = (threadId: string) =>
  request<{ status: string }>(`/story-threads/${threadId}`, { method: 'DELETE' })
export const attachThreadEvent = (threadId: string, eventId: string) =>
  request<StoryThread>(`/story-threads/${threadId}/events`, { method: 'POST', body: JSON.stringify({ event_id: eventId }) })
export const detachThreadEvent = (linkId: string) =>
  request<{ status: string }>(`/story-thread-events/${linkId}`, { method: 'DELETE' })
export const listThreadEdges = (storyId: string) => request<ThreadEdge[]>(`/stories/${storyId}/thread-edges`)
export const createThreadEdge = (storyId: string, payload: { from_thread_id: string; to_thread_id: string; edge_type?: string }) =>
  request<ThreadEdge>(`/stories/${storyId}/thread-edges`, { method: 'POST', body: JSON.stringify(payload) })
