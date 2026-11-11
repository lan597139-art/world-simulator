import { useEffect, useMemo, useState } from 'react'
import * as api from '../api/personas'

export default function MemoryPage() {
  const [personas, setPersonas] = useState<api.Persona[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [memories, setMemories] = useState<api.PersonaMemory[]>([])
  const [threads, setThreads] = useState<api.PersonaThread[]>([])
  const [content, setContent] = useState('')
  const [importance, setImportance] = useState(0.6)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const selected = useMemo(() => personas.find((p) => p.id === selectedId), [personas, selectedId])

  const loadPersonas = async () => {
    const rows = await api.listPersonas('companion')
    setPersonas(rows)
    if (!selectedId && rows[0]) setSelectedId(rows[0].id)
  }
  useEffect(() => { void loadPersonas().catch((e) => setError(e.message)) }, [])

  const loadDetails = async () => {
    if (!selectedId) { setMemories([]); setThreads([]); return }
    try {
      const [mem, thr] = await Promise.all([
        api.listPersonaMemories(selectedId), api.listPersonaThreads(selectedId),
      ])
      setMemories(mem); setThreads(thr)
    } catch (e: any) { setError(e.message) }
  }
  useEffect(() => { void loadDetails() }, [selectedId])

  const add = async () => {
    if (!selectedId || !content.trim()) return
    setBusy(true); setError('')
    try {
      await api.createPersonaMemory(selectedId, content.trim(), importance)
      setContent(''); await loadDetails()
    } catch (e: any) { setError(e.message) } finally { setBusy(false) }
  }

  const remove = async (id: string) => {
    if (!selectedId || !window.confirm('删除这条人格记忆？')) return
    try { await api.deletePersonaMemory(selectedId, id); await loadDetails() }
    catch (e: any) { setError(e.message) }
  }

  const byThread = new Map(threads.map((thread) => [thread.id, thread.title || '独立会话']))

  return (
    <div style={{ padding: '1.5rem', maxWidth: 1120, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22 }}>记忆管理</h1>
        <p style={{ margin: '5px 0 0', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7 }}>
          长期记忆按个人 AI 人格隔离。这里只显示当前 AI 伴侣产品的人格记忆，不会读取其他产品或其他人的会话。
        </p>
      </div>
      {error && <div style={{ padding: 8, borderRadius: 7, background: 'rgba(239,68,68,.08)', color: 'var(--danger-color)', fontSize: 11 }}>{error}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '230px minmax(0,1fr)', gap: 12, alignItems: 'start' }}>
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {personas.map((persona) => (
            <button key={persona.id} type="button" onClick={() => setSelectedId(persona.id)} style={{
              textAlign: 'left', padding: 10, borderRadius: 9, cursor: 'pointer',
              border: `1px solid ${selectedId === persona.id ? 'var(--primary-color)' : 'var(--card-border)'}`,
              background: selectedId === persona.id ? 'color-mix(in srgb, var(--primary-color) 9%, var(--card-bg))' : 'var(--card-bg)',
              color: 'var(--text-main)',
            }}>
              <strong style={{ fontSize: 12 }}>{persona.name}</strong>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{persona.identity || '个人 AI 人格'}</div>
            </button>
          ))}
          {!personas.length && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>还没有个人 AI 人格，请先到「个人 AI 人格」创建。</div>}
        </aside>
        <main style={{ border: '1px solid var(--card-border)', borderRadius: 10, padding: 13, background: 'var(--card-bg)' }}>
          {selected ? (
            <>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <strong style={{ fontSize: 14 }}>{selected.name} · 独立记忆库</strong>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{memories.length} 条 · {threads.length} 个独立会话</span>
              </div>
              <div style={{ display: 'flex', gap: 7, marginTop: 10, flexWrap: 'wrap' }}>
                <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={2} placeholder="写入一条只属于这个人格的记忆…"
                  style={{ flex: 1, minWidth: 260, padding: 8, borderRadius: 7, border: '1px solid var(--card-border)', background: 'var(--bg-color)', color: 'var(--text-main)', fontSize: 12, resize: 'vertical' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 110 }}>
                  <label style={{ fontSize: 10, color: 'var(--text-muted)' }}>重要度 {importance.toFixed(1)}</label>
                  <input type="range" min={0} max={1} step={0.1} value={importance} onChange={(e) => setImportance(Number(e.target.value))} />
                  <button type="button" disabled={busy || !content.trim()} onClick={() => void add()} style={primaryBtn}>写入记忆</button>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 12 }}>
                {memories.map((memory) => (
                  <div key={memory.id} style={{ border: '1px solid var(--card-border)', borderRadius: 8, padding: 9 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 10, background: 'rgba(128,128,128,.12)', color: 'var(--text-muted)' }}>{memory.kind || 'episodic'}</span>
                      <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>重要度 {Number(memory.importance || 0).toFixed(1)}</span>
                      {memory.thread_id && <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>来源：{byThread.get(memory.thread_id) || '会话'}</span>}
                      <span style={{ flex: 1 }} />
                      <button type="button" onClick={() => void remove(memory.id)} style={{ ...smallBtn, color: 'var(--danger-color)' }}>删除</button>
                    </div>
                    <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{memory.content}</div>
                  </div>
                ))}
                {!memories.length && <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: 18, textAlign: 'center' }}>这个独立人格还没有长期记忆。会话记忆与人格记忆不会和其他人格混用。</div>}
              </div>
            </>
          ) : <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>选择左侧人格查看独立记忆。</div>}
        </main>
      </div>
    </div>
  )
}

const primaryBtn: React.CSSProperties = { padding: '6px 9px', borderRadius: 7, border: '1px solid var(--primary-color)', background: 'var(--primary-color)', color: 'var(--primary-text)', fontSize: 11, cursor: 'pointer' }
const smallBtn: React.CSSProperties = { padding: '3px 6px', borderRadius: 6, border: '1px solid var(--card-border)', background: 'transparent', fontSize: 10, cursor: 'pointer' }
