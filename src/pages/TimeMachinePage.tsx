import { useEffect, useState } from 'react'

type Snapshot = {
  id: string
  world_id: string
  label: string
  entity_count: number
  created_at: string
}

const API = 'http://127.0.0.1:8000/api'

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN')
}

export default function TimeMachinePage({ worldId, worldName }: { worldId: string; worldName: string }) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [label, setLabel] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    if (!worldId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`${API}/worlds/${worldId}/snapshots`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setSnapshots(await res.json())
      setError('')
    } catch (err: any) {
      setError(String(err.message || err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [worldId])

  const create = async () => {
    if (!worldId) return
    setBusy('create')
    try {
      const res = await fetch(`${API}/worlds/${worldId}/snapshots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: label.trim() }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.detail || `HTTP ${res.status}`)
      setLabel('')
      await load()
    } catch (err: any) {
      setError(String(err.message || err))
    } finally {
      setBusy('')
    }
  }

  const restore = async (snapshot: Snapshot) => {
    if (!window.confirm(`确定把整个世界回滚到「${snapshot.label}」吗？\n\n当前所有人物、事件、关系、章节、推演记录都会被替换。回滚前建议先再打一个快照。`)) return
    setBusy(snapshot.id)
    try {
      const res = await fetch(`${API}/worlds/${worldId}/snapshots/${snapshot.id}/restore`, { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.detail || `HTTP ${res.status}`)
      alert('回滚完成，页面将重新加载。')
      window.location.reload()
    } catch (err: any) {
      setError(String(err.message || err))
      setBusy('')
    }
  }

  const remove = async (snapshot: Snapshot) => {
    if (!window.confirm(`删除快照「${snapshot.label}」？只删除快照本身，不影响当前世界。`)) return
    setBusy(snapshot.id)
    try {
      const res = await fetch(`${API}/worlds/${worldId}/snapshots/${snapshot.id}`, { method: 'DELETE' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.detail || `HTTP ${res.status}`)
      await load()
    } catch (err: any) {
      setError(String(err.message || err))
    } finally {
      setBusy('')
    }
  }

  if (!worldId) {
    return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>请先进入一个世界，再使用时光机。</div>
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <header style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '11px', letterSpacing: '0.16em', color: 'var(--text-muted)' }}>WORLD TIME MACHINE</div>
        <h1 style={{ margin: '6px 0 8px', fontSize: '26px', color: 'var(--text-main)' }}>时光机</h1>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.7 }}>
          给「{worldName || '当前世界'}」的整个世界打快照：人物、事件、关系、章节、推演、草稿、世界结构全部封存。一键回滚到任意时间点。
        </p>
      </header>

      <div className="glass-card" style={{ padding: '16px', marginBottom: '18px', display: 'flex', gap: '9px', flexWrap: 'wrap' }}>
        <input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="快照备注，例如：大战前夜 / 第三卷完结"
          style={{ flex: 1, minWidth: '220px', padding: '9px 11px', borderRadius: '8px', border: '1px solid var(--card-border)', background: 'rgba(128,128,128,0.08)', color: 'var(--text-main)', fontSize: '12px', outline: 'none' }}
        />
        <button
          onClick={() => void create()}
          disabled={busy === 'create'}
          style={{ padding: '9px 16px', borderRadius: '8px', border: '1px solid var(--primary-color)', background: 'var(--primary-color)', color: 'var(--primary-text)', fontSize: '12px', fontWeight: 700, cursor: busy === 'create' ? 'wait' : 'pointer' }}
        >
          {busy === 'create' ? '封存中…' : '给整个世界打快照'}
        </button>
      </div>

      {error && (
        <div style={{ marginBottom: '14px', padding: '10px 12px', borderRadius: '9px', border: '1px solid var(--danger-color)', color: 'var(--danger-color)', fontSize: '12px' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: '50px', textAlign: 'center', color: 'var(--text-muted)' }}>读取快照…</div>
      ) : snapshots.length === 0 ? (
        <div className="glass-card" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)', borderStyle: 'dashed' }}>
          还没有快照。建议在重大剧情转折前打一个。
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {snapshots.map((snapshot) => (
            <div key={snapshot.id} className="glass-card" style={{ padding: '16px 18px', display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>{snapshot.label}</div>
                <div style={{ marginTop: '4px', fontSize: '10px', color: 'var(--text-muted)' }}>
                  {formatDate(snapshot.created_at)} · {snapshot.entity_count} 条数据
                </div>
              </div>
              <div style={{ display: 'flex', gap: '7px' }}>
                <button
                  onClick={() => void restore(snapshot)}
                  disabled={busy === snapshot.id}
                  style={{ padding: '7px 12px', borderRadius: '7px', border: '1px solid var(--primary-color)', background: 'rgba(128,128,128,0.08)', color: 'var(--text-main)', fontSize: '11px', cursor: busy === snapshot.id ? 'wait' : 'pointer' }}
                >
                  {busy === snapshot.id ? '回滚中…' : '回滚到此时'}
                </button>
                <button
                  onClick={() => void remove(snapshot)}
                  disabled={busy === snapshot.id}
                  style={{ padding: '7px 10px', borderRadius: '7px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-muted)', fontSize: '11px', cursor: 'pointer' }}
                >
                  删除快照
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
