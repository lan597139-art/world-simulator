import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, Dispatch, ReactNode, SetStateAction } from 'react'
import * as api from '../api/yunbao'
import type { YunbaoGrowth, YunbaoProfile, YunbaoVersion } from '../api/yunbao'

const cardSurface: CSSProperties = {
  border: '1px solid var(--card-border)', borderRadius: 14, background: 'var(--ws-surface-bg)',
  boxSizing: 'border-box',
}
const input: CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8,
  border: '1px solid var(--card-border)', background: 'var(--bg-color)',
  color: 'var(--text-main)', fontSize: 12, lineHeight: 1.65,
}
const label: CSSProperties = { display: 'block', fontSize: 10, color: 'var(--text-muted)', marginBottom: 5, letterSpacing: '0.02em' }
const primaryBtn: CSSProperties = {
  padding: '7px 12px', borderRadius: 8, border: '1px solid var(--primary-color)',
  background: 'var(--primary-color)', color: 'var(--primary-text)', fontSize: 11, cursor: 'pointer',
}
const ghostBtn: CSSProperties = {
  padding: '7px 12px', borderRadius: 8, border: '1px solid var(--card-border)',
  background: 'transparent', color: 'var(--text-main)', fontSize: 11, cursor: 'pointer',
}
const sectionTitle: CSSProperties = {
  fontSize: 10, fontWeight: 700, letterSpacing: '0.11em', color: 'var(--primary-color)',
  textTransform: 'uppercase', margin: '0 0 10px',
}

const ESA_LABELS: Record<string, string> = {
  V: '价值 / 欲望', O: '机会 / 开放', D: '防御 / 威胁', E: '表达 / 能量', T: '信任 / 依恋', defense: '防御',
}

function valueText(value: unknown): string {
  if (value === null || value === undefined || value === '') return '未填写'
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
  return Object.entries(value as Record<string, unknown>)
    .map(([key, item]) => `${key}：${typeof item === 'object' ? JSON.stringify(item) : String(item)}`)
    .join('；') || '未填写'
}

function jsonText(value: unknown): string {
  try { return JSON.stringify(value ?? {}, null, 2) } catch { return '{}' }
}

export function YunbaoCard({ onOpen, actionLabel = '云宝人格设计' }: { onOpen: () => void; actionLabel?: string }) {
  const [profile, setProfile] = useState<YunbaoProfile | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    void api.getYunbao()
      .then((data) => { if (alive) setProfile(data) })
      .catch((err) => { if (alive) setError(String(err?.message || err)) })
    return () => { alive = false }
  }, [])

  return (
    <div style={{
      ...cardSurface, padding: 15, display: 'flex', gap: 14, alignItems: 'stretch',
      flexWrap: 'wrap', borderColor: 'color-mix(in srgb, var(--primary-color) 42%, var(--card-border))',
      background: 'linear-gradient(135deg, color-mix(in srgb, var(--primary-color) 7%, var(--ws-surface-bg)), var(--ws-surface-bg))',
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 15, display: 'grid', placeItems: 'center',
        fontSize: 25, background: 'color-mix(in srgb, var(--primary-color) 13%, transparent)',
        border: '1px solid color-mix(in srgb, var(--primary-color) 26%, transparent)',
      }}>{profile?.avatar || '☁'}</div>
      <div style={{ flex: 1, minWidth: 240 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 17 }}>{profile?.name || '云宝'}</strong>
          <span style={{ fontSize: 'var(--text-2xs)', padding: '2px 7px', borderRadius: 10, border: '1px solid var(--card-border)', color: 'var(--text-muted)' }}>
            全局 AI 人格
          </span>
          {profile && (
            <span style={{
              fontSize: 'var(--text-2xs)', padding: '2px 7px', borderRadius: 10,
              border: `1px solid ${profile.current_state ? 'var(--primary-color)' : 'var(--card-border)'}`,
              color: profile.current_state ? 'var(--primary-color)' : 'var(--text-muted)',
            }}>{profile.current_state?.label || '状态未设置'}</span>
          )}
          {profile && (
            <span style={{ fontSize: 'var(--text-2xs)', padding: '2px 7px', borderRadius: 10, border: '1px solid var(--card-border)', color: 'var(--text-muted)' }}>
              {profile.can_edit ? '所有者可编辑' : '只读'}
            </span>
          )}
        </div>
        <div style={{ marginTop: 5, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.65 }}>
          {error || profile?.identity || '用户的全局 AI 人格'}
        </div>
        {profile && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 9 }}>
            <Metric label="人格成熟" value={profile.maturity || '—'} />
            <Metric label="成长经历" value={`${profile.growth_experience?.length || 0} 条`} />
            <Metric label="自传" value={profile.biography ? '已记录' : '未填写'} />
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end' }}>
        <button type="button" onClick={onOpen} style={primaryBtn}>{actionLabel}</button>
      </div>
    </div>
  )
}

