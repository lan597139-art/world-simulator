import { API_ORIGIN } from './config'

export type BillingMode = {
  sandbox: boolean
  provider: string
  provider_label: string
  currency: string
}

export type BillingPlan = {
  key: string
  label: string
  tagline: string
  monthly_cents: number
  yearly_cents: number
  included_calls: number
  features: string[]
}

export type RechargePackage = {
  key: string
  label: string
  amount_cents: number
  note: string
}

export type BillingMembership = {
  plan: string
  plan_label: string
  status: string
  cycle: string
  started_at: string | null
  expires_at: string | null
  auto_renew: boolean
  included_calls: number
  features: string[]
}

export type BillingOrder = {
  id: string
  kind: string
  sku: string
  title: string
  amount_cents: number
  amount_display: string
  currency: string
  status: string
  payment_method: string
  paid_at: string | null
  created_at: string
  details: Record<string, unknown>
}

export type BillingLedgerEntry = {
  id: string
  order_id: string | null
  entry_type: string
  amount_cents: number
  amount_display: string
  balance_after_cents: number
  description: string
  created_at: string
  details: Record<string, unknown>
}

export type BillingUsageDay = {
  date: string
  calls: number
  platform: number
  personal: number
}

export type BillingUsageRecord = {
  id: string
  route: string
  provider: string
  model: string
  status_code: number
  units: number
  created_at: string
}

export type BillingUsage = {
  month: string
  platform_calls: number
  personal_calls: number
  total_calls: number
  included_calls: number
  remaining_calls: number
  monthly_call_limit: number
  limit_used_ratio: number
  daily: BillingUsageDay[]
  recent: BillingUsageRecord[]
}

export type BillingSettlementRecord = {
  id: string
  period_start: string | null
  period_end: string | null
  gross_cents: number
  platform_fee_cents: number
  net_cents: number
  net_display: string
  status: string
  created_at: string | null
  paid_at: string | null
}

export type BillingSettlement = {
  total_earned_cents: number
  available_cents: number
  pending_cents: number
  paid_cents: number
  minimum_cents: number
  fee_rate: number
  records: BillingSettlementRecord[]
}

export type BillingOverview = {
  mode: BillingMode
  account: { balance_cents: number; balance_display: string; currency: string; ai_monthly_call_limit: number }
  membership: BillingMembership
  plans: BillingPlan[]
  recharge_packages: RechargePackage[]
  usage: BillingUsage
  settlement: BillingSettlement
  summary: {
    pending_orders: number
    paid_total_cents: number
    paid_total_display: string
    creator_available_cents: number
    creator_available_display: string
  }
  recent_orders: BillingOrder[]
  recent_ledger: BillingLedgerEntry[]
}

export type BillingServiceRecord = {
  id: string
  service_type: string
  title: string
  amount_cents: number
  amount_display: string
  status: string
  started_at: string | null
  expires_at: string | null
}

export type BillingRecords = {
  ledger: BillingLedgerEntry[]
  services: BillingServiceRecord[]
}

const BASE = `${API_ORIGIN}/api`

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  })
  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`
    try {
      const body = await response.json()
      if (body?.detail) message = body.detail
    } catch { /* keep status */ }
    throw new Error(message)
  }
  return (await response.json()) as T
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
})

export const getBillingOverview = () => request<BillingOverview>('/billing/overview')
export const listBillingOrders = (status = '') =>
  request<BillingOrder[]>(`/billing/orders${status ? `?status=${encodeURIComponent(status)}` : ''}`)
export const createBillingOrder = (payload: { kind: 'recharge' | 'membership'; sku: string; cycle?: 'monthly' | 'yearly' }) =>
  request<{ order: BillingOrder; account: { balance_cents: number; balance_display: string } }>('/billing/orders', json('POST', payload))
export const payBillingOrder = (id: string, payload: { confirm_sandbox?: boolean } = {}) =>
  request<{ order: BillingOrder; account: { balance_cents: number; balance_display: string }; membership: BillingMembership; usage: BillingUsage }>(
    `/billing/orders/${encodeURIComponent(id)}/pay`, json('POST', payload),
  )
export const cancelBillingOrder = (id: string) =>
  request<{ status: string; order: BillingOrder }>(`/billing/orders/${encodeURIComponent(id)}/cancel`, json('POST', {}))
export const updateBillingMembership = (payload: { auto_renew: boolean }) =>
  request<BillingMembership>('/billing/membership', json('PATCH', payload))
export const getBillingUsage = (days = 14) => request<BillingUsage>(`/billing/usage?days=${days}`)
export const updateBillingUsage = (payload: { monthly_call_limit: number }) =>
  request<BillingUsage>('/billing/usage', json('PATCH', payload))
export const getBillingRecords = (limit = 100) => request<BillingRecords>(`/billing/records?limit=${limit}`)
export const getBillingSettlements = () => request<BillingSettlement>('/billing/settlements')
export const runBillingSettlement = () =>
  request<{ settlement: BillingSettlementRecord; summary: BillingSettlement }>('/billing/settlements/run', json('POST', {}))
