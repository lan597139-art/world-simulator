import { API_ORIGIN } from './config'
import { getAuthToken } from './authToken'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken()
  const res = await fetch(`${API_ORIGIN}/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(String(body?.detail || `请求失败（HTTP ${res.status}）`))
  }
  return res.json() as Promise<T>
}

export type CollaboratorUser = {
  id: string
  username: string
  name: string
  avatar: string
}

export type WorldCollaborator = {
  id: string
  world_id: string
  world_name: string
  user: CollaboratorUser
  role: 'editor' | 'viewer'
  status: 'pending' | 'accepted' | 'declined'
  invited_by: CollaboratorUser
  created_at?: string | null
  responded_at?: string | null
}

export type CollaboratorList = {
  owner: CollaboratorUser
  role: 'owner' | 'editor' | 'viewer' | 'none'
  can_manage: boolean
  items: WorldCollaborator[]
}

export const listWorldCollaborators = (worldId: string) =>
  request<CollaboratorList>(`/worlds/${worldId}/collaborators`)

export const inviteWorldCollaborator = (worldId: string, username: string, role: 'editor' | 'viewer') =>
  request<{ item: WorldCollaborator; updated?: boolean }>(`/worlds/${worldId}/collaborators`, {
    method: 'POST',
    body: JSON.stringify({ username, role }),
  })

export const updateWorldCollaborator = (collaboratorId: string, role: 'editor' | 'viewer') =>
  request<{ item: WorldCollaborator }>(`/world-collaborators/${collaboratorId}`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  })

export const removeWorldCollaborator = (collaboratorId: string) =>
  request<{ ok: boolean }>(`/world-collaborators/${collaboratorId}`, { method: 'DELETE' })

export const respondToWorldInvite = (collaboratorId: string, action: 'accept' | 'decline') =>
  request<{ item: WorldCollaborator }>(`/world-collaborators/${collaboratorId}/respond`, {
    method: 'POST',
    body: JSON.stringify({ action }),
  })

export const listWorldInvites = () =>
  request<{ items: WorldCollaborator[] }>('/collaboration/invites')

export type PresenceUser = {
  id: string
  username: string
  name: string
  avatar: string
  last_seen_at?: string
}

export type PresencePayload = {
  online: PresenceUser[]
  count: number
  window_seconds: number
  self: string
}

export const heartbeatWorldPresence = (worldId: string) =>
  request<PresencePayload>(`/worlds/${encodeURIComponent(worldId)}/presence`, {
    method: 'POST',
    body: '{}',
  })

export const getWorldPresence = (worldId: string) =>
  request<PresencePayload>(`/worlds/${encodeURIComponent(worldId)}/presence`)
