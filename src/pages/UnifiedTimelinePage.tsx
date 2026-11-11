import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import * as api from '../api/structure'

const API = 'http://127.0.0.1:8000/api'

const SCOPES = [
  { key: 'world', label: '世界' },
  { key: 'character', label: '人物' },
  { key: 'organization', label: '组织' },
  { key: 'location', label: '地点' },
  { key: 'resource', label: '资源' },
] as const

type ScopeKey = (typeof SCOPES)[number]['key']

const KIND_META: Record<string, { icon: string; label: string }> = {
  event: { icon: '◇', label: '事件' },
  history: { icon: '↻', label: '状态变化' },
  transaction: { icon: '¥', label: '资源变动' },
}

const card: CSSProperties = {
  background: 'var(--card-bg)',
  border: '1px solid var(--card-border)',
  borderRadius: '14px',
  boxShadow: 'var(--card-shadow)',
}

const selectStyle: CSSProperties = {
  padding: '7px 10px',
  borderRadius: '8px',
  border: '1px solid var(--card-border)',
  background: 'transparent',
  color: 'var(--text-main)',
  fontSize: '12px',
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 11px',
        borderRadius: '999px',
        border: active ? '1px solid var(--text-main)' : '1px solid var(--card-border)',
        background: active ? 'var(--text-main)' : 'transparent',
        color: active ? 'var(--bg-color)' : 'var(--text-main)',
        fontSize: '12px',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

export default function UnifiedTimelinePage({ worldId, worldName, mode = 'world' }: { worldId: string; worldName?: string; mode?: string }) {
  const scopes = mode === 'world'
    ? SCOPES
    : [{ key: 'world', label: '全部记录' }, { key: 'character', label: '人物' }] as const
  const [scope, setScope] = useState<ScopeKey>('world')
  const [entityId, setEntityId] = useState('')
  const [kinds, setKinds] = useState<string[]>(mode === 'world' ? ['event', 'history', 'transaction'] : ['event', 'history'])
  const [data, setData] = useState<{ counts: Record<string, number>; items: api.TimelineItem[] } | null>(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<api.TimelineItem | null>(null)
  const [eventNames, setEventNames] = useState<Record<string, string>>({})
  const [relations, setRelations] = useState<{ incoming: any[]; outgoing: any[] }>({
    incoming: [],
    outgoing: [],
  })
  const [detailLoading, setDetailLoading] = useState(false)
  const [entities, setEntities] = useState<{
    character: api.CharacterLite[]
    organization: api.Organization[]
    location: { id: string; name: string }[]
    resource: api.ResourceItem[]
  }>({ character: [], organization: [], location: [], resource: [] })

  const loadEntities = useCallback(async () => {
    if (!worldId) return
    try {
      const [characters, organizations, locations, resources, eventRows] = await Promise.all([
        api.listCharacters(worldId),
        api.listOrganizations(worldId),
        api.listLocations(worldId),
        api.listResources(worldId),
        fetch(`${API}/events?world_id=${worldId}`).then((res) => (res.ok ? res.json() : [])),
      ])
      setEventNames(
        Object.fromEntries((Array.isArray(eventRows) ? eventRows : []).map((event: any) => [event.id, event.name])),
      )
      setEntities({
        character: characters,
        organization: organizations,
        location: locations.map((item) => ({ id: item.id, name: item.name })),
        resource: resources,
      })
    } catch (e: any) {
      setError(String(e.message || e))
    }
  }, [worldId])

  const load = useCallback(async () => {
    if (!worldId) return
    try {
      const result = await api.getTimeline(worldId, scope, entityId || undefined, kinds.join(','))
      setData(result)
    } catch (e: any) {
      setError(String(e.message || e))
    }
  }, [worldId, scope, entityId, kinds])

  useEffect(() => {
    loadEntities()
  }, [loadEntities])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setEntityId('')
  }, [scope])

  const groups = useMemo(() => {
    const map = new Map<string, api.TimelineItem[]>()
    for (const item of data?.items || []) {
      const key = item.occurred_at ? item.occurred_at.replace('T', ' ').slice(0, 10) : '时间未知'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(item)
    }
    return Array.from(map.entries())
  }, [data])

  const options =
    scope === 'character'
      ? entities.character
      : scope === 'organization'
        ? entities.organization
        : scope === 'location'
          ? entities.location
          : scope === 'resource'
            ? entities.resource
            : []

  /** 打开条目详情：历史看来源事件，事件看因果链 */
  const openDetail = async (item: api.TimelineItem) => {
    setSelected(item)
    setRelations({ incoming: [], outgoing: [] })
    const eventId = item.kind === 'event' ? item.id : item.event_id
    if (!eventId) return
    setDetailLoading(true)
    try {
      const rows = await fetch(`${API}/worlds/${worldId}/event-relations?event_id=${eventId}`).then((res) =>
        res.ok ? res.json() : [],
      )
      setRelations({
        incoming: rows.filter((row: any) => row.target_event_id === eventId),
        outgoing: rows.filter((row: any) => row.source_event_id === eventId),
      })
    } catch (e: any) {
      setError(String(e.message || e))
    } finally {
      setDetailLoading(false)
    }
  }

  const toggleKind = (kind: string) => {
    setKinds((current) =>
      current.includes(kind) ? current.filter((item) => item !== kind) : [...current, kind],
    )
  }

  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ ...card, padding: '16px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <div style={{ fontSize: '16px', color: 'var(--text-main)' }}>{mode === 'life' ? '人生时间线' : mode === 'interaction' ? '互动时间线' : '统一时间线'}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
              当前空间：{worldName || '未选择'} · {mode === 'life' ? '按人生经历与记录整理时间顺序，不做世界推演' : mode === 'interaction' ? '按互动事件与关系变化整理时间顺序' : '只读取事件、状态历史与资源流水，不重复维护历史'}
            </div>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {data ? `事件 ${data.counts.event || 0} · 变化 ${data.counts.history || 0} · 流水 ${data.counts.transaction || 0}` : '加载中'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginTop: '14px' }}>
          {scopes.map((item) => (
            <Chip key={item.key} active={scope === item.key} onClick={() => setScope(item.key)}>
              {item.label}
            </Chip>
          ))}

          {scope !== 'world' && (
            <select style={selectStyle} value={entityId} onChange={(e) => setEntityId(e.target.value)}>
              <option value="">选择{scopes.find((s) => s.key === scope)?.label}</option>
              {options.map((option: any) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          )}

          <span style={{ marginLeft: 'auto', display: 'flex', gap: '6px', alignItems: 'center' }}>
            {Object.entries(KIND_META).map(([kind, meta]) => (
              <Chip key={kind} active={kinds.includes(kind)} onClick={() => toggleKind(kind)}>
                {meta.icon} {meta.label}
              </Chip>
            ))}
          </span>
        </div>
      </div>

      {error && (
        <div style={{ ...card, padding: '10px 14px', color: 'var(--danger-color)', fontSize: '12px' }}>{error}</div>
      )}

      {groups.length === 0 && (
        <div style={{ ...card, padding: '34px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
          世界「{worldName || '当前'}」在这个范围还没有可展示的历史。如果这不是你想要的世界，请先用左上角「退出当前世界」切回有数据的那个世界；新世界本身就是空的。
        </div>
      )}

      {groups.map(([date, items]) => (
        <div key={date} style={{ display: 'flex', gap: '14px' }}>
          <div style={{ width: '96px', flexShrink: 0, textAlign: 'right', paddingTop: '4px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-main)' }}>{date}</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{items.length} 条</div>
          </div>
          <div style={{ flex: 1, borderLeft: '1px solid var(--card-border)', paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {items.map((item) => {
              const meta = KIND_META[item.kind] || { icon: '·', label: item.kind }
              return (
                <div
                  key={`${item.kind}-${item.id}`}
                  onClick={() => openDetail(item)}
                  style={{ ...card, padding: '10px 13px', cursor: 'pointer' }}
                  title="点击查看详情与来源"
                >
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', width: '16px' }}>{meta.icon}</span>
                    <span style={{ fontSize: '13px', color: 'var(--text-main)', flex: 1 }}>{item.title}</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{meta.label}</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      {item.occurred_at ? item.occurred_at.replace('T', ' ').slice(11, 16) : ''}
                    </span>
                  </div>
                  {item.description && (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', marginLeft: '24px' }}>
                      {item.description}
                    </div>
                  )}
                  {item.meta?.reason && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', marginLeft: '24px' }}>
                      原因：{item.meta.reason}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {selected && (
        <div
          onClick={() => setSelected(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            padding: '24px',
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{ ...card, width: '640px', maxHeight: '82vh', overflow: 'auto', padding: '20px', background: 'var(--bg-color)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px' }}>
              <div style={{ fontSize: '15px', color: 'var(--text-main)' }}>
                {KIND_META[selected.kind]?.icon} {selected.title}
              </div>
              <button
                onClick={() => setSelected(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '16px' }}
              >
                ✕
              </button>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {KIND_META[selected.kind]?.label}
              {selected.occurred_at ? ` · ${selected.occurred_at.replace('T', ' ').slice(0, 16)}` : ''}
              {selected.entity_type ? ` · ${selected.entity_type}` : ''}
            </div>

            {selected.description && (
              <div style={{ fontSize: '12px', color: 'var(--text-main)', marginTop: '12px', lineHeight: 1.7 }}>
                {selected.description}
              </div>
            )}

            {selected.kind === 'history' && (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '10px', lineHeight: 1.8 }}>
                <div>字段：{selected.meta?.field || '—'}</div>
                <div>
                  变化：{String(selected.meta?.old_value ?? '—')} → {String(selected.meta?.new_value ?? '—')}
                </div>
                {selected.meta?.reason && <div>原因：{selected.meta.reason}</div>}
                {selected.meta?.source && <div>来源：{selected.meta.source}</div>}
              </div>
            )}

            {selected.kind === 'transaction' && (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '10px', lineHeight: 1.8 }}>
                {selected.meta?.amount != null && <div>变动数量：{selected.meta.amount}</div>}
                {selected.meta?.reason && <div>原因：{selected.meta.reason}</div>}
              </div>
            )}

            {selected.kind === 'event' && (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '10px', lineHeight: 1.8 }}>
                {selected.meta?.polarity && <div>极性 / 强度：{selected.meta.polarity} / {selected.meta.intensity}</div>}
                {selected.meta?.domain?.length > 0 && <div>领域：{selected.meta.domain.join('、')}</div>}
                {selected.meta?.storyline && <div>故事线：{selected.meta.storyline}</div>}
              </div>
            )}

            {selected.kind !== 'event' && selected.event_id && (
              <div style={{ fontSize: '12px', color: 'var(--text-main)', marginTop: '12px' }}>
                来源事件：《{eventNames[selected.event_id] || selected.event_id}》
              </div>
            )}

            <div style={{ borderTop: '1px solid var(--card-border)', margin: '14px 0' }} />
            <div style={{ fontSize: '13px', color: 'var(--text-main)', marginBottom: '8px' }}>事件因果链</div>
            {detailLoading && <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>加载中…</div>}
            {!detailLoading && relations.outgoing.length === 0 && relations.incoming.length === 0 && (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {selected.kind === 'event' || selected.event_id
                  ? '暂无因果关联（允许原因未知或仅有时间先后）'
                  : '该条目没有关联事件'}
              </div>
            )}
            {relations.outgoing.map((relation) => (
              <div key={relation.id} style={{ fontSize: '12px', color: 'var(--text-main)', padding: '4px 0' }}>
                本事件 —[{relation.relation_label}]→ 《{eventNames[relation.target_event_id] || relation.target_event_id}》
                {relation.confidence != null && (
                  <span style={{ color: 'var(--text-muted)' }}>（置信 {Math.round(relation.confidence * 100)}%）</span>
                )}
              </div>
            ))}
            {relations.incoming.map((relation) => (
              <div key={relation.id} style={{ fontSize: '12px', color: 'var(--text-main)', padding: '4px 0' }}>
                《{eventNames[relation.source_event_id] || relation.source_event_id}》—[{relation.relation_label}]→ 本事件
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
