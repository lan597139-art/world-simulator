import { useEffect, useMemo, useRef, useState } from 'react'
import { API_ORIGIN } from '../api/config'
import * as storyApi from '../api/storyline'
import * as api from '../api/storyThreads'
import type { StoryProject } from '../api/storyline'
import NarrativeGraphView, { type NarrativeEvent } from '../components/narrative/NarrativeGraphView'

type EventLite = NarrativeEvent

const KIND_LABEL: Record<string, string> = { main: '主线', side: '支线', copy: '副本', shadow: '暗线/影线', ensemble: '群像' }
const KIND_COLOR: Record<string, string> = { main: '#4f7cff', side: '#2f9e6f', copy: '#8b5cf6', shadow: '#c08a2e', ensemble: '#7a8294' }

type TreeMode = 'logic' | 'mindmap' | 'tree' | 'skeleton' | 'fishbone' | 'spiral'
type PlusPos = 'above' | 'below' | 'side'
type NodeKind = 'root' | 'thread' | 'event'

type LaidNode = {
  id: string
  kind: NodeKind
  title: string
  sub: string
  color: string
  width: number
  height: number
  x: number
  y: number
  subW: number
  subH: number
  side: 'left' | 'right'
  children: LaidNode[]
  threadId?: string
  linkId?: string
  eventId?: string
  index?: number
  parentThreadId?: string | null
}

type PickerTarget = { node: LaidNode; position: PlusPos }

const NODE_W = 156
const EVENT_W = 186
const NODE_H = 42
const EVENT_H = 40
const ROOT_W = 170
const ROOT_H = 58
const TREE_X_GAP = 34
const TREE_Y_GAP = 54
const LOGIC_X_GAP = 52
const LOGIC_Y_GAP = 22
const PAD = 30

function curveX(x1: number, y1: number, x2: number, y2: number) {
  const mx = x1 + (x2 - x1) * 0.52
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
}

