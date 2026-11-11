import { useEffect, useState } from 'react'
import * as api from '../api/informationSources'
import { API_ORIGIN } from '../api/config'

const TYPE_LABEL: Record<string, string> = {
  self_memory: '本人回忆', other_account: '他人叙述', document: '资料文献',
  evidence: '实物/记录证据', ai_inference: 'AI 推断',
}
const STATUS_LABEL: Record<string, string> = {
  confirmed: '已确认', unconfirmed: '待核实', inference: 'AI 推断 · 未确认',
}

export default function InformationSourcesPage({ worldId }: { worldId?: string }) {
  const [rows, setRows] = useState<api.InformationSource[]>([])
  const [characters, setCharacters] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [editingId, setEditingId] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [sourceType, setSourceType] = useState('self_memory')
  const [status, setStatus] = useState<'unconfirmed' | 'confirmed'>('unconfirmed')
  const [sourceDate, setSourceDate] = useState(new Date().toISOString().slice(0, 10))
  const [characterId, setCharacterId] = useState('')
  const [eventId, setEventId] = useState('')
  const [citation, setCitation] = useState('')
  const [confidence, setConfidence] = useState(0.5)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    try {
      const params: any = { product: 'diary' }
      if (filterType) params.source_type = filterType
      if (filterStatus) params.status = filterStatus
      setRows(await api.listInformationSources(params))
    } catch (e: any) { setError(e.message) }
  }
  useEffect(() => { void load() }, [filterType, filterStatus])
  useEffect(() => {
    fetch(`${API_ORIGIN}/api/characters`).then((r) => r.json()).then((data) => {
      setCharacters(Array.isArray(data) ? data.filter((c: any) => !worldId || c.world_id === worldId) : [])
    }).catch(() => undefined)
    fetch(`${API_ORIGIN}/api/events${worldId ? `?world_id=${worldId}` : ''}`).then((r) => r.json()).then((data) => {
      setEvents(Array.isArray(data) ? data : [])
    }).catch(() => undefined)
  }, [worldId])

  const resetForm = () => {
    setEditingId(''); setTitle(''); setContent(''); setSourceType('self_memory')
    setStatus('unconfirmed')
    setSourceDate(new Date().toISOString().slice(0, 10)); setCharacterId(''); setEventId('')
    setCitation(''); setConfidence(0.5)
  }

  const edit = (row: api.InformationSource) => {
    setEditingId(row.id); setTitle(row.title || ''); setContent(row.content || '')
    setSourceType(row.source_type); setStatus(row.status === 'confirmed' ? 'confirmed' : 'unconfirmed')
    setSourceDate(row.source_date || new Date().toISOString().slice(0, 10))
    setCharacterId(row.character_id || ''); setEventId(row.event_id || '')
    setCitation(row.citation || ''); setConfidence(Number(row.confidence ?? 0.5))
  }

  const save = async () => {
    if (!title.trim() && !content.trim()) return
    setBusy(true); setError('')
    try {
      const payload: Record<string, unknown> = {
        product_key: 'diary', title, content, source_type: sourceType, source_date: sourceDate,
        character_id: characterId || undefined, event_id: eventId || undefined,
        citation, confidence,
        ...(sourceType === 'ai_inference' ? {} : { status }),
      }
      if (editingId) await api.updateInformationSource(editingId, payload)
      else await api.createInformationSource(payload)
      resetForm(); await load()
    } catch (e: any) { setError(e.message) } finally { setBusy(false) }
  }

  const confirm = async (row: api.InformationSource) => {
    if (!window.confirm('这是 AI 推断，确认把它转为已确认事实？\n\n确认后它才会被传记/整理视为事实；不会自动改写来源原文。')) return
    try { await api.confirmInformationSource(row.id); await load() }
    catch (e: any) { setError(e.message) }
  }

  const remove = async (row: api.InformationSource) => {
    if (!window.confirm(`删除来源「${row.title || '未命名'}」？`)) return
    try { await api.deleteInformationSource(row.id); await load() }
    catch (e: any) { setError(e.message) }
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: 1180, margin: '0 auto' }}>
      <h1 style={{ margin: 0, fontSize: 22 }}>信息来源管理</h1>
      <p style={{ margin: '5px 0 0', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7 }}>
        给本人回忆、他人叙述、资料证据和 AI 推断打来源标签。AI 推断默认不是事实，必须由你显式确认后才能转为已确认。
      </p>
      {error && <div style={{ marginTop: 9, padding: 8, borderRadius: 7, background: 'rgba(239,68,68,.08)', color: 'var(--danger-color)', fontSize: 11 }}>{error}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '360px minmax(0,1fr)', gap: 12, marginTop: 12, alignItems: 'start' }}>
        <section style={card}>
          <strong style={{ fontSize: 13 }}>{editingId ? '编辑来源' : '新增来源'}</strong>
          <div style={{ display: 'grid', gap: 7, marginTop: 9 }}>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="标题，例如：外婆回忆的旧事" style={input} />
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={4} placeholder="来源内容 / 原始叙述 / 证据摘录" style={{ ...input, resize: 'vertical' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
              <label style={field}>来源类型
                <select value={sourceType} onChange={(e) => setSourceType(e.target.value)} style={input}>
                  {Object.entries(TYPE_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
              </label>
              <label style={field}>来源日期
                <input type="date" value={sourceDate} onChange={(e) => setSourceDate(e.target.value)} style={input} />
              </label>
            </div>
            {sourceType !== 'ai_inference' && (
              <label style={field}>核实状态
                <select value={status} onChange={(e) => setStatus(e.target.value as 'unconfirmed' | 'confirmed')} style={input}>
                  <option value="unconfirmed">待核实</option>
                  <option value="confirmed">已确认</option>
                </select>
              </label>
            )}
            <label style={field}>关联人物
              <select value={characterId} onChange={(e) => setCharacterId(e.target.value)} style={input}>
                <option value="">不关联</option>
                {characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label style={field}>关联人生经历
              <select value={eventId} onChange={(e) => setEventId(e.target.value)} style={input}>
                <option value="">不关联</option>
                {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
              </select>
            </label>
            <label style={field}>出处/引用
              <input value={citation} onChange={(e) => setCitation(e.target.value)} placeholder="页码、录音、照片背面、聊天记录…" style={input} />
            </label>
            <label style={field}>可信度 {confidence.toFixed(1)}
              <input type="range" min={0} max={1} step={0.1} value={confidence} onChange={(e) => setConfidence(Number(e.target.value))} />
            </label>
            {sourceType === 'ai_inference' && <div style={{ fontSize: 10, color: 'var(--warning-color, #b45309)', lineHeight: 1.6, padding: 6, borderRadius: 6, background: 'rgba(245,158,11,.08)' }}>AI 推断会固定为「未确认」；保存后需在右侧显式确认，不能自动成为事实。</div>}
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" onClick={() => void save()} disabled={busy} style={primaryBtn}>{busy ? '保存中…' : '保存来源'}</button>
              {editingId && <button type="button" onClick={resetForm} style={smallBtn}>取消编辑</button>}
            </div>
          </div>
        </section>
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ ...input, width: 'auto' }}>
              <option value="">全部来源类型</option>
              {Object.entries(TYPE_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ ...input, width: 'auto' }}>
              <option value="">全部状态</option>
              {Object.entries(STATUS_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
            <span style={{ alignSelf: 'center', fontSize: 10, color: 'var(--text-muted)' }}>{rows.length} 条来源</span>
          </div>
          {rows.map((row) => (
            <article key={row.id} style={card}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <strong style={{ fontSize: 12.5 }}>{row.title || '未命名来源'}</strong>
                <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 9, background: 'rgba(128,128,128,.12)' }}>{row.source_type_label || TYPE_LABEL[row.source_type]}</span>
                <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 9, border: `1px solid ${row.status === 'confirmed' ? 'var(--primary-color)' : row.status === 'inference' ? 'var(--warning-color,#b45309)' : 'var(--card-border)'}`, color: row.status === 'confirmed' ? 'var(--primary-color)' : row.status === 'inference' ? 'var(--warning-color,#b45309)' : 'var(--text-muted)' }}>{STATUS_LABEL[row.status]}</span>
                <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{row.source_date} · 可信度 {Number(row.confidence).toFixed(1)}</span>
                <span style={{ flex: 1 }} />
                <button type="button" style={smallBtn} onClick={() => edit(row)}>编辑</button>
                {row.source_type === 'ai_inference' && row.status !== 'confirmed' && <button type="button" style={smallBtn} onClick={() => void confirm(row)}>确认推断</button>}
                <button type="button" style={{ ...smallBtn, color: 'var(--danger-color)' }} onClick={() => void remove(row)}>删除</button>
              </div>
              {row.content && <p style={{ margin: '7px 0 0', fontSize: 11.5, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{row.content}</p>}
              {row.citation && <div style={{ marginTop: 5, fontSize: 10, color: 'var(--text-muted)' }}>出处：{row.citation}</div>}
            </article>
          ))}
          {!rows.length && <div style={{ padding: 30, textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', border: '1px dashed var(--card-border)', borderRadius: 9 }}>还没有来源记录。先记录本人回忆或他人叙述，再逐条核实。</div>}
        </section>
      </div>
    </div>
  )
}

const card: React.CSSProperties = { border: '1px solid var(--card-border)', borderRadius: 10, padding: 12, background: 'var(--card-bg)' }
const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '7px 8px', borderRadius: 6, border: '1px solid var(--card-border)', background: 'var(--bg-color)', color: 'var(--text-main)', fontSize: 11 }
const field: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 10, color: 'var(--text-muted)' }
const primaryBtn: React.CSSProperties = { padding: '7px 10px', borderRadius: 6, border: '1px solid var(--primary-color)', background: 'var(--primary-color)', color: 'var(--primary-text)', fontSize: 11, cursor: 'pointer' }
const smallBtn: React.CSSProperties = { padding: '4px 7px', borderRadius: 6, border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)', fontSize: 10, cursor: 'pointer' }
