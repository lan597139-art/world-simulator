import { useEffect, useMemo, useState } from 'react'
import { TransformComponent, TransformWrapper, useControls } from 'react-zoom-pan-pinch'
import { ArrowLeft, Crosshair, MapPin, Network, RotateCcw, Users, ZoomIn, ZoomOut } from 'lucide-react'
import { API_ORIGIN } from '../../api/config'
import { listCharacters, listLocations, listOrganizations } from '../../api/structure'
import type { StoryThread, ThreadEvent } from '../../api/storyThreads'
import '../../styles/narrative-graph.css'

export type NarrativeEvent = {
  id: string
  name: string
  description?: string
  storyline?: string
  scale?: string
  participants?: string[]
  affected?: string[]
  location_id?: string
  organization_id?: string
  parent_event_id?: string
  caused_by?: string[]
  story_time?: string
  occurred_at?: string
}

type EventRelation = {
  id: string
  source_event_id: string
  target_event_id: string
  relation_type: string
  relation_label: string
}

type EntityKind = 'character' | 'location' | 'organization'
type EntityInfo = { id: string; name: string; type: EntityKind }
type Focus = { kind: 'all' | 'event' | 'entity' | 'thread'; id?: string }

const KIND_LABEL: Record<string, string> = {
  main: '主线', side: '人物支线', copy: '副本线', shadow: '暗线', ensemble: '群像线',
}
const KIND_COLOR: Record<string, string> = {
  main: '#4f7cff', side: '#2f9e6f', copy: '#8b5cf6', shadow: '#c08a2e', ensemble: '#7a8294',
}
const ENTITY_COLOR: Record<EntityKind, string> = {
  character: '#2f9e6f', location: '#d08437', organization: '#8b5cf6',
}
const ENTITY_LABEL: Record<EntityKind, string> = {
  character: '人物', location: '地点', organization: '组织',
}

const copy = {
  zh: {
    all: '全局视图', focusEvent: '事件局部', focusEntity: '实体局部', focusThread: '故事线局部',
    timeAxis: '时间轴 · TIME', storylines: '故事线',
    back: '返回全局', selectHint: '点击事件查看关联网络；点击人物/地点/组织继续下钻。',
    zoomIn: '放大', zoomOut: '缩小', reset: '复位', relationNetwork: '关联网络',
    participants: '参与人物', locations: '发生地点', organizations: '所属组织', relatedEvents: '相关事件',
    none: '暂无关联', focusHere: '只看此节点', openEvent: '查看事件', thread: '故事线',
    empty: '当前故事线还没有可展示的事件，请先在左侧事件库中挂载事件。',
    relation: '关系', events: '个节点', noEntity: '事件尚未关联人物、地点或组织',
    storyTime: '故事时间', unknown: '未填写',
  },
  en: {
    all: 'Global view', focusEvent: 'Event focus', focusEntity: 'Entity focus', focusThread: 'Thread focus',
    timeAxis: 'Time axis · TIME', storylines: 'Storylines',
    back: 'Back to global', selectHint: 'Select an event to inspect its network; select a character, place, or organization to drill down.',
    zoomIn: 'Zoom in', zoomOut: 'Zoom out', reset: 'Reset', relationNetwork: 'Relationship network',
    participants: 'Characters', locations: 'Locations', organizations: 'Organizations', relatedEvents: 'Related events',
    none: 'No links yet', focusHere: 'Focus this node', openEvent: 'Inspect event', thread: 'Story thread',
    empty: 'No events in this thread yet. Attach events from the event library first.',
    relation: 'Relation', events: 'events', noEntity: 'This event has no linked characters, places, or organizations.',
    storyTime: 'Story time', unknown: 'Not set',
  },
}

type Props = {
  worldId?: string
  threads: StoryThread[]
  events: NarrativeEvent[]
  mode: 'fishbone' | 'spiral'
  selectedEventId?: string
  onSelectEvent: (eventId: string) => void
  lang?: 'zh' | 'en'
}

type Positioned = {
  event: NarrativeEvent
  thread: StoryThread
  link: ThreadEvent
  x: number
  y: number
  strand?: number
  angle?: number
}

function truncate(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value
}

function eventTime(event: NarrativeEvent) {
  return event.story_time || (event.occurred_at ? event.occurred_at.slice(0, 10) : '')
}

