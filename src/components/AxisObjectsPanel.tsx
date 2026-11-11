import { useCallback, useEffect, useMemo, useState } from 'react'
import * as api from '../api/axisObjects'

const AXIS_ORDER = ['scarcity', 'threat', 'status', 'reputation', 'attachment', 'regulation', 'negentropy']
const AXIS_FALLBACK: Record<string, string> = {
  scarcity: '稀缺', threat: '威胁', status: '地位', reputation: '声誉',
  attachment: '依恋', regulation: '调节', negentropy: '负熵（环境修复力）',
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
  padding: '4px 8px', borderRadius: 7, border: '1px solid var(--card-border)',
  background: 'transparent', color: 'var(--text-main)', fontSize: 10, cursor: 'pointer',
}
const tiny: React.CSSProperties = { fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.6 }

type Props = {
  worldId: string
  eventId?: string
  branchId?: string
  compact?: boolean
  title?: string
  onChanged?: () => void
}

type FormState = {
  axis: string; name: string; category: string; description: string; value: string
  linkedType: string; linkedNames: string; preset?: string
}

const emptyForm = (axis: string): FormState => ({
  axis, name: '', category: '', description: '', value: '0.5', linkedType: 'character', linkedNames: '',
})

export default function AxisObjectsPanel({ worldId, eventId, branchId, compact = false, title, onChanged }: Props) {
  const [groups, setGroups] = useState<api.AxisPresetGroup[]>([])
  const [payload, setPayload] = useState<api.AxisPayload | null>(null)
  const [scope, setScope] = useState<'world' | 'event' | 'branch'>(() => branchId ? 'branch' : eventId ? 'event' : 'world')
  const [openAxes, setOpenAxes] = useState<Set<string>>(new Set(['scarcity', 'threat']))
  const [form, setForm] = useState<FormState | null>(null)
  const [editingId, setEditingId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!worldId) return
    try {
      setError('')
      const [presetData, objectData] = await Promise.all([
        api.getAxisPresets(),
        api.listAxisObjects(worldId, eventId, branchId),
      ])
      setGroups(presetData.axes)
      setPayload(objectData)
    } catch (err: any) { setError(err?.message || '加载压强对象失败') }
  }, [worldId, eventId, branchId])

  useEffect(() => { void load() }, [load])
  useEffect(() => { setScope(branchId ? 'branch' : eventId ? 'event' : 'world') }, [branchId, eventId])

  const labelFor = (axis: string) => groups.find((g) => g.key === axis)?.label || AXIS_FALLBACK[axis] || axis
  const effective = payload?.effective || []
  const aggregate = payload?.aggregate || {}
  const pressureAxes = AXIS_ORDER.filter((a) => a !== 'negentropy')
  const currentScopeLabel = scope === 'world' ? '世界基础' : scope === 'event' ? '当前事件' : '当前分支沙盒'

  const byAxis = useMemo(() => {
    const map: Record<string, api.AxisObject[]> = {}
    for (const axis of AXIS_ORDER) map[axis] = effective.filter((o) => o.axis === axis)
    return map
  }, [effective])

  const scopeObjects = useMemo(() => {
    const rows = payload?.objects || []
    if (scope === 'branch') return rows.filter((o) => o.branch_id)
    if (scope === 'event') return rows.filter((o) => o.event_id && !o.branch_id)
    return rows.filter((o) => !o.event_id && !o.branch_id)
  }, [payload, scope])

  const toggleAxis = (axis: string) => {
    setOpenAxes((prev) => {
      const next = new Set(prev)
      if (next.has(axis)) next.delete(axis); else next.add(axis)
      return next
    })
  }

  const openAdd = (axis: string, prefill?: api.AxisObject) => {
    if (prefill) {
      setEditingId('')
      setForm({
        axis, name: prefill.name, category: prefill.category || '',
        description: prefill.description || '', value: String(prefill.value),
        linkedType: 'character', linkedNames: (prefill.linked_factors || []).map((f: any) => typeof f === 'string' ? f : f.name || '').filter(Boolean).join('、'),
        preset: prefill.name,
      })
      return
    }
    setForm(emptyForm(axis))
  }

  const openEdit = (object: api.AxisObject) => {
    setEditingId(object.id)
    setForm({
      axis: object.axis, name: object.name, category: object.category || '',
      description: object.description || '', value: String(object.value),
      linkedType: 'character', linkedNames: (object.linked_factors || []).map((f: any) => typeof f === 'string' ? f : f.name || '').filter(Boolean).join('、'),
    })
  }

  const choosePreset = (axis: string, presetName: string) => {
    const group = groups.find((g) => g.key === axis)
    const preset = group?.presets.find((p) => p.name === presetName)
    if (!preset || !form) return
    setForm({ ...form, name: preset.name, category: preset.category, description: preset.description, preset: presetName })
  }

  const save = async () => {
    if (!form || !form.name.trim()) return
    setBusy(true); setError('')
    try {
      const linked = form.linkedNames.split(/[、,，;；]/).map((s) => s.trim()).filter(Boolean)
        .map((name) => ({ type: form.linkedType, name }))
      const base = {
        axis: form.axis, name: form.name.trim(), category: form.category.trim(),
        description: form.description.trim(), value: Number(form.value),
        linked_factors: linked, source: 'user',
      }
      if (editingId) {
        await api.updateAxisObject(editingId, base)
      } else {
        await api.createAxisObject(worldId, {
          ...base,
          event_id: scope === 'event' ? eventId : undefined,
          branch_id: scope === 'branch' ? branchId : undefined,
        } as any)
      }
      setForm(null); setEditingId('')
      await load(); onChanged?.()
    } catch (err: any) { setError(err.message) } finally { setBusy(false) }
  }

  const remove = async (object: api.AxisObject) => {
    const isInherited = (scope === 'event' && object.scope_type !== 'event') || (scope === 'branch' && object.scope_type !== 'branch')
    if (isInherited) {
      // 删除按钮不作用于继承来的原对象，避免误改世界基础。
      return
    }
    if (!window.confirm(`删除压力对象「${object.name}」？`)) return
    setBusy(true)
    try { await api.deleteAxisObject(object.id); await load(); onChanged?.() }
    catch (err: any) { setError(err.message) } finally { setBusy(false) }
  }

  const inherited = (object: api.AxisObject) =>
    (scope === 'event' && object.scope_type !== 'event') || (scope === 'branch' && object.scope_type !== 'branch')

  const axisCard = (axis: string) => {
    const objects = byAxis[axis] || []
    const open = openAxes.has(axis)
    const isNeg = axis === 'negentropy'
    return (
      <div key={axis} style={{ ...card, padding: 0, overflow: 'hidden', borderColor: isNeg ? 'rgba(47,125,87,.35)' : 'var(--card-border)' }}>
        <button type="button" onClick={() => toggleAxis(axis)} style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 11px',
          border: 'none', background: isNeg ? 'rgba(47,125,87,.07)' : 'rgba(128,128,128,.05)', color: 'var(--text-main)', cursor: 'pointer', textAlign: 'left',
        }}>
          <span style={{ fontSize: 11 }}>{open ? '▾' : '▸'}</span>
          <strong style={{ fontSize: 12 }}>{labelFor(axis)}</strong>
          <span style={tiny}>{isNeg ? '修复力 · 不是压力' : '压力维度'}</span>
          <span style={{ flex: 1 }} />
          <span style={tiny}>{objects.length} 个对象</span>
          <span style={{ fontSize: 11, color: isNeg ? '#2f7d57' : 'var(--primary-color)', fontWeight: 700 }}>均值 {(aggregate[axis] ?? 0).toFixed(2)}</span>
        </button>
        {open && (
          <div style={{ padding: '8px 10px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {objects.length === 0 && <div style={tiny}>这个维度还没有具象对象。添加对象后，它们会各自独立生效，不会再被压成一个抽象数值。</div>}
            {objects.map((object) => {
              const isInherited = inherited(object)
              return (
                <div key={`${object.axis}-${object.name}-${object.id}`} style={{
                  border: '1px solid var(--card-border)', borderRadius: 8, padding: '7px 8px',
                  background: isInherited ? 'rgba(128,128,128,.045)' : 'var(--card-bg)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: 11 }}>{object.name}</strong>
                    <span style={{ ...tiny, border: '1px solid var(--card-border)', borderRadius: 9, padding: '0 5px' }}>
                      {object.scope_type === 'world' ? '世界基础' : object.scope_type === 'event' ? '事件层' : object.scope_type === 'branch' ? '分支层' : object.scope_type}
                    </span>
                    {object.category && <span style={tiny}>{object.category}</span>}
                    <span style={{ flex: 1 }} />
                    <span style={{ fontSize: 12, fontWeight: 800, color: isNeg ? '#2f7d57' : object.value >= 0.75 ? 'var(--danger-color)' : 'var(--primary-color)' }}>
                      {Number(object.value).toFixed(2)}
                    </span>
                  </div>
                  {object.description && <div style={{ ...tiny, marginTop: 2 }}>{object.description}</div>}
                  <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap', marginTop: 5 }}>
                    <span style={tiny}>来源 {object.source || 'initial'} · 关联</span>
                    {(object.linked_factors || []).length ? (object.linked_factors || []).map((f: any, i: number) => (
                      <span key={i} style={{ ...tiny, background: 'rgba(128,128,128,.1)', borderRadius: 8, padding: '0 5px' }}>{typeof f === 'string' ? f : `${f.type || '因素'}：${f.name || ''}`}</span>
                    )) : <span style={tiny}>无</span>}
                    <span style={{ flex: 1 }} />
                    {isInherited ? (
                      <>
                        <button type="button" style={btn} onClick={() => openAdd(axis, object)} title="在当前作用域新建同名对象以覆盖继承值">在此覆盖</button>
                      </>
                    ) : (
                      <>
                        <button type="button" style={btn} onClick={() => openEdit(object)}>编辑</button>
                        {scope !== 'world' && object.scope_type === scope && (
                          <button type="button" style={{ ...btn, color: 'var(--danger-color)' }} onClick={() => void remove(object)}>删除</button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )
            })}
            <button type="button" onClick={() => openAdd(axis)} style={{ ...btn, alignSelf: 'flex-start', borderStyle: 'dashed' }}>＋ 添加{labelFor(axis)}对象</button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <strong style={{ fontSize: 13 }}>{title || '六轴压强 · 具象对象统一配置'}</strong>
          <div style={tiny}>每个维度可放多个独立对象；六轴是压力，负熵是环境修复力。这里配置一次，事件/沙盒只做继承或覆盖。</div>
        </div>
        <span style={{ flex: 1 }} />
        <select value={scope} onChange={(e) => setScope(e.target.value as any)} style={{ ...input, width: 150 }}>
          <option value="world">世界基础</option>
          {eventId && <option value="event">当前事件覆盖</option>}
          {branchId && <option value="branch">当前分支覆盖</option>}
        </select>
      </div>
      {error && <div style={{ fontSize: 11, color: 'var(--danger-color)' }}>{error}</div>}
      <div style={{ ...tiny, border: '1px dashed var(--card-border)', borderRadius: 8, padding: '6px 8px' }}>
        当前作用域：<strong>{currentScopeLabel}</strong>。共 {effective.length} 个生效对象，当前作用域自有 {scopeObjects.length} 个。
        事件/分支与同名世界对象合并时，后层覆盖前层。
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))', gap: 8 }}>
        {pressureAxes.map(axisCard)}
      </div>
      <div style={{ marginTop: 2 }}>{axisCard('negentropy')}</div>

      {form && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ ...card, width: 500, maxWidth: '100%', padding: 16, background: 'var(--bg-color)', maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <strong style={{ fontSize: 13 }}>{editingId ? '编辑压力对象' : `添加${labelFor(form.axis)}对象`} · {currentScopeLabel}</strong>
              <span style={{ flex: 1 }} />
              <button type="button" style={btn} onClick={() => { setForm(null); setEditingId('') }}>关闭</button>
            </div>
            {!editingId && (
              <label style={{ ...tiny, display: 'block', marginTop: 8 }}>从预设选择（也可完全自定义）
                <select value={form.preset || ''} onChange={(e) => choosePreset(form.axis, e.target.value)} style={{ ...input, marginTop: 3 }}>
                  <option value="">自定义对象</option>
                  {(groups.find((g) => g.key === form.axis)?.presets || []).map((p) => (
                    <option key={`${p.category}-${p.name}`} value={p.name}>{p.category} · {p.name}</option>
                  ))}
                </select>
              </label>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
              <label style={tiny}>具体对象名
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, preset: '' })} style={{ ...input, marginTop: 3 }} placeholder="例如：缺钱 / 身份暴露" />
              </label>
              <label style={tiny}>分类
                <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={{ ...input, marginTop: 3 }} placeholder="例如：资源 / 生存条件" />
              </label>
            </div>
            <label style={{ ...tiny, display: 'block', marginTop: 8 }}>描述
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} style={{ ...input, marginTop: 3, resize: 'vertical' }} />
            </label>
            <label style={{ ...tiny, display: 'block', marginTop: 8 }}>数值 0–1（越高压力越大；负熵越高修复力越强）
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 3 }}>
                <input type="range" min={0} max={1} step={0.01} value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} style={{ flex: 1 }} />
                <input type="number" min={0} max={1} step={0.01} value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} style={{ ...input, width: 70 }} />
              </div>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: 8, marginTop: 8 }}>
              <label style={tiny}>关联因素类型
                <select value={form.linkedType} onChange={(e) => setForm({ ...form, linkedType: e.target.value })} style={{ ...input, marginTop: 3 }}>
                  <option value="character">人物</option><option value="event">事件</option>
                  <option value="relationship">关系</option><option value="resource">资源</option>
                  <option value="environment">环境</option><option value="organization">组织</option>
                </select>
              </label>
              <label style={tiny}>关联对象（用、分隔）
                <input value={form.linkedNames} onChange={(e) => setForm({ ...form, linkedNames: e.target.value })} style={{ ...input, marginTop: 3 }} placeholder="例如：韩立、墨居仁" />
              </label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 12 }}>
              <button type="button" style={btn} onClick={() => { setForm(null); setEditingId('') }}>取消</button>
              <button type="button" disabled={busy || !form.name.trim()} onClick={() => void save()} style={{ ...btn, background: 'var(--primary-color)', color: 'var(--primary-text)', borderColor: 'var(--primary-color)' }}>保存对象</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
