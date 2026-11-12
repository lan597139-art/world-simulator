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

export type JournalEntry = {
  id: string
  world_id?: string | null
  character_id?: string | null
  entry_date: string
  date_end?: string | null
  entry_type: string
  entry_type_label: string
  info_class: string
  sensitivity: string
  status: string
  title: string
  content: string
  mood: string
  tags: string[]
  person_ids: string[]
  source_type: string
  source_ref: Record<string, unknown>
  product_key: string
  visibility: string
  created_at?: string | null
  updated_at?: string | null
}

export type JournalPerson = {
  id: string
  name: string
  alias: string
  relation_label: string
  summary: string
  birthday: string
  avatar: string
  status: string
  created_at?: string | null
  updated_at?: string | null
}

export type JournalRelation = {
  id: string
  person_id: string
  related_person_id: string
  relation_type: string
  description: string
  start_date: string
  end_date: string
  status: string
}

export type BiographyChapter = {
  id: string
  biography_id: string
  title: string
  summary: string
  content: string
  order_index: number
  source_entry_ids: string[]
  status: string
}

export type UserBiography = {
  id: string
  title: string
  subtitle: string
  summary: string
  cover: string
  status: string
  visibility: string
  chapter_count: number
  chapters: BiographyChapter[]
  created_at?: string | null
  updated_at?: string | null
}

export type JournalPresets = {
  entry_types: Array<{ key: string; label: string }>
  info_classes: Array<{ key: string; label: string }>
  sensitivities: Array<{ key: string; label: string }>
  biography_statuses: Array<{ key: string; label: string }>
  citation_targets: Array<{ key: string; label: string }>
}

export const getJournalPresets = () => request<JournalPresets>('/journal/presets')
export const getJournalOverview = () => request<Record<string, number>>('/journal/overview')

export const listJournalEntries = (params: {
  product?: string; entry_type?: string; info_class?: string; sensitivity?: string; person_id?: string; status?: string; world_id?: string
} = {}) => {
  const q = new URLSearchParams()
  q.set('product', params.product || 'diary')
  for (const key of ['entry_type', 'info_class', 'sensitivity', 'person_id', 'status', 'world_id'] as const) {
    if (params[key]) q.set(key, String(params[key]))
  }
  return request<JournalEntry[]>(`/journal/entries?${q.toString()}`)
}

export const createJournalEntry = (payload: Partial<JournalEntry> & { content: string }) =>
  request<JournalEntry>('/journal/entries', { method: 'POST', body: JSON.stringify(payload) })
export const updateJournalEntry = (id: string, payload: Partial<JournalEntry>) =>
  request<JournalEntry>(`/journal/entries/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
export const deleteJournalEntry = (id: string) =>
  request<{ status: string }>(`/journal/entries/${id}`, { method: 'DELETE' })

export const listJournalPeople = () => request<JournalPerson[]>('/journal/people')
export const createJournalPerson = (payload: { name: string; relation_label?: string; summary?: string }) =>
  request<JournalPerson>('/journal/people', { method: 'POST', body: JSON.stringify(payload) })
export const updateJournalPerson = (id: string, payload: Partial<JournalPerson>) =>
  request<JournalPerson>(`/journal/people/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
export const deleteJournalPerson = (id: string) =>
  request<{ status: string }>(`/journal/people/${id}`, { method: 'DELETE' })

export const listJournalRelations = (personId = '') =>
  request<JournalRelation[]>(`/journal/relations${personId ? `?person_id=${encodeURIComponent(personId)}` : ''}`)
export const createJournalRelation = (payload: Partial<JournalRelation>) =>
  request<JournalRelation>('/journal/relations', { method: 'POST', body: JSON.stringify(payload) })
export const deleteJournalRelation = (id: string) =>
  request<{ status: string }>(`/journal/relations/${id}`, { method: 'DELETE' })

export const listUserBiographies = () => request<UserBiography[]>('/journal/biographies')
export const createUserBiography = (payload: { title: string; subtitle?: string; summary?: string }) =>
  request<UserBiography>('/journal/biographies', { method: 'POST', body: JSON.stringify(payload) })
export const updateUserBiography = (id: string, payload: Partial<UserBiography>) =>
  request<UserBiography>(`/journal/biographies/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
export const deleteUserBiography = (id: string) =>
  request<{ status: string }>(`/journal/biographies/${id}`, { method: 'DELETE' })
export const createBiographyChapter = (biographyId: string, payload: Partial<BiographyChapter>) =>
  request<BiographyChapter>(`/journal/biographies/${biographyId}/chapters`, { method: 'POST', body: JSON.stringify(payload) })
export const createBiographyChapterFromEntries = (biographyId: string, entryIds: string[], title?: string) =>
  request<BiographyChapter>(`/journal/biographies/${biographyId}/chapters/from-entries`, {
    method: 'POST', body: JSON.stringify({ entry_ids: entryIds, title }),
  })
export const updateBiographyChapter = (biographyId: string, chapterId: string, payload: Partial<BiographyChapter>) =>
  request<BiographyChapter>(`/journal/biographies/${biographyId}/chapters/${chapterId}`, { method: 'PATCH', body: JSON.stringify(payload) })
export const deleteBiographyChapter = (biographyId: string, chapterId: string) =>
  request<{ status: string }>(`/journal/biographies/${biographyId}/chapters/${chapterId}`, { method: 'DELETE' })

export type JournalCitation = {
  id: string
  target_type: string
  target_id: string
  source_id: string
  excerpt: string
  source_title: string
  source_type: string
  source_status: string
  created_at?: string | null
}
export const listJournalCitations = (targetType: string, targetId: string) =>
  request<JournalCitation[]>(`/journal/citations?target_type=${encodeURIComponent(targetType)}&target_id=${encodeURIComponent(targetId)}`)
export const createJournalCitation = (payload: { target_type: string; target_id: string; source_id: string; excerpt?: string }) =>
  request<JournalCitation>('/journal/citations', { method: 'POST', body: JSON.stringify(payload) })
export const deleteJournalCitation = (id: string) =>
  request<{ status: string }>(`/journal/citations/${id}`, { method: 'DELETE' })
