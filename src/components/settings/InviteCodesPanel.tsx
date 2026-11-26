import { useEffect, useState } from 'react'
import { Check, Copy, Plus, RefreshCw, Ticket, XCircle } from 'lucide-react'
import { createInvite, listInvites, updateInvite, type InviteCode } from '../../api/auth'
import { tr, type Lang } from '../../i18n'

const card: React.CSSProperties = {
  border: '1px solid var(--card-border)', borderRadius: 14, background: 'var(--ws-surface-bg)',
  boxSizing: 'border-box', padding: 18,
}
const input: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8,
  border: '1px solid var(--card-border)', background: 'var(--bg-color)',
  color: 'var(--text-main)', fontSize: 11.5, lineHeight: 1.6,
}
const primary: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 8,
  border: '1px solid var(--primary-color)', background: 'var(--primary-color)',
  color: 'var(--primary-text)', fontSize: 11.5, fontWeight: 650, cursor: 'pointer',
}
const ghost: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 10px', borderRadius: 8,
  border: '1px solid var(--card-border)', background: 'transparent',
  color: 'var(--text-main)', fontSize: 10.5, cursor: 'pointer',
}
const dangerGhost: React.CSSProperties = { ...ghost, color: 'var(--danger-color)' }
const label: React.CSSProperties = { display: 'block', fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }

function formatDate(value: string | null, lang: Lang) {
  if (!value) return tr(lang, '长期有效', 'No expiry')
  try { return new Date(value).toLocaleString() } catch { return value }
}