function Metric({ label: text, value }: { label: string; value: string }) {
  return (
    <span style={{
      display: 'inline-flex', gap: 5, alignItems: 'center', padding: '4px 8px', borderRadius: 7,
      background: 'rgba(128,128,128,0.08)', fontSize: 'var(--text-2xs)', color: 'var(--text-muted)',
    }}>
      {text}<strong style={{ color: 'var(--text-main)', fontWeight: 600 }}>{value}</strong>
    </span>
  )
}

export function YunbaoProfilePanel({
  embedded = false,
  onClose,
  onOpenSeedEditor,
}: {
  embedded?: boolean
  onClose?: () => void
  onOpenSeedEditor?: () => void
}) {
  const [profile, setProfile] = useState<YunbaoProfile | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Record<string, any>>({})
  const [versions, setVersions] = useState<YunbaoVersion[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadVersions = async () => {
    try { setVersions(await api.listYunbaoVersions()) } catch { setVersions([]) }
  }

  const load = async () => {
    setError('')
    try {
      const data = await api.getYunbao()
      setProfile(data)
      setDraft({})
      void loadVersions()
    } catch (err: any) { setError(String(err?.message || err)) }
  }

  useEffect(() => { void load() }, [])

  const startEdit = () => {
    if (!profile?.can_edit) return
    setDraft({
      identity: profile.identity,
      description: profile.description,
      maturity: profile.maturity,
      biography: profile.biography,
      traits: (profile.traits || []).join('、'),
      tools: (profile.tools || []).join('、'),
      growth_experience: profile.growth_experience || [],
      esa: jsonText(profile.esa),
      cognition: jsonText(profile.cognition),
      expression: jsonText(profile.expression),
      interaction: jsonText(profile.interaction),
      memory_policy: jsonText(profile.memory_policy),
      public_profile: jsonText(profile.public_profile),
    })
    setEditing(true)
    setNotice('')
  }

  const updateGrowth = (index: number, key: keyof YunbaoGrowth, value: string) => {
    setDraft((prev) => {
      const rows = Array.isArray(prev.growth_experience) ? [...prev.growth_experience] : []
      rows[index] = { ...(rows[index] || {}), [key]: value }
      return { ...prev, growth_experience: rows }
    })
  }

  const addGrowth = () => {
    setDraft((prev) => ({
      ...prev,
      growth_experience: [
        ...(Array.isArray(prev.growth_experience) ? prev.growth_experience : []),
        { id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, date: '', title: '', content: '' },
      ],
    }))
  }

  const removeGrowth = (index: number) => {
    setDraft((prev) => ({
      ...prev,
      growth_experience: (Array.isArray(prev.growth_experience) ? prev.growth_experience : [])
        .filter((_: unknown, i: number) => i !== index),
    }))
  }

  const buildPayload = () => {
    const parse = (key: string) => {
      if (typeof draft[key] !== 'string') return draft[key]
      try { return JSON.parse(draft[key] || '{}') } catch { throw new Error(`${key} 不是合法 JSON`) }
    }
    return {
      identity: draft.identity,
      description: draft.description,
      maturity: draft.maturity,
      biography: draft.biography,
      traits: String(draft.traits || '').split(/[、,，]/).map((item) => item.trim()).filter(Boolean),
      tools: String(draft.tools || '').split(/[、,，]/).map((item) => item.trim()).filter(Boolean),
      growth_experience: draft.growth_experience || [],
      esa: parse('esa'),
      cognition: parse('cognition'),
      expression: parse('expression'),
      interaction: parse('interaction'),
      memory_policy: parse('memory_policy'),
      public_profile: parse('public_profile'),
    }
  }

  const save = async () => {
    setBusy(true); setError(''); setNotice('')
    try {
      const updated = await api.updateYunbao(buildPayload())
      setProfile(updated)
      setEditing(false)
      setNotice('云宝人格已保存并记录为新版本')
      void loadVersions()
    } catch (err: any) {
      setError(String(err?.message || err))
    } finally {
      setBusy(false)
    }
  }

  const saveDraft = async () => {
    setBusy(true); setError(''); setNotice('')
    try {
      await api.createYunbaoDraft(buildPayload())
      setNotice('草稿已保存，尚未生效；可在版本记录中发布')
      void loadVersions()
    } catch (err: any) {
      setError(String(err?.message || err))
    } finally {
      setBusy(false)
    }
  }

  const publishVersion = async (versionId: string) => {
    setBusy(true); setError(''); setNotice('')
    try {
      const result = await api.publishYunbaoVersion(versionId)
      setProfile(result.persona)
      setEditing(false)
      setNotice(`草稿 v${result.version.version_no} 已发布生效`)
      void loadVersions()
    } catch (err: any) {
      setError(String(err?.message || err))
    } finally {
      setBusy(false)
    }
  }

  const rollbackVersion = async (versionId: string) => {
    setBusy(true); setError(''); setNotice('')
    try {
      const result = await api.rollbackYunbaoVersion(versionId)
      setProfile(result.persona)
      setEditing(false)
      setNotice(`已回滚到 v${result.version.version_no}`)
      void loadVersions()
    } catch (err: any) {
      setError(String(err?.message || err))
    } finally {
      setBusy(false)
    }
  }

  const body = !profile ? (
    <div style={{ padding: 30, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
      {error || '正在读取云宝人格…'}
    </div>
  ) : (
    <>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{
          width: 62, height: 62, borderRadius: 17, display: 'grid', placeItems: 'center',
          fontSize: 28, background: 'color-mix(in srgb, var(--primary-color) 12%, transparent)',
          border: '1px solid color-mix(in srgb, var(--primary-color) 25%, transparent)',
        }}>{profile.avatar || '☁'}</div>
        <div style={{ flex: 1, minWidth: 230 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: 21 }}>{profile.name}</h2>
            <span style={badge}>{profile.can_edit ? '系统所有者 · 可编辑' : '普通用户 · 只读'}</span>
            <span style={badge}>{profile.status === 'paused' ? '后台已暂停' : '后台运行中'}</span>
          </div>
          <div style={{ marginTop: 5, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.7 }}>
            {profile.identity} · {profile.description}
          </div>
          <div style={{ marginTop: 9, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(profile.states || []).map((state) => (
              <span key={state.key} style={{
                ...badge,
                borderColor: state.key === profile.active_state ? 'var(--primary-color)' : 'var(--card-border)',
                color: state.key === profile.active_state ? 'var(--primary-color)' : 'var(--text-muted)',
                background: state.key === profile.active_state ? 'color-mix(in srgb, var(--primary-color) 9%, transparent)' : 'transparent',
              }}>{state.label}</span>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 7 }}>
          {profile.can_edit && onOpenSeedEditor && <button type="button" style={ghostBtn} onClick={onOpenSeedEditor}>人物种子编辑器</button>}
          {profile.can_edit && !editing && <button type="button" style={primaryBtn} onClick={startEdit}>编辑人格</button>}
          {editing && <button type="button" style={ghostBtn} onClick={() => { setEditing(false); setError('') }}>取消</button>}
          {onClose && <button type="button" style={ghostBtn} onClick={onClose}>关闭</button>}
        </div>
      </div>

      {error && <div style={errorBox}>{error}</div>}
      {notice && <div style={{ ...errorBox, color: 'var(--primary-color)', borderColor: 'var(--primary-color)' }}>{notice}</div>}

      {editing ? (
        <EditBody
          draft={draft} setDraft={setDraft} updateGrowth={updateGrowth}
          addGrowth={addGrowth} removeGrowth={removeGrowth} save={save} saveDraft={saveDraft} busy={busy}
          onOpenSeedEditor={onOpenSeedEditor}
        />
      ) : (
        <ReadBody
          profile={profile} versions={versions}
          onPublish={publishVersion} onRollback={rollbackVersion} busy={busy}
        />
      )}
    </>
  )

  if (embedded) {
    return <div style={{ ...cardSurface, padding: 20, maxWidth: 1080, margin: '0 auto' }}>{body}</div>
  }
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 85, background: 'rgba(0,0,0,.48)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={onClose}>
      <div
        onClick={(event) => event.stopPropagation()}
        style={{ ...cardSurface, width: 'min(900px, 100%)', maxHeight: '90vh', overflow: 'auto', padding: 20, boxShadow: '0 28px 100px rgba(0,0,0,.35)' }}
      >
        {body}
      </div>
    </div>
  )
}

function ReadBody({
  profile, versions, onPublish, onRollback, busy,
}: {
  profile: YunbaoProfile
  versions: YunbaoVersion[]
  onPublish: (versionId: string) => void
  onRollback: (versionId: string) => void
  busy: boolean
}) {
  return (
    <div style={{ marginTop: 18, display: 'grid', gap: 13 }}>
      <Section title="人格成熟">
        <p style={paragraph}>{profile.maturity || '未填写'}</p>
      </Section>
      <Section title="人格表达特征">
        <p style={paragraph}>{valueText(profile.expression)}</p>
        {profile.traits?.length > 0 && <p style={paragraph}>特征：{profile.traits.join('、')}</p>}
      </Section>
      <Section title="自传">
        <p style={{ ...paragraph, whiteSpace: 'pre-wrap' }}>{profile.biography || '未填写'}</p>
      </Section>
      <Section title="成长经历">
        {profile.growth_experience?.length ? (
          <div style={{ display: 'grid', gap: 8 }}>
            {profile.growth_experience.map((item) => (
              <div key={item.id} style={{ padding: '9px 11px', borderRadius: 8, background: 'rgba(128,128,128,.06)', border: '1px solid var(--card-border)' }}>
                <div style={{ fontSize: 11, fontWeight: 600 }}>{[item.date, item.title].filter(Boolean).join(' · ') || '成长记录'}</div>
                <div style={{ marginTop: 4, fontSize: 10.5, lineHeight: 1.75, color: 'var(--text-muted)', whiteSpace: 'pre-wrap' }}>{item.content}</div>
              </div>
            ))}
          </div>
        ) : <p style={paragraph}>暂无成长经历。</p>}
      </Section>
      <Section title="当前状态">
        <p style={paragraph}>{profile.current_state?.label || '未设置'} · {profile.current_state?.description || ''}</p>
        <p style={{ ...paragraph, color: 'var(--text-muted)' }}>状态切换在云宝对话框中完成，不在此页面修改。</p>
      </Section>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 12 }}>
        <Section title="ESA 动力">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {Object.entries(profile.esa || {}).map(([key, value]) => (
              <span key={key} style={badge}>{ESA_LABELS[key] || key} {String(value)}</span>
            ))}
          </div>
        </Section>
        <Section title="认知 / 互动">
          <p style={paragraph}>{valueText(profile.cognition)}</p>
          <p style={paragraph}>{valueText(profile.interaction)}</p>
        </Section>
      </div>
      <Section title="其他已有数据">
        <p style={paragraph}>工具：{profile.tools?.length ? profile.tools.join('、') : '未填写'}</p>
        <p style={paragraph}>记忆策略：{valueText(profile.memory_policy)}</p>
        <p style={paragraph}>公共资料：{valueText(profile.public_profile)}</p>
      </Section>
      <Section title="版本记录">
        <VersionSection
          versions={versions} canEdit={profile.can_edit} busy={busy}
          onPublish={onPublish} onRollback={onRollback}
        />
      </Section>
    </div>
  )
}

function EditBody({
  draft, setDraft, updateGrowth, addGrowth, removeGrowth, save, saveDraft, busy, onOpenSeedEditor,
}: {
  draft: Record<string, any>
  setDraft: Dispatch<SetStateAction<Record<string, any>>>
  updateGrowth: (index: number, key: keyof YunbaoGrowth, value: string) => void
  addGrowth: () => void
  removeGrowth: (index: number) => void
  save: () => void
  saveDraft: () => void
  busy: boolean
  onOpenSeedEditor?: () => void
}) {
  const growth = useMemo(
    () => (Array.isArray(draft.growth_experience) ? draft.growth_experience : []),
    [draft.growth_experience],
  )
  const field = (key: string) => String(draft[key] ?? '')
  return (
    <div style={{ marginTop: 18, display: 'grid', gap: 13 }}>
      <div style={ownerNotice}>
        仅系统所有者可编辑。云宝昵称、三种常态定义与当前状态不在此处修改；状态只在对话框中切换。
      </div>
      {onOpenSeedEditor && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '9px 11px', borderRadius: 8, border: '1px solid color-mix(in srgb, var(--primary-color) 28%, var(--card-border))', background: 'color-mix(in srgb, var(--primary-color) 5%, transparent)' }}>
          <span style={{ fontSize: 10.5, color: 'var(--text-muted)', lineHeight: 1.65 }}>
            这里编辑人格摘要。完整的人物种子、动力结构、防御机制、思想钢印、生命经历与运行态在专用编辑器中。
          </span>
          <button type="button" style={primaryBtn} onClick={onOpenSeedEditor}>打开完整人物种子编辑器</button>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 11 }}>
        <Field label="人格成熟">
          <input style={input} value={field('maturity')} onChange={(e) => setDraft((p) => ({ ...p, maturity: e.target.value }))} />
        </Field>
        <Field label="身份定位">
          <input style={input} value={field('identity')} onChange={(e) => setDraft((p) => ({ ...p, identity: e.target.value }))} />
        </Field>
      </div>
      <Field label="自我描述">
        <textarea rows={3} style={input} value={field('description')} onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))} />
      </Field>
      <Field label="自传">
        <textarea rows={6} style={input} value={field('biography')} onChange={(e) => setDraft((p) => ({ ...p, biography: e.target.value }))} />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 11 }}>
        <Field label="人格特征（顿号分隔）">
          <input style={input} value={field('traits')} onChange={(e) => setDraft((p) => ({ ...p, traits: e.target.value }))} />
        </Field>
        <Field label="工具（顿号分隔）">
          <input style={input} value={field('tools')} onChange={(e) => setDraft((p) => ({ ...p, tools: e.target.value }))} />
        </Field>
      </div>
      <Section title="成长经历">
        <div style={{ display: 'grid', gap: 9 }}>
          {growth.map((item: YunbaoGrowth, index: number) => (
            <div key={item.id || index} style={{ padding: 10, borderRadius: 9, border: '1px solid var(--card-border)', display: 'grid', gap: 7 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr auto', gap: 7 }}>
                <input style={input} placeholder="日期" value={item.date || ''} onChange={(e) => updateGrowth(index, 'date', e.target.value)} />
                <input style={input} placeholder="标题" value={item.title || ''} onChange={(e) => updateGrowth(index, 'title', e.target.value)} />
                <button type="button" style={{ ...ghostBtn, color: 'var(--danger-color)' }} onClick={() => removeGrowth(index)}>删除</button>
              </div>
              <textarea rows={2} style={input} placeholder="经历内容" value={item.content || ''} onChange={(e) => updateGrowth(index, 'content', e.target.value)} />
            </div>
          ))}
          <div><button type="button" style={ghostBtn} onClick={addGrowth}>+ 添加成长经历</button></div>
        </div>
      </Section>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 11 }}>
        {(['esa', 'cognition', 'expression', 'interaction', 'memory_policy', 'public_profile'] as const).map((key) => (
          <Field key={key} label={`${key}（JSON）`}>
            <textarea rows={5} style={{ ...input, fontFamily: 'monospace', fontSize: 10.5 }} value={field(key)} onChange={(e) => setDraft((p) => ({ ...p, [key]: e.target.value }))} />
          </Field>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button type="button" style={ghostBtn} onClick={saveDraft} disabled={busy}>存为草稿（不生效）</button>
        <button type="button" style={primaryBtn} onClick={save} disabled={busy}>{busy ? '保存中…' : '保存云宝人格'}</button>
      </div>
    </div>
  )
}

function Field({ label: text, children }: { label: string; children: ReactNode }) {
  return <label style={{ display: 'block' }}><span style={label}>{text}</span>{children}</label>
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ padding: 12, border: '1px solid var(--card-border)', borderRadius: 10, background: 'rgba(128,128,128,.025)' }}>
      <h3 style={sectionTitle}>{title}</h3>
      {children}
    </section>
  )
}

