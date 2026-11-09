import { useEffect, useState } from 'react'

type ArchiveItem = {
  id: string
  name?: string
  title?: string
  description?: string
  world_id?: string
  world_name?: string
  archived_at?: string
  word_count?: number
  is_official?: boolean
}

type ArchiveData = {
  worlds: ArchiveItem[]
  characters: ArchiveItem[]
  stories: ArchiveItem[]
}

const API = 'http://127.0.0.1:8000/api'

const TABS: { key: keyof ArchiveData; type: string; label: string }[] = [
  { key: 'worlds', type: 'world', label: '旧世界' },
  { key: 'characters', type: 'character', label: '封存人物' },
  { key: 'stories', type: 'story', label: '旧章节' },
]

function formatDate(value?: string) {
  if (!value) return '未知时间'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN')
}

export default function ArchivePage() {
  const [data, setData] = useState<ArchiveData>({ worlds: [], characters: [], stories: [] })
  const [tab, setTab] = useState<keyof ArchiveData>('worlds')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/archive`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
      setError('')
    } catch (err: any) {
      setError(String(err.message || err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  useEffect(() => {
    if (data[tab].length > 0) return
    const first = TABS.find((item) => data[item.key].length > 0)
    if (first) setTab(first.key)
  }, [data])

  const restore = async (type: string, id: string) => {
    setBusy(id)
    try {
      const res = await fetch(`${API}/archive/${type}/${id}/restore`, { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.detail || `HTTP ${res.status}`)
      await load()
    } catch (err: any) {
      setError(String(err.message || err))
    } finally {
      setBusy('')
    }
  }

  const items = data[tab]

  return (
    <div style={{ padding: '2rem', maxWidth: '1100px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <header style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '11px', letterSpacing: '0.16em', color: 'var(--text-muted)' }}>GLOBAL ARCHIVE</div>
        <h1 style={{ margin: '6px 0 8px', fontSize: '26px', color: 'var(--text-main)' }}>全局归档</h1>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.7 }}>
          封存旧世界、退场人物和旧章节。归档不是删除，数据完整保留，但不会出现在日常页面，也不会参与当前推演。
        </p>
      </header>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', flexWrap: 'wrap' }}>
        {TABS.map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            style={{
              padding: '8px 14px', borderRadius: '9px', cursor: 'pointer', fontSize: '12px',
              border: `1px solid ${tab === item.key ? 'var(--primary-color)' : 'var(--card-border)'}`,
              background: tab === item.key ? 'var(--primary-color)' : 'transparent',
              color: tab === item.key ? 'var(--primary-text)' : 'var(--text-main)',
            }}
          >
            {item.label} · {data[item.key].length}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ marginBottom: '14px', padding: '10px 12px', borderRadius: '9px', border: '1px solid var(--danger-color)', color: 'var(--danger-color)', fontSize: '12px' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: '50px', textAlign: 'center', color: 'var(--text-muted)' }}>加载归档…</div>
      ) : items.length === 0 ? (
        <div className="glass-card" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)', borderStyle: 'dashed' }}>
          这一栏还没有归档内容。
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px' }}>
          {items.map((item) => {
            const meta = TABS.find((entry) => entry.key === tab)!
            const name = item.name || item.title || item.id
            return (
              <div key={item.id} className="glass-card" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '9px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-main)' }}>{name}</h3>
                  <span style={{ padding: '2px 7px', borderRadius: '20px', background: 'rgba(128,128,128,0.14)', color: 'var(--text-muted)', fontSize: '9px', whiteSpace: 'nowrap' }}>
                    {meta.label}
                  </span>
                </div>
                {item.description && <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.65 }}>{item.description}</p>}
                {item.world_name && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>所属世界：{item.world_name}</div>}
                {item.word_count != null && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.word_count} 字</div>}
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>归档于 {formatDate(item.archived_at)}</div>
                <button
                  onClick={() => void restore(meta.type, item.id)}
                  disabled={busy === item.id}
                  style={{ marginTop: 'auto', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--primary-color)', background: 'transparent', color: 'var(--text-main)', cursor: busy === item.id ? 'wait' : 'pointer', fontSize: '11px' }}
                >
                  {busy === item.id ? '恢复中…' : '恢复并解除封存'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
