import { useCallback, useEffect, useState } from 'react'
import { Check, Loader2, X } from 'lucide-react'
import { listWorldInvites, respondToWorldInvite, type WorldCollaborator } from '../../api/collaboration'

type Props = {
  lang: string
  onAccepted: () => void
}

const copy = (lang: string, zh: string, en: string) => (lang === 'zh' ? zh : en)

export default function WorldInvitesPanel({ lang, onAccepted }: Props) {
  const [items, setItems] = useState<WorldCollaborator[]>([])
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      setItems((await listWorldInvites()).items)
    } catch {
      setItems([])
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const respond = async (item: WorldCollaborator, action: 'accept' | 'decline') => {
    setBusy(item.id)
    setError('')
    try {
      await respondToWorldInvite(item.id, action)
      setItems((current) => current.filter((row) => row.id !== item.id))
      if (action === 'accept') onAccepted()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy('')
    }
  }

  if (items.length === 0) return null

  return (
    <div className="glass-card" style={{ padding: '14px 16px', marginBottom: '18px', display: 'flex', flexDirection: 'column', gap: '9px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '10px', letterSpacing: '.12em', color: 'var(--text-muted)' }}>WORLD INVITATIONS</span>
        <span style={{ padding: '2px 7px', borderRadius: '20px', background: 'var(--primary-color)', color: '#fff', fontSize: '9px' }}>{items.length}</span>
      </div>
      {error && <div style={{ fontSize: '11px', color: 'var(--danger-color)' }}>{error}</div>}
      {items.map((item) => (
        <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', padding: '9px 0', borderTop: '1px solid var(--card-border)' }}>
          <div style={{ flex: 1, minWidth: '180px' }}>
            <strong style={{ display: 'block', fontSize: '13px', color: 'var(--text-main)' }}>{item.world_name}</strong>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {copy(lang, `${item.invited_by.name} 邀请你作为${item.role === 'editor' ? '编辑者' : '只读成员'}加入`, `${item.invited_by.name} invited you as ${item.role === 'editor' ? 'an editor' : 'a viewer'}`)}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void respond(item, 'accept')}
            disabled={busy === item.id}
            style={{ padding: '7px 13px', borderRadius: '8px', border: '1px solid var(--primary-color)', background: 'var(--primary-color)', color: '#fff', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            {busy === item.id ? <Loader2 size={12} className="ws-spin" /> : <Check size={12} />}
            {copy(lang, '接受', 'Accept')}
          </button>
          <button
            type="button"
            onClick={() => void respond(item, 'decline')}
            disabled={busy === item.id}
            style={{ padding: '7px 12px', borderRadius: '8px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            <X size={12} /> {copy(lang, '拒绝', 'Decline')}
          </button>
        </div>
      ))}
    </div>
  )
}