function timeValue(event: NarrativeEvent) {
  if (event.occurred_at) {
    const parsed = Date.parse(event.occurred_at)
    if (!Number.isNaN(parsed)) return parsed
  }
  return null
}

function eventEntityIds(event: NarrativeEvent): Array<{ type: EntityKind; id: string }> {
  const rows: Array<{ type: EntityKind; id: string }> = []
  for (const id of event.participants || []) if (id) rows.push({ type: 'character', id })
  for (const id of event.affected || []) if (id) rows.push({ type: 'character', id })
  if (event.location_id) rows.push({ type: 'location', id: event.location_id })
  if (event.organization_id) rows.push({ type: 'organization', id: event.organization_id })
  return rows
}

function edgeKey(a: string, b: string) {
  return [a, b].sort().join('|')
}

function spiralPath(points: Array<{ x: number; y: number }>) {
  if (!points.length) return ''
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
}

function GraphControls({ t }: { t: (typeof copy)['zh'] }) {
  const { zoomIn, zoomOut, resetTransform } = useControls()
  return (
    <div className="ng-zoom">
      <button type="button" title={t.zoomIn} onClick={() => zoomIn()}><ZoomIn size={14} /></button>
      <button type="button" title={t.zoomOut} onClick={() => zoomOut()}><ZoomOut size={14} /></button>
      <button type="button" title={t.reset} onClick={() => resetTransform()}><RotateCcw size={14} /></button>
    </div>
  )
}

