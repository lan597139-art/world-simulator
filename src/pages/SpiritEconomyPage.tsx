import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertCircle,
  Award,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CheckCircle2,
  Gift,
  History,
  Leaf,
  RefreshCw,
  Send,
  ShieldCheck,
  Sprout,
  Wallet,
} from 'lucide-react'
import {
  adjustSpiritFruit,
  exchangeSpiritPlant,
  claimSpiritReward,
  getSpiritAdminOverview,
  getSpiritRewards,
  getSpiritSummary,
  giftSpiritFruit,
  getUserActivityOverview,
  updateSpiritPlant,
  updateSpiritRewardRule,
  type SpiritAdminOverview,
  type UserActivityRow,
  type SpiritInventoryItem,
  type SpiritRewardRule,
  type SpiritSummary,
  type SpiritTransaction,
} from '../api/spiritEconomy'
import '../styles/spirit-economy.css'

type Lang = 'zh' | 'en'
type Tab = 'shop' | 'transfer' | 'ledger' | 'rewards' | 'admin' | 'activity'

type User = { id: string; username?: string; display_name?: string; is_owner?: boolean } | null

const kindLabels: Record<string, { zh: string; en: string }> = {
  reward: { zh: '奖励', en: 'Reward' },
  exchange: { zh: '兑换', en: 'Exchange' },
  gift: { zh: '赠送', en: 'Gift' },
  tip: { zh: '打赏', en: 'Tip' },
  consume: { zh: '消耗', en: 'Spend' },
  admin: { zh: '后台调整', en: 'Admin' },
}

const categoryLabels: Record<string, { zh: string; en: string }> = {
  world: { zh: '世界灵植', en: 'World plant' },
  oc: { zh: 'OC 灵植', en: 'OC plant' },
}

const plantEnglish: Record<string, { name: string; description: string; unit: string }> = {
  world_seed: { name: 'World Seed', description: 'Base plant used to create and expand worlds.', unit: 'plants' },
  oc_seed: { name: 'Persona Seed', description: 'Base plant used to create OCs and character identities.', unit: 'plants' },
}

function plantText(plant: { key: string; name: string; unit: string; description?: string }, lang: Lang) {
  const english = lang === 'en' ? plantEnglish[plant.key] : null
  return {
    name: english?.name || plant.name,
    description: english?.description || plant.description || '',
    unit: english?.unit || plant.unit,
  }
}

function formatDate(value: string, lang: Lang) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date)
}

