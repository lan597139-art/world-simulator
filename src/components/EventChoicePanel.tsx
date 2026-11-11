import { useEffect, useState } from 'react'
import * as api from '../api/eventChoices'

type EventLite = { id: string; name: string }

export default function EventChoicePanel({ eventId, events }: { eventId: string; events: EventLite[] }) {
  const [choices, setChoices] = useState<api.EventChoice[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [activeChoice, setActiveChoice] = useState('')
  const [label, setLabel] = useState('')
  const [consequence, setConsequence] = useState('')
  const [outcome, setOutcome] = useState('')
  const [busy, setBusy] = useState(false)
  const [log, setLog] = useState('')

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
    setLog('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId])

  const run = async (fn: () => Promise<unknown>, message: string) => {
    setBusy(true)
    try {
      await fn()
      await load()
      setLog(message)
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
    }, '选择点已创建')
  }

  const addOption = (choiceId: string) => {
    if (!label.trim()) return
    void run(async () => {
      await api.createEventOption(choiceId, {
        label: label.trim(), consequence, outcome_event_id: outcome || undefined,
      })
      setLabel('')
      setConsequence('')
      setOutcome('')
      setActiveChoice('')
    }, '选项已创建')
  }

  const inputStyle: React.CSSProperties = {
    padding: '6px 8px', borderRadius: '5px', border: '1px solid var(--card-border)',
    background: 'transparent', color: 'var(--text-main)', fontSize: '12px',
  }
  const btnStyle: React.CSSProperties = {
    padding: '5px 10px', borderRadius: '5px', border: '1px solid var(--card-border)',
    background: 'transparent', color: 'var(--text-main)', cursor: 'pointer', fontSize: '11px',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div>
        <h3 style={{ margin: 0, fontSize: '15px', color: 'var(--text-main)' }}>多剧情选择</h3>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>选择 → 结果 → 后续事件；可生成独立沙盒，不改原事件。</div>
      </div>

      {choices.map((choice) => (
        <div key={choice.id} style={{ border: '1px solid var(--card-border)', borderRadius: '8px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <strong style={{ fontSize: '13px', color: 'var(--text-main)' }}>{choice.title}</strong>
            <span style={{ flex: 1 }} />
            <button style={{ ...btnStyle, color: 'var(--danger-color)' }} disabled={busy}
              onClick={() => void run(() => api.deleteEventChoice(choice.id), '选择点已删除')}>删除</button>
          </div>
          {choice.description && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{choice.description}</div>}

          {choice.options.map((option) => (
            <div key={option.id} style={{ background: 'rgba(128,128,128,0.06)', borderRadius: '6px', padding: '7px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <strong style={{ fontSize: '12px', color: 'var(--text-main)' }}>{option.label}</strong>
                <span style={{ flex: 1 }} />
                {option.outcome_event_name && <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>→ {option.outcome_event_name}</span>}
                <button style={btnStyle} disabled={busy || !option.confirmed}
                  onClick={() => void run(() => api.makeEventSandbox(option.id), option.target_branch_id ? '沙盒已存在' : '沙盒已生成')}>
                  {option.target_branch_id ? '查看沙盒' : '生成沙盒'}
                </button>
                <button style={{ ...btnStyle, color: 'var(--danger-color)' }} disabled={busy}
                  onClick={() => void run(() => api.deleteEventOption(option.id), '选项已删除')}>×</button>
              </div>
              {option.consequence && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>结果：{option.consequence}</div>}
            </div>
          ))}

          {activeChoice === choice.id ? (
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
              <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="选项，如：离开" style={{ ...inputStyle, flex: 1, minWidth: '110px' }} />
              <input value={consequence} onChange={(e) => setConsequence(e.target.value)} placeholder="结果" style={{ ...inputStyle, flex: 1, minWidth: '130px' }} />
              <select value={outcome} onChange={(e) => setOutcome(e.target.value)} style={inputStyle}>
                <option value="">后续事件（可选）</option>
                {events.filter((ev) => ev.id !== eventId).map((ev) => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
              </select>
              <button style={btnStyle} disabled={busy} onClick={() => addOption(choice.id)}>保存</button>
              <button style={btnStyle} onClick={() => setActiveChoice('')}>取消</button>
            </div>
          ) : (
            <button style={{ ...btnStyle, alignSelf: 'flex-start' }} onClick={() => { setActiveChoice(choice.id); setLabel(''); setConsequence(''); setOutcome('') }}>+ 添加选项</button>
          )}
        </div>
      ))}

      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="新选择点，如：是否接受条件" style={{ ...inputStyle, flex: 1, minWidth: '160px' }} />
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="说明（可选）" style={{ ...inputStyle, flex: 1, minWidth: '130px' }} />
        <button style={btnStyle} disabled={busy || !title.trim()} onClick={addChoice}>+ 选择点</button>
      </div>
      {log && <div style={{ fontSize: '11px', color: log.startsWith('❌') ? 'var(--danger-color)' : 'var(--text-muted)' }}>{log}</div>}
    </div>
  )
}