export default function NarrativeGraphView({
  worldId, threads, events, mode, selectedEventId, onSelectEvent, lang = 'zh',
}: Props) {
  const t = copy[lang]
  const [focus, setFocus] = useState<Focus>({ kind: 'all' })
  const [activeId, setActiveId] = useState(selectedEventId || '')
  const [relations, setRelations] = useState<EventRelation[]>([])
  const [entityIndex, setEntityIndex] = useState<Record<string, EntityInfo>>({})

  useEffect(() => {
    if (selectedEventId) setActiveId(selectedEventId)
  }, [selectedEventId])

  useEffect(() => {
    if (!worldId) return
    let cancelled = false
    Promise.all([
      listCharacters(worldId).catch(() => []),
      listLocations(worldId).catch(() => []),
      listOrganizations(worldId).catch(() => []),
      fetch(`${API_ORIGIN}/api/worlds/${encodeURIComponent(worldId)}/event-relations`)
        .then((response) => (response.ok ? response.json() : []))
        .catch(() => []),
    ]).then(([characters, locations, organizations, relationRows]) => {
      if (cancelled) return
      const next: Record<string, EntityInfo> = {}
      for (const row of characters as Array<{ id: string; name: string }>) {
        next[`character:${row.id}`] = { id: row.id, name: row.name, type: 'character' }
      }
      for (const row of locations as Array<{ id: string; name: string }>) {
        next[`location:${row.id}`] = { id: row.id, name: row.name, type: 'location' }
      }
      for (const row of organizations as Array<{ id: string; name: string }>) {
        next[`organization:${row.id}`] = { id: row.id, name: row.name, type: 'organization' }
      }
      setEntityIndex(next)
      setRelations(Array.isArray(relationRows) ? relationRows : [])
    })
    return () => { cancelled = true }
  }, [worldId])

  const eventById = useMemo(() => new Map(events.map((event) => [event.id, event])), [events])
  const ordered = useMemo(() => {
    const seen = new Set<string>()
    const rows: Array<{ event: NarrativeEvent; thread: StoryThread; link: ThreadEvent }> = []
    for (const thread of threads) {
      for (const link of [...thread.events].sort((a, b) => a.order_index - b.order_index)) {
        if (!link.event_id || seen.has(link.event_id)) continue
        const event = eventById.get(link.event_id)
        if (!event) continue
        seen.add(link.event_id)
        rows.push({ event, thread, link })
      }
    }
    // 叙事图谱共用一套数据；鱼骨/螺旋按真实时间排序，未填时间的节点保持原故事线顺序。
    return rows.sort((left, right) => {
      const a = timeValue(left.event)
      const b = timeValue(right.event)
      if (a !== null && b !== null && a !== b) return a - b
      if (a !== null && b === null) return -1
      if (a === null && b !== null) return 1
      return left.link.order_index - right.link.order_index
    })
  }, [threads, eventById])

  const active = activeId ? eventById.get(activeId) || null : null
  const activeThread = useMemo(
    () => (activeId ? threads.find((thread) => thread.events.some((link) => link.event_id === activeId)) || null : null),
    [activeId, threads],
  )
  const activeEntities = useMemo(() => {
    if (!active) return []
    return eventEntityIds(active)
      .map((row) => entityIndex[`${row.type}:${row.id}`] || { id: row.id, name: row.id.slice(0, 8), type: row.type })
      .filter((entity, index, list) => list.findIndex((item) => item.type === entity.type && item.id === entity.id) === index)
  }, [active, entityIndex])

  const relatedIds = useMemo(() => {
    if (!activeId) return new Set<string>()
    const ids = new Set<string>()
    for (const relation of relations) {
      if (relation.source_event_id === activeId) ids.add(relation.target_event_id)
      if (relation.target_event_id === activeId) ids.add(relation.source_event_id)
    }
    for (const id of active?.caused_by || []) ids.add(id)
    if (active?.parent_event_id) ids.add(active.parent_event_id)
    ids.delete(activeId)
    return ids
  }, [active, activeId, relations])

  const focusRows = useMemo(() => {
    if (focus.kind === 'all') return ordered
    if (focus.kind === 'thread') return ordered.filter((row) => row.thread.id === focus.id)
    if (focus.kind === 'entity') {
      return ordered.filter((row) => eventEntityIds(row.event).some((entity) => `${entity.type}:${entity.id}` === focus.id))
    }
    if (focus.kind === 'event') {
      const ids = new Set<string>([focus.id || ''])
      for (const relation of relations) {
        if (relation.source_event_id === focus.id) ids.add(relation.target_event_id)
        if (relation.target_event_id === focus.id) ids.add(relation.source_event_id)
      }
      const event = focus.id ? eventById.get(focus.id) : null
      for (const id of event?.caused_by || []) ids.add(id)
      if (event?.parent_event_id) ids.add(event.parent_event_id)
      return ordered.filter((row) => ids.has(row.event.id))
    }
    return ordered
  }, [ordered, focus, relations, eventById])

  const layout = useMemo(() => {
    const n = focusRows.length
    if (mode === 'fishbone') {
      const width = Math.max(980, n * 150 + 220)
      const height = 760
      const spineY = 380
      const threadLane = new Map<string, number>()
      threads.forEach((thread, index) => threadLane.set(thread.id, index))
      const positions: Positioned[] = focusRows.map((row, index) => {
        const lane = threadLane.get(row.thread.id) || 0
        const above = lane % 2 === 0
        return {
          ...row,
          x: 130 + index * 150,
          y: spineY + (above ? -112 : 46),
        }
      })
      const threadRows = threads
        .filter((thread) => focusRows.some((row) => row.thread.id === thread.id))
        .map((thread, index) => ({ thread, x: 110 + index * 236, y: 94 }))
      return { width, height, spineY, positions, threadRows, centerX: width / 2, centerY: height / 2, top: 70, bottom: height - 40, ticks: [] as Array<{ y: number; label: string }> }
    }
    // 螺旋：时间沿纵轴持续向下推进，两条链左右交织；事件挂在其中一条链上。
    const width = 1500
    const height = Math.max(1040, n * 92 + 240)
    const centerX = width / 2
    const centerY = height / 2
    const top = 112
    const bottom = height - 112
    const radius = 330
    const turns = Math.max(1.35, n / 6)
    const points: Positioned[] = focusRows.map((row, index) => {
      const t = n === 1 ? 0.5 : index / (n - 1)
      const angle = -Math.PI / 2 + t * turns * Math.PI * 2
      const strand = index % 2 === 0 ? 1 : -1
      return {
        ...row,
        x: centerX + strand * Math.sin(angle) * radius,
        y: top + t * (bottom - top),
        angle,
        strand,
      }
    })
    const ticks = points
      .filter((_, index) => n <= 7 || index % Math.max(1, Math.floor(n / 6)) === 0 || index === n - 1)
      .map((row) => ({ y: row.y, label: eventTime(row.event).slice(0, 10) || String(focusRows.findIndex((item) => item.event.id === row.event.id) + 1).padStart(2, '0') }))
    return { width, height, spineY: centerY, positions: points, threadRows: [], centerX, centerY, top, bottom, ticks }
  }, [focusRows, mode, threads])

  const byId = useMemo(() => new Map(layout.positions.map((row) => [row.event.id, row])), [layout])
  const activePosition = activeId ? byId.get(activeId) : null

  const selectEvent = (eventId: string) => {
    setActiveId(eventId)
    onSelectEvent(eventId)
  }

  const entityPosition = (entity: EntityInfo, index: number, total: number) => {
    const base = activePosition || { x: layout.centerX, y: layout.centerY }
    const angle = -Math.PI / 2 + (index / Math.max(1, total)) * Math.PI * 2
    const radius = mode === 'spiral' ? 190 : 168
    return { x: base.x + Math.cos(angle) * radius, y: base.y + Math.sin(angle) * radius }
  }

  const relationPaths = useMemo(() => {
    return relations
      .map((relation) => {
        const source = byId.get(relation.source_event_id)
        const target = byId.get(relation.target_event_id)
        if (!source || !target) return null
        return { relation, source, target }
      })
      .filter(Boolean) as Array<{ relation: EventRelation; source: Positioned; target: Positioned }>
  }, [relations, byId])

  const sequencePaths = useMemo(() => {
    const paths: string[] = []
    for (const thread of threads) {
      const rows = focusRows.filter((row) => row.thread.id === thread.id)
      for (let index = 1; index < rows.length; index += 1) {
        const from = byId.get(rows[index - 1].event.id)
        const to = byId.get(rows[index].event.id)
        if (!from || !to) continue
        paths.push(`M ${from.x} ${from.y} L ${to.x} ${to.y}`)
      }
    }
    return paths
  }, [threads, focusRows, byId])

  if (!ordered.length) {
    return <div className="ng-empty"><Network size={28} strokeWidth={1.3} /><strong>{t.empty}</strong></div>
  }

  return (
    <div className={`ng-shell ng-${mode}`}>
      <div className="ng-toolbar">
        <div className="ng-focus">
          <span className="ng-focus-kicker">{focus.kind === 'event' ? t.focusEvent : focus.kind === 'entity' ? t.focusEntity : focus.kind === 'thread' ? t.focusThread : t.all}</span>
          {focus.kind !== 'all' && (
            <button type="button" onClick={() => setFocus({ kind: 'all' })}><ArrowLeft size={12} /> {t.back}</button>
          )}
          {threads.length > 0 && (
            <label className="ng-thread-select">
              <Network size={11} />
              <select
                aria-label={t.storylines}
                value={focus.kind === 'thread' ? focus.id || '' : ''}
                onChange={(event) => {
                  const id = event.target.value
                  setFocus(id ? { kind: 'thread', id } : { kind: 'all' })
                }}
              >
                <option value="">{t.storylines} · {t.all}</option>
                {threads.map((thread) => (
                  <option key={thread.id} value={thread.id} disabled={!thread.events.length}>
                    {thread.title} · {thread.events.length}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <span className="ng-hint">{t.selectHint}</span>
      </div>

      <div className="ng-layout">
        <div className="ng-stage">
          <TransformWrapper minScale={0.25} maxScale={2.2} initialScale={0.72} centerOnInit wheel={{ step: 0.12 }}>
            <GraphControls t={t} />
            <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }} contentStyle={{ width: `${layout.width}px`, height: `${layout.height}px` }}>
              <div className="ng-canvas" style={{ width: layout.width, height: layout.height }}>
                <svg width={layout.width} height={layout.height} viewBox={`0 0 ${layout.width} ${layout.height}`} role="img" aria-label={t.relationNetwork}>
                  <defs>
                    <filter id="ng-glow" x="-40%" y="-40%" width="180%" height="180%">
                      <feGaussianBlur stdDeviation="5" result="blur" />
                      <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                    <marker id="ng-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                      <path d="M 0 0 L 7 3.5 L 0 7 z" fill="currentColor" />
                    </marker>
                  </defs>

                  {mode === 'fishbone' ? (
                    <>
                      <path className="ng-spine" d={`M 70 ${layout.spineY} H ${layout.width - 50}`} />
                      <path className="ng-spine-arrow" d={`M ${layout.width - 64} ${layout.spineY - 7} L ${layout.width - 50} ${layout.spineY} L ${layout.width - 64} ${layout.spineY + 7}`} />
                      <text className="ng-axis-label" x={layout.width - 52} y={layout.spineY + 25} textAnchor="end">{t.timeAxis}</text>
                      {layout.threadRows.map((row) => (
                        <g key={row.thread.id} className={`ng-thread-tag${focus.kind === 'thread' && focus.id === row.thread.id ? ' is-active' : ''}`} onClick={() => setFocus({ kind: 'thread', id: row.thread.id })}>
                          <rect x={row.x} y={row.y} width={Math.min(210, 70 + row.thread.title.length * 13)} height={32} rx={8} style={{ fill: `${KIND_COLOR[row.thread.kind] || KIND_COLOR.main}22`, stroke: KIND_COLOR[row.thread.kind] || KIND_COLOR.main }} />
                          <circle cx={row.x + 15} cy={row.y + 16} r={4} style={{ fill: KIND_COLOR[row.thread.kind] || KIND_COLOR.main }} />
                          <text x={row.x + 26} y={row.y + 20}>{truncate(row.thread.title, 13)}</text>
                        </g>
                      ))}
                      {layout.positions.map((row) => (
                        <path key={`stem:${row.event.id}`} className="ng-stem" d={`M ${row.x} ${layout.spineY} L ${row.x} ${row.y + (row.y < layout.spineY ? 60 : 0)}`} />
                      ))}
                    </>
                  ) : (
                    <>
                      <line className="ng-time-axis" x1={layout.centerX} y1={layout.top - 34} x2={layout.centerX} y2={layout.bottom + 24} />
                      <path className="ng-time-arrow" d={`M ${layout.centerX - 6} ${layout.bottom + 12} L ${layout.centerX} ${layout.bottom + 24} L ${layout.centerX + 6} ${layout.bottom + 12}`} />
                      <text className="ng-axis-label" x={layout.centerX + 10} y={layout.top - 42}>{t.timeAxis}</text>
                      {layout.ticks.map((tick, index) => (
                        <g key={`tick:${index}`}>
                          <line className="ng-time-tick" x1={layout.centerX - 5} y1={tick.y} x2={layout.centerX + 5} y2={tick.y} />
                          <text className="ng-time-label" x={layout.centerX + 12} y={tick.y + 3}>{tick.label}</text>
                        </g>
                      ))}
                      {(() => {
                        const samples = 72
                        const makeStrand = (direction: number) => Array.from({ length: samples }, (_, index) => {
                          const ratio = index / (samples - 1)
                          const angle = -Math.PI / 2 + ratio * Math.max(1.35, layout.positions.length / 6) * Math.PI * 2
                          return { x: layout.centerX + direction * Math.sin(angle) * 330, y: layout.top + ratio * (layout.bottom - layout.top) }
                        })
                        const strandA = makeStrand(1)
                        const strandB = makeStrand(-1)
                        return (
                          <>
                            <path className="ng-helix" d={spiralPath(strandA)} />
                            <path className="ng-helix ng-helix-shadow" d={spiralPath(strandB)} />
                            {strandA.filter((_, index) => index % 6 === 0 && index > 0 && index < samples - 1).map((point, index) => {
                              const other = strandB[index * 6 + 6 <= samples - 1 ? index * 6 + 6 : samples - 1]
                              return <line key={`rung:${index}`} className="ng-rung" x1={point.x} y1={point.y} x2={other.x} y2={other.y} />
                            })}
                          </>
                        )
                      })()}
                    </>
                  )}

                  {mode === 'fishbone' && sequencePaths.map((d, index) => <path key={`seq:${index}`} className="ng-sequence" d={d} />)}
                  {relationPaths.map(({ relation, source, target }) => (
                    <g key={relation.id} className={`ng-relation${relatedIds.has(relation.source_event_id) || relatedIds.has(relation.target_event_id) ? ' is-hot' : ''}`}>
                      <path d={`M ${source.x} ${source.y} Q ${(source.x + target.x) / 2} ${(source.y + target.y) / 2 - 48} ${target.x} ${target.y}`} />
                    </g>
                  ))}

                  {activePosition && activeEntities.map((entity, index) => {
                    const position = entityPosition(entity, index, activeEntities.length)
                    return (
                      <g key={`${entity.type}:${entity.id}`} className={`ng-entity is-${entity.type}`} onClick={() => setFocus({ kind: 'entity', id: `${entity.type}:${entity.id}` })}>
                        <path className="ng-entity-link" d={`M ${activePosition.x} ${activePosition.y} L ${position.x} ${position.y}`} />
                        <rect x={position.x - 60} y={position.y - 15} width={120} height={30} rx={15} />
                        <text x={position.x} y={position.y + 4} textAnchor="middle">{truncate(entity.name, 9)}</text>
                        <title>{entity.name} · {ENTITY_LABEL[entity.type]}</title>
                      </g>
                    )
                  })}

                  {layout.positions.map((row) => {
                    const isActive = row.event.id === activeId
                    const isRelated = relatedIds.has(row.event.id)
                    const color = KIND_COLOR[row.thread.kind] || KIND_COLOR.main
                    const lines = [truncate(row.event.name, 11), truncate(row.event.storyline || row.thread.title, 14)]
                    return (
                      <g
                        key={row.event.id}
                        className={`ng-event${isActive ? ' is-active' : ''}${isRelated ? ' is-related' : ''}`}
                        transform={`translate(${row.x - 74}, ${row.y})`}
                        onClick={() => selectEvent(row.event.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') selectEvent(row.event.id) }}
                      >
                        <rect width="148" height="60" rx="13" style={{ stroke: color }} />
                        <rect className="ng-event-accent" width="4" height="60" rx="2" style={{ fill: color }} />
                        <text x="15" y="23">{lines[0]}</text>
                        <text x="15" y="43" className="ng-event-sub">{lines[1]}</text>
                        {isActive && <circle cx="132" cy="14" r="4" className="ng-event-live" />}
                        <title>{row.event.name}</title>
                      </g>
                    )
                  })}
                </svg>
              </div>
            </TransformComponent>
          </TransformWrapper>
          <div className="ng-legend">
            {Object.entries(KIND_LABEL).slice(0, 5).map(([kind, label]) => (
              <span key={kind}><i style={{ background: KIND_COLOR[kind] }} />{label}</span>
            ))}
          </div>
        </div>

        <aside className="ng-panel">
          {active ? (
            <>
              <div className="ng-panel-top">
                <span className="ng-panel-kicker"><Crosshair size={12} /> {activeThread ? KIND_LABEL[activeThread.kind] || activeThread.kind : t.thread}</span>
                <button type="button" className="ng-focus-button" onClick={() => setFocus({ kind: 'event', id: active.id })}>{t.focusHere}</button>
              </div>
              <h3>{active.name}</h3>
              <p className="ng-panel-desc">{active.description || t.none}</p>
              <div className="ng-meta">
                <span><ClockText>{eventTime(active) || t.unknown}</ClockText></span>
                {activeThread && <span><Network size={11} /> {activeThread.title} · {activeThread.events.length} {t.events}</span>}
              </div>

              {activeEntities.length === 0 && <p className="ng-panel-empty">{t.noEntity}</p>}
              {(['character', 'location', 'organization'] as EntityKind[]).map((type) => {
                const rows = activeEntities.filter((entity) => entity.type === type)
                if (!rows.length) return null
                return (
                  <section key={type} className="ng-entity-group">
                    <h4>{type === 'character' ? t.participants : type === 'location' ? t.locations : t.organizations}</h4>
                    <div className="ng-chip-list">
                      {rows.map((entity) => (
                        <button key={`${entity.type}:${entity.id}`} type="button" className={`ng-chip is-${entity.type}`} onClick={() => setFocus({ kind: 'entity', id: `${entity.type}:${entity.id}` })}>
                          {type === 'character' ? <Users size={11} /> : <MapPin size={11} />}
                          {entity.name}
                        </button>
                      ))}
                    </div>
                  </section>
                )
              })}

              {relatedIds.size > 0 && (
                <section className="ng-entity-group">
                  <h4>{t.relatedEvents}</h4>
                  <div className="ng-related-list">
                    {[...relatedIds].map((id) => {
                      const event = eventById.get(id)
                      if (!event) return null
                      return (
                        <button key={id} type="button" onClick={() => selectEvent(id)}>
                          <strong>{event.name}</strong>
                          <span>{event.storyline || t.thread}</span>
                        </button>
                      )
                    })}
                  </div>
                </section>
              )}

              <div className="ng-panel-foot">
                <span>{t.relationNetwork}</span>
                <button type="button" onClick={() => onSelectEvent(active.id)}>{t.openEvent}</button>
              </div>
            </>
          ) : (
            <div className="ng-panel-placeholder">
              <Network size={30} strokeWidth={1.2} />
              <strong>{t.relationNetwork}</strong>
              <p>{t.selectHint}</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

function ClockText({ children }: { children: string }) {
  return <span className="ng-clock">◷ {children}</span>
}
