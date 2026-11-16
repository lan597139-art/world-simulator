import { API_ORIGIN } from './config'
import { getAuthToken } from './authToken'

export type ComicPageKind = 'page' | 'strip' | 'panel' | 'sketch'
export type ComicAssetKind = 'illustration' | 'manuscript' | 'panel' | 'character' | 'cover' | 'other'

export type ComicPage = {
  id: string
  work_id: string
  chapter_id: string
  caption: string
  image_url: string
  kind: ComicPageKind
  order_index: number
  created_at: string
  updated_at: string
}

export type ComicChapter = {
  id: string
  work_id: string
  title: string
  summary: string
  order_index: number
  status: 'draft' | 'in_progress' | 'completed'
  page_count: number
  pages: ComicPage[]
  created_at: string
  updated_at: string
}

export type ComicAsset = {
  id: string
  work_id: string
  kind: ComicAssetKind
  title: string
  file_url: string
  mime_type: string
  file_size: number
  created_at: string
}

export type ComicWorkspace = {
  work: {
    id: string
    title: string
    summary: string
    cover_url: string
    status: string
    category: string
  }
  chapters: ComicChapter[]
  assets: ComicAsset[]
  page_count: number
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getAuthToken()
  const response = await fetch(`${API_ORIGIN}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.detail || `请求失败 (${response.status})`)
  }
  return response.json()
}

export const getComicWorkspace = (workId: string) =>
  request<ComicWorkspace>(`/api/comic-works/${workId}`)

export const createComicChapter = (workId: string, payload: { title: string; summary?: string }) =>
  request<ComicChapter>(`/api/comic-works/${workId}/chapters`, { method: 'POST', body: JSON.stringify(payload) })

export const updateComicChapter = (workId: string, chapterId: string, payload: { title?: string; summary?: string; status?: string }) =>
  request<ComicChapter>(`/api/comic-works/${workId}/chapters/${chapterId}`, { method: 'PATCH', body: JSON.stringify(payload) })

export const deleteComicChapter = (workId: string, chapterId: string) =>
  request<{ status: string }>(`/api/comic-works/${workId}/chapters/${chapterId}`, { method: 'DELETE' })

export const reorderComicChapters = (workId: string, chapterIds: string[]) =>
  request<ComicWorkspace>(`/api/comic-works/${workId}/chapters/reorder`, { method: 'POST', body: JSON.stringify({ chapter_ids: chapterIds }) })

export const createComicPage = (workId: string, chapterId: string, payload: { image_url: string; caption?: string; kind?: ComicPageKind }) =>
  request<ComicPage>(`/api/comic-works/${workId}/chapters/${chapterId}/pages`, { method: 'POST', body: JSON.stringify(payload) })

export const updateComicPage = (workId: string, pageId: string, payload: { caption?: string; image_url?: string; kind?: ComicPageKind }) =>
  request<ComicPage>(`/api/comic-works/${workId}/pages/${pageId}`, { method: 'PATCH', body: JSON.stringify(payload) })

export const deleteComicPage = (workId: string, pageId: string) =>
  request<{ status: string }>(`/api/comic-works/${workId}/pages/${pageId}`, { method: 'DELETE' })

export const reorderComicPages = (workId: string, chapterId: string, pageIds: string[]) =>
  request<ComicWorkspace>(`/api/comic-works/${workId}/chapters/${chapterId}/pages/reorder`, { method: 'POST', body: JSON.stringify({ page_ids: pageIds }) })

export const createComicAsset = (workId: string, payload: { title: string; file_url: string; kind?: ComicAssetKind; mime_type?: string; file_size?: number }) =>
  request<ComicAsset>(`/api/comic-works/${workId}/assets`, { method: 'POST', body: JSON.stringify(payload) })

export const deleteComicAsset = (workId: string, assetId: string) =>
  request<{ status: string }>(`/api/comic-works/${workId}/assets/${assetId}`, { method: 'DELETE' })
