import { useEffect, useState } from 'react'

type TimelineItem = {
  kind: string
  time?: string
  title?: string
  description?: string
  impact?: string
  polarity?: string
  intensity?: string
  actions?: { engine?: string; action?: string; status?: string }[]
  chapters?: string[]
}

type BiographyData = {
  character: { id: string; name: string; basic_profile: Record<string, any>; archived: boolean }
  timeline: TimelineItem[]
  relationships: { other_name: string; other_type: string; relation_type: string; quadrant?: string; description?: string }[]
  stats: { events: number; life_entries: number; growth_entries: number; simulations: number }
  latest: { id: string; title: string; content: string; engine: string; citations?: Citation[]; created_at: string } | null
  citations?: Citation[]
  ai_configured: boolean
}

type Citation = {
  kind: string
  id: string
  title: string
  story_time?: string
  source_type?: string
}

const API = 'http://127.0.0.1:8000/api'

const kindLabel: Record<string, string> = {
  event: '世界事件',
  life: '生平经历',
  growth: '成长校准',
  diary: '日记',
}

export default function CharacterBiographyModal({
  characterId,
  fallbackName,
  onClose,
}: {
  characterId: string
  fallbackName?: string
  onClose: () => void
}) {
  const [data, setData] = useState<BiographyData | null>(null)
  const [tab, setTab] = useState<'timeline' | 'biography'>('timeline')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/characters/${characterId}/biography`)
      const body = await res.json()
      if (!res.ok) throw new Error(body.detail || `HTTP ${res.status}`)
      setData(body)
      setDraft(body.latest?.content || '')
      setError('')
    } catch (err: any) {
      setError(String(err.message || err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [characterId])

  const generate = async () => {
    setGenerating(true)
    setError('')
    try {
      const res = await fetch(`${API}/characters/${characterId}/biography/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.detail || `HTTP ${res.status}`)
      setData((prev) => prev ? { ...prev, latest: body } : prev)
      setDraft(body.content || '')
      setEditing(false)
      setTab('biography')
    } catch (err: any) {
      setError(String(err.message || err))
    } finally {
      setGenerating(false)
    }
  }

  const save = async () => {
    if (!draft.trim()) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`${API}/characters/${characterId}/biography`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: draft, title: data?.latest?.title || `《${data?.character.name || fallbackName || '人物'}·生平自传》` }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.detail || `HTTP ${res.status}`)
      setData((prev) => prev ? { ...prev, latest: { ...body, created_at: body.created_at } } : prev)
      setEditing(false)
    } catch (err: any) {
      setError(String(err.message || err))
    } finally {
      setSaving(false)
    }
  }

  const name = data?.character.name || fallbackName || '人物'

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '18px' }}>
      <div
        onClick={(event) => event.stopPropagation()}
        style={{ width: '100%', maxWidth: '900px', maxHeight: '92vh', overflow: 'hidden', borderRadius: '16px', border: '1px solid var(--card-border)', background: 'var(--bg-color)', color: 'var(--text-main)', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 90px rgba(0,0,0,0.3)' }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '10px', letterSpacing: '0.16em', color: 'var(--text-muted)' }}>CHARACTER BIOGRAPHY</div>
            <h2 style={{ margin: '4px 0 0', fontSize: '21px' }}>{name} · 传记与履历</h2>
            {data && (
              <div style={{ marginTop: '5px', fontSize: '10px', color: 'var(--text-muted)' }}>
                事件 {data.stats.events} · 生平 {data.stats.life_entries} · 成长 {data.stats.growth_entries} · 推演 {data.stats.simulations}
                {data.character.archived ? ' · 已归档' : ''}
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', fontSize: '22px', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            {(['timeline', 'biography'] as const).map((key) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                style={{ padding: '6px 12px', borderRadius: '7px', border: `1px solid ${tab === key ? 'var(--primary-color)' : 'var(--card-border)'}`, background: tab === key ? 'var(--primary-color)' : 'transparent', color: tab === key ? 'var(--primary-text)' : 'var(--text-muted)', fontSize: '11px', cursor: 'pointer' }}
              >
                {key === 'timeline' ? '生平履历' : '自传'}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '7px' }}>
            <button
              onClick={() => void generate()}
              disabled={generating || loading}
              style={{ padding: '7px 13px', borderRadius: '7px', border: '1px solid var(--primary-color)', background: 'var(--primary-color)', color: 'var(--primary-text)', fontSize: '11px', fontWeight: 700, cursor: generating ? 'wait' : 'pointer' }}
            >
              {generating ? '正在写自传…' : '一键生成自传'}
            </button>
            {tab === 'biography' && data?.latest && !editing && (
              <button
                onClick={() => { setDraft(data.latest?.content || ''); setEditing(true) }}
                style={{ padding: '7px 10px', borderRadius: '7px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)', fontSize: '11px', cursor: 'pointer' }}
              >
                编辑
              </button>
            )}
            {editing && (
              <button
                onClick={() => void save()}
                disabled={saving}
                style={{ padding: '7px 10px', borderRadius: '7px', border: '1px solid var(--primary-color)', background: 'transparent', color: 'var(--text-main)', fontSize: '11px', cursor: saving ? 'wait' : 'pointer' }}
              >
                {saving ? '保存中…' : '保存修改'}
              </button>
            )}
          </div>
        </div>

        {error && (
          <div style={{ margin: '12px 20px 0', padding: '9px 11px', borderRadius: '8px', border: '1px solid var(--danger-color)', color: 'var(--danger-color)', fontSize: '11px', lineHeight: 1.6 }}>{error}</div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px 24px' }}>
          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>正在聚合生平…</div>
          ) : tab === 'timeline' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
              {data?.relationships && data.relationships.length > 0 && (
                <div style={{ padding: '12px', borderRadius: '10px', border: '1px solid var(--card-border)', background: 'rgba(128,128,128,0.06)' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, marginBottom: '7px' }}>人物关系</div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {data.relationships.map((rel, index) => (
                      <span key={`${rel.other_name}-${index}`} style={{ padding: '4px 8px', borderRadius: '20px', border: '1px solid var(--card-border)', fontSize: '10px', color: 'var(--text-muted)' }}>
                        {rel.other_name} · {rel.relation_type || rel.quadrant || rel.other_type}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {(!data?.timeline || data.timeline.length === 0) ? (
                <div style={{ padding: '50px', textAlign: 'center', color: 'var(--text-muted)' }}>还没有可聚合的生平记录。先在事件和推演中留下经历。</div>
              ) : data.timeline.map((item, index) => (
                <div key={`${item.time}-${item.title}-${index}`} style={{ padding: '13px 14px', borderRadius: '10px', border: '1px solid var(--card-border)', background: 'rgba(128,128,128,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'flex-start' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>{item.title || '一段经历'}</div>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{kindLabel[item.kind] || item.kind} · {item.time || '未记时间'}</span>
                  </div>
                  {item.description && <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{item.description}</p>}
                  {item.impact && <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--text-main)' }}>影响：{item.impact}</div>}
                  {item.polarity && <div style={{ marginTop: '4px', fontSize: '10px', color: 'var(--text-muted)' }}>{item.polarity} · {item.intensity || '中'}</div>}
                  {item.actions && item.actions.length > 0 && (
                    <div style={{ marginTop: '7px', paddingTop: '7px', borderTop: '1px dashed var(--card-border)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {item.actions.map((action, actionIndex) => (
                        <div key={actionIndex} style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          行动：{action.action || '—'}　结果：{action.status || '未定'}　{action.engine ? `引擎：${action.engine}` : ''}
                        </div>
                      ))}
                    </div>
                  )}
                  {item.chapters && item.chapters.length > 0 && <div style={{ marginTop: '5px', fontSize: '10px', color: 'var(--text-muted)' }}>相关章节：{item.chapters.join('、')}</div>}
                </div>
              ))}
            </div>
          ) : (
            <div>
              {!data?.latest ? (
                <div style={{ padding: '50px', textAlign: 'center', color: 'var(--text-muted)', lineHeight: 1.9 }}>
                  还没有自传。点击右上角「一键生成自传」，会聚合全部生平事件并由 AI 写成第一人称自传。
                  <br />没有配置 AI Key 时会先生成一份本地整理版，之后仍可重新生成。
                </div>
              ) : editing ? (
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  style={{ width: '100%', minHeight: '420px', boxSizing: 'border-box', padding: '14px', borderRadius: '10px', border: '1px solid var(--card-border)', background: 'rgba(128,128,128,0.05)', color: 'var(--text-main)', fontSize: '13px', lineHeight: 1.9, resize: 'vertical', outline: 'none' }}
                />
              ) : (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {data.latest.engine === 'ai' ? 'AI 生成' : data.latest.engine === 'manual' ? '手动编辑' : '本地整理版'}
                      {' · '}{new Date(data.latest.created_at).toLocaleString('zh-CN')}
                    </div>
                    {!data.ai_configured && <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>未配置 AI Key，当前为本地整理版</div>}
                  </div>
                  <div style={{ padding: '18px', borderRadius: '10px', border: '1px solid var(--card-border)', background: 'rgba(128,128,128,0.04)', fontSize: '13px', lineHeight: 1.95, whiteSpace: 'pre-wrap' }}>
                    {data.latest.content}
                  </div>
                </div>
              )}
              {data?.citations && data.citations.length > 0 && (
                <div style={{ marginTop: '14px', padding: '12px', borderRadius: '10px', border: '1px dashed var(--card-border)' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, marginBottom: '7px' }}>
                    引用来源 · {data.citations.length} 项
                    <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: '7px' }}>文档级溯源，不表示逐句引用</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {data.citations.map((citation, index) => (
                      <div key={`${citation.kind}-${citation.id}-${index}`} style={{ fontSize: '10.5px', color: 'var(--text-muted)', display: 'flex', gap: '6px' }}>
                        <span style={{ color: 'var(--primary-color)' }}>{kindLabel[citation.kind] || citation.kind}</span>
                        <span style={{ flex: 1, color: 'var(--text-main)' }}>{citation.title}</span>
                        <span>{citation.story_time || ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
