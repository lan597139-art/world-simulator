import { API_ORIGIN } from './config'

export type SettingsPreferences = {
  language: 'zh' | 'en'
  theme: 'system' | 'light' | 'dark'
  density: 'compact' | 'comfortable' | 'spacious'
  font_size: 'small' | 'medium' | 'large'
  reduce_motion: boolean
  show_tips: boolean
  auto_save: boolean
}

export type SettingsPrivacy = {
  public_profile: boolean
  show_activity: boolean
  allow_follow: boolean
  allow_friend_requests: boolean
  allow_group_invites: boolean
  allow_ai_private_context: boolean
}

export type SettingsNotifications = {
  community_reply: boolean
  friend_request: boolean
  follow: boolean
  group_activity: boolean
  system: boolean
  weekly_digest: boolean
}

export type SettingsProfile = {
  id: string
  username: string
  display_name: string
  bio: string
  avatar: string
  is_owner: boolean
  created_at?: string | null
}

export type SettingsData = {
  profile: SettingsProfile
  preferences: SettingsPreferences
  privacy: SettingsPrivacy
  notifications: SettingsNotifications
  account: { is_owner: boolean; created_at?: string | null; sessions: number }
  stats: Record<string, number>
  storage: { database_bytes: number }
}

export type AuthSessionRow = {
  id: string
  created_at?: string | null
  expires_at?: string | null
  current: boolean
}

const BASE = `${API_ORIGIN}/api`

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  })
  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`
    try {
      const body = await response.json()
      if (body?.detail) message = body.detail
    } catch { /* keep status */ }
    throw new Error(message)
  }
  return (await response.json()) as T
}

export const getSettings = () => request<SettingsData>('/settings')

export const updateSettings = (payload: {
  preferences?: Partial<SettingsPreferences>
  privacy?: Partial<SettingsPrivacy>
  notifications?: Partial<SettingsNotifications>
}) => request<SettingsData>('/settings', { method: 'PATCH', body: JSON.stringify(payload) })

export const updateProfile = (payload: { display_name?: string; bio?: string; avatar?: string }) =>
  request<SettingsProfile>('/auth/profile', { method: 'PATCH', body: JSON.stringify(payload) })

export const changePassword = (payload: { current_password: string; new_password: string }) =>
  request<{ status: string; message: string }>('/auth/change-password', {
    method: 'POST', body: JSON.stringify(payload),
  })

export const listSettingsSessions = () => request<AuthSessionRow[]>('/settings/sessions')

export const revokeSettingsSession = (id: string) =>
  request<{ status: string }>(`/settings/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' })

export const exportSettingsData = () => request<{ filename: string; content: string }>('/settings/export')

export const getSettingsAbout = () => request<{
  name: string
  version: string
  api_version: string
  description: string
  docs: { title: string; href: string }[]
  support: string
}>('/settings/about')
