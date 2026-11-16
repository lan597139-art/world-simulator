import { useEffect, useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import { appealSanction, mySanctions, type SanctionRow } from '../../api/sanctions'
import { tr } from '../../i18n'

type Lang = 'zh' | 'en'

const LABEL = {
  warning: { zh: '警告', en: 'Warning' },
  mute: { zh: '禁言', en: 'Mute' },
  ban: { zh: '封禁', en: 'Ban' },
}

export default function AccountSanctionsPanel({ lang }: { lang: Lang }) {
  const [rows, setRows] = useState<SanctionRow[]>([])
  const [draft, setDraft] = useState('')
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    try {
      setRows((await mySanctions()).items)
    } catch {
      setRows([])
    }
  }

  useEffect(() => { void load() }, [])

  const active = rows.filter((row) => row.active)
  if (active.length === 0) return null

  const appeal = async (row: SanctionRow) => {
    if (!draft.trim()) return
    setBusyId(row.id)
    setError('')
    try {
      await appealSanction(row.id, draft.trim())
      setDraft('')
      await load()
    } catch (err: any) {
      setError(String(err?.message || err))
    } finally {
      setBusyId('')
    }
  }

  return (
    <div className="account-sanctions">
      <div className="account-sanctions-title"><ShieldAlert size={16} /> {tr(lang, '账号治理状态', 'Account status')}</div>
      {active.map((row) => (
        <div key={row.id} className="account-sanction-card">
          <strong>{tr(lang, LABEL[row.action].zh, LABEL[row.action].en)}</strong>
          <p>{row.reason || '—'}</p>
          <small>
            {row.expires_at ? `${tr(lang, '解除时间', 'Until')} ${new Date(row.expires_at).toLocaleString()}` : tr(lang, '长期处置', 'Indefinite')}
          </small>
          {row.appealed_at ? (
            <div className="account-sanction-appealed">{tr(lang, '申诉已提交，等待开发者处理。', 'Appeal submitted; awaiting review.')}</div>
          ) : (
            <div className="account-sanction-appeal">
              <textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={tr(lang, '说明情况，申请解除限制', 'Explain why this restriction should be lifted')} rows={3} />
              <button type="button" disabled={!draft.trim() || busyId === row.id} onClick={() => void appeal(row)}>{busyId === row.id ? tr(lang, '提交中…', 'Submitting…') : tr(lang, '提交申诉', 'Submit appeal')}</button>
            </div>
          )}
        </div>
      ))}
      {error && <div className="account-sanctions-error">{error}</div>}
    </div>
  )
}
