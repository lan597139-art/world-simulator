import { useEffect, useState } from 'react'
import { API_ORIGIN } from '../api/config'
import * as api from '../api/storyThreads'

type Lite = { id: string; name: string }

const KINDS: Record<string, string> = { main: '主线', side: '支线', copy: '副本', shadow: '影线', ensemble: '群像' }

export default function StoryThreadsModal({ storyId, worldId, onClose }: { storyId: string; worldId: string; onClose: () => void }) {
  const [threads, setThreads] = useState<api.StoryThread[]>([])
  const [edges, setEdges] = useState<api.ThreadEdge[]>([])
  const [characters, setCharacters] = useState<Lite[]>([])
  const [events, setEvents] = useState<Lite[]>([])
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState('main')
  const [character, setCharacter] = useState('')
  const [eventPick, setEventPick] = useState<Record<string, string>>({})
  const [edgeFrom, setEdgeFrom] = useState('')
  const [edgeTo, setEdgeTo] = useState('')
  const [edgeType, setEdgeType] = useState('impact')
  const [busy, setBusy] = useState(false)
  const [log, setLog] = useState('')

  const load = async () => {
    try {
      const [threadRows, edgeRows] = await Promise.all([api.listThreads(storyId), api.listThreadEdges(storyId)])
      setThreads(threadRows); setEdges(edgeRows)
    } catch (error: any) { setLog(`❌ ${error.message || error}`) }
  }

  useEffect(() => {
    void load()
    fetch(`${API_ORIGIN}/api/characters?world_id=${worldId}`).then(r => r.json()).then(setCharacters).catch(() => undefined)
    fetch(`${API_ORIGIN}/api/events?world_id=${worldId}`).then(r => r.json()).then(setEvents).catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyId, worldId])

  const run = async (fn: () => Promise<unknown>, message: string) => {
    setBusy(true)
    try { await fn(); await load(); setLog(message) }
    catch (error: any) { setLog(`❌ ${error.message || error}`) }
    finally { setBusy(false) }
  }

  const addThread = () => {
    if (!title.trim()) return
    void run(async () => {
      await api.createThread(storyId, { title: title.trim(), kind, character_id: character || undefined })
      setTitle(''); setCharacter('')
    }, '人物线已创建')
  }

  const btn: React.CSSProperties = { padding: '5px 9px', borderRadius: '5px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer', fontSize: '11px' }
  const input: React.CSSProperties = { padding: '6px 8px', borderRadius: '5px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)', fontSize: '12px' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ width: '780px', maxWidth: '100%', maxHeight: '86vh', overflowY: 'auto', background: 'var(--bg-color)', border: '1px solid var(--card-border)', borderRadius: '12px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h2 style={{ margin: 0, fontSize: '17px', color: 'var(--text-main)' }}>人物线与关系</h2>
          <div style={{ flex: 1 }} />
          <button style={btn} onClick={onClose}>关闭</button>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>配角可以有独立主线；事件只引用不复制；一条线调整不影响事件本身。</div>

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="人物线名，如：配角A主线" style={{ ...input, flex: 1, minWidth: '160px' }} />
          <select value={kind} onChange={(e) => setKind(e.target.value)} style={input}>
            {Object.entries(KINDS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select value={character} onChange={(e) => setCharacter(e.target.value)} style={input}>
            <option value="">不绑定人物（群像）</option>
            {characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button style={btn} disabled={busy || !title.trim()} onClick={addThread}>+ 人物线</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '10px' }}>
          {threads.map((thread) => (
            <div key={thread.id} style={{ border: '1px solid var(--card-border)', borderRadius: '8px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <strong style={{ fontSize: '13px', color: 'var(--text-main)' }}>{thread.title}</strong>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{KINDS[thread.kind] || thread.kind}{thread.character_name ? ` · ${thread.character_name}` : ''}</span>
                <span style={{ flex: 1 }} />
                <button style={{ ...btn, color: 'var(--danger-color)' }} disabled={busy}
                  onClick={() => void run(() => api.deleteThread(thread.id), '人物线已删除')}>删除</button>
              </div>
              {thread.events.map((link) => (
                <div key={link.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-main)', background: 'rgba(128,128,128,0.06)', borderRadius: '5px', padding: '5px' }}>
                  <span style={{ flex: 1 }}>{link.event_name}</span>
                  <button style={{ ...btn, padding: '1px 5px', color: 'var(--danger-color)' }} disabled={busy}
                    onClick={() => void run(() => api.detachThreadEvent(link.id), '事件已移出人物线')}>×</button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: '5px' }}>
                <select value={eventPick[thread.id] || ''} onChange={(e) => setEventPick((prev) => ({ ...prev, [thread.id]: e.target.value }))} style={{ ...input, flex: 1 }}>
                  <option value="">选择事件</option>
                  {events.filter((ev) => !thread.events.some((link) => link.event_id === ev.id)).map((ev) => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
                </select>
                <button style={btn} disabled={busy || !eventPick[thread.id]}
                  onClick={() => void run(async () => { await api.attachThreadEvent(thread.id, eventPick[thread.id]); setEventPick((prev) => ({ ...prev, [thread.id]: '' })) }, '事件已挂入人物线')}>挂入</button>
              </div>
            </div>
          ))}
        </div>

        <div style={{ borderTop: '1px dashed var(--card-border)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <strong style={{ fontSize: '12px', color: 'var(--text-main)' }}>人物线关系（DAG）</strong>
          {edges.map((edge) => (
            <div key={edge.id} style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {threads.find((t) => t.id === edge.from_thread_id)?.title || edge.from_thread_id.slice(0, 6)}
              {' → '}
              {threads.find((t) => t.id === edge.to_thread_id)?.title || edge.to_thread_id.slice(0, 6)}
              {' · '}{edge.edge_type}
            </div>
          ))}
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
            <select value={edgeFrom} onChange={(e) => setEdgeFrom(e.target.value)} style={input}>
              <option value="">起点人物线</option>
              {threads.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
            <select value={edgeTo} onChange={(e) => setEdgeTo(e.target.value)} style={input}>
              <option value="">终点人物线</option>
              {threads.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
            <select value={edgeType} onChange={(e) => setEdgeType(e.target.value)} style={input}>
              <option value="impact">影响</option>
              <option value="converge">汇合</option>
              <option value="fork">分叉</option>
            </select>
            <button style={btn} disabled={busy || !edgeFrom || !edgeTo}
              onClick={() => void run(async () => { await api.createThreadEdge(storyId, { from_thread_id: edgeFrom, to_thread_id: edgeTo, edge_type: edgeType }); setEdgeFrom(''); setEdgeTo('') }, '关系已创建')}>+ 关系</button>
          </div>
        </div>
        {log && <div style={{ fontSize: '11px', color: log.startsWith('❌') ? 'var(--danger-color)' : 'var(--text-muted)' }}>{log}</div>}
      </div>
    </div>
  )
}
