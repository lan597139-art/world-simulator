import { API_ORIGIN } from './config'

export type SocialAuthor = {
  id: string
  username: string
  display_name: string
  bio: string
  avatar: string
  is_owner: boolean
}

export type SocialPost = {
  id: string
  author: SocialAuthor | null
  body: string
  media_urls: string[]
  channels: ('content' | 'social')[]
  visibility: 'public' | 'friends' | 'private'
  work_id?: string | null
  world_id?: string | null
  character_id?: string | null
  story_id?: string | null
  like_count: number
  comment_count: number
  liked_by_me: boolean
  is_mine: boolean
  created_at: string | null
  updated_at: string | null
}

export type SocialComment = {
  id: string
  post_id: string
  parent_id?: string | null
  body: string
  author: SocialAuthor | null
  created_at: string | null
}

export type SocialProfile = {
  user: SocialAuthor
  friend_status: 'self' | 'friends' | 'incoming' | 'outgoing' | 'none'
  friend_request_id?: string | null
  friend_request_direction?: 'incoming' | 'outgoing' | null
  following: boolean
  blocked_by_me: boolean
  is_blocked: boolean
  can_view: boolean
  allow_friend_requests: boolean
  allow_follow: boolean
  posts: SocialPost[]
  works: { id: string; title: string; scene: string; category: string; cover_url: string; status: string }[]
  stats: { posts: number; friends: number; works: number }
}

export type Conversation = {
  user: SocialAuthor
  last_message: string
  last_at: string | null
  unread: number
  friend: boolean
  blocked: boolean
}

export type DirectMessage = {
  id: string
  sender_id: string
  recipient_id: string
  body: string
  image_url: string
  read_at: string | null
  created_at: string | null
  is_mine: boolean
}

const BASE = `${API_ORIGIN}/api/social`

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  })
  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`
    try { const body = await response.json(); if (body?.detail) message = body.detail } catch { /* keep */ }
    throw new Error(message)
  }
  return (await response.json()) as T
}

const json = (method: string, body?: unknown): RequestInit => ({
  method, body: body === undefined ? undefined : JSON.stringify(body),
})

export const listSocialPosts = (channel: 'all' | 'content' | 'social', scope: 'discover' | 'following' | 'mine') =>
  request<SocialPost[]>(`/posts?channel=${channel}&scope=${scope}`)

export const createSocialPost = (payload: {
  body: string
  media_urls?: string[]
  channels: ('content' | 'social')[]
  visibility: 'public' | 'friends' | 'private'
  work_id?: string
  world_id?: string
}) => request<SocialPost>('/posts', json('POST', payload))

export const updateSocialPost = (id: string, payload: Partial<{ body: string; media_urls: string[]; channels: ('content' | 'social')[]; visibility: 'public' | 'friends' | 'private' }>) =>
  request<SocialPost>(`/posts/${encodeURIComponent(id)}`, json('PATCH', payload))

export const deleteSocialPost = (id: string) =>
  request<{ status: string }>(`/posts/${encodeURIComponent(id)}`, json('DELETE'))

export const likeSocialPost = (id: string, liked: boolean) =>
  request<SocialPost>(`/posts/${encodeURIComponent(id)}/like`, json(liked ? 'POST' : 'DELETE', liked ? {} : undefined))

export const listSocialComments = (postId: string) =>
  request<SocialComment[]>(`/posts/${encodeURIComponent(postId)}/comments`)

export const createSocialComment = (postId: string, body: string, parentId?: string) =>
  request<SocialComment>(`/posts/${encodeURIComponent(postId)}/comments`, json('POST', { body, parent_id: parentId }))

export const deleteSocialComment = (id: string) =>
  request<{ status: string }>(`/comments/${encodeURIComponent(id)}`, json('DELETE'))

export const getSocialProfile = (userId: string) =>
  request<SocialProfile>(`/users/${encodeURIComponent(userId)}/profile`)

export const blockSocialUser = (userId: string) =>
  request<{ status: string }>(`/users/${encodeURIComponent(userId)}/block`, json('POST', {}))

export const unblockSocialUser = (userId: string) =>
  request<{ status: string }>(`/users/${encodeURIComponent(userId)}/block`, json('DELETE'))

export const listConversations = () => request<Conversation[]>('/messages/conversations')
export const getUnreadMessages = () => request<{ count: number }>('/messages/unread')
export const getMessageHistory = (userId: string) =>
  request<DirectMessage[]>(`/messages/${encodeURIComponent(userId)}`)
export const sendDirectMessage = (userId: string, payload: { body?: string; image_url?: string }) =>
  request<DirectMessage>(`/messages/${encodeURIComponent(userId)}`, json('POST', payload))
