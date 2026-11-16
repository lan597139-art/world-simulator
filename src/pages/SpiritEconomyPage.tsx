import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowLeft,
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
  getSpiritSummary,
  giftSpiritFruit,
  type SpiritInventoryItem,
  type SpiritSummary,
  type SpiritTransaction,
} from '../api/spiritEconomy'
import '../styles/spirit-economy.css'

type Lang = 'zh' | 'en'
type Tab = 'shop' | 'transfer' | 'ledger'

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
  onBack,
}: {
  lang: Lang
  user?: User
  onBack?: () => void
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
  const zh = lang === 'zh'

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      setSummary(await getSpiritSummary())
    } catch (err) {
      setError(String((err as Error)?.message || err))
    } finally {
      setLoading(false)
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
          {onBack && (
            <button type="button" className="spirit-back" onClick={onBack} aria-label={zh ? '返回' : 'Back'}>
              <ArrowLeft size={16} />
            </button>
          )}
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
                <div><span>{categoryLabels[item.category]?.[lang] || item.category}</span><strong>{item.name}</strong></div>
                <b>{item.quantity}<small>{item.unit}</small></b>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="spirit-tabs" role="tablist">
        <button type="button" className={tab === 'shop' ? 'active' : ''} onClick={() => setTab('shop')}><ArrowLeftRight size={14} /> {zh ? '兑换灵植' : 'Exchange'}</button>
        <button type="button" className={tab === 'transfer' ? 'active' : ''} onClick={() => setTab('transfer')}><Gift size={14} /> {zh ? '赠送与打赏' : 'Gift & Tip'}</button>
        <button type="button" className={tab === 'ledger' ? 'active' : ''} onClick={() => setTab('ledger')}><History size={14} /> {zh ? '灵果流水' : 'Ledger'}</button>
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
              return (
                <article key={plant.id} className="spirit-shop-card">
                  <div className="spirit-shop-top">
                    <span className={`spirit-category is-${plant.category}`}>{categoryLabels[plant.category]?.[lang] || plant.category}</span>
                    <span className="spirit-owned">{zh ? '持有' : 'Held'} {owned}</span>
                  </div>
                  <h3>{plant.name}</h3>
                  <p>{plant.description}</p>
                  <div className="spirit-price"><strong>{plant.price_fruit}</strong><span>{zh ? '灵果 / 株' : 'fruit / plant'}</span></div>
                  <div className="spirit-buy">
                    <div className="spirit-qty">
                      <button type="button" onClick={() => setQuantity((prev) => ({ ...prev, [plant.id]: Math.max(1, count - 1) }))}>−</button>
                      <input aria-label={zh ? '兑换数量' : 'Quantity'} type="number" min={1} max={99} value={count} onChange={(event) => setQuantity((prev) => ({ ...prev, [plant.id]: Math.max(1, Math.min(99, Number(event.target.value) || 1)) }))} />
                      <button type="button" onClick={() => setQuantity((prev) => ({ ...prev, [plant.id]: Math.min(99, count + 1) }))}>+</button>
                    </div>
                    <button type="button" className="spirit-primary" disabled={!affordable || busy === `exchange:${plant.id}`} onClick={() => void exchange(plant.id, plant.name)}>
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

      {user?.is_owner && (
        <section className="spirit-panel spirit-admin">
          <div className="spirit-section-title"><div><h2>{zh ? '站长资源调整' : 'Owner adjustment'}</h2><p>{zh ? '仅站长可见；调整会写入被调整用户的后台流水。' : 'Owner only; adjustments are written to the target user’s ledger.'}</p></div><ShieldCheck size={18} /></div>
          <div className="spirit-admin-form">
            <label className="spirit-field"><span>{zh ? '目标用户 ID' : 'Target user ID'}</span><input value={adjust.user_id} onChange={(event) => setAdjust((prev) => ({ ...prev, user_id: event.target.value }))} /></label>
            <label className="spirit-field"><span>{zh ? '调整数量（可负）' : 'Amount (negative allowed)'}</span><input type="number" value={adjust.amount} onChange={(event) => setAdjust((prev) => ({ ...prev, amount: event.target.value }))} /></label>
            <label className="spirit-field"><span>{zh ? '原因' : 'Reason'}</span><input value={adjust.note} onChange={(event) => setAdjust((prev) => ({ ...prev, note: event.target.value }))} /></label>
            <button type="button" className="spirit-secondary" disabled={busy === 'adjust'} onClick={() => void submitAdjust()}>{busy === 'adjust' ? (zh ? '提交中…' : 'Saving…') : (zh ? '确认调整' : 'Apply')}</button>
          </div>
        </section>
      )}
    </div>
  )
}
