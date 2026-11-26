import { useEffect, useState } from 'react'
import { Download, HardDrive, RefreshCw, Save, Trash2 } from 'lucide-react'
import { type LocalBackup, type LocalDraft } from '../../db/database'
import { tr, type Lang } from '../../i18n'
import {
  clearLocalWorkspace, deleteLocalDraft, exportLocalWorkspace,
  listLocalBackups, listLocalDrafts, listLocalMedia, saveLocalBackup,
} from '../../services/localContent'

const card: React.CSSProperties = {
  border: '1px solid var(--card-border)', borderRadius: 14, background: 'var(--ws-surface-bg)',
  boxSizing: 'border-box', padding: 18,
}
const ghost: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 10px', borderRadius: 8,
  border: '1px solid var(--card-border)', background: 'transparent',
  color: 'var(--text-main)', fontSize: 10.5, cursor: 'pointer',
}
const primary: React.CSSProperties = {
  ...ghost, border: '1px solid var(--primary-color)', background: 'var(--primary-color)',
  color: 'var(--primary-text)', fontWeight: 650,
}
const danger: React.CSSProperties = { ...ghost, color: 'var(--danger-color)' }

function formatDate(value: string) {
  try { return new Date(value).toLocaleString() } catch { return value }
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function LocalWorkspacePanel({ lang = 'zh' }: { lang?: Lang }) {
  const [drafts, setDrafts] = useState<LocalDraft[]>([])
  const [backups, setBackups] = useState<LocalBackup[]>([])
  const [mediaCount, setMediaCount] = useState(0)
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')

  const load = async () => {
    const [nextDrafts, nextBackups, media] = await Promise.all([listLocalDrafts(), listLocalBackups(), listLocalMedia()])
    setDrafts(nextDrafts)
    setBackups(nextBackups)
    setMediaCount(media.length)
  }

  useEffect(() => { void load() }, [])

  const exportAll = async () => {
    setBusy('export'); setNotice('')
    try {
      const blob = await exportLocalWorkspace()
      download(blob, `world-simulator-local-${new Date().toISOString().slice(0, 10)}.json`)
      setNotice(tr(lang, '已导出当前账号的本地草稿与备份索引。', 'Exported this account\'s local drafts and backup index.'))
    } finally { setBusy('') }
  }

  const backup = async () => {
    setBusy('backup'); setNotice('')
    try {
      const rows = await listLocalDrafts()
      await saveLocalBackup(tr(lang, `手动备份 ${new Date().toLocaleString()}`, `Manual backup ${new Date().toLocaleString()}`), { drafts: rows })
      await load()
      setNotice(tr(lang, '已生成一份本地备份（最多保留最近 20 份）。', 'Local backup created (the latest 20 are kept).'))
    } finally { setBusy('') }
  }

  const remove = async (id: string) => {
    if (!window.confirm(tr(lang, '删除这份本地草稿？只影响当前浏览器，不影响服务器数据。', 'Delete this local draft? Only this browser is affected.'))) return
    await deleteLocalDraft(id)
    await load()
  }

  const clear = async () => {
    if (!window.confirm(tr(lang, '清空当前账号在本浏览器里的全部草稿、备份和媒体索引？此操作不可撤销。', 'Clear all local drafts, backups and media indexes for this account in this browser? This cannot be undone.'))) return
    setBusy('clear')
    try {
      await clearLocalWorkspace()
      await load()
      setNotice(tr(lang, '当前账号的本地工作区已清空。', 'Local workspace cleared.'))
    } finally { setBusy('') }
  }

  const storageSize = drafts.reduce((sum, row) => sum + JSON.stringify(row.payload).length, 0)

  return (
    <section style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 17, letterSpacing: '-0.01em' }}>{tr(lang, '本地创作与备份', 'Local drafts & backup')}</h2>
          <p style={{ margin: '5px 0 0', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.7 }}>
            {tr(lang, '草稿按账号隔离保存在 IndexedDB；服务器断开时仍可继续创作，恢复后由你决定是否同步。', 'Drafts are stored per account in IndexedDB. Keep creating offline; sync when you choose.')}
          </p>
        </div>
        <button type="button" style={ghost} onClick={() => void load()}><RefreshCw size={13} /> {tr(lang, '刷新', 'Refresh')}</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginBottom: 12 }}>
        <div style={{ border: '1px solid var(--card-border)', borderRadius: 9, padding: '9px 10px' }}>
          <span style={{ display: 'block', fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>{tr(lang, '本地草稿', 'Local drafts')}</span>
          <strong style={{ fontSize: 16 }}>{drafts.length}</strong>
        </div>
        <div style={{ border: '1px solid var(--card-border)', borderRadius: 9, padding: '9px 10px' }}>
          <span style={{ display: 'block', fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>{tr(lang, '备份', 'Backups')}</span>
          <strong style={{ fontSize: 16 }}>{backups.length}</strong>
        </div>
        <div style={{ border: '1px solid var(--card-border)', borderRadius: 9, padding: '9px 10px' }}>
          <span style={{ display: 'block', fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>{tr(lang, '草稿体积', 'Draft size')}</span>
          <strong style={{ fontSize: 16 }}>{(storageSize / 1024).toFixed(1)} KB</strong>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        <button type="button" style={primary} disabled={busy === 'backup'} onClick={() => void backup()}><Save size={13} /> {busy === 'backup' ? tr(lang, '备份中…', 'Backing up…') : tr(lang, '立即备份', 'Back up now')}</button>
        <button type="button" style={ghost} disabled={busy === 'export'} onClick={() => void exportAll()}><Download size={13} /> {busy === 'export' ? tr(lang, '导出中…', 'Exporting…') : tr(lang, '导出 JSON', 'Export JSON')}</button>
        <button type="button" style={danger} disabled={busy === 'clear'} onClick={() => void clear()}><Trash2 size={13} /> {busy === 'clear' ? tr(lang, '清理中…', 'Clearing…') : tr(lang, '清空本地工作区', 'Clear local workspace')}</button>
      </div>

      {notice && <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 10 }}>{notice}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {drafts.length === 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 10.5, color: 'var(--text-muted)', padding: '8px 0' }}>
            <HardDrive size={14} /> {tr(lang, '还没有本地草稿。创作页保存的草稿会自动按账号归入这里。', 'No local drafts yet. Drafts saved while creating appear here per account.')}
          </div>
        )}
        {drafts.slice(0, 8).map((draft) => (
          <div key={draft.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', border: '1px solid var(--card-border)', borderRadius: 8 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <strong style={{ display: 'block', fontSize: 10.5 }}>{draft.title}</strong>
              <span style={{ display: 'block', marginTop: 2, fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>{draft.kind} · {formatDate(draft.updatedAt)}</span>
            </div>
            <button type="button" style={danger} onClick={() => void remove(draft.id)}><Trash2 size={12} /></button>
          </div>
        ))}
      </div>

      {backups.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{tr(lang, '最近备份', 'Recent backups')}</div>
          {backups.slice(0, 3).map((row) => (
            <div key={row.id} style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', padding: '3px 0' }}>{row.label} · {formatDate(row.createdAt)}</div>
          ))}
        </div>
      )}
      {mediaCount > 0 && <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>{tr(lang, '媒体索引：', 'Media index: ')}{mediaCount}</div>}
    </section>
  )
}
