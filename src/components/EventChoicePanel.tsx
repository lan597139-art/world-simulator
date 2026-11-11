import { useEffect, useState } from 'react'
import * as api from '../api/eventChoices'

type EventLite = { id: string; name: string }

export default function EventChoicePanel({
  eventId,
  eventName,
  worldId,
  events,
  onEventsChanged,
  onOpenSandbox,
}: {
  eventId: string
  eventName?: string
  worldId?: string
  events: EventLite[]
  onEventsChanged?: () => void
  onOpenSandbox?: (branchId: string) => void
}) {
  const [choices, setChoices] = useState<api.EventChoice[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [activeChoice, setActiveChoice] = useState('')
  const [label, setLabel] = useState('')
  const [consequence, setConsequence] = useState('')
  const [outcome, setOutcome] = useState('')
  const [followUpOpen, setFollowUpOpen] = useState(false)
  const [followUpName, setFollowUpName] = useState('')
  const [extraEvents, setExtraEvents] = useState<EventLite[]>([])
  const [busy, setBusy] = useState(false)
  const [log, setLog] = useState('')
  const [relation, setRelation] = useState<string[]>([])

  const load = async () => {
    try {
      setChoices(await api.listEventChoices(eventId))
    } catch (error: any) {
      setLog(`❌ ${error.message || error}`)
    }
  }

  useEffect(() => {
    void load()
    setActiveChoice('')
    setExtraEvents([])
    setRelation([])
    setLog('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId])

  const run = async (fn: () => Promise<unknown>, message: string) => {
    setBusy(true)
    try {
      await fn()
      await load()
      setLog(message)
      onEventsChanged?.()
    } catch (error: any) {
      setLog(`❌ ${error.message || error}`)
    } finally {
      setBusy(false)
    }
  }

  const addChoice = () => {
    if (!title.trim()) return
    void run(async () => {
      await api.createEventChoice(eventId, { title: title.trim(), description })
      setTitle('')
      setDescription('')
    }, '选择已添加')
  }

  const addOption = (choiceId: string) => {
    if (!label.trim()) return
    void run(async () => {
      await api.createEventOption(choiceId, {
        label: label.trim(), consequence, outcome_event_id: outcome || undefined,
      })
      setLabel(''); setConsequence(''); setOutcome(''); setActiveChoice(''); setFollowUpOpen(false)
    }, '结果已添加')
  }

  const createFollowUp = async () => {
    if (!worldId || !followUpName.trim()) return
    setBusy(true)
    try {
      const created = await api.createFollowUpEvent(worldId, followUpName.trim())
      setExtraEvents((prev) => [...prev, { id: created.id, name: created.name }])
      setOutcome(created.id)
      setFollowUpName(''); setFollowUpOpen(false)
      setLog(`后续事件「${created.name}」已创建，保存结果即可关联`)
      onEventsChanged?.()
    } catch (error: any) {
      setLog(`❌ ${error.message || error}`)
    } finally {
      setBusy(false)
    }
  }

  const editChoice = async (choice: api.EventChoice) => {
    const nextTitle = window.prompt('选择名称', choice.title)
    if (nextTitle === null || !nextTitle.trim()) return
    const nextDescription = window.prompt('选择说明', choice.description || '')
    await run(() => api.updateEventChoice(choice.id, {
      title: nextTitle.trim(), description: nextDescription ?? choice.description,
    }), '选择已更新')
  }

  const editOption = async (option: api.EventChoiceOption) => {
    const nextLabel = window.prompt('选项名称', option.label)
    if (nextLabel === null || !nextLabel.trim()) return
    const nextResult = window.prompt('选择结果', option.consequence || '')
    await run(() => api.updateEventOption(option.id, {
      label: nextLabel.trim(), consequence: nextResult ?? option.consequence,
    }), '选项已更新')
  }

  const buildRelation = async () => {
    const lines: string[] = []
    const seen = new Set<string>([eventId])
    const walk = async (id: string, name: string, depth: number) => {
      if (depth > 5) { lines.push(`${'  '.repeat(depth)}└─ …更深的后续事件`); return }
      const rows = await api.listEventChoices(id)
      if (rows.length === 0) return
      rows.forEach((choice, ci) => {
        const last = ci === rows.length - 1
        lines.push(`${'  '.repeat(depth)}${last ? '└' : '├'}─ 选择：${choice.title}`)
        choice.options.forEach((option, oi) => {
          const optionLast = oi === choice.options.length - 1
          lines.push(`${'  '.repeat(depth + 1)}${optionLast ? '└' : '├'}─ 结果：${option.label}${option.consequence ? `（${option.consequence}）` : ''}`)
          if (option.outcome_event_id) {
            lines.push(`${'  '.repeat(depth + 2)}└→ 后续事件：${option.outcome_event_name || option.outcome_event_id}`)
          }
        })
      })
      for (const choice of rows) {
        for (const option of choice.options) {
          if (option.outcome_event_id && !seen.has(option.outcome_event_id)) {
            seen.add(option.outcome_event_id)
            await walk(option.outcome_event_id, option.outcome_event_name || option.outcome_event_id, depth + 1)
          }
        }
      }
    }
    try {
      await walk(eventId, eventName || '当前事件', 0)
      setRelation(lines.length ? lines : ['当前事件还没有选择结果'])
    } catch (error: any) {
      setLog(`❌ ${error.message || error}`)
    }
  }

  const inputStyle: React.CSSProperties = {
    padding: '6px 8px', borderRadius: '5px', border: '1px solid var(--card-border)',
    background: 'transparent', color: 'var(--text-main)', fontSize: '12px',
  }
  const btnStyle: React.CSSProperties = {
    padding: '5px 10px', borderRadius: '5px', border: '1px solid var(--card-border)',
    background: 'transparent', color: 'var(--text-main)', cursor: 'pointer', fontSize: '11px',
  }
  const outcomeEvents = [...events, ...extraEvents].filter((item, index, all) =>
    item.id !== eventId && all.findIndex((entry) => entry.id === item.id) === index)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div>
        <h3 style={{ margin: 0, fontSize: '15px', color: 'var(--text-main)' }}>事件发展与选择</h3>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.7 }}>
          选择 → 结果 → 后续事件。每个选择是独立决策；结果说明“发生了什么”；后续事件关联 05 事件库中的已有事件，或现场新建。
        </div>
      </div>

      {choices.length === 0 && <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '10px', border: '1px dashed var(--card-border)', borderRadius: '8px' }}>
        还没有选择。添加第一个选择，例如「立即揭发 / 暗中调查 / 与叛徒合作」。
      </div>}

      {choices.map((choice) => (
        <div key={choice.id} style={{ border: '1px solid var(--card-border)', borderRadius: '8px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <strong style={{ fontSize: '13px', color: 'var(--text-main)' }}>{choice.title}</strong>
            <span style={{ flex: 1 }} />
            <button style={btnStyle} disabled={busy} onClick={() => void editChoice(choice)}>编辑选择</button>
            <button style={{ ...btnStyle, color: 'var(--danger-color)' }} disabled={busy}
              onClick={() => void run(() => api.deleteEventChoice(choice.id), '选择已删除')}>删除</button>
          </div>
          {choice.description && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{choice.description}</div>}

          {choice.options.map((option, optionIndex) => (
            <div key={option.id} style={{ background: 'rgba(128,128,128,0.06)', borderRadius: '6px', padding: '7px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <strong style={{ fontSize: '12px', color: 'var(--text-main)' }}>{option.label}</strong>
                <span style={{ flex: 1 }} />
                {option.outcome_event_name && <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>后续：{option.outcome_event_name}</span>}
                <button style={{ ...btnStyle, padding: '2px 5px' }} disabled={busy || optionIndex === 0}
                  onClick={() => void run(() => api.updateEventOption(option.id, { order_index: optionIndex - 1 }), '结果顺序已调整')}>↑</button>
                <button style={{ ...btnStyle, padding: '2px 5px' }} disabled={busy || optionIndex === choice.options.length - 1}
                  onClick={() => void run(() => api.updateEventOption(option.id, { order_index: optionIndex + 1 }), '结果顺序已调整')}>↓</button>
                <button style={btnStyle} disabled={busy} onClick={() => void editOption(option)}>编辑结果</button>
                {option.target_branch_id ? (
                  <button style={{ ...btnStyle, borderColor: 'var(--primary-color)', color: 'var(--primary-color)' }}
                    onClick={() => onOpenSandbox?.(option.target_branch_id!)}>进入沙盒</button>
                ) : (
                  <button style={btnStyle} disabled={busy || !option.confirmed}
                    onClick={() => void run(() => api.makeEventSandbox(option.id), '平行沙盒已生成')}>生成平行沙盒</button>
                )}
                <button style={{ ...btnStyle, color: 'var(--danger-color)' }} disabled={busy}
                  onClick={() => void run(() => api.deleteEventOption(option.id), '结果已删除')}>×</button>
              </div>
              {option.consequence && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>结果：{option.consequence}</div>}
            </div>
          ))}

          {activeChoice === choice.id ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', borderTop: '1px dashed var(--card-border)', paddingTop: '7px' }}>
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="选项，如：暗中调查" style={{ ...inputStyle, flex: 1, minWidth: '120px' }} />
                <input value={consequence} onChange={(e) => setConsequence(e.target.value)} placeholder="结果，如：发现更大的阴谋" style={{ ...inputStyle, flex: 1, minWidth: '160px' }} />
              </div>
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
                <select value={outcome} onChange={(e) => setOutcome(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: '150px' }}>
                  <option value="">后续事件（可选）</option>
                  {outcomeEvents.map((ev) => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
                </select>
                {worldId && <button style={btnStyle} onClick={() => setFollowUpOpen((prev) => !prev)}>+ 新建后续事件</button>}
                <button style={btnStyle} disabled={busy || !label.trim()} onClick={() => addOption(choice.id)}>保存结果</button>
                <button style={btnStyle} onClick={() => setActiveChoice('')}>取消</button>
              </div>
              {followUpOpen && (
                <div style={{ display: 'flex', gap: '5px' }}>
                  <input value={followUpName} onChange={(e) => setFollowUpName(e.target.value)} placeholder="新后续事件名称" style={{ ...inputStyle, flex: 1 }} />
                  <button style={btnStyle} disabled={busy || !followUpName.trim()} onClick={() => void createFollowUp()}>创建并关联</button>
                </div>
              )}
            </div>
          ) : (
            <button style={{ ...btnStyle, alignSelf: 'flex-start' }} onClick={() => { setActiveChoice(choice.id); setLabel(''); setConsequence(''); setOutcome(''); setFollowUpOpen(false) }}>+ 添加结果</button>
          )}
        </div>
      ))}

      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', borderTop: '1px dashed var(--card-border)', paddingTop: '9px' }}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="新选择，如：是否接受条件" style={{ ...inputStyle, flex: 1, minWidth: '160px' }} />
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="说明（可选）" style={{ ...inputStyle, flex: 1, minWidth: '130px' }} />
        <button style={btnStyle} disabled={busy || !title.trim()} onClick={addChoice}>+ 添加选择</button>
      </div>

      {choices.length > 0 && (
        <div style={{ borderTop: '1px dashed var(--card-border)', paddingTop: '9px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-main)' }}>发展关系预览</div>
            <div style={{ flex: 1 }} />
            <button style={btnStyle} onClick={() => void buildRelation()}>查看完整发展关系</button>
          </div>
          <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: '10.5px', color: 'var(--text-muted)', lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>
            {`事件：${eventName || '当前事件'}\n`}
            {choices.map((choice, ci) => {
              const last = ci === choices.length - 1
              return choice.options.length === 0
                ? `${last ? '└' : '├'}── 选择：${choice.title}（未配置结果）\n`
                : choice.options.map((option, oi) => {
                    const branchStem = last ? '    ' : '│   '
                    const optionStem = oi === choice.options.length - 1 ? '└' : '├'
                    return `${last ? '└' : '├'}── 选择：${choice.title}\n${branchStem}${optionStem}── ${option.label}${option.consequence ? ` → ${option.consequence}` : ''}${option.outcome_event_name ? ` → 后续：${option.outcome_event_name}` : ''}\n`
                  }).join('')
            }).join('')}
          </div>
        </div>
      )}
      {relation.length > 0 && (
        <div style={{ border: '1px solid var(--card-border)', borderRadius: '7px', padding: '8px', maxHeight: '220px', overflowY: 'auto' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>完整发展关系（可沿后续事件递归查看）</div>
          <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: '10px', color: 'var(--text-main)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
            {relation.join('\n')}
          </div>
        </div>
      )}
      {log && <div style={{ fontSize: '11px', color: log.startsWith('❌') ? 'var(--danger-color)' : 'var(--text-muted)' }}>{log}</div>}
    </div>
  )
}
