import { API_ORIGIN } from './config'
import { AUTH_TOKEN_KEY, AUTH_USER_KEY } from './authToken'

export type AuthUser = {
  id: string
  username: string
  display_name: string
  email?: string
  email_verified?: boolean
  is_owner?: boolean
  bio?: string
  avatar?: string
  avatar_url?: string
  created_at?: string | null
}
export type AuthStatus = {
  setup_required: boolean
  authenticated: boolean
  user: AuthUser | null
  auth_disabled: boolean
  setup_token_required?: boolean
  registration_enabled?: boolean
  invite_required?: boolean
  email_verification?: 'off' | 'dev' | 'smtp'
}

export type RegisterResult =
  | { verification_required: false; token: string; user: AuthUser }
  | { verification_required: true; registration_id: string; email: string; email_mode: 'dev' | 'smtp'; dev_code?: string | null }

export type InviteCode = {
  id: string
  code_prefix: string
  label: string
  max_uses: number
  used_count: number
  status: 'active' | 'revoked' | 'expired' | 'exhausted'
  expires_at: string | null
  revoked_at: string | null
  created_at: string | null
  last_used_at: string | null
}

const BASE = `${API_ORIGIN}/api`

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (init?.body) headers.set('Content-Type', 'application/json')
  const response = await fetch(`${BASE}${path}`, { ...init, headers })
  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`
    try {
      const body = await response.json()
      if (body?.detail) message = typeof body.detail === 'string' ? body.detail : body.detail.message || message
    } catch { /* status */ }
    throw new Error(message)
  }
  return (await response.json()) as T
}

function persist(token: string, user: AuthUser) {
  localStorage.setItem(AUTH_TOKEN_KEY, token)
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user))
}

export async function authStatus(): Promise<AuthStatus> {
  const token = localStorage.getItem(AUTH_TOKEN_KEY) || ''
  return request<AuthStatus>('/auth/status', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
}

export async function authSetup(payload: { username: string; password: string; display_name?: string; email?: string; setup_token?: string }) {
  const result = await request<{ token: string; user: AuthUser }>('/auth/setup', {
    method: 'POST', body: JSON.stringify(payload),
  })
  persist(result.token, result.user)
  return result
}

export async function authLogin(payload: { username: string; password: string }) {
  const result = await request<{ token: string; user: AuthUser }>('/auth/login', {
    method: 'POST', body: JSON.stringify(payload),
  })
  persist(result.token, result.user)
  return result
}

export async function authRegister(payload: {
  invite_code: string
  username: string
  email: string
  password: string
  display_name?: string
}): Promise<RegisterResult> {
  const result = await request<RegisterResult>('/auth/register', {
    method: 'POST', body: JSON.stringify(payload),
  })
  if (!result.verification_required) persist(result.token, result.user)
  return result
}

export async function authVerifyRegistration(payload: { registration_id: string; code: string }) {
  const result = await request<{ token: string; user: AuthUser }>('/auth/register/verify', {
    method: 'POST', body: JSON.stringify(payload),
  })
  persist(result.token, result.user)
  return result
}

export async function authResendRegistration(registrationId: string) {
  return request<{ status: string; email_mode: string; dev_code?: string | null }>('/auth/register/resend', {
    method: 'POST', body: JSON.stringify({ registration_id: registrationId }),
  })
}

export async function authLogout() {
  try { await request<{ status: string }>('/auth/logout', { method: 'POST', body: '{}' }) } catch { /* clear anyway */ }
  localStorage.removeItem(AUTH_TOKEN_KEY)
  localStorage.removeItem(AUTH_USER_KEY)
}

export async function listInvites() {
  return request<{ items: InviteCode[] }>('/auth/invites')
}

export async function createInvite(payload: { label?: string; max_uses?: number; expires_days?: number }) {
  return request<{ code: string; invite: InviteCode }>('/auth/invites', {
    method: 'POST', body: JSON.stringify(payload),
  })
}

export async function updateInvite(id: string, payload: { label?: string; revoked?: boolean }) {
  return request<{ invite: InviteCode }>(`/auth/invites/${id}`, {
    method: 'PATCH', body: JSON.stringify(payload),
  })
}
