import { useEffect, useState } from 'react'
import * as api from '../api/yunbao'
import type { YunbaoProfile } from '../api/yunbao'
import type { PersonaMemory, PersonaThread } from '../api/personas'

export default function MemoryPage() {
  const [profile, setProfile] = useState<YunbaoProfile | null>(null)
  const [memories, setMemories] = useState<PersonaMemory[]>([])
  const [threads, setThreads] = useState<PersonaThread[]>([])
  const [content, setContent] = useState('')
  const [importance, setImportance] = useState(0.6)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    try {
      const [persona, mem, thr] = await Promise.all([
        api.getYunbao(), api.listYunbaoMemories(), api.listYunbaoThreads(),
      ])
      setProfile(persona); setMemories(mem); setThreads(thr)
    } catch (e: any) { setError(String(e?.message || e)) }
  }
  useEffect(() => { void load() }, [])

  const add = async () => {
    if (!content.trim()) return
    setBusy(true); setError('')
    try {
      await api.createYunbaoMemory(content.trim(), importance)
      setContent(''); await load()
    } catch (e: any) { setError(String(e?.message || e)) } finally { setBusy(false) }
  }

  const remove = async (id: string) => {
    if (!window.confirm('删除这条云宝记忆？')) return
    try { await api.deleteYunbaoMemory(id); await load() }
    catch (e: any) { setError(String(e?.message || e)) }
  }

  const byThread = new Map(threads.map((thread) => [thread.id, thread.title || '独立会话']))

  return (
    <div style={{ padding: '1.5rem', maxWidth: 1120, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22 }}>记忆管理</h1>
        <p style={{ margin: '5px 0 0', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7 }}>
          云宝的长期记忆独立于世界人物、NPC 和其他 AI 人格。当前是单一人格记忆库，不按产品复制。
        </p>
      </div>
      {error && <div style={{ padding: 8, borderRadius: 7, background: 'rgba(239,68,68,.08)', color: 'var(--danger-color)', fontSize: 11 }}>{error}</div>}
      <main style={{ border: '1px solid var(--card-border)', borderRadius: 12, padding: 15, background: 'var(--card-bg)' }}>
        {profile ? (
          <>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 15 }}>{profile.name} · 独立记忆库</strong>
              <span style={badge}>{profile.can_edit ? '所有者可维护' : '只读'}</span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{memories.length} 条 · {threads.length} 个独立会话</span>
            </div>
            {profile.can_edit ? (
              <div style={{ display: 'flex', gap: 7, marginTop: 12, flexWrap: 'wrap' }}>
                <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={2} placeholder="写入一条只属于云宝的记忆…"
                  style={{ flex: 1, minWidth: 260, padding: 8, borderRadius: 7, border: '1px solid var(--card-border)', background: 'var(--bg-color)', color: 'var(--text-main)', fontSize: 12, resize: 'vertical' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 110 }}>
                  <label style={{ fontSize: 10, color: 'var(--text-muted)' }}>重要度 {importance.toFixed(1)}</label>
                  <input type="range" min={0} max={1} step={0.1} value={importance} onChange={(e) => setImportance(Number(e.target.value))} />
                  <button type="button" disabled={busy || !content.trim()} onClick={() => void add()} style={primaryBtn}>写入记忆</button>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 8, background: 'rgba(128,128,128,.07)', fontSize: 10.5, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                普通用户可查看云宝记忆，但不能写入或删除。人格数据与运行配置由系统所有者维护。
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 12 }}>
              {memories.map((memory) => (
                <div key={memory.id} style={{ border: '1px solid var(--card-border)', borderRadius: 8, padding: 9 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={badge}>{memory.kind || 'episodic'}</span>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>重要度 {Number(memory.importance || 0).toFixed(1)}</span>
                    {memory.thread_id && <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>来源：{byThread.get(memory.thread_id) || '会话'}</span>}
                    <span style={{ flex: 1 }} />
                    {profile.can_edit && <button type="button" onClick={() => void remove(memory.id)} style={{ ...smallBtn, color: 'var(--danger-color)' }}>删除</button>}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{memory.content}</div>
                </div>
              ))}
              {!memories.length && <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: 18, textAlign: 'center' }}>云宝还没有长期记忆。会话与记忆不会和其他人格混用。</div>}
            </div>
          </>
        ) : <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>正在读取云宝记忆…</div>}
      </main>
    </div>
  )
}

const primaryBtn: React.CSSProperties = { padding: '6px 9px', borderRadius: 7, border: '1px solid var(--primary-color)', background: 'var(--primary-color)', color: 'var(--primary-text)', fontSize: 11, cursor: 'pointer' }
const smallBtn: React.CSSProperties = { padding: '3px 6px', borderRadius: 6, border: '1px solid var(--card-border)', background: 'transparent', fontSize: 10, cursor: 'pointer' }
const badge: React.CSSProperties = { fontSize: 9, padding: '2px 6px', borderRadius: 10, background: 'rgba(128,128,128,.12)', color: 'var(--text-muted)' }
