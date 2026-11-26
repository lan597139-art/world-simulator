import { API_ORIGIN } from './config'
import { getAuthToken } from './authToken'

export type SpiritPlant = {
  id: string
  key: string
  name: string
  category: 'world' | 'oc' | string
  description: string
  price_fruit: number
  unit: string
  sort_order: number
  is_active: boolean
  expires_at: string | null
  is_expired: boolean
}

export type SpiritInventoryItem = {
  plant_type_id: string
  key: string
  name: string
  category: string
  quantity: number
  unit: string
}

export type SpiritTransaction = {
  id: string
  kind: 'reward' | 'exchange' | 'gift' | 'tip' | 'consume' | 'admin' | string
  fruit_amount: number
  plant_type_id?: string | null
  plant_quantity: number
  unit_price?: number | null
  counterparty_user_id?: string | null
  ref_type: string
  ref_id: string
  note: string
  balance_after: number
  created_at: string
}

export type SpiritSummary = {
  account: {
    user_id: string
    fruit_balance: number
    developer_exempt: boolean
    updated_at: string | null
  }
  inventory: SpiritInventoryItem[]
  plants: SpiritPlant[]
  transactions: SpiritTransaction[]
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

export const getSpiritSummary = () => request<SpiritSummary>('/api/spirit/summary')

export const getSpiritTransactions = (limit = 80) =>
  request<SpiritTransaction[]>(`/api/spirit/transactions?limit=${limit}`)

export const exchangeSpiritPlant = (plantTypeId: string, quantity: number) =>
  request<{ account: SpiritSummary['account']; inventory: SpiritInventoryItem[] }>('/api/spirit/exchange', {
    method: 'POST',
    body: JSON.stringify({ plant_type_id: plantTypeId, quantity }),
  })

export const giftSpiritFruit = (payload: {
  to_user_id: string
  amount: number
  note?: string
  kind?: 'gift' | 'tip'
  ref_type?: string
  ref_id?: string
}) =>
  request<{ status: string; kind: string; balance: number }>('/api/spirit/gift', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const adjustSpiritFruit = (payload: { user_id: string; amount: number; note?: string }) =>
  request<{ status: string; user_id: string; balance: number }>('/api/spirit/admin/adjust', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export type SpiritRewardRule = {
  id: string
  key: string
  name: string
  description: string
  category: string
  fruit_amount: number
  plant_type_id?: string | null
  plant_name?: string
  plant_quantity: number
  claim_mode: 'once' | 'daily' | 'event' | string
  condition: { type?: string }
  enabled: boolean
  daily_limit: number
  total_limit: number
  cooldown_seconds: number
  condition_ready?: boolean
  can_claim?: boolean
  claim_status?: {
    claimed: boolean
    claimed_count: number
    claimed_today: number
    daily_remaining: number | null
    total_remaining: number | null
    cooldown_until: string | null
    claim_key: string
    last_claimed_at: string | null
  }
}

export type SpiritAdminOverview = {
  accounts: Array<{
    user_id: string
    username: string
    display_name: string
    fruit_balance: number
    developer_exempt: boolean
    is_owner: boolean
    updated_at: string | null
  }>
  rules: SpiritRewardRule[]
  plants: SpiritPlant[]
  transactions: SpiritTransaction[]
}

export const getSpiritRewards = () => request<{ items: SpiritRewardRule[] }>('/api/spirit/rewards')

export const claimSpiritReward = (key: string, claimKey?: string) =>
  request<{ status: string; claim: { fruit_amount: number; plant_quantity: number }; account: SpiritSummary['account']; rule: SpiritRewardRule }>(
    `/api/spirit/rewards/${encodeURIComponent(key)}/claim`,
    { method: 'POST', body: JSON.stringify(claimKey ? { claim_key: claimKey } : {}) },
  )

export const getSpiritAdminOverview = (q = '') =>
  request<SpiritAdminOverview>(`/api/spirit/admin/overview?q=${encodeURIComponent(q)}`)

export type UserActivityRow = {
  user_id: string
  username: string
  display_name: string
  is_owner: boolean
  posts: number
  comments: number
  works: number
  reads: number
  likes_given: number
  favorites_given: number
  following: number
  followers: number
  activity_level: { level: number; label: string; score: number; next_threshold: number | null; progress: number }
  last_login_at: string | null
  last_active_at: string | null
  created_at: string | null
}

export const getUserActivityOverview = (q = '') =>
  request<{ items: UserActivityRow[] }>(`/api/admin/user-activity?q=${encodeURIComponent(q)}`)

export const updateSpiritRewardRule = (id: string, payload: Partial<SpiritRewardRule> & { condition?: { type?: string } }) =>
  request<SpiritRewardRule>(`/api/spirit/admin/rewards/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })

export const updateSpiritPlant = (id: string, payload: { price_fruit?: number; is_active?: boolean; name?: string; description?: string; expires_at?: string | null }) =>
  request<SpiritPlant>(`/api/spirit/admin/plants/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })

export const createSpiritRewardRule = (payload: {
  key: string; name: string; description?: string; category?: string
  fruit_amount?: number; claim_mode?: string; condition?: { type?: string }
  daily_limit?: number; total_limit?: number; enabled?: boolean
}) =>
  request<SpiritRewardRule>('/api/spirit/admin/rewards', { method: 'POST', body: JSON.stringify(payload) })
