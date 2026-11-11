import { useEffect, useMemo, useState } from 'react'
import { API_ORIGIN } from '../api/config'
import * as storyApi from '../api/storyline'
import * as api from '../api/storyThreads'
import type { StoryProject } from '../api/storyline'

type EventLite = {
  id: string
  name: string
  description?: string
  story_time?: string
  storyline?: string
  scale?: string
  participants?: string[]
  domain?: string[]
}
type CharacterLite = { id: string; name: string }

const KIND_LABEL: Record<string, string> = {
  main: '主线', side: '支线', copy: '副本', shadow: '暗线/影线', ensemble: '群像',
}
const KIND_COLOR: Record<string, string> = {
  main: 'var(--primary-color)', side: '#7a9e7e', copy: '#a58ac1', shadow: '#b08a5a', ensemble: '#7d8fa8',
}
const LANE_W = 286
const LANE_GAP = 22
const PAD = 18
const HEADER_H = 62
const CARD_H = 84
const CARD_GAP = 12

const card: React.CSSProperties = {
  background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '12px', padding: '12px',
  display: 'flex', flexDirection: 'column', gap: '9px', minHeight: 0,
}
const hint: React.CSSProperties = { fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.65 }
const input: React.CSSProperties = {
  padding: '7px 9px', borderRadius: '7px', border: '1px solid var(--card-border)', background: 'var(--card-bg)',
  color: 'var(--text-main)', fontSize: '11px', minWidth: 0, boxSizing: 'border-box',
}
const btn: React.CSSProperties = {
  padding: '6px 10px', borderRadius: '7px', border: '1px solid var(--card-border)', background: 'transparent',
  color: 'var(--text-main)', fontSize: '10px', cursor: 'pointer', whiteSpace: 'nowrap',
}

function laneX(index: number) { return PAD + index * (LANE_W + LANE_GAP) }
function cardY(index: number) { return HEADER_H + 14 + index * (CARD_H + CARD_GAP) }