function VersionSection({
  versions, canEdit, busy, onPublish, onRollback,
}: {
  versions: YunbaoVersion[]
  canEdit: boolean
  busy: boolean
  onPublish: (versionId: string) => void
  onRollback: (versionId: string) => void
}) {
  if (!versions.length) {
    return <p style={paragraph}>暂无版本记录。保存或发布后会自动生成版本快照。</p>
  }
  return (
    <div style={{ display: 'grid', gap: 7 }}>
      {versions.map((version) => (
        <div key={version.id} style={{
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
          padding: '7px 9px', borderRadius: 8, border: '1px solid var(--card-border)',
          background: 'rgba(128,128,128,.03)',
        }}>
          <span style={badge}>v{version.version_no}</span>
          <span style={{
            ...badge,
            borderColor: version.status === 'draft' ? 'var(--primary-color)' : 'var(--card-border)',
            color: version.status === 'draft' ? 'var(--primary-color)' : 'var(--text-muted)',
          }}>
            {version.status === 'draft' ? '草稿' : version.status === 'published' ? '已发布' : version.status}
          </span>
          <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
            {version.created_at ? new Date(version.created_at).toLocaleString('zh-CN') : '—'}
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            {canEdit && version.status === 'draft' && (
              <button type="button" style={primaryBtn} onClick={() => onPublish(version.id)} disabled={busy}>发布</button>
            )}
            {canEdit && version.status === 'published' && (
              <button type="button" style={ghostBtn} onClick={() => onRollback(version.id)} disabled={busy}>回滚到此版本</button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

const paragraph: CSSProperties = { margin: 0, fontSize: 11, lineHeight: 1.8, color: 'var(--text-main)' }
const badge: CSSProperties = {
  display: 'inline-flex', padding: '3px 8px', borderRadius: 12, border: '1px solid var(--card-border)',
  fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', background: 'transparent',
}
const errorBox: CSSProperties = {
  marginTop: 11, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--danger-color)',
  color: 'var(--danger-color)', fontSize: 11, lineHeight: 1.6,
}
const ownerNotice: CSSProperties = {
  padding: '8px 10px', borderRadius: 8, background: 'rgba(128,128,128,.07)',
  color: 'var(--text-muted)', fontSize: 10.5, lineHeight: 1.7,
}
