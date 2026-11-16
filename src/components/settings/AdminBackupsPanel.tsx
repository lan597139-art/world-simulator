import { useEffect, useState } from 'react'
import { Archive, Download, HardDrive, RefreshCw } from 'lucide-react'
import { createBackup, downloadBackup, listBackups, type BackupRow } from '../../api/backups'
import { tr } from '../../i18n'

type Lang = 'zh' | 'en'

function size(value: number) {
  if (value > 1024 * 1024 * 1024) return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`
  if (value > 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`
  return `${Math.max(1, Math.round(value / 1024))} KB`
}

export default function AdminBackupsPanel({ lang }: { lang: Lang }) {
  const [rows, setRows] = useState<BackupRow[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')

  const load = async () => {
    setBusy(true)
    setError('')
    try {
      setRows((await listBackups()).items)
    } catch (err: any) {
      setError(String(err?.message || err))
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => { void load() }, [])

  const create = async () => {
    setBusy(true)
    setError('')
    setNote('')
    try {
      const data = await createBackup()
      setNote(tr(lang, `已创建 ${data.name}（${size(data.size)}，媒体 ${data.uploads} 个）`, `Created ${data.name} (${size(data.size)}, ${data.uploads} media files)`))
      await load()
    } catch (err: any) {
      setError(String(err?.message || err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="admin-backups">
      <div className="admin-backups-head">
        <div>
          <div className="admin-backups-title"><HardDrive size={15} /> {tr(lang, '数据备份', 'Data backups')}</div>
          <p>{tr(lang, '一致性快照包含 SQLite 数据库与上传目录，自动保留最近 7 份。', 'Consistent snapshots include SQLite and uploads; the latest 7 are kept.')}</p>
        </div>
        <div className="admin-backups-actions">
          <button type="button" onClick={() => void load()} disabled={busy}><RefreshCw size={13} className={busy ? 'ws-spin' : ''} /> {tr(lang, '刷新', 'Refresh')}</button>
          <button type="button" className="primary" onClick={() => void create()} disabled={busy}><Archive size={13} /> {tr(lang, '立即备份', 'Back up now')}</button>
        </div>
      </div>
      {error && <div className="admin-backups-error">{error}</div>}
      {note && <div className="admin-backups-note">{note}</div>}
      {rows.length === 0 && !busy ? (
        <div className="admin-backups-empty">{tr(lang, '还没有备份。建议在部署前后各做一次。', 'No backups yet. Create one before and after deployments.')}</div>
      ) : (
        <div className="admin-backups-list">
          {rows.map((row) => (
            <div key={row.name} className="admin-backup-row">
              <Archive size={14} />
              <span>{row.name}</span>
              <small>{size(row.size)} · {row.created_at ? new Date(row.created_at).toLocaleString() : ''}</small>
              <button type="button" onClick={() => void downloadBackup(row.name).catch((err) => setError(String(err?.message || err)))}><Download size={13} /> {tr(lang, '下载', 'Download')}</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
