import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import * as api from '../api/structure'
import '../styles/product-workspace.css'

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
      className={`tlx-chip${active ? ' is-on' : ''}`}
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
  const [orientation, setOrientation] = useState<'vertical' | 'horizontal'>('vertical')
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

  const dayGroups = useMemo(() => groups.map(([date, items]) => {
    const timeMap = new Map<string, api.TimelineItem[]>()
    for (const item of items) {
      const time = item.occurred_at ? item.occurred_at.replace('T', ' ').slice(11, 16) : '时间未知'
      if (!timeMap.has(time)) timeMap.set(time, [])
      timeMap.get(time)!.push(item)
    }
    return { date, items, times: Array.from(timeMap.entries()) }
  }), [groups])

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

  const renderItem = (item: api.TimelineItem, key: string) => {
    const meta = KIND_META[item.kind] || { icon: '·', label: item.kind }
    return (
      <button
        type="button"
        key={key}
        className={`tlx-item is-${item.kind}`}
        onClick={() => void openDetail(item)}
        title="点击查看详情与来源"
      >
        <span className="tlx-item-head">
          <span className="tlx-item-time">
            {item.occurred_at ? item.occurred_at.replace('T', ' ').slice(11, 16) : '—'}
          </span>
          <span className="tlx-item-kind">{meta.icon} {meta.label}</span>
        </span>
        <span className="tlx-item-title">{item.title}</span>
        {item.description && <span className="tlx-item-desc">{item.description}</span>}
        {item.meta?.reason && <span className="tlx-item-reason">原因：{item.meta.reason}</span>}
        <span className="tlx-item-open">查看 →</span>
      </button>
    )
  }

  return (
    <div className="tlx-page">
      <header className="tlx-head">
        <div className="tlx-head-copy">
          <span className="tlx-kicker">TIMELINE / XMIND VIEW</span>
          <strong>{mode === 'life' ? '人生时间线' : mode === 'interaction' ? '互动时间线' : '统一时间线'}</strong>
        </div>
        <div className="tlx-head-right">
          <span className="tlx-world">{worldName || '未选择世界'}</span>
          <span className="tlx-counts">
            {data ? `${data.items.length} 条记录` : '加载中'}
          </span>
        </div>
      </header>

      <div className="tlx-controls">
        <div className="tlx-orient">
          <button type="button" className={orientation === 'vertical' ? 'is-on' : ''} onClick={() => setOrientation('vertical')}>↕ 纵向</button>
          <button type="button" className={orientation === 'horizontal' ? 'is-on' : ''} onClick={() => setOrientation('horizontal')}>↔ 横向</button>
        </div>
        <div className="tlx-scopes">
          {scopes.map((item) => (
            <Chip key={item.key} active={scope === item.key} onClick={() => setScope(item.key)}>
              {item.label}
            </Chip>
          ))}
        </div>

        {scope !== 'world' && (
          <select className="tlx-select" value={entityId} onChange={(e) => setEntityId(e.target.value)}>
            <option value="">选择{scopes.find((s) => s.key === scope)?.label}</option>
            {options.map((option: any) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        )}

        <div className="tlx-kinds">
          {Object.entries(KIND_META).map(([kind, meta]) => (
            <Chip key={kind} active={kinds.includes(kind)} onClick={() => toggleKind(kind)}>
              {meta.icon} {meta.label}
            </Chip>
          ))}
        </div>
      </div>

      {error && <div className="tlx-error">{error}</div>}

      <div className="tlx-canvas">
        {groups.length === 0 ? (
          <div className="tlx-empty">
            <strong>这个范围还没有时间线</strong>
            <span>世界「{worldName || '当前'}」还没有事件、状态变化或资源流水。先去事件库建立第一条记录。</span>
          </div>
        ) : orientation === 'vertical' ? (
          <div className="tlx-tree">
            <div className="tlx-root">
              <span className="tlx-root-mark">◎</span>
              <div>
                <span className="tlx-root-kicker">WORLD TIMELINE / VERTICAL</span>
                <strong>{worldName || '当前世界'}</strong>
              </div>
              <span className="tlx-root-count">{groups.length} 个时间节点</span>
            </div>

            <div className="tlx-feed">
              {dayGroups.map((day) => (
                <section className="tlx-day" key={day.date}>
                  <div className="tlx-date">
                    <span className="tlx-date-dot" />
                    <strong>{day.date === '时间未知' ? day.date : day.date.slice(5)}</strong>
                    <span>{day.date === '时间未知' ? '待定' : day.date.slice(0, 4)}</span>
                    <small>{day.items.length} 条</small>
                  </div>
                  <div className="tlx-times">
                    {day.times.map(([time, timeItems]) => (
                      <div className="tlx-time-group" key={`${day.date}-${time}`}>
                        <div className="tlx-time-label">
                          <span>{time}</span>
                          {timeItems.length > 1 && <em>同时 {timeItems.length}</em>}
                        </div>
                        <div className={`tlx-time-cards${timeItems.length > 1 ? ' is-multi' : ''}`}>
                          {timeItems.map((item) => renderItem(item, `${day.date}-${time}-${item.kind}-${item.id}`))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        ) : (
          <div className="tlx-h-scroll">
            <div className="tlx-h-tree" style={{ width: Math.max(920, dayGroups.length * 286 + 150) }}>
              <div className="tlx-h-root">
                <span className="tlx-root-mark">◎</span>
                <div>
                  <span className="tlx-root-kicker">WORLD TIMELINE / HORIZONTAL</span>
                  <strong>{worldName || '当前世界'}</strong>
                </div>
              </div>
              <div className="tlx-h-axis" />
              {dayGroups.map((day, index) => (
                <div className="tlx-h-col" key={day.date} style={{ left: 84 + index * 286 }}>
                  <div className="tlx-h-marker">
                    <i />
                    <strong>{day.date === '时间未知' ? day.date : day.date.slice(5)}</strong>
                    <small>{day.date === '时间未知' ? '待定' : day.date.slice(0, 4)} · {day.items.length} 条</small>
                  </div>
                  <div className="tlx-h-cards">
                    {day.times.map(([time, timeItems]) => (
                      <div className="tlx-h-time" key={`${day.date}-${time}`}>
                        <div className="tlx-h-time-head">
                          <span>{time}</span>
                          {timeItems.length > 1 && <em>同时 {timeItems.length}</em>}
                        </div>
                        {timeItems.map((item) => renderItem(item, `h-${day.date}-${time}-${item.kind}-${item.id}`))}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

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
