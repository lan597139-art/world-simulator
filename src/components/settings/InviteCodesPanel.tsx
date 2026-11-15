import { useEffect, useState } from 'react'
import { Check, Copy, Plus, RefreshCw, Ticket, XCircle } from 'lucide-react'
import { createInvite, listInvites, updateInvite, type InviteCode } from '../../api/auth'

const card: React.CSSProperties = {
  border: '1px solid var(--card-border)', borderRadius: 14, background: 'var(--card-bg)',
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

function formatDate(value: string | null) {
  if (!value) return '长期有效'
  try { return new Date(value).toLocaleString() } catch { return value }
}

const STATUS_LABELS: Record<InviteCode['status'], string> = {
  active: '可用', revoked: '已停用', expired: '已过期', exhausted: '已用完',
}

export default function InviteCodesPanel() {
  const [items, setItems] = useState<InviteCode[]>([])
  const [labelText, setLabelText] = useState('')
  const [maxUses, setMaxUses] = useState(1)
  const [expiresDays, setExpiresDays] = useState(7)
  const [newCode, setNewCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    try {
      const data = await listInvites()
      setItems(data.items)
      setError('')
    } catch (err: any) {
      setError(String(err.message || err))
    }
  }

  useEffect(() => { void load() }, [])

  const create = async () => {
    setBusy('create'); setError(''); setCopied(false)
    try {
      const result = await createInvite({ label: labelText.trim(), max_uses: maxUses, expires_days: expiresDays })
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
    if (!window.confirm(`停用邀请码 ${invite.code_prefix}…？已注册用户不受影响。`)) return
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
          <h2 style={{ margin: 0, fontSize: 17, letterSpacing: '-0.01em' }}>邀请码与公开注册</h2>
          <p style={{ margin: '5px 0 0', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.7 }}>
            邀请码只在服务端校验，注册成功时原子消耗。前端隐藏不能替代服务端验证。
          </p>
        </div>
        <button type="button" style={ghost} onClick={() => void load()}><RefreshCw size={13} /> 刷新</button>
      </div>

      {error && <div style={{ marginBottom: 10, fontSize: 11, color: 'var(--danger-color)' }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) 90px 90px auto', gap: 8, alignItems: 'end', marginBottom: 12 }}>
        <label><span style={label}>备注</span><input style={input} value={labelText} onChange={(e) => setLabelText(e.target.value)} placeholder="例如：第一批内测" /></label>
        <label><span style={label}>可用次数</span><input style={input} type="number" min={1} max={1000} value={maxUses} onChange={(e) => setMaxUses(Math.max(1, Math.min(1000, Number(e.target.value) || 1)))} /></label>
        <label><span style={label}>有效天数</span><input style={input} type="number" min={0} max={3650} value={expiresDays} onChange={(e) => setExpiresDays(Math.max(0, Number(e.target.value) || 0))} /></label>
        <button type="button" style={primary} disabled={busy === 'create'} onClick={() => void create()}><Plus size={14} /> {busy === 'create' ? '生成中…' : '生成邀请码'}</button>
      </div>

      {newCode && (
        <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--card-border)', background: 'rgba(128,128,128,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Ticket size={15} />
            <strong style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 14, letterSpacing: '0.03em' }}>{newCode}</strong>
            <button type="button" style={ghost} onClick={async () => {
              try { await navigator.clipboard.writeText(newCode); setCopied(true) } catch { setCopied(false) }
            }}>{copied ? <Check size={13} /> : <Copy size={13} />} {copied ? '已复制' : '复制'}</button>
          </div>
          <p style={{ margin: '5px 0 0', fontSize: 10, color: 'var(--text-muted)' }}>明文只显示这一次；服务端只保存哈希。</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.length === 0 && <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '8px 0' }}>还没有邀请码。生成一个后即可让新用户注册。</div>}
        {items.map((invite) => (
          <div key={invite.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', border: '1px solid var(--card-border)', borderRadius: 9, flexWrap: 'wrap' }}>
            <Ticket size={14} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <strong style={{ display: 'block', fontSize: 11 }}>{invite.code_prefix}•••••••• {invite.label ? `· ${invite.label}` : ''}</strong>
              <span style={{ display: 'block', marginTop: 2, fontSize: 9.5, color: 'var(--text-muted)' }}>
                {invite.used_count}/{invite.max_uses} 次 · {STATUS_LABELS[invite.status]} · {formatDate(invite.expires_at)}
              </span>
            </div>
            {invite.status === 'active' && (
              <button type="button" style={dangerGhost} disabled={busy === `revoke-${invite.id}`} onClick={() => void revoke(invite)}>
                <XCircle size={12} /> 停用
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
