import { API_ORIGIN } from '../api/config'
import type { World } from '../types/world'

export type Lang = 'zh' | 'en'

export type BasicCharacter = {
  id: string
  name: string
  worldId: string
  worldName: string
  role: string
  identity: string
  intro: string
  background: string
  age: string
  gender: string
  kind: 'story' | 'companion'
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_ORIGIN}/api${path}`)
  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`
    try {
      const body = await response.json()
      if (typeof body?.detail === 'string') detail = body.detail
    } catch {
      /* keep status text */
    }
    throw new Error(detail)
  }
  return (await response.json()) as T
}

export async function fetchWorlds(includeWorkspace = true): Promise<World[]> {
  const rows = await apiGet<World[]>(`/worlds?include_workspace=${includeWorkspace ? 'true' : 'false'}`)
  return Array.isArray(rows) ? rows : []
}

export function parseProfile(row: any): Record<string, any> {
  if (row?.basic_profile && typeof row.basic_profile === 'object') return row.basic_profile
  if (typeof row?.basic_profile === 'string') {
    try {
      return JSON.parse(row.basic_profile)
    } catch {
      return {}
    }
  }
  return row || {}
}

export function toCharacter(row: any, worlds: World[]): BasicCharacter {
  const profile = parseProfile(row)
  const world = worlds.find((item) => item.id === row.world_id)
  const name = String(profile.name || row.name || '未命名角色')
  const identity = String(profile.identity || '')
  return {
    id: String(row.id || profile.code || name),
    name,
    worldId: String(row.world_id || ''),
    worldName: world?.name || String(profile.world || ''),
    role: String(profile.role || identity || '原创角色'),
    identity,
    intro: String(profile.intro || profile.description || profile.background || ''),
    background: String(profile.background || ''),
    age: String(profile.age || ''),
    gender: String(profile.gender || ''),
    kind: identity.includes('AI') || world?.product_scene === 'companion' ? 'companion' : 'story',
  }
}

export function formatDate(value: string | null | undefined, lang: Lang, withYear = false) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', {
    ...(withYear ? { year: 'numeric' as const } : {}),
    month: 'short',
    day: 'numeric',
  })
}

export function excerpt(value: string, limit = 120) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit)
}

export function initialOf(name: string) {
  return String(name || '?').trim().charAt(0) || '?'
}

export const WORLD_TYPE_LABELS: Record<string, { zh: string; en: string }> = {
  reality: { zh: '现实', en: 'Reality' },
  fiction: { zh: '虚构', en: 'Fiction' },
  historical: { zh: '历史', en: 'Historical' },
  experimental: { zh: '实验', en: 'Experimental' },
}

export const STORY_STATUS_LABELS: Record<string, { zh: string; en: string }> = {
  active: { zh: '连载中', en: 'Active' },
  draft: { zh: '草稿', en: 'Draft' },
  completed: { zh: '已完结', en: 'Completed' },
  archived: { zh: '已归档', en: 'Archived' },
}

export const BRANCH_STATUS_LABELS: Record<string, { zh: string; en: string }> = {
  active: { zh: '进行中', en: 'Active' },
  paused: { zh: '已暂停', en: 'Paused' },
  archived: { zh: '已归档', en: 'Archived' },
}
