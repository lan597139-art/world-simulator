import { API_ORIGIN } from './config'
import type { AuthUser } from './auth'

const BASE = `${API_ORIGIN}/api`

export async function updateUserDisplayName(displayName: string): Promise<AuthUser> {
  const response = await fetch(`${BASE}/users/me`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ display_name: displayName }),
  })
  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`
    try {
      const body = await response.json()
      if (body?.detail) message = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
    } catch {
      /* keep status text */
    }
    throw new Error(message)
  }
  return await response.json() as AuthUser
}
