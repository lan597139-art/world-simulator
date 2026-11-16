import { useEffect, useState } from 'react'
import { Activity, ChevronDown, RefreshCw, Trash2 } from 'lucide-react'
import { clearClientErrors, listClientErrors, type ClientErrorRow } from '../../api/observability'
import { tr } from '../../i18n'
import AdminBackupsPanel from './AdminBackupsPanel'

type Lang = 'zh' | 'en'

export default function AdminMonitoringPanel({ lang }: { lang: Lang }) {
  const [rows, setRows] = useState<ClientErrorRow[]>([])
  const [total, setTotal] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [open, setOpen] = useState<string | null>(null)

  const load = async () => {
    setBusy(true)
    setError('')
    try {
      const data = await listClientErrors()
      setRows(data.items)
      setTotal(data.total)
    } catch (err: any) {
      setError(String(err?.message || err))
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => { void load() }, [])

  const clear = async () => {
    if (!window.confirm(tr(lang, '清空全部前端错误记录？', 'Clear all client error records?'))) return
    setBusy(true)
    try {
      await clearClientErrors()
      setRows([])
      setTotal(0)
    } catch (err: any) {
      setError(String(err?.message || err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="admin-monitor">
      <div className="admin-monitor-head">
        <div>
          <div className="admin-monitor-title"><Activity size={16} /> {tr(lang, '运行监控', 'Runtime monitoring')}</div>
          <p>{tr(lang, '前端未捕获异常与页面渲染失败会记录在这里，最多保留 2000 条。', 'Uncaught frontend errors and render failures are recorded here, capped at 2,000 entries.')}</p>
        </div>
        <div className="admin-monitor-actions">
          <button type="button" onClick={() => void load()} disabled={busy}><RefreshCw size={14} className={busy ? 'ws-spin' : ''} /> {tr(lang, '刷新', 'Refresh')}</button>
          <button type="button" className="danger" onClick={() => void clear()} disabled={busy || total === 0}><Trash2 size={14} /> {tr(lang, '清空', 'Clear')}</button>
        </div>
      </div>

      <div className="admin-monitor-stats">
        <span><strong>{total}</strong> {tr(lang, '累计错误', 'stored errors')}</span>
        <span><strong>{rows.length}</strong> {tr(lang, '当前展示', 'shown')}</span>
        <span className="muted">{tr(lang, '同一错误 30 秒内只上报一次，避免刷屏。', 'Repeated errors are de-duplicated for 30 seconds.')}</span>
      </div>

      {error && <div className="admin-monitor-error">{error}</div>}

      {rows.length === 0 && !busy ? (
        <div className="admin-monitor-empty">
          <Activity size={28} strokeWidth={1.3} />
          <strong>{tr(lang, '没有记录到前端错误', 'No client errors recorded')}</strong>
          <span>{tr(lang, '页面崩溃时会自动上报，刷新后再看。', 'Crashes report automatically; refresh to check again.')}</span>
        </div>
      ) : (
        <div className="admin-monitor-list">
          {rows.map((row) => (
            <article key={row.id} className="admin-monitor-item">
              <button type="button" className="admin-monitor-summary" onClick={() => setOpen(open === row.id ? null : row.id)}>
                <span className="admin-monitor-dot" />
                <span className="admin-monitor-main">
                  <strong>{row.message}</strong>
                  <small>{row.page ? `page=${row.page}` : row.url || 'unknown page'} · {row.created_at ? new Date(row.created_at).toLocaleString() : ''}</small>
                </span>
                <ChevronDown size={15} className={open === row.id ? 'open' : ''} />
              </button>
              {open === row.id && (
                <div className="admin-monitor-detail">
                  {row.url && <code>{row.url}</code>}
                  {row.stack && <pre>{row.stack}</pre>}
                  <div>{row.user_agent}</div>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
      <AdminBackupsPanel lang={lang} />
    </div>
  )
}
