import { useCallback, useEffect, useMemo, useState } from 'react'
import { API_ORIGIN } from '../api/config'
import {
  applyBranch,
  archiveBranch,
  compareBranches,
  compareEndings,
  continueEnding,
  createBranch,
  createDirection,
  createEnding,
  deleteDirection,
  deleteEnding,
  duplicateBranch,
  duplicateDirection,
  getBranch,
  getCProfile,
  getSixAxis,
  listBranches,
  listDirections,
  listEndings,
  pauseBranch,
  putCProfile,
  putSixAxis,
  resumeBranch,
  rollbackBranch,
  simulateBranch,
  suggestDirections,
  toggleDirection,
  updateDirection,
  type Branch,
  type BranchDetail,
  type Direction,
  type Ending,
} from '../api/multipath'

const SIX_AXIS: { key: string; label: string; hint: string }[] = [
  { key: 'scarcity', label: '稀缺', hint: '生存资源压力' },
  { key: 'threat', label: '威胁', hint: '暴力/惩罚风险' },
  { key: 'status', label: '地位', hint: '阶级碾压与比较' },
  { key: 'reputation', label: '声誉', hint: '社会凝视与污名' },
  { key: 'attachment', label: '依恋', hint: '分离与被抛弃' },
  { key: 'regulation', label: '调节', hint: '认知摩擦与内耗' },
]

const PROFILE_GROUPS: { key: string; label: string; fields: string[] }[] = [
  {
    key: 'Threat_Defense',
    label: '威胁与防御',
    fields: ['fear_threshold', 'fight_threshold', 'flight_threshold', 'freeze_threshold', 'fawn_threshold', 'ally_threshold', 'dissociation_threshold'],
  },
  { key: 'Shame_Face', label: '羞耻与体面', fields: ['shame_trigger_threshold', 'face_loss_sensitivity', 'confession_threshold', 'self_censor_threshold'] },
  { key: 'Status_Envy', label: '地位与嫉妒', fields: ['envy_threshold', 'status_rage_threshold', 'admiration_channel_threshold'] },
  { key: 'Bond_Attachment', label: '连结与依恋', fields: ['attachment_need_baseline', 'separation_anxiety_threshold', 'trust_repair_threshold', 'dependency_threshold'] },
  { key: 'Impulse_Inhibition', label: '冲动与克制', fields: ['impulse_threshold', 'inhibition_strength', 'risk_tolerance'] },
  { key: 'Regulation_Qheat', label: '热崩与递归', fields: ['overheat_threshold', 'rumination_threshold', 'shutdown_threshold'] },
]

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 9px',
  borderRadius: '7px',
  border: '1px solid var(--card-border)',
  background: 'rgba(128,128,128,0.08)',
  color: 'var(--text-main)',
  fontSize: '12px',
  outline: 'none',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: '4px',
  fontSize: '10.5px',
  fontWeight: 600,
  color: 'var(--text-muted)',
}

const btn: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: '7px',
  border: '1px solid var(--card-border)',
  background: 'transparent',
  color: 'var(--text-main)',
  fontSize: '11px',
  cursor: 'pointer',
}

const primaryBtn: React.CSSProperties = {
  ...btn,
  border: '1px solid var(--primary-color)',
  background: 'var(--primary-color)',
  color: 'var(--primary-text)',
  fontWeight: 700,
}

const panelStyle: React.CSSProperties = {
  border: '1px solid var(--card-border)',
  borderRadius: '12px',
  background: 'var(--card-bg, rgba(128,128,128,0.04))',
  padding: '12px 14px',
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
  minHeight: 0,
}

function sourceBadge(source: string) {
  if (source === 'user') return { text: '用户', color: 'var(--primary-color)' }
  if (source === 'ai') return { text: 'AI 待确认', color: 'var(--danger-color)' }
  return { text: 'AI 已确认', color: 'var(--text-muted)' }
}

