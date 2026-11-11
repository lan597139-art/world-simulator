import { useCallback, useEffect, useMemo, useState } from 'react'
import * as api from '../api/personas'

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(0,0,0,.48)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14,
}
const card: React.CSSProperties = {
  background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12,
  padding: 12, boxSizing: 'border-box',
}
const input: React.CSSProperties = {
  width: '100%', padding: '6px 8px', borderRadius: 7, border: '1px solid var(--card-border)',
  background: 'var(--bg-color)', color: 'var(--text-main)', fontSize: 11, boxSizing: 'border-box',
}
const btn: React.CSSProperties = {
  padding: '5px 9px', borderRadius: 7, border: '1px solid var(--card-border)',
  background: 'transparent', color: 'var(--text-main)', fontSize: 10, cursor: 'pointer',
}
const tiny: React.CSSProperties = { fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.6 }
const sectionTitle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: 'var(--primary-color)', marginTop: 4 }

const TEMPLATES: { key: string; label: string; payload: Partial<api.Persona> }[] = [
  {
    key: 'rational', label: '理性严谨的我',
    payload: {
      name: '理性严谨的我', identity: '用户的分析型个人 AI', description: '先厘清事实与约束，再给可执行结论；不迎合、不编造。',
      esa: { V: 0.35, O: 0.7, D: 0.8, E: 0.55, T: 0.75, defense: 0.72 },
      traits: ['理性', '严谨', '证据优先'], cognition: { tendency: '分析型', uncertainty: '明确标注不确定', conflict: '先拆解再判断' },
      expression: { tone: '克制、清晰', length: '适中', format: '结论先行' },
      interaction: { relation: '协作伙伴', directness: '直接', boundaries: '不替用户做重大决定' },
      memory_policy: { share_public_profile: false, isolation: true, auto_capture: false },
      public_profile: { nickname: '', bio: '', preferences: '' }, tools: ['信息整理', '任务拆解'],
    },
  },
  {
    key: 'quiet', label: '安静内向的我',
    payload: {
      name: '安静内向的我', identity: '用户的低刺激陪伴型个人 AI', description: '不催促、不喧闹，先接住情绪，再慢慢梳理。',
      esa: { V: 0.55, O: 0.4, D: 0.45, E: 0.35, T: 0.55, defense: 0.5 },
      traits: ['安静', '内向', '耐心'], cognition: { tendency: '感受优先', uncertainty: '允许留白', conflict: '避免对抗' },
      expression: { tone: '温和、简短', length: '偏短', format: '自然段' },
      interaction: { relation: '陪伴者', directness: '委婉', boundaries: '不强迫表达' },
      memory_policy: { share_public_profile: false, isolation: true, auto_capture: false },
      public_profile: { nickname: '', bio: '', preferences: '' }, tools: ['情绪陪伴', '日记整理'],
    },
  },
  {
    key: 'free', label: '自由松弛的我',
    payload: {
      name: '自由松弛的我', identity: '用户的创意型个人 AI', description: '放松、开放，允许试错，擅长把卡住的事变成可玩的小实验。',
      esa: { V: 0.45, O: 0.78, D: 0.6, E: 0.7, T: 0.5, defense: 0.65 },
      traits: ['松弛', '开放', '有幽默感'], cognition: { tendency: '发散型', uncertainty: '先试再修正', conflict: '换角度' },
      expression: { tone: '轻松、有画面感', length: '中等', format: '要点 + 例子' },
      interaction: { relation: '玩伴/共创者', directness: '随和', boundaries: '不替用户承诺' },
      memory_policy: { share_public_profile: false, isolation: true, auto_capture: false },
      public_profile: { nickname: '', bio: '', preferences: '' }, tools: ['创意发散', '任务陪伴'],
    },
  },
]

const ENGINE_KEYS = ['V', 'O', 'D', 'E', 'T'] as const
const ENGINE_LABEL: Record<string, string> = { V: 'V 价值/欲望', O: 'O 机会/开放', D: 'D 防御/威胁', E: 'E 表达/能量', T: 'T 信任/依恋' }

