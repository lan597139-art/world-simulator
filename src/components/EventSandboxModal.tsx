import { useCallback, useEffect, useState } from 'react'
import * as sandboxApi from '../api/eventSandbox'
import type { SandboxItem, SandboxPresets, SandboxScenario } from '../api/eventSandbox'
import { createBranch } from '../api/multipath'
import AxisObjectsPanel from './AxisObjectsPanel'

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 75, background: 'rgba(0,0,0,.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14,
}
const card: React.CSSProperties = {
  background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 10,
  padding: 10, boxSizing: 'border-box',
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
const sectionTitle: React.CSSProperties = { fontSize: 11.5, fontWeight: 800, color: 'var(--primary-color)' }

const LIST_META: { key: keyof Pick<SandboxScenario, 'preset_options' | 'constraints' | 'supports' | 'potentials' | 'factors'>; title: string; hint: string; placeholder: string }[] = [
  { key: 'preset_options', title: 'A · 预设选项', hint: '作者可编辑、增删的探索方向；一个方案可有多条。', placeholder: '例如：让韩立先隐忍观察' },
  { key: 'constraints', title: 'B · 约束条件', hint: '必须遵守 / 不得突破的边界。', placeholder: '例如：不得突破人物现有能力' },
  { key: 'supports', title: 'C · 支持条件', hint: '让该方向成立所依赖的条件。', placeholder: '例如：人物之间存在信任' },
  { key: 'potentials', title: 'D · 潜在条件', hint: '只是可能性，未确认前不会被写成事实。', placeholder: '例如：某人物可能隐藏真实动机' },
  { key: 'factors', title: 'E · 可能关联', hint: '人物、组织、资源、环境等因素；只做关联，不改原对象。', placeholder: '关联因素名称' },
]

type Props = {
  event: any
  onClose: () => void
  onNavigate?: (page: string) => void
}

export default function EventSandboxModal({ event, onClose, onNavigate }: Props) {
  const [scenarios, setScenarios] = useState<SandboxScenario[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [draft, setDraft] = useState<SandboxScenario | null>(null)
  const [presets, setPresets] = useState<SandboxPresets | null>(null)
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [comparison, setComparison] = useState<any[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    if (!event?.id) return
    try {
      setError('')
      const [rows, presetData] = await Promise.all([
        sandboxApi.listSandboxScenarios(event.id),
        sandboxApi.getSandboxPresets(event.id),
      ])
      setScenarios(rows)
      setPresets(presetData)
      if (!selectedId && rows.length) setSelectedId(rows[0].id)
    } catch (err: any) { setError(err.message) }
  }, [event?.id, selectedId])

  useEffect(() => { void load() }, [event?.id])
  useEffect(() => {
    const found = scenarios.find((s) => s.id === selectedId) || null
    setDraft(found ? JSON.parse(JSON.stringify(found)) : null)
  }, [selectedId, scenarios])

  const flash = (text: string) => { setNotice(text); window.setTimeout(() => setNotice(''), 3500) }

  const createScenario = async () => {
    setBusy(true); setError('')
    try {
      const row = await sandboxApi.createSandboxScenario(event.id, {
        title: `沙盒方案 ${String.fromCharCode(65 + scenarios.length)}`,
        note: '', preset_options: [], constraints: [], supports: [], potentials: [], factors: [],
      })
      setScenarios((prev) => [row, ...prev]); setSelectedId(row.id); flash('已创建独立方案，可分别保存和比较')
    } catch (err: any) { setError(err.message) } finally { setBusy(false) }
  }

  const save = async (): Promise<boolean> => {
    if (!draft || !draft.title.trim()) { setError('方案名称不能为空'); return false }
    setBusy(true); setError('')
    try {
      const updated = await sandboxApi.updateSandboxScenario(draft.id, {
        title: draft.title.trim(), note: draft.note,
        preset_options: draft.preset_options, constraints: draft.constraints,
        supports: draft.supports, potentials: draft.potentials,
        factors: draft.factors,
      })
      setScenarios((prev) => prev.map((s) => s.id === updated.id ? updated : s))
      setDraft(JSON.parse(JSON.stringify(updated)))
      flash('方案已保存；原事件没有被复制或覆盖')
      return true
    } catch (err: any) { setError(err.message); return false } finally { setBusy(false) }
  }

  const removeScenario = async () => {
    if (!draft || !window.confirm(`删除沙盒方案「${draft.title}」？原事件与已创建分支不会被删除。`)) return
    setBusy(true)
    try {
      await sandboxApi.deleteSandboxScenario(draft.id)
      setSelectedId(''); setComparison(null); await load(); flash('方案已删除')
    } catch (err: any) { setError(err.message) } finally { setBusy(false) }
  }

  const list = (key: typeof LIST_META[number]['key']): SandboxItem[] => (draft?.[key] as SandboxItem[]) || []
  const setList = (key: typeof LIST_META[number]['key'], rows: SandboxItem[]) => {
    if (!draft) return
    setDraft({ ...draft, [key]: rows } as SandboxScenario)
  }
  const addItem = (key: typeof LIST_META[number]['key'], item: SandboxItem) => setList(key, [...list(key), item])
  const updateItem = (key: typeof LIST_META[number]['key'], index: number, patch: Partial<SandboxItem>) => {
    setList(key, list(key).map((row, i) => i === index ? { ...row, ...patch } : row))
  }
  const removeItem = (key: typeof LIST_META[number]['key'], index: number) => setList(key, list(key).filter((_, i) => i !== index))

  const compare = async () => {
    if (!compareIds.length) { setError('先勾选至少两个方案'); return }
    setBusy(true); setError('')
    try {
      const result = await sandboxApi.compareSandboxScenarios(compareIds)
      setComparison(result.scenarios)
    } catch (err: any) { setError(err.message) } finally { setBusy(false) }
  }

  const createRealBranch = async () => {
    if (!draft || !draft.id) return
    if (!(await save())) return
    setBusy(true); setError('')
    try {
      const branch = await createBranch({
        root_event_id: event.id,
        name: draft.title,
        note: `05 事件分支沙盒方案：${draft.title}`,
      })
      const updated = await sandboxApi.updateSandboxScenario(draft.id, { branch_id: branch.id, status: 'active' })
      setScenarios((prev) => prev.map((s) => s.id === updated.id ? updated : s))
      setDraft(JSON.parse(JSON.stringify(updated)))
      flash('已创建真实分支沙盒，并保留与原事件的关联；可在 07 模拟运行 / 08 写作辅助选择该分支')
    } catch (err: any) { setError(err.message) } finally { setBusy(false) }
  }

  const addSuggestion = (key: typeof LIST_META[number]['key'], item: SandboxItem) => {
    if (!draft) return
    const exists = list(key).some((row) => row.text === item.text || row.name === item.name)
    if (exists) return
    addItem(key, key === 'factors'
      ? { ...item, text: item.name || item.text }
      : { ...item, text: item.text || item.label, status: key === 'potentials' ? 'potential' : 'active' })
  }

  const suggestions = (key: typeof LIST_META[number]['key']): SandboxItem[] => {
    if (!presets) return []
    if (key === 'preset_options') return presets.preset_options
    if (key === 'constraints') return presets.constraint_candidates
    if (key === 'supports') return presets.support_candidates
    if (key === 'potentials') return presets.potential_candidates
    return presets.factors
  }

  return (
    <div style={overlay} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ ...card, width: 1160, maxWidth: '100%', height: '90vh', padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'var(--bg-color)' }}>
        <header style={{ padding: '12px 15px', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong style={{ fontSize: 15 }}>05 事件详情 · 分支沙盒</strong>
            <div style={{ fontSize: 13, color: 'var(--text-main)', marginTop: 2 }}>{event.name}</div>
            <div style={tiny}>
              {event.story_time || '时间未定'} · {event.storyline || '事件'} · {event.polarity || ''}{event.intensity ? ` / ${event.intensity}` : ''}
              {' '}· 这里只针对已有事件创建探索方案，不复制、不覆盖原事件。
            </div>
          </div>
          <button type="button" style={btn} onClick={onClose}>关闭</button>
        </header>
        {error && <div style={{ padding: '6px 14px', color: 'var(--danger-color)', background: 'rgba(239,68,68,.07)', fontSize: 11 }}>{error}</div>}
        {notice && <div style={{ padding: '6px 14px', color: '#2f7d57', background: 'rgba(47,125,87,.09)', fontSize: 11 }}>{notice}</div>}

        <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '225px minmax(0,1fr)' }}>
          <aside style={{ borderRight: '1px solid var(--card-border)', padding: 10, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 7 }}>
            <button type="button" style={{ ...btn, borderStyle: 'dashed' }} disabled={busy} onClick={() => void createScenario()}>＋ 新建独立方案</button>
            <div style={{ ...tiny, marginTop: 4 }}>同一事件可保存多个方案，互不覆盖。勾选可比较。</div>
            {scenarios.map((scenario) => (
              <div key={scenario.id} style={{ ...card, padding: 8, borderColor: selectedId === scenario.id ? 'var(--primary-color)' : 'var(--card-border)' }}>
                <label style={{ display: 'flex', gap: 6, alignItems: 'flex-start', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={compareIds.includes(scenario.id)}
                    onChange={(e) => setCompareIds((prev) => e.target.checked ? [...prev, scenario.id] : prev.filter((id) => id !== scenario.id))}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span style={{ flex: 1 }} onClick={() => setSelectedId(scenario.id)}>
                    <span style={{ display: 'block', fontSize: 11.5, fontWeight: 700 }}>{scenario.title}</span>
                    <span style={{ display: 'block', ...tiny }}>
                      {scenario.preset_options.length} 预设 · {scenario.constraints.length} 约束 · {scenario.potentials.length} 潜在
                    </span>
                    <span style={{ display: 'block', ...tiny }}>{scenario.branch_id ? '已创建真实分支' : '未创建分支'}</span>
                  </span>
                </label>
              </div>
            ))}
            {!scenarios.length && <div style={tiny}>还没有方案。新建后填写 A–E 配置并保存。</div>}
            <button type="button" style={btn} disabled={busy || compareIds.length < 2} onClick={() => void compare()}>比较所选方案（{compareIds.length}）</button>
            {onNavigate && (
              <div style={{ borderTop: '1px dashed var(--card-border)', paddingTop: 7, display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={tiny}>创建真实分支后，可到：</div>
                <button type="button" style={btn} onClick={() => onNavigate('simulation')}>07 模拟运行 · 选择分支</button>
                <button type="button" style={btn} onClick={() => onNavigate('writing')}>08 写作辅助 · 选择分支</button>
              </div>
            )}
          </aside>

          <main style={{ minWidth: 0, overflow: 'auto', padding: 12 }}>
            {!draft && <div style={tiny}>选择左侧方案，或新建一个。</div>}
            {draft && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <strong style={{ fontSize: 13 }}>事件详情</strong>
                    <span style={tiny}>{event.description || '无描述'}</span>
                  </div>
                  <div style={tiny}>该方案只关联事件 <code>{event.id.slice(0, 8)}</code>；原事件不会被改写。</div>
                </div>

                {event.world_id && (
                  <section style={{ ...card, padding: 8 }}>
                    <AxisObjectsPanel
                      worldId={event.world_id}
                      eventId={event.id}
                      branchId={draft.branch_id || undefined}
                      compact
                      title={draft.branch_id ? '六轴压强 · 事件/分支沙盒调用' : '六轴压强 · 当前事件调用'}
                    />
                  </section>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <label style={tiny}>方案名称
                    <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} style={{ ...input, marginTop: 3 }} />
                  </label>
                  <label style={tiny}>方案备注
                    <input value={draft.note || ''} onChange={(e) => setDraft({ ...draft, note: e.target.value })} style={{ ...input, marginTop: 3 }} placeholder="这个方案想探索什么不同走向" />
                  </label>
                </div>

                {LIST_META.map((meta) => (
                  <section key={meta.key} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, flexWrap: 'wrap' }}>
                      <span style={sectionTitle}>{meta.title}</span>
                      <span style={tiny}>{meta.hint}</span>
                    </div>
                    {meta.key === 'potentials' && (
                      <div style={{ ...tiny, border: '1px dashed #b9883e', borderRadius: 6, padding: '4px 6px', color: '#8a6429' }}>
                        潜在条件只是候选，不会自动写进世界事实；需要你确认后才算成立。
                      </div>
                    )}
                    {list(meta.key).map((item, index) => (
                      <div key={index} style={{ display: 'flex', gap: 5, alignItems: 'flex-start' }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <input value={item.text || item.name || ''} onChange={(e) => updateItem(meta.key, index, { text: e.target.value, name: e.target.value })} placeholder={meta.placeholder} style={input} />
                          {meta.key === 'preset_options' && (
                            <input value={item.description || ''} onChange={(e) => updateItem(meta.key, index, { description: e.target.value })} placeholder="这条方向的说明（可选）" style={input} />
                          )}
                          {meta.key === 'factors' && (
                            <div style={{ display: 'flex', gap: 4 }}>
                              <select value={item.type || 'character'} onChange={(e) => updateItem(meta.key, index, { type: e.target.value })} style={{ ...input, width: 100 }}>
                                <option value="character">人物</option><option value="organization">组织</option>
                                <option value="resource">资源</option><option value="environment">环境</option>
                                <option value="event">事件</option><option value="relationship">关系</option>
                              </select>
                              <span style={tiny}>关联只做引用，不改对象。</span>
                            </div>
                          )}
                          {meta.key === 'potentials' && (
                            <select value={item.status || 'potential'} onChange={(e) => updateItem(meta.key, index, { status: e.target.value })} style={{ ...input, width: 150 }}>
                              <option value="potential">潜在（未确认）</option>
                              <option value="confirmed">已确认</option>
                              <option value="dismissed">已排除</option>
                            </select>
                          )}
                        </div>
                        <button type="button" style={{ ...btn, color: 'var(--danger-color)' }} onClick={() => removeItem(meta.key, index)}>删</button>
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      <button type="button" style={btn} onClick={() => addItem(meta.key, meta.key === 'factors'
                        ? { text: '', name: '', type: 'character', status: 'active' }
                        : { text: '', description: '', status: meta.key === 'potentials' ? 'potential' : 'active', kind: meta.key })}>＋ 自定义</button>
                      {suggestions(meta.key).slice(0, 8).map((item, index) => (
                        <button key={index} type="button" style={{ ...btn, borderStyle: 'dashed' }} onClick={() => addSuggestion(meta.key, item)}>
                          ＋ {item.label || item.name || item.text}
                        </button>
                      ))}
                    </div>
                  </section>
                ))}

                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', borderTop: '1px dashed var(--card-border)', paddingTop: 8 }}>
                  <button type="button" style={{ ...btn, background: 'var(--primary-color)', color: 'var(--primary-text)', borderColor: 'var(--primary-color)' }} disabled={busy} onClick={() => void save()}>保存方案</button>
                  <button type="button" style={btn} disabled={busy} onClick={() => void createRealBranch()}>{draft.branch_id ? '已关联分支（可重新创建）' : '创建真实分支沙盒'}</button>
                  <button type="button" style={{ ...btn, color: 'var(--danger-color)' }} disabled={busy} onClick={() => void removeScenario()}>删除方案</button>
                  <span style={{ flex: 1 }} />
                  {draft.branch_id && <span style={tiny}>分支 ID：<code>{draft.branch_id.slice(0, 8)}</code> · 复用多路径引擎</span>}
                </div>
              </div>
            )}

            {comparison && (
              <div style={{ ...card, marginTop: 12, overflow: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <strong style={{ fontSize: 12 }}>方案比较</strong>
                  <span style={{ flex: 1 }} />
                  <button type="button" style={btn} onClick={() => setComparison(null)}>收起</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(comparison.length, 2)}, minmax(260px, 1fr))`, gap: 8, marginTop: 8 }}>
                  {comparison.map((row) => (
                    <div key={row.id} style={{ border: '1px solid var(--card-border)', borderRadius: 8, padding: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>{row.title}</div>
                      <div style={tiny}>{row.note || '无备注'}</div>
                      <div style={{ ...tiny, marginTop: 5 }}>预设选项 {row.preset_count} · 约束 {(row.constraints || []).length} · 支持 {(row.supports || []).length} · 潜在 {(row.potentials || []).length}</div>
                      <div style={{ ...tiny, marginTop: 4 }}>关联：{(row.factors || []).map((f: any) => f.name || f.text).join('、') || '无'}</div>
                      <div style={{ ...tiny, marginTop: 4 }}>分支：{row.branch_id ? row.branch_id.slice(0, 8) : '未创建'}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}
