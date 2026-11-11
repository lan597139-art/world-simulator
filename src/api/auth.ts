import { API_ORIGIN } from './config'
import { AUTH_TOKEN_KEY, AUTH_USER_KEY } from './authToken'

export type AuthUser = { id: string; username: string; display_name: string; created_at?: string | null }
export type AuthStatus = { setup_required: boolean; authenticated: boolean; user: AuthUser | null; auth_disabled: boolean; setup_token_required?: boolean }

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

export async function authStatus(): Promise<AuthStatus> {
  const token = localStorage.getItem(AUTH_TOKEN_KEY) || ''
  return request<AuthStatus>('/auth/status', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
}

export async function authSetup(payload: { username: string; password: string; display_name?: string; setup_token?: string }) {
  const result = await request<{ token: string; user: AuthUser }>('/auth/setup', {
    method: 'POST', body: JSON.stringify(payload),
  })
  localStorage.setItem(AUTH_TOKEN_KEY, result.token)
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(result.user))
  return result
}

export async function authLogin(payload: { username: string; password: string }) {
  const result = await request<{ token: string; user: AuthUser }>('/auth/login', {
    method: 'POST', body: JSON.stringify(payload),
  })
  localStorage.setItem(AUTH_TOKEN_KEY, result.token)
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(result.user))
  return result
}

export async function authLogout() {
  try { await request<{ status: string }>('/auth/logout', { method: 'POST', body: '{}' }) } catch { /* clear anyway */ }
  localStorage.removeItem(AUTH_TOKEN_KEY)
  localStorage.removeItem(AUTH_USER_KEY)
}