export default function InviteCodesPanel({ lang = 'zh' }: { lang?: Lang }) {
  const STATUS_LABELS: Record<InviteCode['status'], string> = {
    active: tr(lang, '可用', 'Active'), revoked: tr(lang, '已停用', 'Revoked'), expired: tr(lang, '已过期', 'Expired'), exhausted: tr(lang, '已用完', 'Used up'),
  }
  const [items, setItems] = useState<InviteCode[]>([])
  const [batches, setBatches] = useState<string[]>([])
  const [batchFilter, setBatchFilter] = useState('')
  const [labelText, setLabelText] = useState('')
  const [kind, setKind] = useState<'normal' | 'special' | 'developer'>('normal')
  const [batch, setBatch] = useState(() => new Date().toISOString().slice(0, 7))
  const [rewardFruit, setRewardFruit] = useState(0)
  const [inviterReward, setInviterReward] = useState(0)
  const [maxUses, setMaxUses] = useState(1)
  const [expiresDays, setExpiresDays] = useState(7)
  const kindLabels = {
    normal: tr(lang, '普通', 'Normal'),
    special: tr(lang, '特殊', 'Special'),
    developer: tr(lang, '开发者', 'Developer'),
  }
  const [newCode, setNewCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const load = async (selectedBatch = batchFilter) => {
    try {
      const data = await listInvites(selectedBatch)
      setItems(data.items)
      setBatches(data.batches || [])
      setError('')
    } catch (err: any) {
      setError(String(err.message || err))
    }
  }

  useEffect(() => { void load(batchFilter) }, [batchFilter])

  const create = async () => {
    setBusy('create'); setError(''); setCopied(false)
    try {
      const result = await createInvite({
        label: labelText.trim(), max_uses: maxUses, expires_days: expiresDays,
        kind, batch: batch.trim(), reward_fruit: rewardFruit, inviter_reward_fruit: inviterReward,
      })
      setNewCode(result.code)
      setLabelText('')
      await load()
      try {
        await navigator.clipboard.writeText(result.code)
        setCopied(true)
      } catch { /* manual copy fallback */ }
    } catch (err: any) {
      setError(String(err.message || err))
    } finally { setBusy('') }
  }

  const revoke = async (invite: InviteCode) => {
    if (!window.confirm(tr(lang, `停用邀请码 ${invite.code_prefix}…？已注册用户不受影响。`, `Revoke invite ${invite.code_prefix}…? Existing users are unaffected.`))) return
    setBusy(`revoke-${invite.id}`); setError('')
    try {
      await updateInvite(invite.id, { revoked: true })
      await load()
    } catch (err: any) {
      setError(String(err.message || err))
    } finally { setBusy('') }
  }

  return (
    <section style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 17, letterSpacing: '-0.01em' }}>{tr(lang, '邀请码与公开注册', 'Invite codes & registration')}</h2>
          <p style={{ margin: '5px 0 0', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.7 }}>
            {tr(lang, '邀请码只在服务端校验，注册成功时原子消耗。前端隐藏不能替代服务端验证。', 'Invite codes are verified server-side and consumed atomically on success.')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <select style={{ ...input, width: 150 }} value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)}>
            <option value="">{tr(lang, '全部批次', 'All batches')}</option>
            {batches.map((row) => <option key={row} value={row}>{row}</option>)}
          </select>
          <button type="button" style={ghost} onClick={() => void load()}><RefreshCw size={13} /> {tr(lang, '刷新', 'Refresh')}</button>
        </div>
      </div>

      {error && <div style={{ marginBottom: 10, fontSize: 11, color: 'var(--danger-color)' }}>{error}</div>}

      <div className="invite-create-grid">
        <label><span style={label}>{tr(lang, '备注', 'Label')}</span><input style={input} value={labelText} onChange={(e) => setLabelText(e.target.value)} placeholder={tr(lang, "例如：第一批内测", "e.g. first beta")} /></label>
        <label><span style={label}>{tr(lang, '类型', 'Tier')}</span><select style={input} value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}><option value="normal">{kindLabels.normal}</option><option value="special">{kindLabels.special}</option><option value="developer">{kindLabels.developer}</option></select></label>
        <label><span style={label}>{tr(lang, '批次', 'Batch')}</span><input style={input} value={batch} onChange={(e) => setBatch(e.target.value)} placeholder="2026-11" /></label>
        <label><span style={label}>{tr(lang, '被邀请人灵果', 'Invitee fruit')}</span><input style={input} type="number" min={0} value={rewardFruit} onChange={(e) => setRewardFruit(Math.max(0, Number(e.target.value) || 0))} /></label>
        <label><span style={label}>{tr(lang, '邀请人灵果', 'Inviter fruit')}</span><input style={input} type="number" min={0} value={inviterReward} onChange={(e) => setInviterReward(Math.max(0, Number(e.target.value) || 0))} /></label>
        <label><span style={label}>{tr(lang, '可用次数', 'Max uses')}</span><input style={input} type="number" min={1} max={1000} value={maxUses} onChange={(e) => setMaxUses(Math.max(1, Math.min(1000, Number(e.target.value) || 1)))} /></label>
        <label><span style={label}>{tr(lang, '有效天数', 'Valid days')}</span><input style={input} type="number" min={0} max={3650} value={expiresDays} onChange={(e) => setExpiresDays(Math.max(0, Number(e.target.value) || 0))} /></label>
        <button type="button" style={primary} disabled={busy === 'create'} onClick={() => void create()}><Plus size={14} /> {busy === 'create' ? tr(lang, '生成中…', 'Creating…') : tr(lang, '生成邀请码', 'Create invite')}</button>
      </div>

      {newCode && (
        <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--card-border)', background: 'rgba(128,128,128,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Ticket size={15} />
            <strong style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 14, letterSpacing: '0.03em' }}>{newCode}</strong>
            <button type="button" style={ghost} onClick={async () => {
              try { await navigator.clipboard.writeText(newCode); setCopied(true) } catch { setCopied(false) }
            }}>{copied ? <Check size={13} /> : <Copy size={13} />} {copied ? tr(lang, '已复制', 'Copied') : tr(lang, '复制', 'Copy')}</button>
          </div>
          <p style={{ margin: '5px 0 0', fontSize: 10, color: 'var(--text-muted)' }}>{tr(lang, '明文只显示这一次；服务端只保存哈希。', 'The plaintext is shown once; only a hash is stored.')}</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.length === 0 && <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '8px 0' }}>{tr(lang, '还没有邀请码。生成一个后即可让新用户注册。', 'No invite codes yet. Create one to let new users register.')}</div>}
        {items.map((invite) => (
          <div key={invite.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', border: '1px solid var(--card-border)', borderRadius: 9, flexWrap: 'wrap' }}>
            <Ticket size={14} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <strong style={{ display: 'block', fontSize: 11 }}>{invite.code_prefix}•••••••• {invite.label ? `· ${invite.label}` : ''}</strong>
              <span style={{ display: 'block', marginTop: 2, fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>
                {invite.used_count}/{invite.max_uses} {tr(lang, '次', 'uses')} · {STATUS_LABELS[invite.status]} · {formatDate(invite.expires_at, lang)}
              </span>
              <span style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 3, fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>
                <b style={{ fontWeight: 600 }}>{kindLabels[invite.kind] || invite.kind}</b>
                {invite.batch && <span>· {invite.batch}</span>}
                {invite.reward_fruit > 0 && <span>· {tr(lang, '被邀请', 'Invitee')} +{invite.reward_fruit}</span>}
                {invite.inviter_reward_fruit > 0 && <span>· {tr(lang, '邀请人', 'Inviter')} +{invite.inviter_reward_fruit}</span>}
              </span>
            </div>
            {invite.status === 'active' && (
              <button type="button" style={dangerGhost} disabled={busy === `revoke-${invite.id}`} onClick={() => void revoke(invite)}>
                <XCircle size={12} /> {tr(lang, '停用', 'Revoke')}
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
