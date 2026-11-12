import { useEffect, useState } from 'react'
import * as api from '../api/yunbao'
import type { YunbaoProfile } from '../api/yunbao'
import type { PersonaMemory, PersonaThread } from '../api/personas'

export default function CompanionRuntimePage({ onOpenPersonas }: { onOpenPersonas?: () => void }) {
  const [profile, setProfile] = useState<YunbaoProfile | null>(null)
  const [threads, setThreads] = useState<PersonaThread[]>([])
  const [memories, setMemories] = useState<PersonaMemory[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    try {
      const [persona, thr, mem] = await Promise.all([
        api.getYunbao(), api.listYunbaoThreads(), api.listYunbaoMemories(),
      ])
      setProfile(persona); setThreads(thr); setMemories(mem)
    } catch (e: any) { setError(String(e?.message || e)) }
  }
  useEffect(() => { void load() }, [])

  const toggle = async () => {
    if (!profile?.can_edit) return
    setBusy(true); setError('')
    try {
      const updated = await api.updateYunbao({ status: profile.status === 'paused' ? 'active' : 'paused' })
      setProfile(updated)
    } catch (e: any) { setError(String(e?.message || e)) } finally { setBusy(false) }
  }

  const active = profile ? profile.status !== 'paused' : false
  const latest = threads[0]

  return (
    <div style={{ padding: '1.5rem', maxWidth: 1120, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>07 人格运行</h1>
          <p style={{ margin: '5px 0 0', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: 720 }}>
            这里只看云宝的后台运行状态、独立会话与长期记忆，不开放完整世界模拟控制台。
            暂停只改变运行标记，不删除会话、记忆或人格数据。
          </p>
        </div>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={onOpenPersonas} style={primaryBtn}>查看云宝人格</button>
      </div>
      {error && <div style={{ marginTop: 10, padding: 8, borderRadius: 7, background: 'rgba(239,68,68,.08)', color: 'var(--danger-color)', fontSize: 11 }}>{error}</div>}
      <div style={{ marginTop: 14 }}>
        {profile ? (
          <div style={{ border: '1px solid var(--card-border)', borderRadius: 13, padding: 16, background: 'var(--card-bg)', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 44, height: 44, borderRadius: '50%', display: 'grid', placeItems: 'center', background: active ? 'color-mix(in srgb, var(--primary-color) 14%, transparent)' : 'rgba(128,128,128,.12)', fontSize: 19 }}>{profile.avatar || '☁'}</span>
              <div style={{ minWidth: 0 }}>
                <strong style={{ fontSize: 15 }}>{profile.name}</strong>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{profile.identity || '全局 AI 人格'} · {profile.current_state?.label}</div>
              </div>
              <span style={{ marginLeft: 'auto', fontSize: 9, padding: '3px 8px', borderRadius: 10, border: `1px solid ${active ? 'var(--primary-color)' : 'var(--card-border)'}`, color: active ? 'var(--primary-color)' : 'var(--text-muted)' }}>
                {active ? '后台运行中' : '已暂停'}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
              <Metric label="独立会话" value={threads.length} />
              <Metric label="长期记忆" value={memories.length} />
              <Metric label="三种常态" value={profile.states?.length || 3} />
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              最近会话：{latest ? `${latest.title || '独立会话'} · ${latest.message_count ?? 0} 条` : '暂无，和云宝开始一段长期互动'}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 'auto', flexWrap: 'wrap' }}>
              {profile.can_edit ? (
                <button type="button" style={primaryBtn} onClick={() => void toggle()} disabled={busy}>
                  {busy ? '处理中…' : active ? '暂停后台运行' : '恢复后台运行'}
                </button>
              ) : (
                <span style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid var(--card-border)', fontSize: 10.5, color: 'var(--text-muted)' }}>
                  只读：运行状态由系统所有者维护
                </span>
              )}
              <button type="button" style={smallBtn} onClick={onOpenPersonas}>进入云宝详情</button>
            </div>
          </div>
        ) : <div style={{ padding: 30, textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', border: '1px dashed var(--card-border)', borderRadius: 10 }}>正在读取云宝运行状态…</div>}
      </div>
      <div style={{ marginTop: 14, padding: 10, border: '1px dashed var(--card-border)', borderRadius: 8, fontSize: 10.5, color: 'var(--text-muted)', lineHeight: 1.7 }}>
        权限边界：云宝工作台独立于 AI 伴侣产品；人格运行只读取云宝自己的会话与记忆，编辑权限仅限开发者。
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