export default function StorylinePage({ worldId, onOpenEvents }: { worldId?: string; onOpenEvents?: () => void }) {
  const [stories, setStories] = useState<StoryProject[]>([])
  const [storyId, setStoryId] = useState('')
  const [threads, setThreads] = useState<api.StoryThread[]>([])
  const [edges, setEdges] = useState<api.ThreadEdge[]>([])
  const [events, setEvents] = useState<EventLite[]>([])
  const [characters, setCharacters] = useState<CharacterLite[]>([])
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [log, setLog] = useState('')

  const [query, setQuery] = useState('')
  const [filterCharacter, setFilterCharacter] = useState('')
  const [filterLine, setFilterLine] = useState('')
  const [filterScale, setFilterScale] = useState('')

  const [newStoryTitle, setNewStoryTitle] = useState('')
  const [newThreadTitle, setNewThreadTitle] = useState('')
  const [newThreadKind, setNewThreadKind] = useState('main')
  const [newThreadCharacter, setNewThreadCharacter] = useState('')

  const [selectedLinkId, setSelectedLinkId] = useState('')
  const [selectedThreadId, setSelectedThreadId] = useState('')
  const [connectMode, setConnectMode] = useState(false)
  const [connectFrom, setConnectFrom] = useState<{ linkId: string; threadId: string; eventId: string } | null>(null)
  const [editingThread, setEditingThread] = useState(false)
  const [threadTitle, setThreadTitle] = useState('')
  const [threadKind, setThreadKind] = useState('main')
  const [threadCharacter, setThreadCharacter] = useState('')

  const currentStory = stories.find((item) => item.id === storyId) || null
  const selectedThread = threads.find((item) => item.id === selectedThreadId) || null
  const selectedLink = threads.flatMap((thread) => thread.events).find((item) => item.id === selectedLinkId) || null
  const selectedEvent = selectedLink ? events.find((item) => item.id === selectedLink.event_id) || null : null

  const characterName = (id?: string | null) => characters.find((item) => item.id === id)?.name || ''
  const participantLabel = (event: EventLite) => (event.participants || []).map((id) => characterName(id) || id).join('、')

  const loadStory = async (id: string) => {
    if (!id) { setThreads([]); setEdges([]); return }
    setLoading(true)
    try {
      const [threadRows, edgeRows] = await Promise.all([api.listThreads(id), api.listThreadEdges(id)])
      setThreads(threadRows)
      setEdges(edgeRows)
      setSelectedThreadId((prev) => (prev && threadRows.some((t) => t.id === prev) ? prev : threadRows[0]?.id || ''))
    } catch (error: any) { setLog(`❌ ${error.message || error}`) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    if (!worldId) return
    Promise.all([
      storyApi.listStories(worldId),
      fetch(`${API_ORIGIN}/api/events?world_id=${worldId}`).then((res) => res.json()),
      fetch(`${API_ORIGIN}/api/characters?world_id=${worldId}`).then((res) => res.json()),
    ]).then(([storyRows, eventRows, charRows]) => {
      setStories(storyRows)
      setEvents(Array.isArray(eventRows) ? eventRows : [])
      setCharacters(Array.isArray(charRows) ? charRows.map((row: any) => ({ id: row.id, name: row.name })) : [])
      setStoryId((prev) => (prev && storyRows.some((row) => row.id === prev) ? prev : storyRows[0]?.id || ''))
    }).catch((error) => setLog(`❌ ${error.message || error}`))
  }, [worldId])

  useEffect(() => { void loadStory(storyId) }, [storyId])

  const createStoryNow = async () => {
    if (!worldId || !newStoryTitle.trim()) return
    try {
      const created = await storyApi.createStory({ world_id: worldId, title: newStoryTitle.trim() })
      setStories((prev) => [...prev, created])
      setStoryId(created.id)
      setNewStoryTitle('')
      setLog('故事已创建')
    } catch (error: any) { setLog(`❌ ${error.message || error}`) }
  }

  const createThreadNow = async () => {
    if (!storyId || !newThreadTitle.trim()) return
    try {
      await api.createThread(storyId, {
        title: newThreadTitle.trim(), kind: newThreadKind, character_id: newThreadCharacter || undefined,
      })
      setNewThreadTitle(''); setNewThreadCharacter('')
      await loadStory(storyId)
      setLog('故事线已创建')
    } catch (error: any) { setLog(`❌ ${error.message || error}`) }
  }

  const importLegacy = async () => {
    if (!storyId || importing) return
    if (!window.confirm('把该故事既有的结构事件导入为故事树？事件仍引用 05 事件库，不会复制或删除事件。')) return
    setImporting(true)
    try {
      const detail = await storyApi.getStory(storyId)
      const known = [...threads]
      let created = 0
      let attached = 0
      for (const space of detail.spaces) {
        const units = await storyApi.listUnits(space.id)
        for (const unit of units) {
          const title = space.id === detail.original_space_id ? unit.title : `${space.name} · ${unit.title}`
          let thread = known.find((row) => row.title === title)
          if (!thread) {
            const kind = unit.kind === 'mainline' ? 'main' : unit.kind === 'instance' ? 'copy' : 'side'
            thread = await api.createThread(storyId, { title, kind })
            known.push(thread)
            created += 1
          }
          const unitEvents = await storyApi.listUnitEvents(unit.id)
          for (const link of unitEvents) {
            if (thread.events.some((row) => row.event_id === link.event_id)) continue
            const updated = await api.attachThreadEvent(thread.id, link.event_id)
            thread = updated
            attached += 1
          }
        }
      }
      await loadStory(storyId)
      setLog(created || attached ? `已从既有故事生成 ${created} 条线，引用 ${attached} 个事件` : '既有故事没有可导入的结构事件')
    } catch (error: any) { setLog(`❌ ${error.message || error}`) }
    finally { setImporting(false) }
  }

  const attachEvent = async (threadId: string, eventId: string, index?: number) => {
    try {
      await api.attachThreadEvent(threadId, eventId, index)
      await loadStory(storyId)
      setLog('事件已放入故事树')
    } catch (error: any) { setLog(`❌ ${error.message || error}`) }
  }

  const moveLink = async (linkId: string, threadId: string, index: number) => {
    try {
      await api.updateThreadEvent(linkId, { thread_id: threadId, order_index: index })
      await loadStory(storyId)
      setSelectedThreadId(threadId)
      setLog('事件位置已调整')
    } catch (error: any) { setLog(`❌ ${error.message || error}`) }
  }

  const removeLink = async (linkId: string) => {
    try {
      await api.detachThreadEvent(linkId)
      if (selectedLinkId === linkId) setSelectedLinkId('')
      await loadStory(storyId)
      setLog('事件已从故事树移除，事件库中的事件不受影响')
    } catch (error: any) { setLog(`❌ ${error.message || error}`) }
  }

  const moveThread = async (threadId: string, index: number) => {
    try {
      await api.updateThread(threadId, { order_index: index })
      await loadStory(storyId)
      setLog('故事线顺序已调整')
    } catch (error: any) { setLog(`❌ ${error.message || error}`) }
  }

  const saveThread = async () => {
    if (!selectedThread || !threadTitle.trim()) return
    try {
      await api.updateThread(selectedThread.id, {
        title: threadTitle.trim(), kind: threadKind, character_id: threadCharacter || null,
      })
      setEditingThread(false)
      await loadStory(storyId)
      setLog('故事线已更新')
    } catch (error: any) { setLog(`❌ ${error.message || error}`) }
  }

  const deleteThreadNow = async () => {
    if (!selectedThread) return
    if (!window.confirm(`删除故事线「${selectedThread.title}」？事件库中的事件不会被删除。`)) return
    try {
      await api.deleteThread(selectedThread.id)
      setSelectedThreadId('')
      await loadStory(storyId)
      setLog('故事线已删除')
    } catch (error: any) { setLog(`❌ ${error.message || error}`) }
  }

  const startConnect = (thread: api.StoryThread, link: api.StoryThread['events'][number]) => {
    if (!connectMode) return
    if (!connectFrom) {
      setConnectFrom({ linkId: link.id, threadId: thread.id, eventId: link.event_id })
      setLog('已选择起点事件，再点击目标事件建立叙事连线')
      return
    }
    if (connectFrom.linkId === link.id) { setConnectFrom(null); return }
    void createEdge(connectFrom, { linkId: link.id, threadId: thread.id, eventId: link.event_id })
  }

  const createEdge = async (from: { linkId: string; threadId: string; eventId: string }, to: { linkId: string; threadId: string; eventId: string }) => {
    try {
      await api.createThreadEdge(storyId, {
        from_thread_id: from.threadId, to_thread_id: to.threadId,
        from_event_id: from.eventId, to_event_id: to.eventId, edge_type: 'impact',
      })
      setConnectFrom(null)
      setConnectMode(false)
      await loadStory(storyId)
      setLog('叙事连线已建立')
    } catch (error: any) { setLog(`❌ ${error.message || error}`) }
  }

  const removeEdge = async (edgeId: string) => {
    try {
      await api.deleteThreadEdge(edgeId)
      await loadStory(storyId)
      setLog('连线已删除')
    } catch (error: any) { setLog(`❌ ${error.message || error}`) }
  }

  const handleLaneDrop = (event: React.DragEvent, thread: api.StoryThread) => {
    event.preventDefault()
    const eventId = event.dataTransfer.getData('application/x-event-id')
    const linkId = event.dataTransfer.getData('application/x-link-id')
    if (eventId) void attachEvent(thread.id, eventId)
    else if (linkId) {
      const index = threads.find((item) => item.id === thread.id)?.events.length || 0
      void moveLink(linkId, thread.id, index)
    }
  }

  const handleCardDrop = (event: React.DragEvent, thread: api.StoryThread, index: number) => {
    event.preventDefault(); event.stopPropagation()
    const eventId = event.dataTransfer.getData('application/x-event-id')
    const linkId = event.dataTransfer.getData('application/x-link-id')
    if (eventId) void attachEvent(thread.id, eventId, index)
    else if (linkId) void moveLink(linkId, thread.id, index)
  }

  const filteredEvents = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return events.filter((event) => {
      if (needle && !`${event.name} ${event.description || ''}`.toLowerCase().includes(needle)) return false
      if (filterCharacter && !(event.participants || []).includes(filterCharacter)) return false
      if (filterLine && event.storyline !== filterLine) return false
      if (filterScale && event.scale !== filterScale) return false
      return true
    })
  }, [events, query, filterCharacter, filterLine, filterScale])

  const storylineOptions = useMemo(() => Array.from(new Set(events.map((e) => e.storyline).filter(Boolean))), [events])
  const canvasWidth = Math.max(760, PAD * 2 + threads.length * LANE_W + Math.max(0, threads.length - 1) * LANE_GAP)
  const canvasHeight = Math.max(480, HEADER_H + 20 + Math.max(1, ...threads.map((t) => t.events.length)) * (CARD_H + CARD_GAP) + 80)

  const linkPosition = (threadId: string, eventId: string) => {
    const threadIndex = threads.findIndex((thread) => thread.id === threadId)
    const thread = threads[threadIndex]
    if (!thread || threadIndex < 0) return null
    const eventIndex = thread.events.findIndex((link) => link.event_id === eventId)
    if (eventIndex < 0) return null
    return { x: laneX(threadIndex) + 12, y: cardY(eventIndex), centerY: cardY(eventIndex) + CARD_H / 2 }
  }

  return (
    <div style={{ padding: '1rem', height: 'calc(100vh - 60px)', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ ...card, flexDirection: 'row', alignItems: 'center', padding: '10px 14px', gap: '8px', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '16px', color: 'var(--text-main)' }}>故事线管理</h2>
        <select value={storyId} onChange={(e) => setStoryId(e.target.value)} style={{ ...input, maxWidth: '190px' }}>
          <option value="">选择故事</option>
          {stories.map((story) => <option key={story.id} value={story.id}>{story.title}</option>)}
        </select>
        <input value={newStoryTitle} onChange={(e) => setNewStoryTitle(e.target.value)} placeholder="新故事名" style={{ ...input, width: '140px' }} />
        <button style={btn} onClick={() => void createStoryNow()}>+ 故事</button>
        <button style={btn} onClick={() => onOpenEvents?.()}>管理 05 事件</button>
        {threads.length === 0 && <button style={btn} disabled={importing} onClick={() => void importLegacy()}>{importing ? '导入中…' : '从既有故事导入'}</button>}
        <div style={{ flex: 1 }} />
        {connectMode && <span style={{ fontSize: '10px', color: 'var(--primary-color)' }}>{connectFrom ? '点击目标事件完成连线' : '点击起点事件开始连线'}</span>}
        <button style={{ ...btn, ...(connectMode ? { borderColor: 'var(--primary-color)', color: 'var(--primary-color)' } : {}) }}
          onClick={() => { setConnectMode((prev) => !prev); setConnectFrom(null) }}>{connectMode ? '退出连线' : '连线'}</button>
        <span style={{ ...hint }}>{threads.length} 条线 · {threads.reduce((sum, t) => sum + t.events.length, 0)} 事件 · {edges.length} 连线</span>
      </div>

      {!storyId ? (
        <div style={{ ...card, flex: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
          {stories.length === 0 ? '当前世界还没有故事。先创建故事，再从 05 事件库组织剧情。' : '选择一条故事开始编辑。'}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '10px', flex: 1, minHeight: 0 }}>
          {/* 左：事件库 */}
          <div style={{ ...card, width: '266px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <h3 style={{ margin: 0, fontSize: '13px', color: 'var(--text-main)' }}>事件库</h3>
              <div style={{ flex: 1 }} />
              <span style={hint}>{filteredEvents.length}/{events.length}</span>
            </div>
            <div style={{ ...hint }}>来自 05 事件管理；拖到中间故事树即可引用。</div>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索事件…" style={input} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
              <select value={filterCharacter} onChange={(e) => setFilterCharacter(e.target.value)} style={input}>
                <option value="">全部人物</option>
                {characters.map((char) => <option key={char.id} value={char.id}>{char.name}</option>)}
              </select>
              <select value={filterLine} onChange={(e) => setFilterLine(e.target.value)} style={input}>
                <option value="">全部剧情线</option>
                {storylineOptions.map((line) => <option key={line} value={line}>{line}</option>)}
              </select>
              <select value={filterScale} onChange={(e) => setFilterScale(e.target.value)} style={{ ...input, gridColumn: '1 / -1' }}>
                <option value="">全部层级</option>
                <option value="宏观">宏观</option>
                <option value="中观">中观</option>
                <option value="微观">微观</option>
              </select>
            </div>
            {filteredEvents.length === 0 && <div style={{ ...hint, padding: '8px' }}>没有匹配事件。可在 05 创建新事件。</div>}
            {filteredEvents.map((event) => (
              <div key={event.id} draggable data-library-event={event.id}
                onDragStart={(e) => { e.dataTransfer.setData('application/x-event-id', event.id); e.dataTransfer.effectAllowed = 'copy' }}
                style={{ padding: '8px', borderRadius: '7px', border: '1px solid var(--card-border)', cursor: 'grab', background: 'rgba(128,128,128,0.04)' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)' }}>{event.name}</div>
                <div style={{ ...hint, marginTop: '3px' }}>{event.storyline || '未分线'} · {event.scale || '未分层'}{participantLabel(event) ? ` · ${participantLabel(event)}` : ''}</div>
                {event.description && <div style={{ ...hint, marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.description}</div>}
              </div>
            ))}
          </div>

          {/* 中：故事树 */}
          <div style={{ ...card, flex: 1, minWidth: 0, padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 12px', borderBottom: '1px solid var(--card-border)', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: '13px', color: 'var(--text-main)' }}>故事树</h3>
              <input value={newThreadTitle} onChange={(e) => setNewThreadTitle(e.target.value)} placeholder="主线/支线名称，如：韩立成长线" style={{ ...input, flex: 1, minWidth: '150px' }} />
              <select value={newThreadKind} onChange={(e) => setNewThreadKind(e.target.value)} style={input}>
                {Object.entries(KIND_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <select value={newThreadCharacter} onChange={(e) => setNewThreadCharacter(e.target.value)} style={input}>
                <option value="">不绑定人物</option>
                {characters.map((char) => <option key={char.id} value={char.id}>{char.name}</option>)}
              </select>
              <button style={btn} onClick={() => void createThreadNow()}>+ 故事线</button>
            </div>

            <div style={{ position: 'relative', overflow: 'auto', flex: 1 }}>
              {loading && <div style={{ ...hint, padding: '10px' }}>加载故事树…</div>}
              {threads.length === 0 && !loading && (
                <div style={{ padding: '50px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', lineHeight: 2 }}>
                  从一个目标开始：创建「主线」，再把 05 事件拖进来。<br />支线、副本、暗线可以稍后添加。
                </div>
              )}
              {threads.length > 0 && (
                <div style={{ position: 'relative', width: canvasWidth, height: canvasHeight }}>
                  <svg width={canvasWidth} height={canvasHeight} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2 }}>
                    {edges.map((edge) => {
                      const from = edge.from_event_id ? linkPosition(edge.from_thread_id, edge.from_event_id) : { x: laneX(threads.findIndex((t) => t.id === edge.from_thread_id)) + LANE_W - 12, y: HEADER_H / 2 + 4, centerY: HEADER_H / 2 + 4 }
                      const to = edge.to_event_id ? linkPosition(edge.to_thread_id, edge.to_event_id) : { x: laneX(threads.findIndex((t) => t.id === edge.to_thread_id)) + 12, y: HEADER_H / 2 + 4, centerY: HEADER_H / 2 + 4 }
                      if (!from || !to) return null
                      const x1 = from.x + (edge.from_event_id ? LANE_W - 24 : 0)
                      const y1 = from.centerY
                      const x2 = to.x
                      const y2 = to.centerY
                      const mid = (x1 + x2) / 2
                      return (
                        <g key={edge.id}>
                          <path d={`M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`} fill="none" stroke="var(--primary-color)" strokeWidth="1.4" opacity="0.7" />
                          <circle cx={x2} cy={y2} r="3" fill="var(--primary-color)" opacity="0.8" />
                        </g>
                      )
                    })}
                  </svg>

                  {threads.map((thread, threadIndex) => (
                    <div key={thread.id} data-story-lane={thread.id}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleLaneDrop(e, thread)}
                      onClick={() => setSelectedThreadId(thread.id)}
                      style={{
                        position: 'absolute', left: laneX(threadIndex), top: 8, width: LANE_W, bottom: 8,
                        border: `1px solid ${selectedThreadId === thread.id ? 'var(--primary-color)' : 'var(--card-border)'}`,
                        borderRadius: '10px', background: 'rgba(128,128,128,0.035)', zIndex: 1,
                      }}>
                      <div style={{ height: HEADER_H, padding: '10px 12px', borderBottom: '1px dashed var(--card-border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: KIND_COLOR[thread.kind] || 'var(--text-muted)' }} />
                          <strong style={{ fontSize: '12.5px', color: 'var(--text-main)' }}>{thread.title}</strong>
                          <span style={{ flex: 1 }} />
                          <button style={{ ...btn, padding: '1px 4px', fontSize: '9px' }} disabled={threadIndex === 0}
                            onClick={(e) => { e.stopPropagation(); void moveThread(thread.id, threadIndex - 1) }}>←</button>
                          <button style={{ ...btn, padding: '1px 4px', fontSize: '9px' }} disabled={threadIndex === threads.length - 1}
                            onClick={(e) => { e.stopPropagation(); void moveThread(thread.id, threadIndex + 1) }}>→</button>
                          <span style={{ ...hint }}>{KIND_LABEL[thread.kind] || thread.kind}</span>
                        </div>
                        <div style={{ ...hint, marginTop: '4px' }}>{thread.character_name || '未绑定人物'} · {thread.events.length} 事件</div>
                      </div>
                      <div style={{ padding: '8px' }}>
                        {thread.events.map((link, index) => {
                          const event = events.find((row) => row.id === link.event_id)
                          const isSelected = selectedLinkId === link.id
                          const isConnectSource = connectFrom?.linkId === link.id
                          return (
                            <div key={link.id} draggable data-story-link={link.id} data-story-event={link.event_id}
                              onDragStart={(e) => { e.dataTransfer.setData('application/x-link-id', link.id); e.dataTransfer.effectAllowed = 'move' }}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => handleCardDrop(e, thread, index)}
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedThreadId(thread.id)
                                setSelectedLinkId(link.id)
                                if (connectMode) startConnect(thread, link)
                              }}
                              style={{
                                height: CARD_H, boxSizing: 'border-box', padding: '8px', marginBottom: CARD_GAP,
                                borderRadius: '8px', cursor: connectMode ? 'crosshair' : 'grab',
                                border: `1px solid ${isConnectSource ? 'var(--primary-color)' : isSelected ? 'var(--text-main)' : 'var(--card-border)'}`,
                                background: isSelected || isConnectSource ? 'rgba(128,128,128,0.12)' : 'var(--card-bg)',
                                display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'hidden',
                              }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{index + 1}</span>
                                <strong style={{ fontSize: '11.5px', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event?.name || link.event_name || '事件'}</strong>
                              </div>
                              <div style={{ ...hint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event?.description || '暂无说明'}</div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: 'auto' }}>
                                <span style={{ ...hint, fontSize: '9px' }}>{event?.storyline || ''}</span>
                                <span style={{ flex: 1 }} />
                                <button style={{ ...btn, padding: '1px 4px', fontSize: '9px' }} onClick={(e) => { e.stopPropagation(); void moveLink(link.id, thread.id, Math.max(0, index - 1)) }}>↑</button>
                                <button style={{ ...btn, padding: '1px 4px', fontSize: '9px' }} onClick={(e) => { e.stopPropagation(); void moveLink(link.id, thread.id, Math.min(thread.events.length - 1, index + 1)) }}>↓</button>
                                <button style={{ ...btn, padding: '1px 4px', fontSize: '9px', color: 'var(--danger-color)' }} onClick={(e) => { e.stopPropagation(); void removeLink(link.id) }}>×</button>
                              </div>
                            </div>
                          )
                        })}
                        {thread.events.length === 0 && <div style={{ ...hint, textAlign: 'center', padding: '18px 6px', border: '1px dashed var(--card-border)', borderRadius: '8px' }}>拖事件到这里</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 右：检查器 */}
          <div style={{ ...card, width: '252px', overflowY: 'auto' }}>
            <h3 style={{ margin: 0, fontSize: '13px', color: 'var(--text-main)' }}>详情</h3>
            {selectedEvent ? (
              <>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>{selectedEvent.name}</div>
                <div style={hint}>{selectedEvent.storyline || '未分线'} · {selectedEvent.scale || '未分层'} · {selectedEvent.story_time || ''}</div>
                {selectedEvent.description && <div style={{ fontSize: '11px', color: 'var(--text-main)', lineHeight: 1.7 }}>{selectedEvent.description}</div>}
                {participantLabel(selectedEvent) && <div style={hint}>人物：{participantLabel(selectedEvent)}</div>}
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                  <button style={btn} onClick={() => onOpenEvents?.()}>到 05 编辑</button>
                  <button style={{ ...btn, color: 'var(--danger-color)' }} onClick={() => selectedLink && void removeLink(selectedLink.id)}>移出故事树</button>
                </div>
              </>
            ) : selectedThread ? (
              <>
                {editingThread ? (
                  <>
                    <input value={threadTitle} onChange={(e) => setThreadTitle(e.target.value)} style={input} />
                    <select value={threadKind} onChange={(e) => setThreadKind(e.target.value)} style={input}>
                      {Object.entries(KIND_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                    <select value={threadCharacter} onChange={(e) => setThreadCharacter(e.target.value)} style={input}>
                      <option value="">不绑定人物</option>
                      {characters.map((char) => <option key={char.id} value={char.id}>{char.name}</option>)}
                    </select>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <button style={btn} onClick={() => void saveThread()}>保存</button>
                      <button style={btn} onClick={() => setEditingThread(false)}>取消</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>{selectedThread.title}</div>
                    <div style={hint}>{KIND_LABEL[selectedThread.kind] || selectedThread.kind} · {selectedThread.character_name || '未绑定人物'} · {selectedThread.events.length} 事件</div>
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                      <button style={btn} onClick={() => { setEditingThread(true); setThreadTitle(selectedThread.title); setThreadKind(selectedThread.kind); setThreadCharacter(selectedThread.character_id || '') }}>编辑故事线</button>
                      <button style={{ ...btn, color: 'var(--danger-color)' }} onClick={() => void deleteThreadNow()}>删除</button>
                    </div>
                  </>
                )}
              </>
            ) : (
              <div style={hint}>点击故事线或事件查看详情。拖拽事件可调整位置或移入其他线。</div>
            )}

            <div style={{ borderTop: '1px dashed var(--card-border)', paddingTop: '8px', marginTop: '4px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '5px' }}>叙事连线</div>
              {edges.length === 0 && <div style={hint}>点击顶部「连线」，再依次点击起点/目标事件。</div>}
              {edges.map((edge) => (
                <div key={edge.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--text-muted)', padding: '4px 0', borderBottom: '1px dashed var(--card-border)' }}>
                  <span style={{ flex: 1 }}>{edge.from_event_name || edge.from_thread_id.slice(0, 6)} → {edge.to_event_name || edge.to_thread_id.slice(0, 6)}</span>
                  <button style={{ ...btn, padding: '1px 4px', color: 'var(--danger-color)' }} onClick={() => void removeEdge(edge.id)}>×</button>
                </div>
              ))}
            </div>
            {log && <div style={{ fontSize: '10px', color: log.startsWith('❌') ? 'var(--danger-color)' : 'var(--text-muted)', lineHeight: 1.6 }}>{log}</div>}
          </div>
        </div>
      )}
    </div>
  )
}
