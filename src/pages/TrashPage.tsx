import { useEffect, useState } from 'react'

type TrashItem = {
  id: string
  entity_type: string
  entity_type_label: string
  entity_id: string
  name: string
  world_id: string
  world_name: string
  deleted_at: string
}

const API = 'http://127.0.0.1:8000/api'

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN')
}

export default function TrashPage() {
  const [items, setItems] = useState<TrashItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/trash`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setItems(await res.json())
      setError('')
    } catch (err: any) {
      setError(String(err.message || err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const restore = async (id: string) => {
    setBusy(id)
    try {
      const res = await fetch(`${API}/trash/${id}/restore`, { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.detail || `HTTP ${res.status}`)
      await load()
    } catch (err: any) {
      setError(String(err.message || err))
    } finally {
      setBusy('')
    }
  }

  const discard = async (id: string) => {
    if (!window.confirm('彻底丢弃这条回收站记录？此操作不可恢复。')) return
    setBusy(id)
    try {
      const res = await fetch(`${API}/trash/${id}`, { method: 'DELETE' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.detail || `HTTP ${res.status}`)
      await load()
    } catch (err: any) {
      setError(String(err.message || err))
    } finally {
      setBusy('')
    }
  }

  const empty = async () => {
    if (!window.confirm(`确定清空回收站中的 ${items.length} 条记录？此操作不可恢复。`)) return
    setBusy('all')
    try {
      const res = await fetch(`${API}/trash`, { method: 'DELETE' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.detail || `HTTP ${res.status}`)
      await load()
    } catch (err: any) {
      setError(String(err.message || err))
    } finally {
      setBusy('')
    }
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1100px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '11px', letterSpacing: '0.16em', color: 'var(--text-muted)' }}>GLOBAL RECYCLE BIN</div>
          <h1 style={{ margin: '6px 0 8px', fontSize: '26px', color: 'var(--text-main)' }}>全局回收站</h1>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.7 }}>
            删除的人物、世界、章节、地点、事件等会先放进这里。随时可以复原，避免手滑。
          </p>
        </div>
        {items.length > 0 && (
          <button
            onClick={() => void empty()}
            disabled={busy === 'all'}
            style={{ padding: '9px 14px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.35)', background: 'rgba(239,68,68,0.08)', color: 'var(--danger-color)', fontSize: '11px', cursor: busy === 'all' ? 'wait' : 'pointer' }}
          >
            {busy === 'all' ? '清空中…' : `清空回收站（${items.length}）`}
          </button>
        )}
      </header>

      {error && (
        <div style={{ marginBottom: '14px', padding: '10px 12px', borderRadius: '9px', border: '1px solid var(--danger-color)', color: 'var(--danger-color)', fontSize: '12px' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: '50px', textAlign: 'center', color: 'var(--text-muted)' }}>加载回收站…</div>
      ) : items.length === 0 ? (
        <div className="glass-card" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)', borderStyle: 'dashed' }}>
          回收站是空的。
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {items.map((item) => (
            <div key={item.id} className="glass-card" style={{ padding: '15px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
              <div style={{ minWidth: '200px', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: '14px', color: 'var(--text-main)' }}>{item.name}</strong>
                  <span style={{ padding: '2px 7px', borderRadius: '20px', background: 'rgba(128,128,128,0.14)', color: 'var(--text-muted)', fontSize: '9px' }}>{item.entity_type_label}</span>
                </div>
                <div style={{ marginTop: '4px', fontSize: '10px', color: 'var(--text-muted)' }}>
                  {item.world_name ? `所属世界：${item.world_name} · ` : ''}删除于 {formatDate(item.deleted_at)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '7px' }}>
                <button
                  onClick={() => void restore(item.id)}
                  disabled={busy === item.id}
                  style={{ padding: '7px 11px', borderRadius: '7px', border: '1px solid var(--primary-color)', background: 'transparent', color: 'var(--text-main)', fontSize: '11px', cursor: busy === item.id ? 'wait' : 'pointer' }}
                >
                  {busy === item.id ? '恢复中…' : '恢复'}
                </button>
                <button
                  onClick={() => void discard(item.id)}
                  disabled={busy === item.id}
                  style={{ padding: '7px 11px', borderRadius: '7px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-muted)', fontSize: '11px', cursor: 'pointer' }}
                >
                  彻底丢弃
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