export default function MultiPathPage({ worldId }: { worldId: string }) {
  const [events, setEvents] = useState<any[]>([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [directions, setDirections] = useState<Direction[]>([])
  const [draft, setDraft] = useState<Partial<Direction> | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<Partial<Direction>[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [detail, setDetail] = useState<BranchDetail | null>(null)
  const [branchEvents, setBranchEvents] = useState<any[]>([])
  const [simEventId, setSimEventId] = useState('')
  const [simDirectionId, setSimDirectionId] = useState('')
  const [perspective, setPerspective] = useState('第三人称限知 · 跟随主导人物')
  const [simulating, setSimulating] = useState(false)
  const [simResult, setSimResult] = useState<any>(null)
  const [endings, setEndings] = useState<Ending[]>([])
  const [selectedEndings, setSelectedEndings] = useState<string[]>([])
  const [endingCompare, setEndingCompare] = useState<any>(null)
  const [selectedBranches, setSelectedBranches] = useState<string[]>([])
  const [branchCompare, setBranchCompare] = useState<any>(null)
  const [sixAxis, setSixAxis] = useState<Record<string, number>>({})
  const [negentropy, setNegentropy] = useState(0)
  const [chars, setChars] = useState<any[]>([])
  const [profileCharId, setProfileCharId] = useState('')
  const [profile, setProfile] = useState<Record<string, Record<string, number>>>({})
  const [branchName, setBranchName] = useState('')
  const [branchEventForm, setBranchEventForm] = useState({ name: '', description: '', polarity: '威胁', intensity: '中' })
  const [endingForm, setEndingForm] = useState({ name: '', description: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const selectedEvent = useMemo(() => events.find((row) => row.id === selectedEventId) || null, [events, selectedEventId])

  const loadBase = useCallback(async () => {
    if (!worldId) return
    setError('')
    try {
      const [eventRows, branchRows, endingRows, axis] = await Promise.all([
        fetch(`${API_ORIGIN}/api/events?world_id=${worldId}`).then((r) => r.json()),
        listBranches(worldId),
        listEndings(worldId),
        getSixAxis(worldId),
      ])
      setEvents(Array.isArray(eventRows) ? eventRows : [])
      setBranches(branchRows)
      setEndings(endingRows)
      setSixAxis(axis.six_axis || {})
      setNegentropy(typeof axis.negentropy === 'number' ? axis.negentropy : 0)
      const characterRows = await fetch(`${API_ORIGIN}/api/characters?world_id=${worldId}`).then((r) => r.json())
      setChars(Array.isArray(characterRows) ? characterRows : [])
    } catch (err: any) {
      setError(String(err?.message || err))
    }
  }, [worldId])

  useEffect(() => {
    void loadBase()
  }, [loadBase])

  useEffect(() => {
    if (!selectedEventId) {
      setDirections([])
      return
    }
    listDirections(selectedEventId)
      .then(setDirections)
      .catch((err) => setError(String(err?.message || err)))
    setDraft(null)
    setEditingId(null)
    setSuggestions([])
  }, [selectedEventId])

  useEffect(() => {
    if (!selectedBranchId) {
      setDetail(null)
      return
    }
    getBranch(selectedBranchId)
      .then((data) => {
        setDetail(data)
        setSimEventId(data.root_event_id)
      })
      .catch((err) => setError(String(err?.message || err)))
    fetch(`${API_ORIGIN}/api/events?world_id=${worldId}&branch_id=${selectedBranchId}`)
      .then((r) => r.json())
      .then((rows) => setBranchEvents(Array.isArray(rows) ? rows : []))
      .catch(() => setBranchEvents([]))
  }, [selectedBranchId, worldId])

  const reloadBranches = async () => {
    const rows = await listBranches(worldId)
    setBranches(rows)
    if (selectedBranchId) {
      const data = await getBranch(selectedBranchId)
      setDetail(data)
    }
    setEndings(await listEndings(worldId))
  }

  const run = async (task: () => Promise<void>) => {
    setBusy(true)
    setError('')
    try {
      await task()
    } catch (err: any) {
      setError(String(err?.message || err))
    } finally {
      setBusy(false)
    }
  }

  // ---- 方向 ----
  const startCreate = () => {
    setEditingId(null)
    setDraft({ name: '', description: '', trigger_conditions: [], cognition: {}, behavior_output: '', reality_resistance: '', direct_result: '', future_impacts: [] })
  }

  const startEdit = (row: Direction) => {
    setEditingId(row.id)
    setDraft({ ...row })
  }

  const saveDraft = () =>
    run(async () => {
      if (!draft || !(draft.name || '').trim()) {
        setError('方向名称不能为空')
        return
      }
      const payload: Partial<Direction> = {
        name: draft.name,
        description: draft.description || '',
        trigger_conditions: draft.trigger_conditions || [],
        cognition: draft.cognition || {},
        behavior_output: draft.behavior_output || '',
        reality_resistance: draft.reality_resistance || '',
        direct_result: draft.direct_result || '',
        future_impacts: draft.future_impacts || [],
      }
      if (editingId) await updateDirection(editingId, payload)
      else await createDirection(selectedEventId, payload)
      setDirections(await listDirections(selectedEventId))
      setDraft(null)
      setEditingId(null)
    })

  const adoptSuggestion = (suggestion: Partial<Direction>) =>
    run(async () => {
      await createDirection(selectedEventId, { ...suggestion, source: 'ai', confirmed: true })
      setSuggestions((rows) => rows.filter((row) => row.name !== suggestion.name))
      setDirections(await listDirections(selectedEventId))
    })

  // ---- 分支 ----
  const makeBranch = (direction?: Direction) =>
    run(async () => {
      if (!selectedEventId) {
        setError('请先选择事件')
        return
      }
      const branch = await createBranch({
        root_event_id: selectedEventId,
        source_direction_id: direction?.id,
        name: branchName.trim() || undefined,
      })
      setBranchName('')
      setBranches(await listBranches(worldId))
      setSelectedBranchId(branch.id)
    })

  const simulate = () =>
    run(async () => {
      if (!selectedBranchId || !simEventId) {
        setError('请选择分支与事件')
        return
      }
      setSimulating(true)
      try {
        const result = await simulateBranch(selectedBranchId, {
          event_id: simEventId,
          direction_id: simDirectionId || undefined,
          perspective,
        })
        setSimResult(result)
        await reloadBranches()
      } finally {
        setSimulating(false)
      }
    })

  const createBranchEvent = () =>
    run(async () => {
      if (!selectedBranchId || !branchEventForm.name.trim()) {
        setError('请填写分支事件名称')
        return
      }
      const response = await fetch(`${API_ORIGIN}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch_id: selectedBranchId,
          world_id: worldId,
          name: branchEventForm.name,
          description: branchEventForm.description,
          polarity: branchEventForm.polarity,
          intensity: branchEventForm.intensity,
          participants: selectedEvent?.participants || [],
        }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.detail || '创建分支事件失败')
      }
      setBranchEventForm({ name: '', description: '' , polarity: '威胁', intensity: '中' })
      const rows = await fetch(`${API_ORIGIN}/api/events?world_id=${worldId}&branch_id=${selectedBranchId}`).then((r) => r.json())
      setBranchEvents(Array.isArray(rows) ? rows : [])
    })

  const makeEnding = () =>
    run(async () => {
      if (!selectedBranchId) return
      await createEnding(selectedBranchId, {
        name: endingForm.name || undefined,
        description: endingForm.description || undefined,
      })
      setEndingForm({ name: '', description: '' })
      await reloadBranches()
    })

  const compareSelectedBranches = () =>
    run(async () => {
      if (selectedBranches.length < 2) {
        setError('至少选择两个分支')
        return
      }
      setBranchCompare(await compareBranches(selectedBranches))
    })

  const compareSelectedEndings = () =>
    run(async () => {
      if (selectedEndings.length < 2) {
        setError('至少选择两个结局')
        return
      }
      setEndingCompare(await compareEndings(selectedEndings))
    })

  const loadProfile = (characterId: string) => {
    setProfileCharId(characterId)
    if (!characterId) {
      setProfile({})
      return
    }
    getCProfile(characterId)
      .then((data) => {
        const filled: Record<string, Record<string, number>> = {}
        for (const group of PROFILE_GROUPS) {
          const source = (data.c_profile?.[group.key] || {}) as Record<string, any>
          filled[group.key] = {}
          for (const field of group.fields) {
            const value = source[field]
            filled[group.key][field] = typeof value === 'number' ? value : 0.5
          }
        }
        setProfile(filled)
      })
      .catch((err) => setError(String(err?.message || err)))
  }

  const saveProfile = () =>
    run(async () => {
      if (!profileCharId) return
      await putCProfile(profileCharId, profile)
      setError('')
    })

  const saveSixAxis = () =>
    run(async () => {
      const payload: Record<string, number> = {}
      for (const axis of SIX_AXIS) payload[axis.key] = Number(sixAxis[axis.key] ?? 0)
      const saved = await putSixAxis(worldId, { six_axis: payload, negentropy })
      setSixAxis(saved.six_axis || {})
      setNegentropy(typeof saved.negentropy === 'number' ? saved.negentropy : 0)
    })

  if (!worldId) {
    return <div style={{ padding: '2rem', color: 'var(--text-main)' }}>请先进入一个世界。</div>
  }

  return (
    <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '12px', color: 'var(--text-main)', minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '17px' }}>多路径推演</h2>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          分支为沙盒，推演不污染主时间线；只有「应用分支」才会覆盖主时间线。
        </span>
      </div>
      {error && (
        <div style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--danger-color)', color: 'var(--danger-color)', fontSize: '11px' }}>{error}</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '300px minmax(320px, 1fr) 320px', gap: '12px', alignItems: 'start' }}>
        {/* 左：事件与方向 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={panelStyle}>
            <strong style={{ fontSize: '12.5px' }}>主时间线事件</strong>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '220px', overflowY: 'auto' }}>
              {events.length === 0 && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>暂无事件</span>}
              {events.map((event) => (
                <button
                  key={event.id}
                  onClick={() => setSelectedEventId(event.id)}
                  style={{
                    ...btn,
                    textAlign: 'left',
                    borderColor: event.id === selectedEventId ? 'var(--primary-color)' : 'var(--card-border)',
                  }}
                >
                  {event.name}
                </button>
              ))}
            </div>
          </div>

          <div style={panelStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
              <strong style={{ fontSize: '12.5px' }}>发展方向</strong>
              <div style={{ display: 'flex', gap: '5px' }}>
                <button style={btn} disabled={!selectedEventId || busy} onClick={startCreate}>新建</button>
                <button
                  style={btn}
                  disabled={!selectedEventId || busy}
                  onClick={() => run(async () => setSuggestions((await suggestDirections(selectedEventId)).directions))}
                >
                  AI 建议
                </button>
              </div>
            </div>

            {directions.map((row) => {
              const badge = sourceBadge(row.source)
              return (
                <div key={row.id} style={{ border: '1px solid var(--card-border)', borderRadius: '8px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '6px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, opacity: row.enabled ? 1 : 0.5 }}>{row.name}</span>
                    <span style={{ fontSize: '9.5px', color: badge.color }}>{badge.text}</span>
                  </div>
                  {row.description && <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>{row.description}</span>}
                  <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                    <button style={btn} onClick={() => startEdit(row)}>编辑</button>
                    <button style={btn} onClick={() => run(async () => { await duplicateDirection(row.id); setDirections(await listDirections(selectedEventId)) })}>复制</button>
                    <button style={btn} onClick={() => run(async () => { await toggleDirection(row.id); setDirections(await listDirections(selectedEventId)) })}>{row.enabled ? '禁用' : '启用'}</button>
                    <button style={btn} onClick={() => run(async () => { await deleteDirection(row.id); setDirections(await listDirections(selectedEventId)) })}>删除</button>
                    <button style={primaryBtn} onClick={() => makeBranch(row)}>从此建分支</button>
                  </div>
                </div>
              )
            })}

            {suggestions.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px dashed var(--card-border)', paddingTop: '8px' }}>
                <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>AI 建议（采纳后才入库）</span>
                {suggestions.map((item, index) => (
                  <div key={`${item.name}-${index}`} style={{ border: '1px solid var(--card-border)', borderRadius: '8px', padding: '7px' }}>
                    <div style={{ fontSize: '11.5px', fontWeight: 600 }}>{item.name}</div>
                    {item.description && <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{item.description}</div>}
                    <button style={{ ...primaryBtn, marginTop: '5px' }} onClick={() => adoptSuggestion(item)}>采纳</button>
                  </div>
                ))}
              </div>
            )}

            {draft && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', borderTop: '1px dashed var(--card-border)', paddingTop: '8px' }}>
                <label style={labelStyle}>名称</label>
                <input style={inputStyle} value={draft.name || ''} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                <label style={labelStyle}>描述</label>
                <textarea style={{ ...inputStyle, minHeight: '52px' }} value={draft.description || ''} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
                <label style={labelStyle}>触发条件（每行一条）</label>
                <textarea
                  style={{ ...inputStyle, minHeight: '44px' }}
                  value={(draft.trigger_conditions || []).join('\n')}
                  onChange={(e) => setDraft({ ...draft, trigger_conditions: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })}
                />
                <label style={labelStyle}>事件认知：意义</label>
                <input
                  style={inputStyle}
                  value={draft.cognition?.meaning || ''}
                  onChange={(e) => setDraft({ ...draft, cognition: { ...(draft.cognition || {}), meaning: e.target.value } })}
                />
                <label style={labelStyle}>事件认知：归因</label>
                <input
                  style={inputStyle}
                  value={draft.cognition?.attribution || ''}
                  onChange={(e) => setDraft({ ...draft, cognition: { ...(draft.cognition || {}), attribution: e.target.value } })}
                />
                <label style={labelStyle}>认知确定度（0-1）</label>
                <input
                  style={inputStyle}
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  value={Number(draft.cognition?.certainty ?? 0.6)}
                  onChange={(e) => setDraft({ ...draft, cognition: { ...(draft.cognition || {}), certainty: Number(e.target.value) } })}
                />
                <label style={labelStyle}>可能的行为输出</label>
                <textarea style={{ ...inputStyle, minHeight: '44px' }} value={draft.behavior_output || ''} onChange={(e) => setDraft({ ...draft, behavior_output: e.target.value })} />
                <label style={labelStyle}>现实条件与外部阻力</label>
                <textarea style={{ ...inputStyle, minHeight: '44px' }} value={draft.reality_resistance || ''} onChange={(e) => setDraft({ ...draft, reality_resistance: e.target.value })} />
                <label style={labelStyle}>直接结果</label>
                <textarea style={{ ...inputStyle, minHeight: '44px' }} value={draft.direct_result || ''} onChange={(e) => setDraft({ ...draft, direct_result: e.target.value })} />
                <label style={labelStyle}>后续影响（每行一条）</label>
                <textarea
                  style={{ ...inputStyle, minHeight: '44px' }}
                  value={(draft.future_impacts || []).join('\n')}
                  onChange={(e) => setDraft({ ...draft, future_impacts: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })}
                />
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button style={primaryBtn} disabled={busy} onClick={saveDraft}>{editingId ? '保存修改' : '创建方向'}</button>
                  <button style={btn} onClick={() => { setDraft(null); setEditingId(null) }}>取消</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 中：分支与推演 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={panelStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
              <strong style={{ fontSize: '12.5px' }}>分支沙盒</strong>
              <div style={{ display: 'flex', gap: '5px' }}>
                <input
                  style={{ ...inputStyle, width: '110px' }}
                  placeholder="分支名称（可选）"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                />
                <button style={btn} disabled={!selectedEventId || busy} onClick={() => makeBranch()}>新建分支</button>
              </div>
            </div>
            {branches.length === 0 && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>还没有分支。选择方向后点「从此建分支」。</span>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {branches.map((row) => (
                <div
                  key={row.id}
                  style={{
                    border: `1px solid ${row.id === selectedBranchId ? 'var(--primary-color)' : 'var(--card-border)'}`,
                    borderRadius: '8px',
                    padding: '7px 9px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <button style={{ ...btn, border: 'none', padding: 0, textAlign: 'left', flex: 1 }} onClick={() => setSelectedBranchId(row.id)}>
                    <span style={{ fontSize: '12px', fontWeight: 600 }}>{row.name}</span>
                    <span style={{ fontSize: '9.5px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                      {row.status} · 节点 {row.node_count} · 结局 {row.ending_count}
                    </span>
                  </button>
                  <input
                    type="checkbox"
                    checked={selectedBranches.includes(row.id)}
                    onChange={(e) =>
                      setSelectedBranches((ids) => (e.target.checked ? [...ids, row.id].slice(-2) : ids.filter((id) => id !== row.id)))
                    }
                  />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button style={btn} disabled={selectedBranches.length < 2 || busy} onClick={compareSelectedBranches}>对比选中分支</button>
            </div>
          </div>

          {detail && (
            <>
              <div style={panelStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: '12.5px' }}>{detail.name}</strong>
                  <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                    <button style={btn} disabled={busy} onClick={() => run(async () => { await (detail.status === 'active' ? pauseBranch(detail.id) : resumeBranch(detail.id)); await reloadBranches() })}>
                      {detail.status === 'active' ? '暂停' : '恢复'}
                    </button>
                    <button style={btn} disabled={busy} onClick={() => run(async () => { await duplicateBranch(detail.id); await reloadBranches() })}>复制</button>
                    <button style={btn} disabled={busy} onClick={() => run(async () => { if (window.confirm('归档该分支？数据保留，可恢复。')) { await archiveBranch(detail.id); await reloadBranches() } })}>归档</button>
                    <button
                      style={btn}
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          if (!window.confirm('把该分支当前状态应用到主时间线？将先自动备份主时间线。')) return
                          await applyBranch(detail.id)
                          await loadBase()
                          await reloadBranches()
                        })
                      }
                    >
                      应用分支
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '180px', overflowY: 'auto' }}>
                  {detail.nodes.map((node) => (
                    <div key={node.id} style={{ border: '1px solid var(--card-border)', borderRadius: '7px', padding: '6px 8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '6px' }}>
                        <span style={{ fontSize: '11px' }}>
                          #{node.seq} · {node.kind} · {node.summary}
                        </span>
                        <button
                          style={{ ...btn, padding: '2px 7px', fontSize: '10px' }}
                          disabled={busy}
                          onClick={() => run(async () => { await rollbackBranch(detail.id, node.id); await reloadBranches() })}
                        >
                          回溯到此
                        </button>
                      </div>
                      {node.rollback_reason && <div style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>回溯原因：{node.rollback_reason}</div>}
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px dashed var(--card-border)', paddingTop: '8px' }}>
                  <strong style={{ fontSize: '12px' }}>在分支中推演</strong>
                  <select style={inputStyle} value={simEventId} onChange={(e) => setSimEventId(e.target.value)}>
                    <option value="">选择事件</option>
                    {branchEvents.map((event) => (
                      <option key={event.id} value={event.id}>
                        {event.name}{event.branch_id ? '（分支事件）' : ''}
                      </option>
                    ))}
                    {events.filter((event) => !branchEvents.some((row) => row.id === event.id)).map((event) => (
                      <option key={`main-${event.id}`} value={event.id}>{event.name}（主时间线）</option>
                    ))}
                  </select>
                  <select style={inputStyle} value={simDirectionId} onChange={(e) => setSimDirectionId(e.target.value)}>
                    <option value="">方向（可选）</option>
                    {directions.filter((row) => row.event_id === simEventId).map((row) => (
                      <option key={row.id} value={row.id}>{row.name}{row.enabled ? '' : '（已禁用）'}</option>
                    ))}
                  </select>
                  <input style={inputStyle} value={perspective} onChange={(e) => setPerspective(e.target.value)} placeholder="推演视角" />
                  <button style={primaryBtn} disabled={busy || simulating || detail.status !== 'active'} onClick={simulate}>
                    {simulating ? '推演中…' : '开始分支推演'}
                  </button>
                  {simResult && (
                    <div style={{ border: '1px solid var(--card-border)', borderRadius: '8px', padding: '8px', fontSize: '10.5px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div>关系变化 {simResult.applied?.relationships ?? 0} 条 · 行动 {simResult.applied?.actions ?? 0} 条{simResult.state_hint ? ` · 状态标签 ${simResult.state_hint}` : ''}</div>
                      {simResult.run?.world_changes && <div style={{ color: 'var(--text-muted)' }}>世界变化：{simResult.run.world_changes}</div>}
                      {(simResult.run?.character_actions || []).map((action: any, index: number) => (
                        <div key={index}>
                          <strong>{action.name}</strong>（{action.engine || '—'}）：{action.action} → {action.status}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px dashed var(--card-border)', paddingTop: '8px' }}>
                  <strong style={{ fontSize: '12px' }}>分支内新建事件</strong>
                  <input style={inputStyle} placeholder="事件名称" value={branchEventForm.name} onChange={(e) => setBranchEventForm({ ...branchEventForm, name: e.target.value })} />
                  <textarea style={{ ...inputStyle, minHeight: '42px' }} placeholder="事件描述" value={branchEventForm.description} onChange={(e) => setBranchEventForm({ ...branchEventForm, description: e.target.value })} />
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <select style={inputStyle} value={branchEventForm.polarity} onChange={(e) => setBranchEventForm({ ...branchEventForm, polarity: e.target.value })}>
                      {['威胁', '机会', '中性', '混合'].map((value) => <option key={value} value={value}>{value}</option>)}
                    </select>
                    <select style={inputStyle} value={branchEventForm.intensity} onChange={(e) => setBranchEventForm({ ...branchEventForm, intensity: e.target.value })}>
                      {['极低', '低', '中', '高', '极高'].map((value) => <option key={value} value={value}>{value}</option>)}
                    </select>
                  </div>
                  <button style={btn} disabled={busy} onClick={createBranchEvent}>创建分支事件</button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px dashed var(--card-border)', paddingTop: '8px' }}>
                  <strong style={{ fontSize: '12px' }}>生成结局</strong>
                  <input style={inputStyle} placeholder="结局名称" value={endingForm.name} onChange={(e) => setEndingForm({ ...endingForm, name: e.target.value })} />
                  <textarea style={{ ...inputStyle, minHeight: '42px' }} placeholder="结局描述（可选）" value={endingForm.description} onChange={(e) => setEndingForm({ ...endingForm, description: e.target.value })} />
                  <button style={btn} disabled={busy || detail.status !== 'active'} onClick={makeEnding}>保存为结局</button>
                </div>
              </div>
            </>
          )}

          {branchCompare && (
            <div style={panelStyle}>
              <strong style={{ fontSize: '12.5px' }}>分支对比</strong>
              {(branchCompare.comparisons || []).map((item: any, index: number) => (
                <div key={index} style={{ fontSize: '10.5px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <div style={{ color: 'var(--text-muted)' }}>{item.a} ↔ {item.b}</div>
                  {item.diff?.relationships?.length > 0 && (
                    <div>
                      关系：{item.diff.relationships.map((row: any) => `${row.pair}（${row.a || '—'} → ${row.b || '—'}）`).join('；')}
                    </div>
                  )}
                  {item.diff?.characters?.length > 0 && (
                    <div>
                      人物：{item.diff.characters.map((row: any) => row.name).join('、')} 存在差异
                    </div>
                  )}
                  {item.diff?.world?.length > 0 && (
                    <div>
                      世界：{item.diff.world.map((row: any) => `${row.field}（${row.a ?? '—'} → ${row.b ?? '—'}）`).join('；')}
                    </div>
                  )}
                  {!item.diff?.relationships?.length && !item.diff?.characters?.length && !item.diff?.world?.length && <div style={{ color: 'var(--text-muted)' }}>状态基本一致</div>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 右：结局 / 六轴 / C_profile */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={panelStyle}>
            <strong style={{ fontSize: '12.5px' }}>结局管理</strong>
            {endings.length === 0 && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>暂无结局</span>}
            {endings.map((row) => (
              <div key={row.id} style={{ border: '1px solid var(--card-border)', borderRadius: '8px', padding: '7px 9px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '6px', alignItems: 'center' }}>
                  <span style={{ fontSize: '11.5px', fontWeight: 600 }}>{row.name}</span>
                  <input
                    type="checkbox"
                    checked={selectedEndings.includes(row.id)}
                    onChange={(e) => setSelectedEndings((ids) => (e.target.checked ? [...ids, row.id].slice(-2) : ids.filter((id) => id !== row.id)))}
                  />
                </div>
                {row.description && <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px' }}>{row.description}</div>}
                <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
                  <button
                    style={{ ...btn, padding: '2px 7px', fontSize: '10px' }}
                    disabled={busy || !row.allow_continue}
                    onClick={() => run(async () => { await continueEnding(row.id); await reloadBranches() })}
                  >
                    继续推演
                  </button>
                  <button style={{ ...btn, padding: '2px 7px', fontSize: '10px' }} disabled={busy} onClick={() => run(async () => { await deleteEnding(row.id); await reloadBranches() })}>删除</button>
                </div>
              </div>
            ))}
            <button style={primaryBtn} disabled={selectedEndings.length < 2 || busy} onClick={compareSelectedEndings}>对比选中结局</button>
            {endingCompare && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px dashed var(--card-border)', paddingTop: '8px' }}>
                {(endingCompare.comparisons || []).map((item: any, index: number) => (
                  <div key={index} style={{ fontSize: '10px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <div style={{ color: 'var(--text-muted)' }}>{item.a} ↔ {item.b}</div>
                    {(item.diff?.relationships || []).map((row: any) => <div key={row.pair}>关系 {row.pair}：{row.a ?? '—'} → {row.b ?? '—'}</div>)}
                    {(item.diff?.characters || []).map((row: any) => <div key={row.name}>人物 {row.name} 终态不同</div>)}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={panelStyle}>
            <strong style={{ fontSize: '12.5px' }}>世界六轴压强</strong>
            {SIX_AXIS.map((axis) => (
              <div key={axis.key}>
                <label style={labelStyle}>{axis.label}（0-1，越高压力越大）</label>
                <input
                  style={inputStyle}
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  value={Number(sixAxis[axis.key] ?? 0)}
                  onChange={(e) => setSixAxis({ ...sixAxis, [axis.key]: Number(e.target.value) })}
                />
              </div>
            ))}
            <label style={labelStyle}>负熵（环境修复力，0-1）</label>
            <input style={inputStyle} type="number" min={0} max={1} step={0.05} value={Number(negentropy ?? 0)} onChange={(e) => setNegentropy(Number(e.target.value))} />
            <button style={btn} disabled={busy} onClick={saveSixAxis}>保存六轴</button>
          </div>

          <div style={panelStyle}>
            <strong style={{ fontSize: '12.5px' }}>人物人格参数（C_profile）</strong>
            <select style={inputStyle} value={profileCharId} onChange={(e) => loadProfile(e.target.value)}>
              <option value="">选择人物</option>
              {chars.map((char) => (
                <option key={char.id} value={char.id}>{char.name}</option>
              ))}
            </select>
            {profileCharId && PROFILE_GROUPS.map((group) => (
              <div key={group.key} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '10.5px', fontWeight: 600 }}>{group.label}</span>
                {group.fields.map((field) => (
                  <div key={field} style={{ display: 'grid', gridTemplateColumns: '1fr 64px', gap: '6px', alignItems: 'center' }}>
                    <span style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>{field}</span>
                    <input
                      style={{ ...inputStyle, padding: '4px 6px' }}
                      type="number"
                      min={0}
                      max={1}
                      step={0.05}
                      value={Number(profile?.[group.key]?.[field] ?? 0.5)}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          [group.key]: { ...(profile[group.key] || {}), [field]: Number(e.target.value) },
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            ))}
            {profileCharId && <button style={btn} disabled={busy} onClick={saveProfile}>保存人格参数</button>}
          </div>
        </div>
      </div>
    </div>
  )
}
