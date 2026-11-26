import { API_ORIGIN } from './config'
import { getAuthToken } from './authToken'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken()
  const res = await fetch(`${API_ORIGIN}/api${path}`, {
    ...init, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.headers || {}) },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(String(body?.detail || `请求失败（HTTP ${res.status}）`))
  }
  return res.json() as Promise<T>
}

export type PublicationExperience = {
  enabled: boolean
  fruit: number | null
  has_content: boolean
  granted: boolean
  /** 深度体验内容，仅在已授权时下发；未授权为 null。 */
  content?: PublicWork['content']['snapshot'] | null
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
  click_count: number
  comment_count: number
  favorite_count: number
  like_count: number
  /** 作者用户 id，仅在已登录视图者时下发，用于作品打赏定向。 */
  author_user_id: string | null
  public_visible: boolean
  experience: PublicationExperience
  content: {
    version_id?: string | null
    version_no?: number | null
    snapshot: { kind?: string; items?: Array<{ title?: string; content?: string; date?: string; order_index?: number }> }
    content_hash: string
  }
  liked_by_me: boolean
  favorited_by_me: boolean
}

export type AuthorPublication = PublicWork & {
  id: string
  owner_user_id: string
  status: string
  current_version_id?: string | null
  /** 作者内容权限：普通公开范围与灵果体验开关/消耗。 */
  public_visible: boolean
  experience_enabled: boolean
  experience_fruit: number | null
}

export const publicFeed = (workType = '', limit = 30) => {
  const q = new URLSearchParams()
  if (workType) q.set('work_type', workType)
  q.set('limit', String(limit))
  return request<PublicWork[]>(`/community/public?${q.toString()}`)
}
export const publicDetail = (publicId: string) =>
  request<PublicWork>(`/community/public/${encodeURIComponent(publicId)}`)
/** 记录作品点击量：入口/目录点击与阅读量分别计数。 */
export const clickPublicWork = (publicId: string) =>
  request<{ click_count: number }>(`/community/public/${encodeURIComponent(publicId)}/click`, { method: 'POST' })
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
export const likePublicWork = (publicId: string) =>
  request<{ liked: boolean }>(`/community/public/${encodeURIComponent(publicId)}/like`, { method: 'POST' })
export const unlikePublicWork = (publicId: string) =>
  request<{ liked: boolean }>(`/community/public/${encodeURIComponent(publicId)}/like`, { method: 'DELETE' })
export const getExperienceInfo = (publicId: string) =>
  request<PublicationExperience & { public_id: string }>(`/community/public/${encodeURIComponent(publicId)}/experience`)
export const grantExperience = (publicId: string, idempotencyKey: string) =>
  request<{
    public_id: string
    granted: boolean
    transaction_id: string | null
    fruit_amount: number
    balance_after: number | null
    exempt: boolean
    experience: { kind?: string; items?: Array<{ title?: string; content?: string; date?: string; order_index?: number }> }
  }>(`/community/public/${encodeURIComponent(publicId)}/experience`, {
    method: 'POST',
    body: JSON.stringify({ confirm: true, idempotency_key: idempotencyKey }),
  })
export const updatePublicationPermissions = (id: string, payload: {
  public_visible?: boolean
  experience_enabled?: boolean
  experience_fruit?: number | null
}) =>
  request<AuthorPublication>(`/community/publications/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })

export const publishDirect = (payload: {
  title: string
  content: string
  summary?: string
  anonymous?: boolean
  work_type?: string
  public_visible?: boolean
  experience_enabled?: boolean
  experience_fruit?: number | null
  experience_snapshot?: { kind: string; items: Array<{ title: string; content: string }> } | null
}) => request<AuthorPublication>('/community/publications', {
  method: 'POST', body: JSON.stringify({ source_type: 'direct', ...payload }),
})
