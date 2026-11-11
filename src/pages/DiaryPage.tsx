import { useEffect, useState } from 'react'
import * as api from '../api/diary'

const SOURCE_LABEL: Record<string, string> = {
  user: '手写', chat: '聊天摘录', event: '事件', branch: '分支', import: '导入', ai_draft: 'AI 草案',
  self_memory: '本人回忆', other_account: '他人叙述', evidence: '资料/证据', ai_inference: 'AI 推断 · 待核实',
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

export default function DiaryPage({
  product = 'diary', worldId = '', onOpenSources,
}: { product?: string; worldId?: string; onOpenSources?: () => void }) {
  const [entries, setEntries] = useState<api.DiaryEntry[]>([])
  const [sourceFilter, setSourceFilter] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [editing, setEditing] = useState(false)
  const [date, setDate] = useState(today())
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [mood, setMood] = useState('')
  const [tags, setTags] = useState('')
  const [busy, setBusy] = useState(false)
  const [log, setLog] = useState('')

  const load = async () => {
    try {
      setEntries(await api.listDiary({ product, source_type: sourceFilter || undefined }))
    } catch (error: any) { setLog(`❌ ${error.message || error}`) }
  }

  useEffect(() => { void load() }, [sourceFilter, product])

  const selected = entries.find((entry) => entry.id === selectedId)

  const startNew = () => {
    setEditing(true); setSelectedId(''); setDate(today()); setTitle(''); setContent('')
    setMood(''); setTags(''); setLog('')
  }

  const startEdit = (entry: api.DiaryEntry) => {
    setEditing(true); setSelectedId(entry.id); setDate(entry.entry_date); setTitle(entry.title)
    setContent(entry.content); setMood(entry.mood); setTags((entry.tags || []).join(', '))
    setLog('')
  }

  const save = async () => {
    if (!content.trim()) return
    setBusy(true)
    try {
      const payload = {
        entry_date: date, title, content, mood,
        tags: tags.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean),
        world_id: worldId || undefined,
      }
      if (selectedId) await api.updateDiary(selectedId, payload)
      else await api.createDiary({ ...payload, source_type: 'self_memory', product_key: product })
      setEditing(false); setLog('已保存')
      await load()
    } catch (error: any) { setLog(`❌ ${error.message || error}`) }
    finally { setBusy(false) }
  }

  const remove = async () => {
    if (!selectedId) return
    if (!window.confirm('删除这篇日记？')) return
    setBusy(true)
    try { await api.deleteDiary(selectedId); setEditing(false); setSelectedId(''); await load(); setLog('已删除') }
    catch (error: any) { setLog(`❌ ${error.message || error}`) }
    finally { setBusy(false) }
  }

  const input: React.CSSProperties = {
    width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--card-border)',
    background: 'transparent', color: 'var(--text-main)', fontSize: '13px', boxSizing: 'border-box',
  }
  const btn: React.CSSProperties = {
    padding: '7px 12px', borderRadius: '6px', border: '1px solid var(--card-border)',
    background: 'transparent', color: 'var(--text-main)', cursor: 'pointer', fontSize: '12px',
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '22px', color: 'var(--text-main)' }}>日记与传记</h1>
          <p style={{ margin: '5px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
            日记独立于世界；传记可从人物页生成并列出引用来源。每条记录保留来源标签。
          </p>
        </div>
        <div style={{ flex: 1 }} />
        <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} style={{ ...input, width: '130px' }}>
          <option value="">全部来源</option>
          {Object.entries(SOURCE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <button style={btn} onClick={onOpenSources}>信息来源管理</button>
        <button style={btn} onClick={startNew}>+ 写日记</button>
      </div>

      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        <div className="glass-card" style={{ width: '310px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '7px', maxHeight: 'calc(100vh - 210px)', overflowY: 'auto' }}>
          {entries.length === 0 && <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '12px' }}>还没有日记。日记不需要先创建世界。</div>}
          {entries.map((entry) => (
            <button key={entry.id} type="button" onClick={() => startEdit(entry)}
              style={{
                textAlign: 'left', padding: '9px', borderRadius: '7px', cursor: 'pointer',
                border: `1px solid ${entry.id === selectedId ? 'var(--primary-color)' : 'var(--card-border)'}`,
                background: entry.id === selectedId ? 'rgba(128,128,128,0.1)' : 'transparent',
                color: 'var(--text-main)', display: 'flex', flexDirection: 'column', gap: '4px',
              }}>
              <span style={{ display: 'flex', justifyContent: 'space-between', gap: '6px' }}>
                <strong style={{ fontSize: '12px' }}>{entry.title || '无题'}</strong>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{entry.entry_date}</span>
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '260px' }}>
                {entry.content}
              </span>
              <span style={{ fontSize: '9px', color: 'var(--primary-color)' }}>{SOURCE_LABEL[entry.source_type] || entry.source_type}</span>
            </button>
          ))}
        </div>

        <div className="glass-card" style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '300px' }}>
          {editing ? (
            <>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input value={date} onChange={(e) => setDate(e.target.value)} type="date" style={{ ...input, width: '150px' }} />
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="标题（可选）" style={{ ...input, flex: 1 }} />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input value={mood} onChange={(e) => setMood(e.target.value)} placeholder="心情（可选）" style={{ ...input, flex: 1 }} />
                <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="标签，逗号分隔" style={{ ...input, flex: 2 }} />
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                本条日记会归入「日记与传记」独立数据空间；来源可在「信息来源管理」中逐条核实，AI 推断不会自动成为事实。
              </div>
              <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="今天发生了什么？"
                style={{ ...input, minHeight: '220px', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.7 }} />
              <div style={{ display: 'flex', gap: '7px' }}>
                <button style={{ ...btn, background: 'var(--text-main)', color: 'var(--bg-color)' }} disabled={busy || !content.trim()} onClick={() => void save()}>保存</button>
                <button style={btn} onClick={() => setEditing(false)}>取消</button>
                {selectedId && <button style={{ ...btn, color: 'var(--danger-color)' }} disabled={busy} onClick={() => void remove()}>删除</button>}
                <div style={{ flex: 1 }} />
                {selected && <span style={{ fontSize: '10px', color: 'var(--text-muted)', alignSelf: 'center' }}>来源：{SOURCE_LABEL[selected.source_type] || selected.source_type}</span>}
              </div>
            </>
          ) : (
            <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.9 }}>
              <div style={{ fontSize: '30px', opacity: 0.5 }}>✎</div>
              {selected ? (
                <>
                  <h3 style={{ color: 'var(--text-main)', margin: '8px 0' }}>{selected.title || '无题'}</h3>
                  <div style={{ fontSize: '11px' }}>{selected.entry_date} · {SOURCE_LABEL[selected.source_type]}</div>
                  <p style={{ color: 'var(--text-main)', whiteSpace: 'pre-wrap', textAlign: 'left', maxWidth: '560px', margin: '16px auto', lineHeight: 1.8 }}>{selected.content}</p>
                  <button style={btn} onClick={() => startEdit(selected)}>编辑</button>
                </>
              ) : (
                <div>选择左侧日记，或点击「写日记」。<br />传记在人物页生成，基于事件、经历与日记，并列出文档级引用来源。</div>
              )}
            </div>
          )}
          {log && <div style={{ fontSize: '11px', color: log.startsWith('❌') ? 'var(--danger-color)' : 'var(--text-muted)' }}>{log}</div>}
        </div>
      </div>
    </div>
  )
}
