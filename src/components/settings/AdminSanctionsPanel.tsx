import { useEffect, useState } from 'react'
import { Ban, RefreshCw, ShieldAlert, TriangleAlert, Undo2, VolumeX } from 'lucide-react'
import { listSanctions, revokeSanction, type SanctionRow } from '../../api/sanctions'
import { tr } from '../../i18n'

type Lang = 'zh' | 'en'

const ACTION_META = {
  warning: { zh: '警告', en: 'Warning', icon: TriangleAlert, tone: 'warn' },
  mute: { zh: '禁言', en: 'Mute', icon: VolumeX, tone: 'mute' },
  ban: { zh: '封禁', en: 'Ban', icon: Ban, tone: 'ban' },
}

export default function AdminSanctionsPanel({ lang, refreshKey = 0 }: { lang: Lang; refreshKey?: number }) {
  const [rows, setRows] = useState<SanctionRow[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    setBusy(true)
    setError('')
    try {
      setRows((await listSanctions()).items)
    } catch (err: any) {
      setError(String(err?.message || err))
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => { void load() }, [refreshKey])

  const revoke = async (row: SanctionRow) => {
    const note = window.prompt(tr(lang, '撤销说明（会通知对方）', 'Revocation note (the user is notified)'), '') ?? null
    if (note === null) return
    try {
      await revokeSanction(row.id, note)
      await load()
    } catch (err: any) {
      setError(String(err?.message || err))
    }
  }

  return (
    <div className="admin-sanctions">
      <div className="admin-sanctions-head">
        <div className="admin-sanctions-title"><ShieldAlert size={15} /> {tr(lang, '治理记录', 'Governance records')}</div>
        <button type="button" onClick={() => void load()} disabled={busy}><RefreshCw size={13} className={busy ? 'ws-spin' : ''} /> {tr(lang, '刷新', 'Refresh')}</button>
      </div>
      {error && <div className="admin-sanctions-error">{error}</div>}
      {rows.length === 0 && !busy ? (
        <div className="admin-sanctions-empty">{tr(lang, '还没有治理记录。', 'No governance records yet.')}</div>
      ) : (
        <div className="admin-sanctions-list">
          {rows.map((row) => {
            const meta = ACTION_META[row.action]
            const Icon = meta.icon
            return (
              <div key={row.id} className={`admin-sanction-row tone-${meta.tone}`}>
                <div className="admin-sanction-main">
                  <div className="admin-sanction-line">
                    <Icon size={14} />
                    <strong>{tr(lang, meta.zh, meta.en)}</strong>
                    <span>{row.user_name}</span>
                    {row.active ? <em>{tr(lang, '生效中', 'active')}</em> : <span className="admin-sanction-done">{tr(lang, '已结束', 'ended')}</span>}
                    {row.appealed_at && <span className="admin-sanction-appeal">{tr(lang, '已申诉', 'appealed')}</span>}
                  </div>
                  <p>{row.reason || '—'}</p>
                  <small>
                    {row.created_by_name || 'admin'} · {row.created_at ? new Date(row.created_at).toLocaleString() : ''}
                    {row.expires_at ? ` · ${tr(lang, '至', 'until')} ${new Date(row.expires_at).toLocaleString()}` : ''}
                  </small>
                  {row.appeal_note && <blockquote>{tr(lang, '申诉：', 'Appeal: ')}{row.appeal_note}</blockquote>}
                </div>
                {row.active && (
                  <button type="button" onClick={() => void revoke(row)}><Undo2 size={13} /> {tr(lang, '撤销', 'Revoke')}</button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