export default function SpiritEconomyPage({
  lang,
  user,
}: {
  lang: Lang
  user?: User
}) {
  const [summary, setSummary] = useState<SpiritSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [flash, setFlash] = useState('')
  const [tab, setTab] = useState<Tab>('shop')
  const [quantity, setQuantity] = useState<Record<string, number>>({})
  const [gift, setGift] = useState({ to_user_id: '', amount: '60', note: '', kind: 'gift' as 'gift' | 'tip', ref_type: '', ref_id: '' })
  const [adjust, setAdjust] = useState({ user_id: '', amount: '100', note: '' })
  const [rewards, setRewards] = useState<SpiritRewardRule[]>([])
  const [admin, setAdmin] = useState<SpiritAdminOverview | null>(null)
  const [activity, setActivity] = useState<UserActivityRow[]>([])
  const [activityQuery, setActivityQuery] = useState('')
  const [activityLoading, setActivityLoading] = useState(false)
  const [claiming, setClaiming] = useState('')
  const zh = lang === 'zh'

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [nextSummary, nextRewards] = await Promise.all([getSpiritSummary(), getSpiritRewards()])
      setSummary(nextSummary)
      setRewards(nextRewards.items)
      setAdmin(user?.is_owner ? await getSpiritAdminOverview() : null)
      if (user?.is_owner) {
        try {
          const rows = await getUserActivityOverview()
          setActivity(rows.items)
        } catch {
          /* 活跃概览为辅助能力，失败不影响经济后台主流程 */
        }
      }
    } catch (err) {
      setError(String((err as Error)?.message || err))
    } finally {
      setLoading(false)
    }
  }

  const loadActivity = async () => {
    setTab('activity')
    if (!user?.is_owner) return
    setActivityLoading(true)
    try {
      const rows = await getUserActivityOverview(activityQuery)
      setActivity(rows.items)
    } catch (err) {
      setError(String((err as Error)?.message || err))
    } finally {
      setActivityLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const inventoryByPlant = useMemo(() => {
    const map: Record<string, SpiritInventoryItem> = {}
    for (const row of summary?.inventory || []) map[row.plant_type_id] = row
    return map
  }, [summary])

  const exchange = async (plantId: string, name: string) => {
    const count = Math.max(1, Math.min(99, Number(quantity[plantId] || 1)))
    setBusy(`exchange:${plantId}`)
    setError('')
    try {
      const result = await exchangeSpiritPlant(plantId, count)
      setSummary((prev) => prev ? { ...prev, account: result.account, inventory: result.inventory } : prev)
      setFlash(zh ? `已兑换 ${name} × ${count}` : `Exchanged ${name} × ${count}`)
      setQuantity((prev) => ({ ...prev, [plantId]: 1 }))
      void load()
    } catch (err) {
      setError(String((err as Error)?.message || err))
    } finally {
      setBusy('')
    }
  }

  const transfer = async () => {
    if (!gift.to_user_id.trim()) { setError(zh ? '请填写接收用户 ID' : 'Recipient user ID is required'); return }
    const amount = Number(gift.amount)
    if (!Number.isFinite(amount) || amount <= 0) { setError(zh ? '请输入有效的灵果数量' : 'Enter a valid fruit amount'); return }
    setBusy('transfer')
    setError('')
    try {
      await giftSpiritFruit({
        to_user_id: gift.to_user_id.trim(),
        amount: Math.floor(amount),
        note: gift.note.trim(),
        kind: gift.kind,
        ref_type: gift.ref_type,
        ref_id: gift.ref_id.trim(),
      })
      setFlash(gift.kind === 'tip' ? (zh ? '打赏成功' : 'Tip sent') : (zh ? '赠送成功' : 'Gift sent'))
      setGift((prev) => ({ ...prev, to_user_id: '', note: '', ref_id: '' }))
      setTab('ledger')
      void load()
    } catch (err) {
      setError(String((err as Error)?.message || err))
    } finally {
      setBusy('')
    }
  }

  const claimReward = async (rule: SpiritRewardRule) => {
    let claimKey = ''
    if (rule.claim_mode === 'event') {
      const entered = window.prompt(zh ? '请输入本次活动凭证' : 'Enter this event claim key')
      if (!entered?.trim()) return
      claimKey = entered.trim()
    }
    setClaiming(rule.key)
    setError('')
    try {
      const result = await claimSpiritReward(rule.key, claimKey || undefined)
      setFlash(zh
        ? `已领取 ${rule.name}${result.claim.fruit_amount ? ` · +${result.claim.fruit_amount} 灵果` : ''}`
        : `Claimed ${rule.name}${result.claim.fruit_amount ? ` · +${result.claim.fruit_amount} fruit` : ''}`)
      await load()
    } catch (err) {
      setError(String((err as Error)?.message || err))
    } finally {
      setClaiming('')
    }
  }

  const toggleRule = async (rule: SpiritRewardRule) => {
    setBusy(`rule:${rule.id}`)
    setError('')
    try {
      const updated = await updateSpiritRewardRule(rule.id, { enabled: !rule.enabled })
      setAdmin((prev) => prev ? { ...prev, rules: prev.rules.map((row) => row.id === updated.id ? updated : row) } : prev)
      setRewards((prev) => prev.map((row) => row.id === updated.id ? { ...row, enabled: updated.enabled } : row))
    } catch (err) {
      setError(String((err as Error)?.message || err))
    } finally {
      setBusy('')
    }
  }

  const saveRuleFruit = async (ruleId: string, value: string) => {
    const amount = Number(value)
    if (!Number.isFinite(amount) || amount < 0) return
    setBusy(`rule-amount:${ruleId}`)
    setError('')
    try {
      const updated = await updateSpiritRewardRule(ruleId, { fruit_amount: Math.trunc(amount) })
      setAdmin((prev) => prev ? { ...prev, rules: prev.rules.map((row) => row.id === updated.id ? updated : row) } : prev)
      setFlash(zh ? `${updated.name} 奖励已更新` : `${updated.name} reward updated`)
    } catch (err) {
      setError(String((err as Error)?.message || err))
    } finally {
      setBusy('')
    }
  }

  const savePlantPrice = async (plantId: string, value: string) => {
    const price = Number(value)
    if (!Number.isFinite(price) || price < 1) return
    setBusy(`plant:${plantId}`)
    setError('')
    try {
      const updated = await updateSpiritPlant(plantId, { price_fruit: Math.trunc(price) })
      setAdmin((prev) => prev ? { ...prev, plants: prev.plants.map((row) => row.id === updated.id ? updated : row) } : prev)
      setSummary((prev) => prev ? { ...prev, plants: prev.plants.map((row) => row.id === updated.id ? updated : row) } : prev)
      setFlash(zh ? `${updated.name} 兑换价已更新` : `${updated.name} price updated`)
    } catch (err) {
      setError(String((err as Error)?.message || err))
    } finally {
      setBusy('')
    }
  }

  const savePlantExpiry = async (plantId: string, value: string | null) => {
    setBusy(`plant:${plantId}`)
    setError('')
    try {
      const updated = await updateSpiritPlant(plantId, { expires_at: value })
      setAdmin((prev) => prev ? { ...prev, plants: prev.plants.map((row) => row.id === updated.id ? updated : row) } : prev)
      setSummary((prev) => prev ? { ...prev, plants: prev.plants.map((row) => row.id === updated.id ? updated : row) } : prev)
      setFlash(zh ? `${updated.name} 截止时间已更新` : `${updated.name} deadline updated`)
    } catch (err) {
      setError(String((err as Error)?.message || err))
    } finally {
      setBusy('')
    }
  }

  const submitAdjust = async () => {
    const amount = Number(adjust.amount)
    if (!adjust.user_id.trim() || !Number.isFinite(amount) || amount === 0) {
      setError(zh ? '请填写用户 ID 与非零整数' : 'User ID and a non-zero integer are required')
      return
    }
    setBusy('adjust')
    setError('')
    try {
      await adjustSpiritFruit({ user_id: adjust.user_id.trim(), amount: Math.trunc(amount), note: adjust.note.trim() })
      setFlash(zh ? '灵果余额已调整' : 'Fruit balance adjusted')
      setAdjust((prev) => ({ ...prev, user_id: '', note: '' }))
      void load()
    } catch (err) {
      setError(String((err as Error)?.message || err))
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="spirit-page cc-page-scroll">
      <header className="spirit-head">
        <div className="spirit-head-main">
          <div>
            <span className="spirit-eyebrow"><Sprout size={14} /> {zh ? '资源与交易' : 'Resources & Exchange'}</span>
            <h1>{zh ? '灵果资源中心' : 'Spirit Fruit Center'}</h1>
            <p>{zh ? '灵果与灵植只通过服务端交易变更；每一次兑换、赠送和调整都会留下流水。' : 'Fruit and plants change only through server-side transactions; every exchange, gift, and adjustment is recorded.'}</p>
          </div>
        </div>
        <button type="button" className="spirit-refresh" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'is-spinning' : ''} /> {zh ? '刷新' : 'Refresh'}
        </button>
      </header>

      {error && <div className="spirit-alert is-error"><AlertCircle size={15} /> {error}<button type="button" onClick={() => setError('')}>{zh ? '关闭' : 'Close'}</button></div>}
      {flash && <div className="spirit-alert is-ok"><CheckCircle2 size={15} /> {flash}<button type="button" onClick={() => setFlash('')}>{zh ? '关闭' : 'Close'}</button></div>}

      <section className="spirit-stats">
        <article className="spirit-stat is-primary">
          <span><Wallet size={16} /> {zh ? '灵果余额' : 'Fruit balance'}</span>
          <strong>{summary?.account.fruit_balance ?? '—'}</strong>
          <small>{zh ? '不可由前端直接修改' : 'Read-only client balance'}</small>
        </article>
        <article className="spirit-stat">
          <span><Leaf size={16} /> {zh ? '灵植种类' : 'Plant kinds'}</span>
          <strong>{summary?.inventory.length ?? '—'}</strong>
          <small>{zh ? '当前持有的灵植库存' : 'Plants currently held'}</small>
        </article>
        <article className="spirit-stat">
          <span><History size={16} /> {zh ? '最近流水' : 'Recent ledger'}</span>
          <strong>{summary?.transactions.length ?? '—'}</strong>
          <small>{zh ? '最近 20 条资源变化' : 'Last 20 resource changes'}</small>
        </article>
        <article className="spirit-stat">
          <span><ShieldCheck size={16} /> {zh ? '资源身份' : 'Resource profile'}</span>
          <strong className="is-text">{summary?.account.developer_exempt ? (zh ? '开发者豁免' : 'Developer exempt') : (zh ? '普通账户' : 'Standard')}</strong>
          <small>{zh ? '创建消耗规则由服务端校验' : 'Spend rules enforced server-side'}</small>
        </article>
      </section>

      <section className="spirit-inventory">
        <div className="spirit-section-title">
          <div><h2>{zh ? '我的灵植' : 'My plants'}</h2><p>{zh ? '建界灵植用于世界，塑人灵植用于 OC。' : 'World plants for worlds, OC plants for characters.'}</p></div>
        </div>
        {!summary?.inventory.length ? (
          <div className="spirit-empty"><Leaf size={22} /><strong>{zh ? '库存还是空的' : 'No plants yet'}</strong><span>{zh ? '在下方兑换第一株灵植。' : 'Exchange your first plant below.'}</span></div>
        ) : (
          <div className="spirit-inventory-grid">
            {summary.inventory.map((item) => (
              <article key={item.plant_type_id} className={`spirit-plant-card is-${item.category}`}>
                <div className="spirit-plant-icon">{item.category === 'world' ? <Sprout size={20} /> : <Leaf size={20} />}</div>
                <div><span>{categoryLabels[item.category]?.[lang] || item.category}</span><strong>{plantText(item, lang).name}</strong></div>
                <b>{item.quantity}{lang === 'zh' ? '' : ' '}<small>{plantText(item, lang).unit}</small></b>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="spirit-tabs" role="tablist">
        <button type="button" className={tab === 'shop' ? 'active' : ''} onClick={() => setTab('shop')}><ArrowLeftRight size={14} /> {zh ? '兑换灵植' : 'Exchange'}</button>
        <button type="button" className={tab === 'transfer' ? 'active' : ''} onClick={() => setTab('transfer')}><Gift size={14} /> {zh ? '赠送与打赏' : 'Gift & Tip'}</button>
        <button type="button" className={tab === 'ledger' ? 'active' : ''} onClick={() => setTab('ledger')}><History size={14} /> {zh ? '灵果流水' : 'Ledger'}</button>
        <button type="button" className={tab === 'rewards' ? 'active' : ''} onClick={() => setTab('rewards')}><Award size={14} /> {zh ? '奖励领取' : 'Rewards'}</button>
        {user?.is_owner && <button type="button" className={tab === 'admin' ? 'active' : ''} onClick={() => setTab('admin')}><ShieldCheck size={14} /> {zh ? '经济后台' : 'Economy admin'}</button>}
        {user?.is_owner && <button type="button" className={tab === 'activity' ? 'active' : ''} onClick={() => void loadActivity()}><Activity size={14} /> {zh ? '用户活跃' : 'User activity'}</button>}
      </div>

      {tab === 'shop' && (
        <section className="spirit-panel">
          <div className="spirit-section-title">
            <div><h2>{zh ? '灵植兑换' : 'Plant exchange'}</h2><p>{zh ? '兑换时锁定当时单价，历史价格会写入流水。' : 'The current unit price is locked into the transaction record.'}</p></div>
            <span className="spirit-balance"><Wallet size={13} /> {summary?.account.fruit_balance ?? 0}</span>
          </div>
          <div className="spirit-shop-grid">
            {summary?.plants.map((plant) => {
              const count = Math.max(1, Math.min(99, Number(quantity[plant.id] || 1)))
              const owned = inventoryByPlant[plant.id]?.quantity || 0
              const affordable = (summary?.account.fruit_balance || 0) >= plant.price_fruit * count
              const deadline = plant.expires_at && new Date(plant.expires_at).getTime() > Date.now()
                ? new Date(plant.expires_at)
                : null
              const expired = Boolean(plant.is_expired) || (Boolean(plant.expires_at) && !deadline)
              return (
                <article key={plant.id} className={`spirit-shop-card${expired ? ' is-expired' : ''}`}>
                  <div className="spirit-shop-top">
                    <span className={`spirit-category is-${plant.category}`}>{categoryLabels[plant.category]?.[lang] || plant.category}</span>
                    <span className="spirit-owned">{zh ? '持有' : 'Held'} {owned}</span>
                  </div>
                  <h3>{plantText(plant, lang).name}</h3>
                  <p>{plantText(plant, lang).description}</p>
                  {deadline && (
                    <p className="spirit-deadline">
                      {zh ? '活动截止' : 'Ends'}：{deadline.toLocaleDateString(zh ? 'zh-CN' : 'en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                    </p>
                  )}
                  {expired && <p className="spirit-expired-flag">{zh ? '活动已截止' : 'Event ended'}</p>}
                  <div className="spirit-price"><strong>{plant.price_fruit}</strong><span>{zh ? '灵果 / 株' : 'fruit / plant'}</span></div>
                  <div className="spirit-buy">
                    <div className="spirit-qty">
                      <button type="button" onClick={() => setQuantity((prev) => ({ ...prev, [plant.id]: Math.max(1, count - 1) }))}>−</button>
                      <input aria-label={zh ? '兑换数量' : 'Quantity'} type="number" min={1} max={99} value={count} onChange={(event) => setQuantity((prev) => ({ ...prev, [plant.id]: Math.max(1, Math.min(99, Number(event.target.value) || 1)) }))} />
                      <button type="button" onClick={() => setQuantity((prev) => ({ ...prev, [plant.id]: Math.min(99, count + 1) }))}>+</button>
                    </div>
                    <button type="button" className="spirit-primary" disabled={!affordable || expired || busy === `exchange:${plant.id}`} onClick={() => void exchange(plant.id, plantText(plant, lang).name)}>
                      {busy === `exchange:${plant.id}` ? (zh ? '兑换中…' : 'Exchanging…') : `${zh ? '兑换' : 'Exchange'} · ${plant.price_fruit * count}`}
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      )}

      {tab === 'transfer' && (
        <section className="spirit-panel spirit-transfer-layout">
          <div>
            <div className="spirit-section-title"><div><h2>{zh ? '送给创作者' : 'Support a creator'}</h2><p>{zh ? '普通赠送与作品打赏分开记录，可附留言和关联对象。' : 'Gifts and tips are recorded separately with notes and references.'}</p></div></div>
            <div className="spirit-kind-switch">
              <button type="button" className={gift.kind === 'gift' ? 'active' : ''} onClick={() => setGift((prev) => ({ ...prev, kind: 'gift' }))}><Gift size={14} /> {zh ? '普通赠送' : 'Gift'}</button>
              <button type="button" className={gift.kind === 'tip' ? 'active' : ''} onClick={() => setGift((prev) => ({ ...prev, kind: 'tip' }))}><Send size={14} /> {zh ? '作品打赏' : 'Tip'}</button>
            </div>
            <label className="spirit-field"><span>{zh ? '接收用户 ID' : 'Recipient user ID'}</span><input value={gift.to_user_id} onChange={(event) => setGift((prev) => ({ ...prev, to_user_id: event.target.value }))} placeholder={zh ? '例如 user_xxx' : 'e.g. user_xxx'} /></label>
            <div className="spirit-row">
              <label className="spirit-field"><span>{zh ? '灵果数量' : 'Fruit amount'}</span><input type="number" min={1} value={gift.amount} onChange={(event) => setGift((prev) => ({ ...prev, amount: event.target.value }))} /></label>
              <label className="spirit-field"><span>{zh ? '关联类型（可选）' : 'Reference (optional)'}</span><select value={gift.ref_type} onChange={(event) => setGift((prev) => ({ ...prev, ref_type: event.target.value }))}><option value="">{zh ? '不关联' : 'None'}</option><option value="work">{zh ? '作品' : 'Work'}</option><option value="world">{zh ? '世界' : 'World'}</option><option value="character">{zh ? 'OC' : 'OC'}</option><option value="story">{zh ? '故事' : 'Story'}</option></select></label>
            </div>
            {gift.ref_type && <label className="spirit-field"><span>{zh ? '关联对象 ID' : 'Reference ID'}</span><input value={gift.ref_id} onChange={(event) => setGift((prev) => ({ ...prev, ref_id: event.target.value }))} /></label>}
            <label className="spirit-field"><span>{zh ? '留言（可选）' : 'Message (optional)'}</span><textarea rows={3} maxLength={240} value={gift.note} onChange={(event) => setGift((prev) => ({ ...prev, note: event.target.value }))} /></label>
            <button type="button" className="spirit-primary is-wide" disabled={busy === 'transfer'} onClick={() => void transfer()}><Send size={15} /> {busy === 'transfer' ? (zh ? '发送中…' : 'Sending…') : (gift.kind === 'tip' ? (zh ? '发送打赏' : 'Send tip') : (zh ? '赠送灵果' : 'Send gift'))}</button>
          </div>
          <aside className="spirit-note-card">
            <ShieldCheck size={20} />
            <h3>{zh ? '交易保护' : 'Transaction safety'}</h3>
            <p>{zh ? '余额校验、不能给自己赠送、接收用户必须存在；赠送双方都会生成独立流水。' : 'Balance checks, no self-gifting, and recipient validation; both sides get independent ledger entries.'}</p>
            <p>{zh ? '打赏可关联作品、世界、OC 或故事，关联对象保存在流水里。' : 'Tips can reference a work, world, OC, or story and keep that reference in the ledger.'}</p>
          </aside>
        </section>
      )}

      {tab === 'rewards' && (
        <section className="spirit-panel">
          <div className="spirit-section-title">
            <div><h2>{zh ? '可领取奖励' : 'Claimable rewards'}</h2><p>{zh ? '奖励条件、次数和冷却由服务端校验；重复领取会被拒绝。' : 'Conditions, limits and cooldowns are enforced server-side.'}</p></div>
            <span className="spirit-balance"><Award size={13} /> {rewards.filter((row) => row.can_claim).length}</span>
          </div>
          {!rewards.length ? <div className="spirit-empty"><Award size={22} /><strong>{zh ? '暂无可领取奖励' : 'No rewards available'}</strong></div> : (
            <div className="spirit-reward-grid">
              {rewards.map((rule) => (
                <article key={rule.id} className={`spirit-reward-card ${rule.can_claim ? 'is-ready' : ''}`}>
                  <div className="spirit-reward-top">
                    <span className="spirit-category">{rule.category}</span>
                    <span className={`spirit-reward-state ${rule.can_claim ? 'is-ready' : ''}`}>
                      {!rule.enabled ? (zh ? '未启用' : 'Disabled') : rule.claim_status?.claimed ? (zh ? '已领取' : 'Claimed') : rule.can_claim ? (zh ? '可领取' : 'Ready') : (zh ? '未满足' : 'Locked')}
                    </span>
                  </div>
                  <h3>{rule.name}</h3>
                  <p>{rule.description}</p>
                  <div className="spirit-reward-value">
                    {rule.fruit_amount > 0 && <strong>+{rule.fruit_amount} <small>{zh ? '灵果' : 'fruit'}</small></strong>}
                    {rule.plant_quantity > 0 && <strong>+{rule.plant_quantity} <small>{rule.plant_name || (zh ? '灵植' : 'plant')}</small></strong>}
                  </div>
                  <div className="spirit-reward-meta">
                    <span>{rule.claim_mode === 'daily' ? (zh ? '每日一次' : 'Daily') : rule.claim_mode === 'event' ? (zh ? '活动凭证' : 'Event key') : (zh ? '仅一次' : 'One time')}</span>
                    {rule.claim_status?.last_claimed_at && <span>{zh ? '上次' : 'Last'} {formatDate(rule.claim_status.last_claimed_at, lang)}</span>}
                  </div>
                  <button type="button" className="spirit-primary is-wide" disabled={!rule.can_claim || claiming === rule.key} onClick={() => void claimReward(rule)}>
                    {claiming === rule.key ? (zh ? '领取中…' : 'Claiming…') : rule.can_claim ? (zh ? '领取奖励' : 'Claim reward') : rule.claim_status?.claimed ? (zh ? '已领取' : 'Claimed') : !rule.enabled ? (zh ? '未启用' : 'Disabled') : (zh ? '未满足条件' : 'Not available')}
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'ledger' && (
        <section className="spirit-panel">
          <div className="spirit-section-title"><div><h2>{zh ? '灵果流水' : 'Fruit ledger'}</h2><p>{zh ? '每一笔余额变化都可追溯；兑换会保留历史单价。' : 'Every balance change is traceable; exchanges preserve the historic unit price.'}</p></div></div>
          {!summary?.transactions.length ? <div className="spirit-empty"><History size={22} /><strong>{zh ? '还没有流水' : 'No ledger entries yet'}</strong></div> : (
            <div className="spirit-ledger">
              {summary.transactions.map((item: SpiritTransaction) => (
                <article key={item.id} className="spirit-ledger-row">
                  <span className={`spirit-ledger-icon is-${item.fruit_amount >= 0 ? 'in' : 'out'}`}>{item.fruit_amount >= 0 ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}</span>
                  <div className="spirit-ledger-main">
                    <strong>{item.note || kindLabels[item.kind]?.[lang] || item.kind}</strong>
                    <span>{kindLabels[item.kind]?.[lang] || item.kind}{item.plant_quantity ? ` · ${item.plant_quantity} ${zh ? '株' : 'plants'}` : ''}{item.unit_price ? ` · ${zh ? '单价' : 'unit'} ${item.unit_price}` : ''} · {formatDate(item.created_at, lang)}</span>
                  </div>
                  <div className={`spirit-ledger-amount ${item.fruit_amount >= 0 ? 'is-in' : 'is-out'}`}>
                    <strong>{item.fruit_amount >= 0 ? '+' : ''}{item.fruit_amount}</strong>
                    <span>{zh ? '余额' : 'balance'} {item.balance_after}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'admin' && user?.is_owner && (
        <section className="spirit-panel spirit-admin">
          <div className="spirit-section-title"><div><h2>{zh ? '经济后台' : 'Economy admin'}</h2><p>{zh ? '奖励规则、灵植价格、账户余额与异常流水集中管理。' : 'Manage reward rules, plant prices, balances and ledger review.'}</p></div><ShieldCheck size={18} /></div>
          <div className="spirit-admin-grid">
            <div>
              <h3 className="spirit-admin-title">{zh ? '奖励规则' : 'Reward rules'}</h3>
              <div className="spirit-admin-list">
                {(admin?.rules || []).map((rule) => (
                  <div key={rule.id} className="spirit-admin-row">
                    <div><strong>{rule.name}</strong><span>{rule.key} · {rule.claim_mode}</span></div>
                    <label className="spirit-admin-price"><input type="number" min={0} defaultValue={rule.fruit_amount} disabled={busy === `rule-amount:${rule.id}`} onBlur={(event) => { if (Number(event.target.value) !== rule.fruit_amount) void saveRuleFruit(rule.id, event.target.value) }} /><span>{zh ? '灵果' : 'fruit'}</span></label>
                    <button type="button" className={`spirit-admin-toggle ${rule.enabled ? 'is-on' : ''}`} disabled={busy === `rule:${rule.id}`} onClick={() => void toggleRule(rule)}>
                      {rule.enabled ? (zh ? '已启用' : 'Enabled') : (zh ? '已停用' : 'Disabled')}
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="spirit-admin-title">{zh ? '灵植价格' : 'Plant prices'}</h3>
              <div className="spirit-admin-list">
                {(admin?.plants || []).map((plant) => (
                  <div key={plant.id} className="spirit-admin-row">
                    <div><strong>{plantText(plant, lang).name}</strong><span>{plant.key} · {plant.category}{plant.expires_at ? ` · ${zh ? '截止' : 'ends'} ${new Date(plant.expires_at).toLocaleDateString(zh ? 'zh-CN' : 'en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })}` : ''}</span></div>
                    <label className="spirit-admin-price"><input type="number" min={1} defaultValue={plant.price_fruit} onBlur={(event) => { if (Number(event.target.value) !== plant.price_fruit) void savePlantPrice(plant.id, event.target.value) }} /><span>{zh ? '灵果' : 'fruit'}</span></label>
                    <label className="spirit-admin-expiry"><input type="datetime-local" defaultValue={plant.expires_at ? new Date(plant.expires_at).toISOString().slice(0, 16) : ''} onChange={(event) => {
                      const value = event.target.value
                      if (value) void savePlantExpiry(plant.id, new Date(value).toISOString())
                      else void savePlantExpiry(plant.id, null)
                    }} /><span>{zh ? '截止' : 'Ends'}</span></label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="spirit-section-title spirit-admin-sub"><div><h3>{zh ? '账户余额' : 'Account balances'}</h3><p>{zh ? '点击账户可带入下方调整表单。' : 'Select an account to fill the adjustment form.'}</p></div></div>
          <div className="spirit-admin-list spirit-admin-accounts">
            {(admin?.accounts || []).slice(0, 12).map((account) => (
              <button key={account.user_id} type="button" className="spirit-admin-row is-clickable" onClick={() => setAdjust((prev) => ({ ...prev, user_id: account.user_id }))}>
                <div><strong>{account.display_name} <small>@{account.username}</small></strong><span>{account.user_id} · {account.developer_exempt ? (zh ? '开发者豁免' : 'Developer exempt') : (zh ? '普通账户' : 'Standard')}</span></div>
                <b>{account.fruit_balance} <small>{zh ? '灵果' : 'fruit'}</small></b>
              </button>
            ))}
          </div>
          <div className="spirit-section-title spirit-admin-sub"><div><h3>{zh ? '最近资源流水' : 'Recent resource ledger'}</h3><p>{zh ? '包含奖励、兑换、赠送、消耗与站长调整。' : 'Rewards, exchanges, gifts, spending and owner adjustments.'}</p></div></div>
          <div className="spirit-admin-ledger">
            {(admin?.transactions || []).slice(0, 12).map((item) => (
              <div key={item.id} className="spirit-admin-ledger-row">
                <span className={`spirit-category ${item.fruit_amount < 0 ? 'is-oc' : ''}`}>{kindLabels[item.kind]?.[lang] || item.kind}</span>
                <code>{item.user_id.slice(0, 12)}</code>
                <strong>{item.fruit_amount !== 0 ? `${item.fruit_amount > 0 ? '+' : ''}${item.fruit_amount}` : item.plant_quantity !== 0 ? `${item.plant_quantity > 0 ? '+' : ''}${item.plant_quantity} 株` : '0'}</strong>
                <span>{item.note || item.ref_type}</span>
                <time>{formatDate(item.created_at, lang)}</time>
              </div>
            ))}
          </div>
          <div className="spirit-section-title spirit-admin-sub"><div><h3>{zh ? '站长资源调整' : 'Owner balance adjustment'}</h3><p>{zh ? '仅站长可见；调整会写入被调整用户的后台流水。' : 'Owner only; adjustments are written to the target user’s ledger.'}</p></div></div>
          <div className="spirit-admin-form">
            <label className="spirit-field"><span>{zh ? '目标用户 ID' : 'Target user ID'}</span><input value={adjust.user_id} onChange={(event) => setAdjust((prev) => ({ ...prev, user_id: event.target.value }))} /></label>
            <label className="spirit-field"><span>{zh ? '调整数量（可负）' : 'Amount (negative allowed)'}</span><input type="number" value={adjust.amount} onChange={(event) => setAdjust((prev) => ({ ...prev, amount: event.target.value }))} /></label>
            <label className="spirit-field"><span>{zh ? '原因' : 'Reason'}</span><input value={adjust.note} onChange={(event) => setAdjust((prev) => ({ ...prev, note: event.target.value }))} /></label>
            <button type="button" className="spirit-secondary" disabled={busy === 'adjust'} onClick={() => void submitAdjust()}>{busy === 'adjust' ? (zh ? '提交中…' : 'Saving…') : (zh ? '确认调整' : 'Apply')}</button>
          </div>
        </section>
      )}

      {tab === 'activity' && user?.is_owner && (
        <section className="spirit-panel spirit-activity">
          <div className="spirit-section-title"><div><h2>{zh ? '用户活跃' : 'User activity'}</h2><p>{zh ? '站长可见：所有用户的登录会话与参与痕迹（动态、评论、作品、互动）。' : 'Owner view: login sessions and participation traces across all users.'}</p></div><Activity size={18} /></div>
          <div className="spirit-activity-toolbar">
            <input
              className="spirit-field-input"
              placeholder={zh ? '搜索用户名 / 昵称' : 'Search username / name'}
              value={activityQuery}
              onChange={(event) => setActivityQuery(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') void loadActivity() }}
            />
            <button type="button" className="spirit-secondary" onClick={() => void loadActivity()}>{activityLoading ? (zh ? '读取中…' : 'Loading…') : (zh ? '查询' : 'Search')}</button>
          </div>
          <div className="spirit-activity-table">
            <div className="spirit-activity-head">
              <span>{zh ? '用户' : 'User'}</span>
              <span>{zh ? '动态' : 'Posts'}</span>
              <span>{zh ? '评论' : 'Comments'}</span>
              <span>{zh ? '作品' : 'Works'}</span>
              <span>{zh ? '阅读' : 'Reads'}</span>
              <span>{zh ? '点赞 / 收藏' : 'Likes / Favs'}</span>
              <span>{zh ? '关注 / 粉丝' : 'Following / Fans'}</span>
              <span>{zh ? '活跃等级' : 'Activity level'}</span>
              <span>{zh ? '最近登录' : 'Last login'}</span>
              <span>{zh ? '最近参与' : 'Last active'}</span>
            </div>
            {activity.length === 0 ? (
              <div className="spirit-inline-empty">{activityLoading ? (zh ? '读取中…' : 'Loading…') : (zh ? '暂无用户数据' : 'No users yet')}</div>
            ) : (
              activity.map((row) => (
                <div className="spirit-activity-row" key={row.user_id}>
                  <span className="spirit-activity-user"><strong>{row.display_name}</strong><small>@{row.username}{row.is_owner ? ` · ${zh ? '站长' : 'Owner'}` : ''}</small></span>
                  <span>{row.posts}</span>
                  <span>{row.comments}</span>
                  <span>{row.works}</span>
                  <span>{row.reads}</span>
                  <span>{row.likes_given} / {row.favorites_given}</span>
                  <span>{row.following} / {row.followers}</span>
                  <span><b className="spirit-level">Lv.{row.activity_level.level} · {row.activity_level.label}</b></span>
                  <span>{row.last_login_at ? formatDate(row.last_login_at, lang) : '—'}</span>
                  <span>{row.last_active_at ? formatDate(row.last_active_at, lang) : '—'}</span>
                </div>
              ))
            )}
          </div>
        </section>
      )}
    </div>
  )
}
