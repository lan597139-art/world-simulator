import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import {
  AlertCircle,
  ArrowDownToLine,
  Banknote,
  Check,
  CheckCircle2,
  Crown,
  Download,
  Gauge,
  HandCoins,
  Landmark,
  ReceiptText,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Wallet,
  X,
} from 'lucide-react'
import type { AuthUser } from '../api/auth'
import {
  cancelBillingOrder,
  createBillingOrder,
  getBillingOverview,
  getBillingRecords,
  getBillingSettlements,
  getBillingUsage,
  listBillingOrders,
  payBillingOrder,
  runBillingSettlement,
  updateBillingMembership,
  updateBillingUsage,
  type BillingLedgerEntry,
  type BillingOrder,
  type BillingOverview,
  type BillingPlan,
  type BillingRecords,
  type BillingSettlement,
  type BillingUsage,
} from '../api/billing'
import '../styles/billing-center.css'

type Lang = 'zh' | 'en'
type Section = 'membership' | 'balance' | 'usage' | 'orders' | 'settlement' | 'records'
type Cycle = 'monthly' | 'yearly'

const SECTIONS: { key: Section; zh: string; en: string; desc: string; icon: ReactNode }[] = [
  { key: 'membership', zh: '会员中心', en: 'Membership', desc: '等级、权益与续费', icon: <Crown size={17} strokeWidth={1.6} /> },
  { key: 'balance', zh: '充值与账户余额', en: 'Balance & top-up', desc: '余额、充值与流水', icon: <Wallet size={17} strokeWidth={1.6} /> },
  { key: 'usage', zh: 'AI 用量管理', en: 'AI usage', desc: '调用额度与用量提醒', icon: <Gauge size={17} strokeWidth={1.6} /> },
  { key: 'orders', zh: '支付与订单', en: 'Orders & payment', desc: '待支付、已支付与取消', icon: <ReceiptText size={17} strokeWidth={1.6} /> },
  { key: 'settlement', zh: '创作者结算', en: 'Creator settlement', desc: '收入、平台服务费与结算单', icon: <HandCoins size={17} strokeWidth={1.6} /> },
  { key: 'records', zh: '费用与服务记录', en: 'Billing records', desc: '所有消费与服务周期', icon: <ScrollText size={17} strokeWidth={1.6} /> },
]

const card: CSSProperties = {
  border: '1px solid var(--card-border)', borderRadius: 14, background: 'var(--card-bg)',
  boxSizing: 'border-box',
}
const input: CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 8,
  border: '1px solid var(--card-border)', background: 'var(--bg-color)',
  color: 'var(--text-main)', fontSize: 12, lineHeight: 1.6,
}
const primary: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 13px', borderRadius: 8,
  border: '1px solid var(--primary-color)', background: 'var(--primary-color)',
  color: 'var(--primary-text)', fontSize: 11, fontWeight: 650, cursor: 'pointer',
}
const ghost: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 11px', borderRadius: 8,
  border: '1px solid var(--card-border)', background: 'transparent',
  color: 'var(--text-main)', fontSize: 10.5, cursor: 'pointer',
}
const tiny: CSSProperties = { ...ghost, padding: '5px 8px', fontSize: 9.5 }
const danger: CSSProperties = { ...tiny, color: 'var(--danger-color)' }

const ORDER_STATUS: Record<string, string> = {
  pending: '待支付', paid: '已支付', cancelled: '已取消', refunded: '已退款',
}
const PLAN_ORDER = ['free', 'creator', 'pro']

function formatDate(value?: string | null) {
  if (!value) return '—'
  try { return new Date(value).toLocaleString() } catch { return value }
}
function formatDay(value: string) {
  try { return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' }) } catch { return value }
}
function planPrice(plan: BillingPlan, cycle: Cycle) {
  const cents = cycle === 'monthly' ? plan.monthly_cents : plan.yearly_cents
  return cents ? `¥${(cents / 100).toFixed(0)}` : '免费'
}
function planSuffix(cycle: Cycle) {
  return cycle === 'monthly' ? '/ 月' : '/ 年'
}
function membershipStatusLabel(status: string) {
  return status === 'active' ? '生效中' : status === 'expired' ? '已到期' : status === 'cancelled' ? '已取消续费' : status
}
function entryLabel(type: string) {
  const map: Record<string, string> = {
    topup: '账户充值', membership: '会员开通', service: '服务购买', ai_usage: 'AI 用量',
    creator_earning: '创作收入', refund: '退款', adjustment: '余额调整', withdrawal: '结算提现',
  }
  return map[type] || type
}

function SectionHeader({ kicker, title, desc, aside }: { kicker: string; title: string; desc: string; aside?: ReactNode }) {
  return (
    <div className="bc-section-head">
      <div>
        <span className="bc-kicker">{kicker}</span>
        <h2>{title}</h2>
        <p>{desc}</p>
      </div>
      {aside}
    </div>
  )
}

function Empty({ title, hint }: { title: string; hint?: string }) {
  return <div className="bc-empty"><Sparkles size={18} /><strong>{title}</strong>{hint && <span>{hint}</span>}</div>
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`bc-status is-${status}`}>{ORDER_STATUS[status] || status}</span>
}

