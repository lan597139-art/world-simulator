import { API_ORIGIN } from './config'

export type SocialUser = {
  id: string
  username: string
  display_name: string
  avatar: string
  bio: string
  is_owner: boolean
  is_following: boolean
  is_friend: boolean
  friend_request: '' | 'incoming' | 'outgoing'
  follower_count: number
  following_count: number
}

export type CommunityTopic = {
  id: string
  category: string
  category_label: string
  title: string
  body: string
  tags: string[]
  author: SocialUser | null
  reply_count: number
  view_count: number
  created_at: string
  updated_at: string
}

export type TopicReply = {
  id: string
  body: string
  author: SocialUser | null
  created_at: string
}

export type TopicDetail = CommunityTopic & { replies: TopicReply[] }

export type CommunityGroup = {
  id: string
  name: string
  description: string
  category: string
  category_label: string
  visibility: 'public' | 'private'
  owner: SocialUser | null
  member_count: number
  joined: boolean
  membership_status: string
  is_owner: boolean
  created_at: string
}

export type GroupPost = {
  id: string
  group_id: string
  title: string
  body: string
  author: SocialUser | null
  reply_count: number
  created_at: string
  updated_at: string
}

export type GroupDetail = CommunityGroup & {
  members: (SocialUser & { role: string })[]
  pending_members: (SocialUser & { role: string })[]
  posts: GroupPost[]
}

export type FriendRequest = {
  id: string
  status: string
  message: string
  created_at: string
  user: SocialUser | null
}

export type Friend = SocialUser & { friends_since: string }

export type CommunityNotification = {
  id: string
  type: string
  actor: SocialUser | null
  object_type: string
  object_id: string
  title: string
  body: string
  read: boolean
  created_at: string
}

export type FeedItem = {
  id: string
  type: 'topic' | 'group_post' | 'publication'
  title: string
  summary: string
  category?: string
  group?: { id: string; name: string }
  author: SocialUser | null
  created_at: string
  target: { kind: string; id: string; group_id?: string }
}

export type SocialOverview = {
  viewer: SocialUser
  scope: string
  feed: FeedItem[]
  topics: CommunityTopic[]
  groups: CommunityGroup[]
  suggestions: SocialUser[]
  notifications: CommunityNotification[]
  counts: {
    following: number
    followers: number
    friends: number
    unread_notifications: number
    pending_friend_requests: number
  }
}

export type SocialSearch = { users: SocialUser[]; topics: CommunityTopic[]; groups: CommunityGroup[] }

const BASE = `${API_ORIGIN}/api`

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

export const getSocialOverview = (scope: 'following' | 'friends' | 'all' = 'following') =>
  request<SocialOverview>(`/community/social/overview?scope=${scope}`)
export const searchSocialUsers = (q: string) =>
  request<SocialUser[]>(`/community/social/users?q=${encodeURIComponent(q)}`)
export const getSocialUser = (id: string) => request<SocialUser & { is_self: boolean; recent_topics: CommunityTopic[] }>(`/community/social/users/${encodeURIComponent(id)}`)
export const getFollowers = (id: string) => request<SocialUser[]>(`/community/social/users/${encodeURIComponent(id)}/followers`)
export const getFollowing = (id: string) => request<SocialUser[]>(`/community/social/users/${encodeURIComponent(id)}/following`)
export const followUser = (id: string) => request<{ following: boolean }>(`/community/social/users/${encodeURIComponent(id)}/follow`, json('POST', {}))
export const unfollowUser = (id: string) => request<{ following: boolean }>(`/community/social/users/${encodeURIComponent(id)}/follow`, json('DELETE'))

export const listTopics = (category = 'all', q = '') =>
  request<CommunityTopic[]>(`/community/topics?category=${encodeURIComponent(category)}&q=${encodeURIComponent(q)}`)
export const createTopic = (payload: { category: string; title: string; body: string; tags?: string[] }) =>
  request<CommunityTopic>('/community/topics', json('POST', payload))
export const getTopic = (id: string) => request<TopicDetail>(`/community/topics/${encodeURIComponent(id)}`)
export const replyTopic = (id: string, body: string) =>
  request<TopicReply>(`/community/topics/${encodeURIComponent(id)}/replies`, json('POST', { body }))
export const deleteTopic = (id: string) => request<{ status: string }>(`/community/topics/${encodeURIComponent(id)}`, json('DELETE'))

export const listGroups = (scope: 'all' | 'joined' | 'owned' = 'all') =>
  request<CommunityGroup[]>(`/community/groups?scope=${scope}`)
export const createGroup = (payload: { name: string; description: string; category: string; visibility: 'public' | 'private' }) =>
  request<CommunityGroup>('/community/groups', json('POST', payload))
export const getGroup = (id: string) => request<GroupDetail>(`/community/groups/${encodeURIComponent(id)}`)
export const joinGroup = (id: string) => request<{ status: string; joined: boolean }>(`/community/groups/${encodeURIComponent(id)}/join`, json('POST', {}))
export const leaveGroup = (id: string) => request<{ status: string }>(`/community/groups/${encodeURIComponent(id)}/leave`, json('POST', {}))
export const approveGroupMember = (groupId: string, userId: string) =>
  request<{ status: string }>(`/community/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(userId)}/approve`, json('POST', {}))
export const createGroupPost = (groupId: string, payload: { title: string; body: string }) =>
  request<GroupPost>(`/community/groups/${encodeURIComponent(groupId)}/posts`, json('POST', payload))
export const replyGroupPost = (groupId: string, postId: string, body: string) =>
  request<TopicReply>(`/community/groups/${encodeURIComponent(groupId)}/posts/${encodeURIComponent(postId)}/replies`, json('POST', { body }))

export const listFriends = () => request<Friend[]>('/community/social/friends')
export const listFriendRequests = (direction: 'incoming' | 'outgoing') =>
  request<FriendRequest[]>(`/community/social/friend-requests?direction=${direction}`)
export const sendFriendRequest = (userId: string, message = '') =>
  request<{ id: string; status: string }>('/community/social/friend-requests', json('POST', { user_id: userId, message }))
export const acceptFriendRequest = (id: string) =>
  request<{ status: string }>(`/community/social/friend-requests/${encodeURIComponent(id)}/accept`, json('POST', {}))
export const rejectFriendRequest = (id: string) =>
  request<{ status: string }>(`/community/social/friend-requests/${encodeURIComponent(id)}/reject`, json('POST', {}))
export const cancelFriendRequest = (id: string) =>
  request<{ status: string }>(`/community/social/friend-requests/${encodeURIComponent(id)}`, json('DELETE'))
export const deleteFriend = (userId: string) =>
  request<{ status: string }>(`/community/social/friends/${encodeURIComponent(userId)}`, json('DELETE'))

export const getSocialFeed = (scope: 'following' | 'friends' | 'all' = 'following') =>
  request<FeedItem[]>(`/community/social/feed?scope=${scope}`)
export const listNotifications = (unreadOnly = false) =>
  request<CommunityNotification[]>(`/community/social/notifications?unread_only=${unreadOnly ? 'true' : 'false'}`)
export const markNotificationsRead = (ids?: string[]) =>
  request<{ status: string }>('/community/social/notifications/read', json('POST', ids ? { ids } : {}))
export const socialSearch = (q: string) =>
  request<SocialSearch>(`/community/social/search?q=${encodeURIComponent(q)}`)