function curveY(x1: number, y1: number, x2: number, y2: number) {
  const my = y1 + (y2 - y1) * 0.52
  return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`
}

function measureV(node: LaidNode) {
  const totalChildW = node.children.reduce((sum, child) => sum + child.subW, 0) + Math.max(0, node.children.length - 1) * TREE_X_GAP
  node.subW = Math.max(node.width, totalChildW)
  node.subH = node.height + (node.children.length ? TREE_Y_GAP + Math.max(...node.children.map((child) => child.subH)) : 0)
  node.children.forEach(measureV)
}

function measureH(node: LaidNode) {
  const totalChildH = node.children.reduce((sum, child) => sum + child.subH, 0) + Math.max(0, node.children.length - 1) * LOGIC_Y_GAP
  node.subW = node.width + (node.children.length ? LOGIC_X_GAP + Math.max(...node.children.map((child) => child.subW)) : 0)
  node.subH = Math.max(node.height, totalChildH)
  node.children.forEach(measureH)
}

function measureSkeleton(node: LaidNode, depth: number) {
  if (depth === 0) {
    node.children.forEach((c) => measureSkeleton(c, 1))
    const maxW = node.children.length ? Math.max(...node.children.map((c) => c.subW)) : 0
    const totalH = node.children.reduce((sum, c) => sum + c.subH, 0) + (node.children.length > 1 ? (node.children.length - 1) * TREE_Y_GAP : 0)
    node.subW = Math.max(node.width, maxW)
    node.subH = node.height + (node.children.length ? TREE_Y_GAP + totalH : 0)
  } else {
    node.children.forEach((c) => measureSkeleton(c, depth + 1))
    const right = node.children.filter((_, i) => i % 2 === 0)
    const left = node.children.filter((_, i) => i % 2 === 1)

    const measureGroup = (group: LaidNode[]) => {
      if (!group.length) return { w: 0, h: 0 }
      const totalH = group.reduce((sum, c) => sum + c.subH, 0) + (group.length > 1 ? (group.length - 1) * LOGIC_Y_GAP : 0)
      const maxW = Math.max(...group.map((c) => c.subW))
      return { w: maxW, h: totalH }
    }

    const r = measureGroup(right)
    const l = measureGroup(left)

    node.subW = (l.w ? l.w + LOGIC_X_GAP : 0) + node.width + (r.w ? r.w + LOGIC_X_GAP : 0)
    node.subH = Math.max(node.height, r.h, l.h)
  }
}

function placeV(node: LaidNode, left: number, top: number) {
  node.x = left + ((node.subW - node.width) / 2)
  node.y = top
  if (!node.children.length) return
  const childW = node.children.reduce((sum, child) => sum + child.subW, 0) + (node.children.length - 1) * TREE_X_GAP
  let childLeft = left + ((node.subW - childW) / 2)
  const childTop = top + node.height + TREE_Y_GAP
  for (const child of node.children) {
    placeV(child, childLeft, childTop)
    childLeft += child.subW + TREE_X_GAP
  }
}

function placeH(node: LaidNode, left: number, top: number) {
  node.x = left
  node.y = top + ((node.subH - node.height) / 2)
  if (!node.children.length) return
  const childH = node.children.reduce((sum, child) => sum + child.subH, 0) + (node.children.length - 1) * LOGIC_Y_GAP
  let childTop = top + ((node.subH - childH) / 2)
  const childLeft = left + node.width + LOGIC_X_GAP
  for (const child of node.children) {
    placeH(child, childLeft, childTop)
    childTop += child.subH + LOGIC_Y_GAP
  }
}

function placeSide(node: LaidNode, anchorX: number, centerY: number, side: 'left' | 'right') {
  node.side = side
  node.x = side === 'right' ? anchorX + LOGIC_X_GAP : anchorX - LOGIC_X_GAP - node.width
  node.y = centerY - (node.height / 2)
  if (!node.children.length) return
  const childH = node.children.reduce((sum, child) => sum + child.subH, 0) + (node.children.length - 1) * LOGIC_Y_GAP
  let childCenter = centerY - (childH / 2)
  const childAnchor = side === 'right' ? node.x + node.width : node.x
  for (const child of node.children) {
    placeSide(child, childAnchor, childCenter + (child.subH / 2), side)
    childCenter += child.subH + LOGIC_Y_GAP
  }
}

function placeSkeleton(node: LaidNode, baseLeft: number, baseTop: number, depth: number) {
  if (depth === 0) {
    node.x = baseLeft + ((node.subW - node.width) / 2)
    node.y = baseTop
    let childTop = baseTop + node.height + TREE_Y_GAP
    for (const child of node.children) {
      const childLeft = baseLeft + ((node.subW - child.subW) / 2)
      placeSkeleton(child, childLeft, childTop, 1)
      childTop += child.subH + TREE_Y_GAP
    }
  } else {
    node.x = baseLeft + ((node.subW - node.width) / 2)
    node.y = baseTop + ((node.subH - node.height) / 2)

    const right = node.children.filter((_, i) => i % 2 === 0)
    const left = node.children.filter((_, i) => i % 2 === 1)

    const placeGroup = (group: LaidNode[], side: 'left' | 'right') => {
      if (!group.length) return
      const totalH = group.reduce((sum, c) => sum + c.subH, 0) + (group.length > 1 ? (group.length - 1) * LOGIC_Y_GAP : 0)
      let cTop = node.y + (node.height / 2) - (totalH / 2)
      const anchor = side === 'right' ? node.x + node.width : node.x

      for (const child of group) {
        const cLeft = side === 'right' ? anchor + LOGIC_X_GAP : anchor - LOGIC_X_GAP - child.subW
        placeSkeleton(child, cLeft, cTop, 2)
        cTop += child.subH + LOGIC_Y_GAP
      }
    }
    placeGroup(right, 'right')
    placeGroup(left, 'left')
  }
}

function collect(node: LaidNode, list: LaidNode[] = []) {
  list.push(node)
  node.children.forEach((child) => collect(child, list))
  return list
}

function layoutTree(root: LaidNode, mode: TreeMode) {
  if (mode === 'tree') {
    measureV(root)
    placeV(root, 0, 0)
  } else if (mode === 'logic') {
    measureH(root)
    placeH(root, 0, 0)
  } else if (mode === 'skeleton') {
    measureSkeleton(root, 0)
    placeSkeleton(root, 0, 0, 0)
  } else {
    measureH(root)
    root.x = 0
    root.y = 0
    root.side = 'right'
    const right = root.children.filter((_, index) => index % 2 === 0)
    const left = root.children.filter((_, index) => index % 2 === 1)
    const placeGroup = (group: LaidNode[], side: 'left' | 'right') => {
      const total = group.reduce((sum, child) => sum + child.subH, 0) + Math.max(0, group.length - 1) * LOGIC_Y_GAP
      let center = root.y + (root.height / 2) - (total / 2)
      const anchor = side === 'right' ? root.x + root.width : root.x
      for (const child of group) {
        placeSide(child, anchor, center + (child.subH / 2), side)
        center += child.subH + LOGIC_Y_GAP
      }
    }
    placeGroup(right, 'right')
    placeGroup(left, 'left')
  }

  const nodes = collect(root)
  const minX = Math.min(...nodes.map((node) => node.x))
  const minY = Math.min(...nodes.map((node) => node.y))
  for (const node of nodes) {
    node.x += PAD - minX
    node.y += PAD - minY
  }
  const width = Math.max(...nodes.map((node) => node.x + node.width)) + PAD
  const height = Math.max(...nodes.map((node) => node.y + node.height)) + PAD
  return { nodes, root, width, height }
}

function buildTree(
  storyTitle: string,
  threads: api.StoryThread[],
  events: EventLite[],
): LaidNode {
  const eventsById = new Map(events.map((event) => [event.id, event]))
  const byParent = new Map<string, api.StoryThread[]>()
  for (const thread of threads) {
    const key = thread.parent_thread_id || ''
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key)!.push(thread)
  }

  const seen = new Set<string>()
  const buildThread = (thread: api.StoryThread): LaidNode => {
    seen.add(thread.id)
    const color = KIND_COLOR[thread.kind] || KIND_COLOR.main
    const eventChildren = thread.events.map((link, index) => {
      const event = eventsById.get(link.event_id)
      return {
        id: `event:${link.id}`,
        kind: 'event' as const,
        title: event?.name || link.event_name || '未知事件',
        sub: event?.storyline || link.role || '未分类',
        color,
        width: EVENT_W,
        height: EVENT_H,
        x: 0,
        y: 0,
        subW: EVENT_W,
        subH: EVENT_H,
        side: 'right' as const,
        children: [] as LaidNode[],
        threadId: thread.id,
        linkId: link.id,
        eventId: link.event_id,
        index,
      }
    })
    const childThreads = (byParent.get(thread.id) || []).filter((child) => !seen.has(child.id)).map(buildThread)
    const node: LaidNode = {
      id: `thread:${thread.id}`,
      kind: 'thread',
      title: thread.title,
      sub: `${KIND_LABEL[thread.kind] || thread.kind} · ${thread.events.length} 节点`,
      color,
      width: NODE_W,
      height: NODE_H,
      x: 0,
      y: 0,
      subW: NODE_W,
      subH: NODE_H,
      side: 'right',
      children: [...eventChildren, ...childThreads],
      threadId: thread.id,
      parentThreadId: thread.parent_thread_id || null,
    }
    return node
  }

  const topThreads = (byParent.get('') || []).map(buildThread)
  const root: LaidNode = {
    id: 'root',
    kind: 'root',
    title: storyTitle,
    sub: `${threads.length} 条线 · ${threads.reduce((sum, thread) => sum + thread.events.length, 0)} 个节点`,
    color: '#4f7cff',
    width: ROOT_W,
    height: ROOT_H,
    x: 0,
    y: 0,
    subW: ROOT_W,
    subH: ROOT_H,
    side: 'right',
    children: topThreads,
  }
  return root
}

// 通用气泡样式
const popoverStyle: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: '0',
  marginTop: '12px',
  width: '320px',
  background: 'var(--bg-color, #1e1e24)',
  border: '1px solid var(--card-border, #333)',
  borderRadius: '12px',
  padding: '16px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  zIndex: 100,
  cursor: 'default',
  textAlign: 'left',
  pointerEvents: 'auto',
};

export default function StorylinePage({ worldId, onOpenEvents, lang = 'zh' }: { worldId?: string; onOpenEvents?: () => void; lang?: 'zh' | 'en' }) {
  const [stories, setStories] = useState<StoryProject[]>([])
  const [storyId, setStoryId] = useState('')
  const [threads, setThreads] = useState<api.StoryThread[]>([])
  const [events, setEvents] = useState<EventLite[]>([])
  const [selectedLinkId, setSelectedLinkId] = useState('')
  const [selectedThreadId, setSelectedThreadId] = useState('')
  const [busy, setBusy] = useState(false)
  const [treeMode, setTreeMode] = useState<TreeMode>('skeleton')
  const isGraphMode = treeMode === 'fishbone' || treeMode === 'spiral'
  const [picker, setPicker] = useState<PickerTarget | null>(null)
  const [pickerQuery, setPickerQuery] = useState('')
  const canvasRef = useRef<HTMLDivElement>(null)

  const selectedThread = threads.find((thread) => thread.id === selectedThreadId) || null
  const selectedLink = threads.flatMap((thread) => thread.events).find((link) => link.id === selectedLinkId) || null
  const selectedEvent = selectedLink ? events.find((event) => event.id === selectedLink.event_id) || null : null
  const selectedIndex = selectedThread && selectedLink
    ? selectedThread.events.findIndex((link) => link.id === selectedLink.id)
    : -1
  const currentStory = stories.find((story) => story.id === storyId) || null

  const clearSelection = () => {
    setSelectedThreadId('')
    setSelectedLinkId('')
  }

  const loadStory = async (id: string) => {
    if (!id) {
      setThreads([])
      return
    }
    try {
      const threadRows = await api.listThreads(id)
      setThreads(threadRows)
      setSelectedThreadId((prev) => (prev && threadRows.some((thread) => thread.id === prev) ? prev : threadRows[0]?.id || ''))
    } catch (error) {
      console.error(error)
    }
  }

  useEffect(() => {
    if (!worldId) return
    Promise.all([
      storyApi.listStories(worldId),
      fetch(`${API_ORIGIN}/api/events?world_id=${worldId}`).then((res) => res.json()),
    ]).then(([storyRows, eventRows]) => {
      setStories(storyRows)
      setEvents(Array.isArray(eventRows) ? eventRows : [])
      setStoryId((prev) => (prev && storyRows.some((row) => row.id === prev) ? prev : storyRows[0]?.id || ''))
    })
  }, [worldId])

  useEffect(() => { void loadStory(storyId) }, [storyId])

  const layout = useMemo(() => {
    const root = buildTree(currentStory?.title || '故事主题', threads, events)
    return layoutTree(root, treeMode)
  }, [threads, events, currentStory?.title, treeMode])

  const pathList = useMemo(() => {
    const paths: Array<{ key: string; d: string; color: string }> = []
    for (const node of layout.nodes) {
      for (const child of node.children) {
        const isSkeletonRoot = treeMode === 'skeleton' && node.kind === 'root'
        if (treeMode === 'tree' || isSkeletonRoot) {
          paths.push({
            key: `${node.id}-${child.id}`,
            d: curveY(node.x + (node.width / 2), node.y + node.height, child.x + (child.width / 2), child.y),
            color: child.color,
          })
        } else {
          const anchorLeft = child.x >= node.x
          paths.push({
            key: `${node.id}-${child.id}`,
            d: curveX(
              anchorLeft ? node.x + node.width : node.x,
              node.y + (node.height / 2),
              anchorLeft ? child.x : child.x + child.width,
              child.y + (child.height / 2),
            ),
            color: child.color,
          })
        }
      }
    }
    return paths
  }, [layout, treeMode])

  useEffect(() => {
    if (treeMode === 'logic') return
    const frame = requestAnimationFrame(() => {
      const el = canvasRef.current
      if (el) el.scrollLeft = Math.max(0, (layout.width - el.clientWidth) / 2)
    })
    return () => cancelAnimationFrame(frame)
  }, [treeMode, layout.width])

  const detachEvent = async (linkId: string) => {
    setBusy(true)
    try {
      await api.detachThreadEvent(linkId)
      setSelectedLinkId('')
      await loadStory(storyId)
    } finally {
      setBusy(false)
    }
  }

  const deleteThreadNow = async (threadId: string) => {
    if (!window.confirm('删除这条故事线？线内事件不会被删除，只会解除挂接。')) return
    setBusy(true)
    try {
      await api.deleteThread(threadId)
      setSelectedThreadId('')
      await loadStory(storyId)
    } finally {
      setBusy(false)
    }
  }

  const pickerEvents = events.filter((event) =>
    `${event.name} ${event.storyline || ''} ${event.description || ''}`.toLowerCase().includes(pickerQuery.trim().toLowerCase()),
  )

  const openPicker = (node: LaidNode, position: PlusPos) => {
    if (!storyId || busy) return
    setPickerQuery('')
    setPicker({ node, position })
  }

  const createBranchWithEvent = async (event: EventLite, parentThreadId: string | null, kind = 'side') => {
    const thread = await api.createThread(storyId, {
      title: event.name,
      kind,
      parent_thread_id: parentThreadId || undefined,
    })
    await api.attachThreadEvent(thread.id, event.id)
    await loadStory(storyId)
    setSelectedThreadId(thread.id)
    setSelectedLinkId('')
  }

  const applyPick = async (event: EventLite) => {
    const target = picker
    if (!target) return
    setPicker(null)
    setBusy(true)
    try {
      const { node, position } = target
      if (node.kind === 'root') {
        await createBranchWithEvent(event, null, 'main')
      } else if (node.kind === 'thread') {
        if (position === 'side') {
          await api.attachThreadEvent(node.threadId!, event.id)
          await loadStory(storyId)
        } else {
          await createBranchWithEvent(event, node.parentThreadId || null, node.side === 'left' ? 'side' : 'main')
        }
      } else if (node.kind === 'event') {
        if (position === 'side') {
          await createBranchWithEvent(event, node.threadId || null, 'side')
        } else {
          const index = position === 'above' ? node.index : (node.index ?? 0) + 1
          await api.attachThreadEvent(node.threadId!, event.id, index)
          await loadStory(storyId)
        }
      }
    } catch (error) {
      console.error(error)
    } finally {
      setBusy(false)
    }
  }

  const renderPlus = (node: LaidNode) => (
    <>
      <button type="button" className="slx-plus is-above" title="在上方新增" onClick={(event) => { event.stopPropagation(); openPicker(node, 'above') }}>+</button>
      <button type="button" className="slx-plus is-below" title="在下方新增" onClick={(event) => { event.stopPropagation(); openPicker(node, 'below') }}>+</button>
      <button
        type="button"
        className={`slx-plus is-side${node.side === 'left' ? ' is-left' : ''}`}
        title={node.kind === 'thread' ? '在侧边添加事件' : node.kind === 'event' ? '在侧边创建子分支' : '在侧边创建主线'}
        onClick={(event) => { event.stopPropagation(); openPicker(node, 'side') }}
      >+</button>
    </>
  )

  return (
    <div className="slx-page" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* 极简顶部工具栏，只保留故事选择与视图切换 */}
      <div className="slx-topbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid var(--card-border)' }}>
        
        {/* 左侧：只保留故事选择 */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <select value={storyId} onChange={(event) => setStoryId(event.target.value)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)', fontWeight: 600 }}>
            {stories.length === 0 && <option value="">暂无故事</option>}
            {stories.map((story) => <option key={story.id} value={story.id}>{story.title}</option>)}
          </select>
        </div>

        {/* 右侧：只保留视图切换 */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div className="slx-modes" style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', background: 'rgba(128,128,128,0.1)', borderRadius: '8px', padding: '4px' }}>
            <button type="button" className={treeMode === 'skeleton' ? 'is-on' : ''} onClick={() => setTreeMode('skeleton')} style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: treeMode === 'skeleton' ? 'var(--bg-color)' : 'transparent', color: treeMode === 'skeleton' ? 'var(--text-main)' : 'var(--text-muted)' }}>骨架图</button>
            <button type="button" className={treeMode === 'logic' ? 'is-on' : ''} onClick={() => setTreeMode('logic')} style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: treeMode === 'logic' ? 'var(--bg-color)' : 'transparent', color: treeMode === 'logic' ? 'var(--text-main)' : 'var(--text-muted)' }}>逻辑图</button>
            <button type="button" className={treeMode === 'mindmap' ? 'is-on' : ''} onClick={() => setTreeMode('mindmap')} style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: treeMode === 'mindmap' ? 'var(--bg-color)' : 'transparent', color: treeMode === 'mindmap' ? 'var(--text-main)' : 'var(--text-muted)' }}>思维导图</button>
            <button type="button" className={treeMode === 'tree' ? 'is-on' : ''} onClick={() => setTreeMode('tree')} style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: treeMode === 'tree' ? 'var(--bg-color)' : 'transparent', color: treeMode === 'tree' ? 'var(--text-main)' : 'var(--text-muted)' }}>树状图</button>
            <button type="button" className={treeMode === 'fishbone' ? 'is-on' : ''} onClick={() => setTreeMode('fishbone')} style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: treeMode === 'fishbone' ? 'var(--bg-color)' : 'transparent', color: treeMode === 'fishbone' ? 'var(--text-main)' : 'var(--text-muted)' }}>鱼骨图</button>
            <button type="button" className={treeMode === 'spiral' ? 'is-on' : ''} onClick={() => setTreeMode('spiral')} style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: treeMode === 'spiral' ? 'var(--bg-color)' : 'transparent', color: treeMode === 'spiral' ? 'var(--text-main)' : 'var(--text-muted)' }}>DNA 螺旋</button>
          </div>
        </div>
      </div>

      {/* 全宽画布区域 */}
      <div 
        className="slx-canvas-wrap" 
        ref={canvasRef} 
        style={{ flex: 1, overflow: isGraphMode ? 'hidden' : 'auto', position: 'relative', padding: isGraphMode ? '16px 20px 20px' : '24px' }}
        onClick={isGraphMode ? undefined : clearSelection}
      >
        {isGraphMode ? (
          <NarrativeGraphView
            worldId={worldId}
            threads={threads}
            events={events}
            mode={treeMode as 'fishbone' | 'spiral'}
            lang={lang}
            selectedEventId={selectedLink?.event_id || ''}
            onSelectEvent={(eventId) => {
              const thread = threads.find((row) => row.events.some((link) => link.event_id === eventId))
              const link = thread?.events.find((row) => row.event_id === eventId)
              if (thread) setSelectedThreadId(thread.id)
              setSelectedLinkId(link?.id || '')
            }}
          />
        ) : threads.length === 0 ? (
          <div className="slx-empty" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
            <strong style={{ fontSize: '18px', marginBottom: '8px', color: 'var(--text-main)' }}>还没有故事线</strong>
            <span>点击根节点的“+”从事件库生成第一根枝干。</span>
          </div>
        ) : (
          <div className="slx-canvas" style={{ width: layout.width, height: layout.height, position: 'relative' }}>
            <svg className="slx-links" width={layout.width} height={layout.height} aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
              {pathList.map((path) => (
                <path
                  key={path.key}
                  d={path.d}
                  fill="none"
                  stroke={path.color}
                  strokeWidth={path.key.startsWith('root') ? 2.4 : 1.5}
                  opacity={path.key.startsWith('root') ? 0.9 : 0.58}
                  strokeLinecap="round"
                />
              ))}
            </svg>

            {layout.nodes.map((node) => {
              const isSelectedThread = selectedThreadId === node.threadId && !selectedLinkId;
              const isSelectedEvent = selectedLinkId === node.linkId;

              if (node.kind === 'root') {
                return (
                  <div
                    key={node.id}
                    className="slx-node slx-root"
                    style={{ left: node.x, top: node.y, width: node.width, height: node.height, position: 'absolute' }}
                  >
                    <span className="slx-root-mark">◎</span>
                    <strong>{node.title}</strong>
                    <small>{node.sub}</small>
                    {renderPlus(node)}
                  </div>
                )
              }
              
              if (node.kind === 'thread') {
                return (
                  <div
                    key={node.id}
                    className={`slx-node slx-branch${isSelectedThread ? ' is-selected' : ''}`}
                    style={{ left: node.x, top: node.y, width: node.width, height: node.height, borderColor: node.color, position: 'absolute' }}
                    onClick={(e) => { e.stopPropagation(); setSelectedThreadId(node.threadId || ''); setSelectedLinkId(''); }}
                  >
                    <span className="slx-branch-bar" style={{ background: node.color }} />
                    <div>
                      <strong>{node.title}</strong>
                      <small>{node.sub}</small>
                    </div>
                    <button
                      type="button"
                      className="slx-branch-del"
                      title="删除故事线"
                      onClick={(event) => { event.stopPropagation(); void deleteThreadNow(node.threadId!) }}
                    >×</button>
                    {renderPlus(node)}

                    {/* 悬浮详情气泡：Thread */}
                    {isSelectedThread && (
                      <div style={popoverStyle} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{ fontSize: '12px', color: KIND_COLOR[selectedThread?.kind || 'main'], fontWeight: 600 }}>
                            {KIND_LABEL[selectedThread?.kind || 'main'] || '主线'}
                          </span>
                        </div>
                        <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', color: 'var(--text-main)' }}>{node.title}</h4>
                        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>{selectedThread?.events.length} 个事件节点</p>
                        <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: 'var(--text-muted)', opacity: 0.8 }}>
                          悬停节点使用 + 新增：上方/下方创建同级，侧边创建子级。
                        </p>
                      </div>
                    )}
                  </div>
                )
              }
              
              return (
                <div
                  key={node.id}
                  className={`slx-node slx-leaf${isSelectedEvent ? ' is-selected' : ''}`}
                  style={{ left: node.x, top: node.y, width: node.width, height: node.height, borderLeftColor: node.color, position: 'absolute' }}
                  onClick={(e) => { e.stopPropagation(); setSelectedThreadId(node.threadId || ''); setSelectedLinkId(node.linkId || ''); }}
                >
                  <span className="slx-leaf-index">{String((node.index ?? 0) + 1).padStart(2, '0')}</span>
                  <div>
                    <strong>{node.title}</strong>
                    <small>{node.sub}</small>
                  </div>
                  {renderPlus(node)}

                  {/* 悬浮详情气泡：Event */}
                  {isSelectedEvent && selectedEvent && (
                    <div style={popoverStyle} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '12px', color: KIND_COLOR[selectedThread?.kind || 'main'], fontWeight: 600 }}>
                          {KIND_LABEL[selectedThread?.kind || 'main'] || '主线'} · 节点 {selectedIndex >= 0 ? selectedIndex + 1 : '—'}
                        </span>
                        <button onClick={(e) => { e.stopPropagation(); void detachEvent(selectedLink!.id) }} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '12px' }}>移除</button>
                      </div>
                      <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', color: 'var(--text-main)' }}>{selectedEvent.name}</h4>
                      <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: 'var(--text-muted)' }}>{selectedEvent.storyline || '未分类'} · {selectedEvent.scale || '未分层'}</p>
                      <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-main)', lineHeight: 1.5 }}>{selectedEvent.description || '暂无描述'}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 选择事件弹窗 */}
      {picker && (
        <div className="slx-picker-overlay" role="dialog" aria-modal="true" aria-label="选择事件" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setPicker(null)}>
          <div className="slx-picker" onClick={e => e.stopPropagation()} style={{ width: '500px', background: 'var(--bg-color)', borderRadius: '12px', border: '1px solid var(--card-border)', display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>
            <header className="slx-picker-head" style={{ padding: '16px 20px', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{picker.position === 'above' ? '上方新增' : picker.position === 'below' ? '下方新增' : '侧边新增'}</span>
                <strong style={{ fontSize: '18px', color: 'var(--text-main)' }}>选择事件</strong>
                <small style={{ fontSize: '12px', color: 'var(--text-muted)' }}>目标：{picker.node.title} · {picker.position === 'side' ? '创建子级' : '创建同级'}</small>
              </div>
              <button type="button" onClick={() => setPicker(null)} aria-label="关闭" style={{ background: 'transparent', border: 'none', fontSize: '24px', color: 'var(--text-muted)', cursor: 'pointer' }}>×</button>
            </header>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--card-border)' }}>
              <input
                className="slx-picker-search"
                value={pickerQuery}
                onChange={(event) => setPickerQuery(event.target.value)}
                placeholder="搜索事件名称、故事线…"
                autoFocus
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)' }}
              />
            </div>
            <div className="slx-picker-list" style={{ padding: '8px', overflowY: 'auto', flex: 1 }}>
              {pickerEvents.map((event) => (
                <button type="button" key={event.id} className="slx-picker-event" onClick={() => void applyPick(event)} style={{ width: '100%', textAlign: 'left', padding: '12px', border: 'none', background: 'transparent', borderBottom: '1px solid var(--card-border)', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <strong style={{ fontSize: '14px', color: 'var(--text-main)' }}>{event.name}</strong>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{event.storyline || '未分类'}{event.description ? ` · ${event.description.slice(0, 48)}` : ''}</span>
                </button>
              ))}
              {pickerEvents.length === 0 && <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>没有匹配事件</div>}
            </div>
          </div>
        </div>
      )}

      {busy && <div className="slx-busy" style={{ position: 'fixed', bottom: '24px', right: '24px', background: 'var(--primary-color)', color: '#fff', padding: '8px 16px', borderRadius: '8px', zIndex: 1000 }}>同步中…</div>}
    </div>
  )
}