function CheckoutModal({
  draft,
  overview,
  busy,
  onClose,
  onSubmit,
}: {
  draft: { kind: 'recharge' | 'membership'; sku: string; cycle?: Cycle; title: string; amount_cents: number }
  overview: BillingOverview
  busy: boolean
  onClose: () => void
  onSubmit: (payNow: boolean) => void
}) {
  const isRecharge = draft.kind === 'recharge'
  const balance = overview.account.balance_cents
  const after = isRecharge ? balance + draft.amount_cents : balance - draft.amount_cents
  const insufficient = !isRecharge && balance < draft.amount_cents
  return (
    <div className="bc-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <section className="bc-modal" role="dialog" aria-modal="true" aria-label="确认订单">
        <header>
          <div><h2>{isRecharge ? '确认充值' : '确认开通会员'}</h2><p>{draft.title}</p></div>
          <button type="button" style={ghost} onClick={onClose} aria-label="关闭"><X size={15} /></button>
        </header>
        <div className="bc-modal-body">
          <div className="bc-checkout-amount">
            <span>应付金额</span>
            <strong>¥{(draft.amount_cents / 100).toFixed(2)}</strong>
          </div>
          <div className="bc-checkout-lines">
            <div><span>当前余额</span><strong>¥{(balance / 100).toFixed(2)}</strong></div>
            <div><span>{isRecharge ? '充值后余额' : '支付后余额'}</span><strong style={{ color: insufficient ? 'var(--danger-color)' : undefined }}>¥{(Math.max(after, 0) / 100).toFixed(2)}</strong></div>
            <div><span>支付方式</span><strong>{isRecharge ? '本地沙盒支付' : '账户余额'}</strong></div>
          </div>
          {isRecharge ? (
            <div className="bc-warning">
              <AlertCircle size={14} />
              当前未接入真实支付机构。确认后会以「本地沙盒」方式写入余额与流水，不会产生任何真实扣款。
            </div>
          ) : insufficient ? (
            <div className="bc-warning is-danger">
              <AlertCircle size={14} />
              账户余额不足，还差 ¥{((draft.amount_cents - balance) / 100).toFixed(2)}。可以先创建待支付订单，再到「充值与账户余额」充值后支付。
            </div>
          ) : (
            <div className="bc-inline-note"><ShieldCheck size={14} /> 会员开通会立即从账户余额扣款，并生成不可删除的费用流水。</div>
          )}
          <div className="bc-modal-actions">
            <button type="button" style={ghost} onClick={onClose}>取消</button>
            <button type="button" style={ghost} disabled={busy} onClick={() => onSubmit(false)}>仅创建待支付订单</button>
            <button type="button" style={primary} disabled={busy || insufficient} onClick={() => onSubmit(true)}>
              {busy ? '处理中…' : isRecharge ? '确认本地充值' : '使用余额开通'}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

export default function BillingCenterPage({
  lang,
  user,
  onOpenAi,
}: {
  lang: Lang
  user: AuthUser | null
  onOpenAi: () => void
}) {
  const [section, setSection] = useState<Section>('membership')
  const [overview, setOverview] = useState<BillingOverview | null>(null)
  const [orders, setOrders] = useState<BillingOrder[]>([])
  const [orderFilter, setOrderFilter] = useState('')
  const [usage, setUsage] = useState<BillingUsage | null>(null)
  const [records, setRecords] = useState<BillingRecords | null>(null)
  const [settlement, setSettlement] = useState<BillingSettlement | null>(null)
  const [cycle, setCycle] = useState<Cycle>('monthly')
  const [checkout, setCheckout] = useState<{ kind: 'recharge' | 'membership'; sku: string; cycle?: Cycle; title: string; amount_cents: number } | null>(null)
  const [limitDraft, setLimitDraft] = useState('0')
  const [recordFilter, setRecordFilter] = useState('all')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [flash, setFlash] = useState('')

  const loadOverview = async () => {
    const next = await getBillingOverview()
    setOverview(next)
    setUsage(next.usage)
    setSettlement(next.settlement)
    setLimitDraft(String(next.account.ai_monthly_call_limit || 0))
    return next
  }

  const loadOrders = async (filter = orderFilter) => {
    try { setOrders(await listBillingOrders(filter)) } catch (err: any) { setError(String(err?.message || err)) }
  }
  const loadUsage = async () => {
    try { const next = await getBillingUsage(30); setUsage(next) } catch (err: any) { setError(String(err?.message || err)) }
  }
  const loadRecords = async () => {
    try { setRecords(await getBillingRecords()) } catch (err: any) { setError(String(err?.message || err)) }
  }
  const loadSettlements = async () => {
    try { setSettlement(await getBillingSettlements()) } catch (err: any) { setError(String(err?.message || err)) }
  }

  useEffect(() => {
    setError('')
    void loadOverview().catch((err) => setError(String(err?.message || err)))
  }, [user?.id])
  useEffect(() => {
    if (section === 'orders') void loadOrders()
    else if (section === 'usage') void loadUsage()
    else if (section === 'records') void loadRecords()
    else if (section === 'settlement') void loadSettlements()
  }, [section])
  useEffect(() => {
    if (!flash) return
    const timer = window.setTimeout(() => setFlash(''), 2800)
    return () => window.clearTimeout(timer)
  }, [flash])

  const notify = (message: string) => { setFlash(message); setError('') }
  const fail = (err: unknown) => setError(String((err as any)?.message || err))

  const openPlanCheckout = (plan: BillingPlan) => {
    if (plan.key === 'free') return
    setCheckout({
      kind: 'membership', sku: plan.key, cycle, title: `${plan.label} · ${cycle === 'monthly' ? '月付' : '年付'}`,
      amount_cents: cycle === 'monthly' ? plan.monthly_cents : plan.yearly_cents,
    })
  }
  const openRechargeCheckout = (pkg: BillingOverview['recharge_packages'][number]) => {
    setCheckout({ kind: 'recharge', sku: pkg.key, title: `账户充值 · ${pkg.label}`, amount_cents: pkg.amount_cents })
  }

  const submitCheckout = async (payNow: boolean) => {
    if (!checkout) return
    setBusy('checkout'); setError('')
    try {
      const created = await createBillingOrder({
        kind: checkout.kind, sku: checkout.sku,
        ...(checkout.kind === 'membership' ? { cycle: checkout.cycle || cycle } : {}),
      })
      if (payNow) {
        await payBillingOrder(created.order.id, checkout.kind === 'recharge' ? { confirm_sandbox: true } : {})
      }
      setCheckout(null)
      await loadOverview()
      if (section === 'orders') await loadOrders()
      if (section === 'records') await loadRecords()
      notify(payNow ? (checkout.kind === 'recharge' ? '充值已到账' : '会员已开通') : '订单已创建，可在「支付与订单」中继续支付')
    } catch (err) { fail(err); setCheckout(null) }
    finally { setBusy('') }
  }

  const payPending = async (order: BillingOrder) => {
    if (order.kind === 'recharge' && !overview?.mode.sandbox) {
      setError('支付通道未配置，当前无法完成充值')
      return
    }
    const detail = order.kind === 'recharge'
      ? '当前为本地沙盒充值，会直接写入余额，不会产生真实扣款。继续吗？'
      : `将使用账户余额 ¥${(order.amount_cents / 100).toFixed(2)} 支付该订单，继续吗？`
    if (!window.confirm(detail)) return
    setBusy(`pay:${order.id}`); setError('')
    try {
      await payBillingOrder(order.id, order.kind === 'recharge' ? { confirm_sandbox: true } : {})
      await loadOverview()
      await loadOrders()
      notify(order.kind === 'recharge' ? '充值已到账' : '订单已支付')
    } catch (err) { fail(err) }
    finally { setBusy('') }
  }

  const cancelPending = async (order: BillingOrder) => {
    if (!window.confirm('确定取消这笔待支付订单吗？')) return
    setBusy(`cancel:${order.id}`); setError('')
    try {
      await cancelBillingOrder(order.id)
      await loadOrders()
      notify('订单已取消')
    } catch (err) { fail(err) }
    finally { setBusy('') }
  }

  const toggleAutoRenew = async () => {
    if (!overview) return
    setBusy('auto-renew')
    try {
      const next = await updateBillingMembership({ auto_renew: !overview.membership.auto_renew })
      setOverview((current) => current ? { ...current, membership: next } : current)
      notify(next.auto_renew ? '已开启续费提醒' : '已关闭续费提醒')
    } catch (err) { fail(err) }
    finally { setBusy('') }
  }

  const saveLimit = async () => {
    const value = Number(limitDraft)
    if (!Number.isInteger(value) || value < 0) { setError('请输入 0 或正整数'); return }
    setBusy('limit')
    try {
      const next = await updateBillingUsage({ monthly_call_limit: value })
      setUsage(next)
      setOverview((current) => current ? { ...current, account: { ...current.account, ai_monthly_call_limit: value }, usage: next } : current)
      notify(value ? `用量提醒阈值已设为 ${value} 次/月` : '已关闭用量提醒')
    } catch (err) { fail(err) }
    finally { setBusy('') }
  }

  const runSettlement = async () => {
    if (!window.confirm('将按当前可结算收入生成结算单，平台服务费 10%。提现通道尚未接入，结算单会保持待处理。继续吗？')) return
    setBusy('settlement'); setError('')
    try {
      const result = await runBillingSettlement()
      setSettlement(result.summary)
      await loadOverview()
      notify('结算单已生成，等待打款')
    } catch (err) { fail(err) }
    finally { setBusy('') }
  }

  const exportLedger = () => {
    const rows = records?.ledger || overview?.recent_ledger || []
    const header = '时间,类型,说明,金额,支付后余额\n'
    const lines = rows.map((row) => [
      formatDate(row.created_at), entryLabel(row.entry_type), row.description,
      (row.amount_cents / 100).toFixed(2), (row.balance_after_cents / 100).toFixed(2),
    ].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([`\uFEFF${header}${lines}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `billing-ledger-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  const currentPlanIndex = overview ? PLAN_ORDER.indexOf(overview.membership.plan) : 0
  const filteredLedger = useMemo(() => {
    const rows = records?.ledger || []
    if (recordFilter === 'all') return rows
    return rows.filter((row) => row.entry_type === recordFilter)
  }, [records, recordFilter])
  const maxDaily = useMemo(() => Math.max(1, ...(usage?.daily.map((day) => day.calls) || [0])), [usage])
  const pendingSettlement = settlement?.records.some((row) => row.status === 'pending')

  if (error && !overview) {
    return <div className="bc-page"><div style={{ ...card, padding: 24, borderColor: 'var(--danger-color)' }}><strong>无法读取商业与服务中心</strong><p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{error}</p><button type="button" style={primary} onClick={() => { setError(''); void loadOverview().catch(fail) }}><RefreshCw size={14} /> 重试</button></div></div>
  }
  if (!overview) return <div className="bc-page"><div className="bc-loading">正在读取账户与服务信息…</div></div>

  const isPaidMember = overview.membership.plan !== 'free' && overview.membership.status === 'active'

  return (
    <div className="bc-page">
      <header className="bc-hero">
        <div>
          <span className="bc-kicker">BUSINESS & SERVICES</span>
          <h1>商业与服务中心</h1>
          <p>会员、余额、AI 用量、支付订单、创作者结算与服务记录，统一在这里管理。</p>
          <div className="bc-hero-meta">
            <span className={`bc-mode ${overview.mode.sandbox ? 'is-sandbox' : 'is-disabled'}`}>
              {overview.mode.sandbox ? <ShieldCheck size={12} /> : <AlertCircle size={12} />}
              {overview.mode.provider_label}
            </span>
            <span>{user?.display_name || user?.username || '当前用户'}</span>
            <span>账户 ID · {user?.id || '—'}</span>
          </div>
        </div>
        <div className="bc-hero-cards">
          <div className="bc-hero-card">
            <span>账户余额</span>
            <strong>{overview.account.balance_display}</strong>
            <small>可用于会员与服务消费</small>
          </div>
          <div className="bc-hero-card">
            <span>当前会员</span>
            <strong>{overview.membership.plan_label}</strong>
            <small>{isPaidMember ? `${formatDate(overview.membership.expires_at)} 到期` : overview.membership.status === 'expired' ? '会员已到期' : '基础权益生效中'}</small>
          </div>
        </div>
      </header>

      {error && <div className="bc-message is-error"><AlertCircle size={14} /> {error}<button type="button" style={tiny} onClick={() => setError('')}>关闭</button></div>}
      {flash && <div className="bc-message is-ok"><Check size={14} /> {flash}</div>}

      <div className="bc-layout">
        <nav className="bc-nav" aria-label="商业与服务中心分类">
          {SECTIONS.map((item) => (
            <button key={item.key} type="button" className={`bc-nav-item ${section === item.key ? 'is-active' : ''}`} onClick={() => { setSection(item.key); setError('') }}>
              <span className="bc-nav-icon">{item.icon}</span>
              <span><strong>{lang === 'zh' ? item.zh : item.en}</strong><small>{item.desc}</small></span>
            </button>
          ))}
        </nav>

        <div className="bc-content">
          {section === 'membership' && (
            <>
              <SectionHeader
                kicker="MEMBERSHIP"
                title="会员中心"
                desc="会员按月或按年开通，费用从账户余额扣除；当前支付通道为本地沙盒，不产生真实扣款。"
                aside={<div className="bc-cycle-toggle"><button type="button" style={cycle === 'monthly' ? primary : ghost} onClick={() => setCycle('monthly')}>月付</button><button type="button" style={cycle === 'yearly' ? primary : ghost} onClick={() => setCycle('yearly')}>年付 · 更省</button></div>}
              />

              <section className="bc-current-plan">
                <div className="bc-plan-mark"><Crown size={24} strokeWidth={1.5} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span className="bc-label">当前方案</span>
                  <h3>{overview.membership.plan_label} <span className={`bc-status is-${overview.membership.status}`}>{membershipStatusLabel(overview.membership.status)}</span></h3>
                  <p>{isPaidMember ? `${overview.membership.cycle === 'yearly' ? '年付' : '月付'} · 有效期至 ${formatDate(overview.membership.expires_at)}` : '免费方案包含基础创作能力与每月 20 次平台 AI 调用。'}</p>
                </div>
                {isPaidMember && (
                  <button type="button" style={overview.membership.auto_renew ? primary : ghost} disabled={busy === 'auto-renew'} onClick={() => void toggleAutoRenew()}>
                    {overview.membership.auto_renew ? '续费提醒已开启' : '开启续费提醒'}
                  </button>
                )}
              </section>

              <div className="bc-plan-grid">
                {overview.plans.map((plan) => {
                  const index = PLAN_ORDER.indexOf(plan.key)
                  const isCurrent = overview.membership.plan === plan.key && isPaidMember
                  const disabled = plan.key === 'free' || isCurrent
                  return (
                    <article key={plan.key} className={`bc-plan-card ${plan.key === 'creator' ? 'is-featured' : ''} ${isCurrent ? 'is-current' : ''}`}>
                      {plan.key === 'creator' && <span className="bc-plan-ribbon">推荐</span>}
                      <div className="bc-plan-head">
                        <div><span className="bc-plan-name">{plan.label}</span><p>{plan.tagline}</p></div>
                        {isCurrent ? <CheckCircle2 size={18} /> : index > currentPlanIndex ? <Sparkles size={17} /> : <Crown size={17} />}
                      </div>
                      <div className="bc-plan-price"><strong>{planPrice(plan, cycle)}</strong>{plan.monthly_cents > 0 && <span>{planSuffix(cycle)}</span>}</div>
                      <div className="bc-plan-quota">{plan.included_calls} 次平台 AI 调用 / 月</div>
                      <ul>{plan.features.map((feature) => <li key={feature}><Check size={12} />{feature}</li>)}</ul>
                      <button type="button" style={disabled ? ghost : primary} disabled={disabled} onClick={() => openPlanCheckout(plan)}>
                        {isCurrent ? '当前方案' : plan.key === 'free' ? '基础方案' : index > currentPlanIndex ? `升级到${plan.label}` : `切换到${plan.label}`}
                      </button>
                    </article>
                  )
                })}
              </div>
              <div className="bc-inline-note"><ShieldCheck size={14} /> 会员权益按当前账号生效；到期不会自动扣款，所谓「续费提醒」只记录偏好，后续可由通知系统发送提醒。</div>
            </>
          )}

          {section === 'balance' && (
            <>
              <SectionHeader kicker="BALANCE" title="充值与账户余额" desc="充值写入本地账本，用于会员与服务消费。真实支付接入前，所有充值都明确标注为本地沙盒。" />
              <section className="bc-balance-card">
                <div>
                  <span className="bc-label">可用余额</span>
                  <strong>{overview.account.balance_display}</strong>
                  <p>余额不会过期，可用于会员续费与后续服务购买。</p>
                </div>
                <div className="bc-balance-stats">
                  <div><span>累计消费</span><strong>{overview.summary.paid_total_display}</strong></div>
                  <div><span>待支付订单</span><strong>{overview.summary.pending_orders} 笔</strong></div>
                </div>
              </section>
              <div className="bc-package-grid">
                {overview.recharge_packages.map((pkg) => (
                  <article key={pkg.key} className="bc-package-card">
                    <div><span>{pkg.note}</span><strong>{pkg.label}</strong></div>
                    <button type="button" style={primary} onClick={() => openRechargeCheckout(pkg)}><ArrowDownToLine size={14} /> 充值</button>
                  </article>
                ))}
              </div>
              <section className="bc-panel">
                <SectionHeader kicker="LEDGER" title="最近余额流水" desc="充值、会员扣款与后续服务消费都会写入不可覆盖的账本。" aside={<button type="button" style={ghost} onClick={() => setSection('records')}>查看全部 <ScrollText size={13} /></button>} />
                {overview.recent_ledger.length === 0 ? <Empty title="还没有余额流水" hint="完成第一笔充值或会员开通后会显示在这里。" /> : (
                  <div className="bc-ledger-list">
                    {overview.recent_ledger.map((row) => <LedgerRow key={row.id} row={row} />)}
                  </div>
                )}
              </section>
              <div className="bc-inline-note"><AlertCircle size={14} /> 本地沙盒充值不是真实支付。若需要接入微信、支付宝或 Stripe，需要配置支付机构与服务端回调；当前页面不会引导真实付款。</div>
            </>
          )}

          {section === 'usage' && (
            <>
              <SectionHeader kicker="AI USAGE" title="AI 用量管理" desc="统计本月 AI 调用次数，区分平台 Key 与自带 Key；不记录提示词、响应内容或 Key。" aside={<button type="button" style={ghost} onClick={onOpenAi}>AI 接入设置</button>} />
              <div className="bc-stat-grid">
                <div><span>本月总调用</span><strong>{usage?.total_calls ?? 0}</strong><small>次</small></div>
                <div><span>平台额度调用</span><strong>{usage?.platform_calls ?? 0}</strong><small>次</small></div>
                <div><span>自带 Key 调用</span><strong>{usage?.personal_calls ?? 0}</strong><small>次</small></div>
                <div><span>会员剩余额度</span><strong>{usage?.remaining_calls ?? 0}</strong><small>次</small></div>
              </div>
              <section className="bc-panel">
                <div className="bc-quota-head"><div><span className="bc-label">会员月度额度</span><strong>{usage?.platform_calls ?? 0} / {usage?.included_calls ?? 0} 次</strong></div><span>{usage?.month || ''}</span></div>
                <div className="bc-progress"><span style={{ width: `${Math.min(100, ((usage?.platform_calls || 0) / Math.max(1, usage?.included_calls || 1)) * 100)}%` }} /></div>
                <p className="bc-quota-note">自带 Key 的调用不计入平台额度，也不会产生平台费用。额度为提示性配额，当前版本不对个人 Key 做限流。</p>
                <div className="bc-limit-row">
                  <div><span className="bc-label">月度调用提醒阈值</span><p>达到阈值后提醒，不自动中断；0 表示不提醒。</p></div>
                  <div className="bc-limit-control"><input style={{ ...input, width: 110 }} type="number" min={0} value={limitDraft} onChange={(e) => setLimitDraft(e.target.value)} /><span>次 / 月</span><button type="button" style={primary} disabled={busy === 'limit'} onClick={() => void saveLimit()}>保存</button></div>
                </div>
                {(usage?.monthly_call_limit || 0) > 0 && (
                  <div className="bc-inline-note"><Gauge size={14} /> 当前提醒阈值 {usage?.monthly_call_limit} 次；本月平台调用 {usage?.platform_calls} 次。</div>
                )}
              </section>
              <section className="bc-panel">
                <SectionHeader kicker="DAILY" title="近 30 天调用趋势" desc="以真实请求记录汇总，按天展示平台与自带 Key 调用。" />
                <div className="bc-chart">
                  {(usage?.daily || []).map((day) => (
                    <div className="bc-chart-col" key={day.date} title={`${day.date} · ${day.calls} 次`}>
                      <div className="bc-chart-bar"><span style={{ height: `${Math.max(2, (day.calls / maxDaily) * 100)}%` }} /></div>
                      <small>{formatDay(day.date)}</small>
                    </div>
                  ))}
                </div>
              </section>
              <section className="bc-panel">
                <SectionHeader kicker="RECENT" title="最近调用" desc="失败请求也会记录状态码，便于排查额度与鉴权问题。" />
                {usage?.recent.length === 0 ? <Empty title="还没有 AI 调用记录" hint="开始一次推演、聊天或写作辅助后，这里会出现真实调用。" /> : (
                  <div className="bc-usage-list">
                    {usage?.recent.map((row) => (
                      <div className="bc-usage-row" key={row.id}>
                        <span className={`bc-provider ${row.provider === 'personal' ? 'is-personal' : ''}`}>{row.provider === 'personal' ? '自带 Key' : '平台'}</span>
                        <div><strong>{row.route}</strong><span>{row.model || '默认模型'} · {formatDate(row.created_at)}</span></div>
                        <span className={row.status_code < 400 ? 'bc-ok' : 'bc-bad'}>{row.status_code}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}

          {section === 'orders' && (
            <>
              <SectionHeader kicker="ORDERS" title="支付与订单" desc="所有会员与充值订单。待支付订单可继续支付或取消；已支付订单不能删除。" aside={<button type="button" style={ghost} onClick={() => void loadOrders()}><RefreshCw size={13} /> 刷新</button>} />
              <div className="bc-filter-row">
                {[['', '全部'], ['pending', '待支付'], ['paid', '已支付'], ['cancelled', '已取消']].map(([value, label]) => (
                  <button key={value} type="button" style={orderFilter === value ? primary : ghost} onClick={() => { setOrderFilter(value); void loadOrders(value) }}>{label}</button>
                ))}
              </div>
              {orders.length === 0 ? <Empty title="暂无订单" hint="从会员中心或余额页面发起开通/充值后，订单会显示在这里。" /> : (
                <div className="bc-order-list">
                  {orders.map((order) => (
                    <article className="bc-order-card" key={order.id}>
                      <div className="bc-order-icon">{order.kind === 'recharge' ? <Wallet size={18} /> : <Crown size={18} />}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="bc-order-title"><strong>{order.title}</strong><StatusBadge status={order.status} /></div>
                        <span>订单号 {order.id.slice(0, 12)}… · 创建于 {formatDate(order.created_at)}{order.paid_at ? ` · 支付于 ${formatDate(order.paid_at)}` : ''}</span>
                      </div>
                      <div className="bc-order-amount">{order.amount_display}</div>
                      {order.status === 'pending' && (
                        <div className="bc-order-actions">
                          <button type="button" style={primary} disabled={busy === `pay:${order.id}` || (order.kind === 'recharge' && !overview.mode.sandbox)} title={order.kind === 'recharge' && !overview.mode.sandbox ? '支付通道未配置' : undefined} onClick={() => void payPending(order)}>{busy === `pay:${order.id}` ? '支付中…' : order.kind === 'recharge' ? '完成充值' : '余额支付'}</button>
                          <button type="button" style={danger} disabled={busy === `cancel:${order.id}`} onClick={() => void cancelPending(order)}>取消</button>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
              <div className="bc-inline-note"><ReceiptText size={14} /> 当前订单只记录本地账本。接入真实支付后，应由服务端验签支付回调再变更订单状态，不能信任前端结果。</div>
            </>
          )}

          {section === 'settlement' && (
            <>
              <SectionHeader kicker="CREATOR" title="创作者结算" desc="公开作品或服务产生真实收入后进入可结算余额；平台服务费 10%，单笔最低 ¥100。" aside={<button type="button" style={primary} disabled={busy === 'settlement' || !settlement || settlement.available_cents < settlement.minimum_cents || !!pendingSettlement} onClick={() => void runSettlement()}>{busy === 'settlement' ? '生成中…' : '生成结算单'}</button>} />
              <div className="bc-stat-grid">
                <div><span>累计创作收入</span><strong>¥{((settlement?.total_earned_cents || 0) / 100).toFixed(2)}</strong></div>
                <div><span>可结算余额</span><strong>¥{((settlement?.available_cents || 0) / 100).toFixed(2)}</strong></div>
                <div><span>待打款</span><strong>¥{((settlement?.pending_cents || 0) / 100).toFixed(2)}</strong></div>
                <div><span>已打款</span><strong>¥{((settlement?.paid_cents || 0) / 100).toFixed(2)}</strong></div>
              </div>
              <div className="bc-settlement-grid">
                <section className="bc-panel">
                  <SectionHeader kicker="RULES" title="结算规则" desc="结算单生成后进入待打款；当前未接入提现通道。" />
                  <ul className="bc-rule-list">
                    <li><span>平台服务费</span><strong>{Math.round((settlement?.fee_rate || 0.1) * 100)}%</strong></li>
                    <li><span>最低结算金额</span><strong>¥{((settlement?.minimum_cents || 10000) / 100).toFixed(0)}</strong></li>
                    <li><span>结算周期</span><strong>每月可申请一次</strong></li>
                    <li><span>到账方式</span><strong>提现通道未接入</strong></li>
                  </ul>
                </section>
                <section className="bc-panel">
                  <SectionHeader kicker="PAYOUT" title="收款账户" desc="真实结算前必须绑定并验证收款账户。" />
                  <div className="bc-payout-empty"><Landmark size={24} /><strong>尚未绑定收款账户</strong><span>当前版本不收集银行卡、身份证或第三方支付账户。接入支付机构后，再通过安全的服务端流程完成实名与绑卡。</span><button type="button" style={ghost} disabled>绑定收款账户（待接入）</button></div>
                </section>
              </div>
              <section className="bc-panel">
                <SectionHeader kicker="SETTLEMENTS" title="结算记录" desc="结算单只追加，不覆盖历史记录。" />
                {!settlement || settlement.records.length === 0 ? <Empty title="还没有结算记录" hint="有可结算创作收入后，可生成第一张结算单。" /> : (
                  <div className="bc-settlement-list">
                    {settlement.records.map((row) => (
                      <div className="bc-settlement-row" key={row.id}>
                        <div><strong>{formatDate(row.period_start)} — {formatDate(row.period_end)}</strong><span>收入 ¥{(row.gross_cents / 100).toFixed(2)} · 服务费 ¥{(row.platform_fee_cents / 100).toFixed(2)}</span></div>
                        <strong>{row.net_display}</strong>
                        <span className={`bc-status is-${row.status === 'paid' ? 'paid' : 'pending'}`}>{row.status === 'paid' ? '已打款' : '待打款'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
              <div className="bc-inline-note"><HandCoins size={14} /> 当前没有公开作品销售或服务分销收入来源，因此默认无可结算金额。本页先把规则、账本与结算单结构落地，不伪造收入。</div>
            </>
          )}

          {section === 'records' && (
            <>
              <SectionHeader kicker="RECORDS" title="费用与服务记录" desc="余额流水与会员服务周期统一归档，支持导出当前账号的账单 CSV。" aside={<div style={{ display: 'flex', gap: 7 }}><button type="button" style={ghost} onClick={() => void loadRecords()}><RefreshCw size={13} /> 刷新</button><button type="button" style={ghost} onClick={exportLedger}><Download size={13} /> 导出流水</button></div>} />
              <div className="bc-filter-row">
                {[['all', '全部'], ['topup', '充值'], ['membership', '会员'], ['creator_earning', '创作收入'], ['ai_usage', 'AI 用量']].map(([value, label]) => (
                  <button key={value} type="button" style={recordFilter === value ? primary : ghost} onClick={() => setRecordFilter(value)}>{label}</button>
                ))}
              </div>
              <section className="bc-panel">
                <SectionHeader kicker="LEDGER" title="账户流水" desc={`${filteredLedger.length} 条记录`} />
                {filteredLedger.length === 0 ? <Empty title="没有符合条件的流水" hint="完成充值、开通会员或产生创作收入后会写入。" /> : (
                  <div className="bc-ledger-list">{filteredLedger.map((row) => <LedgerRow key={row.id} row={row} />)}</div>
                )}
              </section>
              <section className="bc-panel">
                <SectionHeader kicker="SERVICES" title="服务周期" desc="当前账号已购买的会员服务及有效期。" />
                {!records || records.services.length === 0 ? <Empty title="还没有服务周期" hint="开通会员后会记录服务开始与到期时间。" /> : (
                  <div className="bc-service-list">
                    {records.services.map((row) => (
                      <div className="bc-service-row" key={row.id}>
                        <div className="bc-service-icon"><Crown size={17} /></div>
                        <div style={{ flex: 1 }}><strong>{row.title}</strong><span>{formatDate(row.started_at)} — {formatDate(row.expires_at)}</span></div>
                        <strong>{row.amount_display}</strong>
                        <span className={`bc-status is-${row.status}`}>{row.status === 'active' ? '生效中' : '已到期'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
              <div className="bc-inline-note"><ScrollText size={14} /> 账单导出只包含当前账号的余额流水，不包含密码、AI Key、聊天正文或私人世界数据。</div>
            </>
          )}
        </div>
      </div>

      {checkout && (
        <CheckoutModal
          draft={checkout}
          overview={overview}
          busy={busy === 'checkout'}
          onClose={() => setCheckout(null)}
          onSubmit={(payNow) => void submitCheckout(payNow)}
        />
      )}
    </div>
  )
}

function LedgerRow({ row }: { row: BillingLedgerEntry }) {
  const positive = row.amount_cents >= 0
  return (
    <div className="bc-ledger-row">
      <div className={`bc-ledger-icon ${positive ? 'is-positive' : ''}`}>{positive ? <ArrowDownToLine size={15} /> : <Banknote size={15} />}</div>
      <div style={{ flex: 1, minWidth: 0 }}><strong>{row.description || entryLabel(row.entry_type)}</strong><span>{entryLabel(row.entry_type)} · {formatDate(row.created_at)}</span></div>
      <div className={`bc-ledger-amount ${positive ? 'is-positive' : ''}`}>{row.amount_display}</div>
      <span className="bc-ledger-balance">余额 ¥{(row.balance_after_cents / 100).toFixed(2)}</span>
    </div>
  )
}
