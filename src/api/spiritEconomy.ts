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