export default function PersonaManager({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [personas, setPersonas] = useState<api.Persona[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [draft, setDraft] = useState<Partial<api.Persona> | null>(null)
  const [threads, setThreads] = useState<api.PersonaThread[]>([])
  const [threadId, setThreadId] = useState('')
  const [messages, setMessages] = useState<api.PersonaMessage[]>([])
  const [memories, setMemories] = useState<api.PersonaMemory[]>([])
  const [tab, setTab] = useState<'profile' | 'chat' | 'memory'>('profile')
  const [traitsText, setTraitsText] = useState('')
  const [memoryText, setMemoryText] = useState('')
  const [chatText, setChatText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const selected = useMemo(() => personas.find((p) => p.id === selectedId), [personas, selectedId])

  const loadPersonas = useCallback(async () => {
    const rows = await api.listPersonas()
    setPersonas(rows)
    if (!selectedId && rows.length) setSelectedId(rows[0].id)
    if (selectedId && !rows.some((p) => p.id === selectedId)) setSelectedId(rows[0]?.id || '')
  }, [selectedId])

  useEffect(() => { if (open) void loadPersonas().catch((err) => setError(err.message)) }, [open])

  useEffect(() => {
    if (!selected) { setDraft(null); setTraitsText(''); return }
    setDraft(JSON.parse(JSON.stringify(selected)))
    setTraitsText((selected.traits || []).join('、'))
  }, [selectedId, selected])

  useEffect(() => {
    if (!open || !selectedId) { setThreads([]); setMessages([]); setMemories([]); setThreadId(''); return }
    void api.listPersonaThreads(selectedId).then((rows) => {
      setThreads(rows)
      if (rows.length) { setThreadId(rows[0].id); return api.listPersonaMessages(selectedId, rows[0].id) }
      setThreadId(''); setMessages([]); return [] as api.PersonaMessage[]
    }).then((rows) => setMessages(rows)).catch((err) => setError(err.message))
    void api.listPersonaMemories(selectedId).then(setMemories).catch(() => setMemories([]))
  }, [open, selectedId, tab === 'profile'])

  const chooseThread = async (id: string) => {
    setThreadId(id)
    if (!selectedId || !id) { setMessages([]); return }
    try { setMessages(await api.listPersonaMessages(selectedId, id)) } catch (err: any) { setError(err.message) }
  }

  const createBlankPersona = async () => {
    setBusy(true); setError('')
    try {
      const created = await api.createPersona({
        name: '新的自我', identity: '待定义的个人 AI', description: '',
        esa: { V: 0.5, O: 0.5, D: 0.5, E: 0.5, T: 0.5 },
      })
      await loadPersonas(); setSelectedId(created.id); setDraft(created)
    } catch (err: any) { setError(err.message) } finally { setBusy(false) }
  }

  const createTemplate = async (template: typeof TEMPLATES[number]) => {
    setBusy(true); setError('')
    try {
      const created = await api.createPersona(template.payload)
      await loadPersonas(); setSelectedId(created.id); setTab('profile')
    } catch (err: any) { setError(err.message) } finally { setBusy(false) }
  }

  const deletePersona = async () => {
    if (!selected || !window.confirm(`删除人格「${selected.name}」及其独立会话/记忆？`)) return
    setBusy(true); setError('')
    try { await api.deletePersona(selected.id); setSelectedId(''); await loadPersonas() }
    catch (err: any) { setError(err.message) } finally { setBusy(false) }
  }

  const saveProfile = async () => {
    if (!draft || !selected) return
    if (!String(draft.name || '').trim()) { setError('人格名称不能为空'); return }
    setBusy(true); setError('')
    try {
      const updated = await api.updatePersona(selected.id, {
        ...draft,
        traits: traitsText.split(/[、,，;；]/).map((s) => s.trim()).filter(Boolean),
      })
      setPersonas((prev) => prev.map((p) => p.id === updated.id ? updated : p))
      setDraft(JSON.parse(JSON.stringify(updated)))
    } catch (err: any) { setError(err.message) } finally { setBusy(false) }
  }

  const setEsa = (key: string, value: number) => {
    if (!draft) return
    setDraft({ ...draft, esa: { ...(draft.esa || {}), [key]: value } })
  }

  const saveMemory = async () => {
    if (!selected || !memoryText.trim()) return
    setBusy(true); setError('')
    try {
      await api.createPersonaMemory(selected.id, memoryText.trim(), 0.6)
      setMemoryText(''); setMemories(await api.listPersonaMemories(selected.id))
    } catch (err: any) { setError(err.message) } finally { setBusy(false) }
  }

  const removeMemory = async (memoryId: string) => {
    if (!selected) return
    try { await api.deletePersonaMemory(selected.id, memoryId); setMemories(await api.listPersonaMemories(selected.id)) }
    catch (err: any) { setError(err.message) }
  }

  const sendChat = async () => {
    if (!selected || !chatText.trim() || busy) return
    const text = chatText.trim()
    setBusy(true); setError(''); setChatText('')
    const optimistic: api.PersonaMessage = { id: `local-${Date.now()}`, thread_id: threadId, role: 'user', content: text }
    setMessages((prev) => [...prev, optimistic])
    try {
      const result = await api.chatWithPersona(selected.id, text, threadId || undefined)
      setThreadId(result.thread_id)
      setMessages(await api.listPersonaMessages(selected.id, result.thread_id))
      setThreads(await api.listPersonaThreads(selected.id))
    } catch (err: any) {
      setError(err.message)
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
      setChatText(text)
    } finally { setBusy(false) }
  }

  const newThread = () => { setThreadId(''); setMessages([]); setTab('chat') }

  const deleteThread = async () => {
    if (!selected || !threadId || !window.confirm('删除这条独立会话？')) return
    try {
      await api.deletePersonaThread(selected.id, threadId)
      const rows = await api.listPersonaThreads(selected.id)
      setThreads(rows)
      if (rows.length) await chooseThread(rows[0].id); else { setThreadId(''); setMessages([]) }
    } catch (err: any) { setError(err.message) }
  }

  if (!open) return null

  return (
    <div style={overlay} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ ...card, width: 1080, maxWidth: '100%', height: '86vh', maxHeight: 820, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'var(--bg-color)' }}>
        <header style={{ padding: '12px 15px', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div>
            <strong style={{ fontSize: 15 }}>03 人物管理 · 个人 AI 人格</strong>
            <div style={tiny}>每个人格是独立身份：有自己的 ESA 动力、表达、会话历史与记忆，不会自动混用。</div>
          </div>
          <span style={{ flex: 1 }} />
          <button type="button" style={btn} onClick={onClose}>关闭</button>
        </header>
        {error && <div style={{ padding: '6px 14px', color: 'var(--danger-color)', fontSize: 11, background: 'rgba(239,68,68,.07)' }}>{error}</div>}
        <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '220px minmax(0, 1fr) 330px' }}>
          <aside style={{ borderRight: '1px solid var(--card-border)', padding: 10, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 7 }}>
            <button type="button" style={{ ...btn, borderStyle: 'dashed' }} disabled={busy} onClick={() => void createTemplate(TEMPLATES[0])}>＋ 从模板创建</button>
            <button type="button" style={btn} disabled={busy} onClick={() => void createBlankPersona()}>＋ 空白人格</button>
            {TEMPLATES.slice(1).map((t) => (
              <button key={t.key} type="button" style={btn} disabled={busy} onClick={() => void createTemplate(t)}>＋ {t.label}</button>
            ))}
            <div style={{ ...tiny, margin: '4px 0 2px' }}>我的人格</div>
            {personas.map((p) => (
              <button key={p.id} type="button" onClick={() => { setSelectedId(p.id); setTab('profile') }} style={{
                ...card, padding: '8px 9px', textAlign: 'left', cursor: 'pointer',
                borderColor: selectedId === p.id ? 'var(--primary-color)' : 'var(--card-border)',
                background: selectedId === p.id ? 'color-mix(in srgb, var(--primary-color) 10%, var(--card-bg))' : 'var(--card-bg)',
              }}>
                <div style={{ fontSize: 11.5, fontWeight: 700 }}>{p.name}</div>
                <div style={{ ...tiny, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.identity || '个人 AI 人格'}</div>
              </button>
            ))}
            {!personas.length && <div style={tiny}>还没有个人 AI 人格。用上方模板创建一个，或完全自定义。</div>}
          </aside>

          <main style={{ minWidth: 0, overflow: 'auto', padding: 12 }}>
            {!selected && <div style={tiny}>选择左侧人格，或从模板创建。</div>}
            {selected && draft && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <strong style={{ fontSize: 13 }}>{selected.name}</strong>
                  <span style={tiny}>独立身份 · 独立记忆</span>
                  <span style={{ flex: 1 }} />
                  <button type="button" style={{ ...btn, color: 'var(--danger-color)' }} onClick={() => void deletePersona()}>删除人格</button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <label style={tiny}>人格名称
                    <input value={draft.name || ''} onChange={(e) => setDraft({ ...draft, name: e.target.value })} style={{ ...input, marginTop: 3 }} />
                  </label>
                  <label style={tiny}>身份定位
                    <input value={draft.identity || ''} onChange={(e) => setDraft({ ...draft, identity: e.target.value })} style={{ ...input, marginTop: 3 }} placeholder="例如：用户的分析型个人 AI" />
                  </label>
                </div>
                <label style={tiny}>自我描述
                  <textarea value={draft.description || ''} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={2} style={{ ...input, marginTop: 3, resize: 'vertical' }} />
                </label>
                <label style={tiny}>特征标签（用、分隔）
                  <input value={traitsText} onChange={(e) => setTraitsText(e.target.value)} style={{ ...input, marginTop: 3 }} placeholder="理性、严谨、证据优先" />
                </label>

                <div style={sectionTitle}>ESA 人格动力（不是只写提示词）</div>
                <div style={{ ...tiny }}>这些数值进入人格动力层，影响判断优先级、防御强度与表达能量。</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 7 }}>
                  {ENGINE_KEYS.map((key) => (
                    <label key={key} style={{ ...tiny, border: '1px solid var(--card-border)', borderRadius: 8, padding: 6 }}>
                      <div>{ENGINE_LABEL[key]}</div>
                      <input type="range" min={0} max={1} step={0.01} value={Number((draft.esa || {})[key] ?? 0.5)} onChange={(e) => setEsa(key, Number(e.target.value))} style={{ width: '100%' }} />
                      <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--text-main)' }}>{Number((draft.esa || {})[key] ?? 0.5).toFixed(2)}</div>
                    </label>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <label style={tiny}>认知倾向
                    <input value={String((draft.cognition || {}).tendency || '')} onChange={(e) => setDraft({ ...draft, cognition: { ...(draft.cognition || {}), tendency: e.target.value } })} style={{ ...input, marginTop: 3 }} placeholder="分析型 / 感受优先 / 发散型" />
                  </label>
                  <label style={tiny}>不确定时
                    <input value={String((draft.cognition || {}).uncertainty || '')} onChange={(e) => setDraft({ ...draft, cognition: { ...(draft.cognition || {}), uncertainty: e.target.value } })} style={{ ...input, marginTop: 3 }} placeholder="标注不确定性 / 允许留白" />
                  </label>
                  <label style={tiny}>表达语气
                    <input value={String((draft.expression || {}).tone || '')} onChange={(e) => setDraft({ ...draft, expression: { ...(draft.expression || {}), tone: e.target.value } })} style={{ ...input, marginTop: 3 }} />
                  </label>
                  <label style={tiny}>互动关系
                    <input value={String((draft.interaction || {}).relation || '')} onChange={(e) => setDraft({ ...draft, interaction: { ...(draft.interaction || {}), relation: e.target.value } })} style={{ ...input, marginTop: 3 }} />
                  </label>
                </div>

                <div style={sectionTitle}>公共资料授权</div>
                <label style={{ ...tiny, display: 'flex', gap: 7, alignItems: 'flex-start', border: '1px solid var(--card-border)', borderRadius: 8, padding: 8 }}>
                  <input
                    type="checkbox"
                    checked={Boolean((draft.memory_policy || {}).share_public_profile)}
                    onChange={(e) => setDraft({ ...draft, memory_policy: { ...(draft.memory_policy || {}), share_public_profile: e.target.checked } })}
                  />
                  <span>允许这个人格在对话中使用我的公共资料（昵称/简介/偏好）。人格记忆始终隔离，不会自动混入其他人格。</span>
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 7 }}>
                  <input value={String((draft.public_profile || {}).nickname || '')} onChange={(e) => setDraft({ ...draft, public_profile: { ...(draft.public_profile || {}), nickname: e.target.value } })} placeholder="共享昵称" style={input} />
                  <input value={String((draft.public_profile || {}).bio || '')} onChange={(e) => setDraft({ ...draft, public_profile: { ...(draft.public_profile || {}), bio: e.target.value } })} placeholder="共享简介" style={input} />
                  <input value={String((draft.public_profile || {}).preferences || '')} onChange={(e) => setDraft({ ...draft, public_profile: { ...(draft.public_profile || {}), preferences: e.target.value } })} placeholder="共享偏好" style={input} />
                </div>

                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <button type="button" style={{ ...btn, background: 'var(--primary-color)', color: 'var(--primary-text)', borderColor: 'var(--primary-color)' }} disabled={busy} onClick={() => void saveProfile()}>保存人格配置</button>
                </div>
              </div>
            )}
          </main>

          <aside style={{ borderLeft: '1px solid var(--card-border)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ display: 'flex', gap: 4, padding: 8, borderBottom: '1px solid var(--card-border)' }}>
              <button type="button" onClick={() => setTab('chat')} style={{ ...btn, flex: 1, background: tab === 'chat' ? 'var(--primary-color)' : 'transparent', color: tab === 'chat' ? 'var(--primary-text)' : 'var(--text-main)' }}>人格会话</button>
              <button type="button" onClick={() => setTab('memory')} style={{ ...btn, flex: 1, background: tab === 'memory' ? 'var(--primary-color)' : 'transparent', color: tab === 'memory' ? 'var(--primary-text)' : 'var(--text-main)' }}>独立记忆 {memories.length}</button>
            </div>
            {tab === 'memory' ? (
              <div style={{ padding: 10, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 7 }}>
                <div style={tiny}>只属于「{selected?.name || '当前人格'}」。新增记忆不会出现在其他人格。</div>
                <textarea value={memoryText} onChange={(e) => setMemoryText(e.target.value)} rows={3} placeholder="例如：用户希望我在给建议前先确认约束条件。" style={{ ...input, resize: 'vertical' }} />
                <button type="button" style={btn} disabled={busy || !memoryText.trim()} onClick={() => void saveMemory()}>写入本人格记忆</button>
                {memories.map((m) => (
                  <div key={m.id} style={{ ...card, padding: 8 }}>
                    <div style={{ fontSize: 11 }}>{m.content}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <span style={tiny}>重要度 {Number(m.importance).toFixed(2)} · {m.source || 'chat'}</span>
                      <span style={{ flex: 1 }} />
                      <button type="button" style={{ ...btn, color: 'var(--danger-color)' }} onClick={() => void removeMemory(m.id)}>删除</button>
                    </div>
                  </div>
                ))}
                {!memories.length && <div style={tiny}>还没有记忆。</div>}
              </div>
            ) : (
              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: 8, borderBottom: '1px solid var(--card-border)', display: 'flex', gap: 5 }}>
                  <select value={threadId} onChange={(e) => void chooseThread(e.target.value)} style={input}>
                    <option value="">新会话（发送后创建）</option>
                    {threads.map((t) => <option key={t.id} value={t.id}>{t.title || '未命名会话'}（{t.message_count || 0}）</option>)}
                  </select>
                  <button type="button" style={btn} onClick={newThread}>＋</button>
                  {threadId && <button type="button" style={{ ...btn, color: 'var(--danger-color)' }} onClick={() => void deleteThread()}>×</button>}
                </div>
                <div style={{ flex: 1, overflow: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {!messages.length && <div style={tiny}>这是「{selected?.name || '人格'}」的独立会话。可以聊天、情感互动、问答、整理信息或让 TA 协助任务。模型/工具沿用全局 AI 配置。</div>}
                  {messages.map((m) => (
                    <div key={m.id} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                      <div style={{
                        maxWidth: '92%', padding: '7px 9px', borderRadius: 10, fontSize: 11.5, lineHeight: 1.65, whiteSpace: 'pre-wrap',
                        background: m.role === 'user' ? 'var(--primary-color)' : 'rgba(128,128,128,.12)',
                        color: m.role === 'user' ? 'var(--primary-text)' : 'var(--text-main)',
                      }}>{m.content}</div>
                    </div>
                  ))}
                  {busy && <div style={tiny}>「{selected?.name || '人格'}」正在回应…</div>}
                </div>
                <div style={{ padding: 8, borderTop: '1px solid var(--card-border)' }}>
                  <textarea
                    value={chatText} onChange={(e) => setChatText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendChat() } }}
                    rows={2} placeholder="和这个人格说话…（Enter 发送）" style={{ ...input, resize: 'none' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 5 }}>
                    <button type="button" style={{ ...btn, background: 'var(--primary-color)', color: 'var(--primary-text)' }} disabled={busy || !chatText.trim()} onClick={() => void sendChat()}>发送</button>
                  </div>
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  )
}
