import { API_ORIGIN } from './config'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_ORIGIN}/api${path}`, {
    ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(String(body?.detail || `请求失败（HTTP ${res.status}）`))
  }
  return res.json() as Promise<T>
}

export type PublicWork = {
  public_id: string
  work_type: string
  title: string
  summary: string
  author_display: string
  anonymous: boolean
  cover: string
  published_at?: string | null
  view_count: number
  comment_count: number
  favorite_count: number
  content: {
    version_id?: string | null
    version_no?: number | null
    snapshot: { kind?: string; items?: Array<{ title?: string; content?: string; date?: string; order_index?: number }> }
    content_hash: string
  }
}

export type AuthorPublication = PublicWork & {
  id: string
  owner_user_id: string
  status: string
  current_version_id?: string | null
}

export const publicFeed = (workType = '', limit = 30) => {
  const q = new URLSearchParams()
  if (workType) q.set('work_type', workType)
  q.set('limit', String(limit))
  return request<PublicWork[]>(`/community/public?${q.toString()}`)
}
export const publicDetail = (publicId: string) =>
  request<PublicWork>(`/community/public/${encodeURIComponent(publicId)}`)
export const listMyPublications = () => request<AuthorPublication[]>('/community/publications')
export const publishEntry = (entryIds: string[], payload: { title: string; summary?: string; anonymous?: boolean }) =>
  request<AuthorPublication>('/community/publications', {
    method: 'POST',
    body: JSON.stringify({ source_type: 'journal_entry', source_ids: entryIds, ...payload }),
  })
export const publishBiography = (biographyId: string, payload: { title: string; summary?: string; anonymous?: boolean }) =>
  request<AuthorPublication>('/community/publications', {
    method: 'POST',
    body: JSON.stringify({ source_type: 'biography', source_id: biographyId, ...payload }),
  })
export const withdrawPublication = (id: string) =>
  request<AuthorPublication>(`/community/publications/${id}/withdraw`, { method: 'POST' })
export const commentOnWork = (publicId: string, body: string) =>
  request<{ id: string; body: string }>(`/community/public/${encodeURIComponent(publicId)}/comments`, {
    method: 'POST', body: JSON.stringify({ body }),
  })
export const listComments = (publicId: string) =>
  request<Array<{ id: string; body: string; created_at?: string }>>(`/community/public/${encodeURIComponent(publicId)}/comments`)
export const favoriteWork = (publicId: string) =>
  request<{ favorited: boolean }>(`/community/public/${encodeURIComponent(publicId)}/favorite`, { method: 'POST' })

export const publishDirect = (payload: {
  title: string; content: string; summary?: string; anonymous?: boolean; work_type?: string
}) => request<AuthorPublication>('/community/publications', {
  method: 'POST', body: JSON.stringify({ source_type: 'direct', ...payload }),
})
