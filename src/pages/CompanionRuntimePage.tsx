import { useEffect, useState } from 'react'
import * as api from '../api/personas'

type Card = {
  persona: api.Persona
  threads: api.PersonaThread[]
  memories: api.PersonaMemory[]
}

export default function CompanionRuntimePage({ onOpenPersonas }: { onOpenPersonas?: () => void }) {
  const [cards, setCards] = useState<Card[]>([])
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    try {
      const personas = await api.listPersonas('companion')
      const rows = await Promise.all(personas.map(async (persona) => {
        const [threads, memories] = await Promise.all([
          api.listPersonaThreads(persona.id), api.listPersonaMemories(persona.id),
        ])
        return { persona, threads, memories }
      }))
      setCards(rows)
    } catch (e: any) { setError(e.message) }
  }
  useEffect(() => { void load() }, [])

  const toggle = async (persona: api.Persona) => {
    setBusy(persona.id); setError('')
    try {
      await api.updatePersona(persona.id, { status: persona.status === 'paused' ? 'active' : 'paused' })
      await load()
    } catch (e: any) { setError(e.message) } finally { setBusy('') }
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: 1120, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>07 人格运行</h1>
          <p style={{ margin: '5px 0 0', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: 720 }}>
            这里只看个人 AI 人格的后台陪伴状态、独立会话与长期记忆，不开放完整世界模拟控制台。
            暂停某个人格只会暂停它的后台运行标记，不删除会话和记忆。
          </p>
        </div>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={onOpenPersonas} style={primaryBtn}>打开人格管理</button>
      </div>
      {error && <div style={{ marginTop: 10, padding: 8, borderRadius: 7, background: 'rgba(239,68,68,.08)', color: 'var(--danger-color)', fontSize: 11 }}>{error}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 10, marginTop: 14 }}>
        {cards.map(({ persona, threads, memories }) => {
          const active = persona.status !== 'paused'
          const latest = threads[0]
          return (
            <div key={persona.id} style={{ border: '1px solid var(--card-border)', borderRadius: 11, padding: 13, background: 'var(--card-bg)', display: 'flex', flexDirection: 'column', gap: 9 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center', background: active ? 'color-mix(in srgb, var(--primary-color) 14%, transparent)' : 'rgba(128,128,128,.12)', fontSize: 15 }}>{persona.avatar || '✦'}</span>
                <div style={{ minWidth: 0 }}>
                  <strong style={{ fontSize: 13 }}>{persona.name}</strong>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{persona.identity || '个人 AI 人格'}</div>
                </div>
                <span style={{ marginLeft: 'auto', fontSize: 9, padding: '3px 7px', borderRadius: 10, border: `1px solid ${active ? 'var(--primary-color)' : 'var(--card-border)'}`, color: active ? 'var(--primary-color)' : 'var(--text-muted)' }}>
                  {active ? '后台运行中' : '已暂停'}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 5 }}>
                <Metric label="独立会话" value={threads.length} />
                <Metric label="长期记忆" value={memories.length} />
                <Metric label="ESA" value={Object.keys(persona.esa || {}).length} />
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                最近会话：{latest ? `${latest.title || '独立会话'} · ${latest.message_count ?? 0} 条` : '暂无，和 TA 开始一段长期互动'}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
                <button type="button" style={primaryBtn} onClick={() => void toggle(persona)} disabled={busy === persona.id}>
                  {busy === persona.id ? '处理中…' : active ? '暂停后台运行' : '恢复后台运行'}
                </button>
                <button type="button" style={smallBtn} onClick={onOpenPersonas}>进入独立会话</button>
              </div>
            </div>
          )
        })}
        {!cards.length && <div style={{ gridColumn: '1/-1', padding: 30, textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', border: '1px dashed var(--card-border)', borderRadius: 10 }}>还没有个人 AI 人格。先创建人格和 AI 伴侣角色，再回到这里查看后台运行状态。</div>}
      </div>
      <div style={{ marginTop: 14, padding: 10, border: '1px dashed var(--card-border)', borderRadius: 8, fontSize: 10.5, color: 'var(--text-muted)', lineHeight: 1.7 }}>
        权限边界：AI 伴侣产品不出现世界管理、世界结构、世界设定、完整模拟控制台和故事线管理；人格运行只读取伴侣产品自己的工作空间与人格记忆。
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div style={{ border: '1px solid var(--card-border)', borderRadius: 7, padding: '6px 7px' }}>
    <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{label}</div>
    <div style={{ fontSize: 15, fontWeight: 700 }}>{value}</div>
  </div>
}

const primaryBtn: React.CSSProperties = { padding: '7px 10px', borderRadius: 7, border: '1px solid var(--primary-color)', background: 'var(--primary-color)', color: 'var(--primary-text)', fontSize: 11, cursor: 'pointer' }
const smallBtn: React.CSSProperties = { padding: '7px 10px', borderRadius: 7, border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)', fontSize: 11, cursor: 'pointer' }
