export const AUTH_TOKEN_KEY = 'ws.authToken'
export const AUTH_USER_KEY = 'ws.authUser'

export function getAuthToken(): string {
  try { return localStorage.getItem(AUTH_TOKEN_KEY) || '' } catch { return '' }
}

export function setAuthToken(token: string) {
  try { localStorage.setItem(AUTH_TOKEN_KEY, token) } catch { /* ignore */ }
}

export function clearAuthToken() {
  try { localStorage.removeItem(AUTH_TOKEN_KEY); localStorage.removeItem(AUTH_USER_KEY) } catch { /* ignore */ }
}


export function getStoredAuthUser(): { id?: string; username?: string; display_name?: string } | null {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
