import { useCallback, useEffect, useMemo, useState } from 'react'
import { API_ORIGIN } from '../api/config'
import * as storyApi from '../api/storyline'
import * as treeApi from '../api/storyTree'
import * as threadApi from '../api/storyThreads'

type EventLite = {
  id: string; name: string; description?: string; story_time?: string
  storyline?: string; participants?: string[]; polarity?: string; branch_id?: string | null
}
type CharacterLite = { id: string; name: string }

const KIND_LABEL: Record<string, string> = {
  main: '主线树干', side: '人物支线', copy: '副本线', shadow: '暗线', ensemble: '群像线',
}
const KIND_COLOR: Record<string, string> = {
  main: 'var(--primary-color)', side: '#4f8b6d', copy: '#8768b5', shadow: '#a1703d', ensemble: '#627d9e',
}
const card: React.CSSProperties = {
  background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12,
  padding: 12, boxSizing: 'border-box',
}
const input: React.CSSProperties = {
  width: '100%', padding: '7px 9px', borderRadius: 7, border: '1px solid var(--card-border)',
  background: 'var(--bg-color)', color: 'var(--text-main)', fontSize: 11, boxSizing: 'border-box',
}
const btn: React.CSSProperties = {
  padding: '5px 9px', borderRadius: 7, border: '1px solid var(--card-border)',
  background: 'transparent', color: 'var(--text-main)', fontSize: 10, cursor: 'pointer',
}
const tiny: React.CSSProperties = { fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.6 }

export default function StorylinePage({ worldId, onOpenEvents }: { worldId?: string; onOpenEvents?: () => void }) {
  const [stories, setStories] = useState<storyApi.StoryProject[]>([])
  const [storyId, setStoryId] = useState('')
  const [data, setData] = useState<treeApi.StoryTree | null>(null)
  const [events, setEvents] = useState<EventLite[]>([])
  const [characters, setCharacters] = useState<CharacterLite[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [selectedNodeId, setSelectedNodeId] = useState('')
  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [selectedEventId, setSelectedEventId] = useState('')
  const [collapsedBranches, setCollapsedBranches] = useState<Set<string>>(new Set())
  const [branchForm, setBranchForm] = useState<null | { mode: 'create' | 'edit'; title: string; kind: string; character_id: string; parent_thread_id: string; order_index: string }>(null)
  const [newStoryTitle, setNewStoryTitle] = useState('')
  const [busy, setBusy] = useState(false)

  const loadStories = useCallback(async () => {
    if (!worldId) return
    const rows = await storyApi.listStories(worldId)
    setStories(rows)
    if (!storyId && rows.length) setStoryId(rows[0].id)
  }, [worldId, storyId])

  const loadTree = useCallback(async (id: string) => {
    if (!id) return
    setLoading(true); setError('')
    try {
      const tree = await treeApi.getStoryTree(id)
      setData(tree)
    } catch (err: any) {
      setError(err?.message || '加载故事树失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadStories().catch((err) => setError(err.message)) }, [worldId])
  useEffect(() => { if (storyId) void loadTree(storyId) }, [storyId, loadTree])
  useEffect(() => {
    if (!worldId) return
    fetch(`${API_ORIGIN}/api/events?world_id=${encodeURIComponent(worldId)}`)
      .then((r) => r.json()).then((rows) => setEvents(Array.isArray(rows) ? rows : []))
      .catch(() => setEvents([]))
    fetch(`${API_ORIGIN}/api/characters`)
      .then((r) => r.json()).then((rows) => setCharacters(Array.isArray(rows) ? rows.filter((c: any) => c.world_id === worldId) : []))
      .catch(() => setCharacters([]))
  }, [worldId])

  const branchById = useMemo(() => new Map((data?.branches || []).map((b) => [b.id, b])), [data])
  const nodeById = useMemo(() => new Map((data?.nodes || []).map((n) => [n.id, n])), [data])
  const roots = useMemo(() => {
    const branches = data?.branches || []
    return branches.filter((b) => !b.parent_thread_id || !branches.some((p) => p.id === b.parent_thread_id))
  }, [data])
  const trunk = useMemo(() => roots.find((b) => b.kind === 'main') || roots[0], [roots])
  const selectedNode = selectedNodeId ? nodeById.get(selectedNodeId) : undefined
  const selectedBranch = selectedBranchId ? branchById.get(selectedBranchId) : undefined
  const selectedEvent = selectedEventId ? events.find((e) => e.id === selectedEventId) : undefined
  const filteredEvents = useMemo(() => {
    const q = query.trim().toLowerCase()
    return events.filter((e) => !q || e.name.toLowerCase().includes(q) || (e.description || '').toLowerCase().includes(q))
  }, [events, query])

  const resetSelection = () => { setSelectedNodeId(''); setSelectedBranchId(''); setSelectedEventId('') }
  const flash = (text: string) => { setNotice(text); window.setTimeout(() => setNotice(''), 3200) }

  const createStory = async () => {
    if (!worldId || !newStoryTitle.trim()) return
    setBusy(true)
    try {
      const story = await storyApi.createStory({ world_id: worldId, title: newStoryTitle.trim() })
      setNewStoryTitle(''); await loadStories(); setStoryId(story.id)
    } catch (err: any) { setError(err.message) } finally { setBusy(false) }
  }

  const openBranchForm = (mode: 'create' | 'edit', parent?: string) => {
    if (mode === 'edit' && selectedBranch) {
      setBranchForm({
        mode, title: selectedBranch.title, kind: selectedBranch.kind,
        character_id: selectedBranch.character_id || '',
        parent_thread_id: selectedBranch.parent_thread_id || '',
        order_index: String(selectedBranch.order_index),
      })
    } else {
      setBranchForm({
        mode: 'create', title: '', kind: 'side', character_id: '',
        parent_thread_id: parent || trunk?.id || '', order_index: String((data?.branches.length || 0)),
      })
    }
  }

  const saveBranch = async () => {
    if (!storyId || !branchForm || !branchForm.title.trim()) return
    setBusy(true)
    try {
      if (branchForm.mode === 'create') {
        const created = await threadApi.createThread(storyId, {
          title: branchForm.title.trim(), kind: branchForm.kind,
          character_id: branchForm.character_id || undefined,
          parent_thread_id: branchForm.parent_thread_id || undefined,
        })
        setSelectedBranchId(created.id)
        flash('树枝已创建，可在下方添加事件或待填充位置')
      } else if (selectedBranch) {
        await threadApi.updateThread(selectedBranch.id, {
          title: branchForm.title.trim(), kind: branchForm.kind,
          character_id: branchForm.character_id || null,
          parent_thread_id: branchForm.parent_thread_id || null,
          order_index: Number(branchForm.order_index) || 0,
        })
        flash('树枝设置已保存')
      }
      setBranchForm(null); await loadTree(storyId)
    } catch (err: any) { setError(err.message) } finally { setBusy(false) }
  }

  const addPending = async (threadId: string) => {
    if (!storyId) return
    setBusy(true)
    try {
      const node = await treeApi.createTreeNode(storyId, {
        thread_id: threadId, node_status: 'pending', title: '待填充事件',
      })
      setSelectedNodeId(node.id); setSelectedBranchId(threadId); setSelectedEventId('')
      await loadTree(storyId); flash('已新增待填充位置，点击右侧事件即可填入')
    } catch (err: any) { setError(err.message) } finally { setBusy(false) }
  }

  const addChildNode = async (node: treeApi.TreeNode) => {
    if (!storyId) return
    setBusy(true)
    try {
      const child = await treeApi.createTreeNode(storyId, {
        thread_id: node.thread_id, parent_node_id: node.id,
        node_status: 'pending', title: '待填充：延伸',
      })
      setSelectedNodeId(child.id); setSelectedBranchId(node.thread_id); setSelectedEventId('')
      await loadTree(storyId); flash('已在该事件叶下新增延伸位置')
    } catch (err: any) { setError(err.message) } finally { setBusy(false) }
  }

  const fillNode = async (nodeId: string, eventId: string) => {
    setBusy(true)
    try {
      await treeApi.updateTreeNode(nodeId, { event_id: eventId })
      setSelectedNodeId(nodeId); setSelectedEventId(eventId)
      if (storyId) await loadTree(storyId)
      flash('事件已放入故事树；原事件本身未被复制或修改')
    } catch (err: any) { setError(err.message) } finally { setBusy(false) }
  }

  const dropEvent = async (threadId: string, eventId: string, nodeId?: string) => {
    if (nodeId) return fillNode(nodeId, eventId)
    if (!storyId) return
    setBusy(true)
    try {
      const node = await treeApi.createTreeNode(storyId, { thread_id: threadId, event_id: eventId })
      setSelectedNodeId(node.id); setSelectedBranchId(threadId); setSelectedEventId(eventId)
      await loadTree(storyId); flash('事件叶已追加到该树枝')
    } catch (err: any) { setError(err.message) } finally { setBusy(false) }
  }

  const addEventToSelected = async (eventId: string) => {
    if (selectedNode && !selectedNode.event_id) return fillNode(selectedNode.id, eventId)
    const threadId = selectedBranchId || trunk?.id
    if (!threadId) { setError('请先选择一根树枝'); return }
    return dropEvent(threadId, eventId)
  }

  const updateNode = async (payload: Partial<treeApi.TreeNode>) => {
    if (!selectedNode) return
    setBusy(true)
    try {
      await treeApi.updateTreeNode(selectedNode.id, payload)
      if (storyId) await loadTree(storyId); flash('节点已保存')
    } catch (err: any) { setError(err.message) } finally { setBusy(false) }
  }

  const removeNode = async () => {
    if (!selectedNode || !window.confirm('从故事树移除这个节点？不会删除 05 原始事件。')) return
    setBusy(true)
    try {
      await treeApi.deleteTreeNode(selectedNode.id)
      resetSelection(); if (storyId) await loadTree(storyId); flash('节点已移除')
    } catch (err: any) { setError(err.message) } finally { setBusy(false) }
  }

  const removeBranch = async () => {
    if (!selectedBranch || !window.confirm('删除这根树枝及树上的节点？05 原始事件不会被删除。')) return
    setBusy(true)
    try {
      await threadApi.deleteThread(selectedBranch.id)
      resetSelection(); if (storyId) await loadTree(storyId); flash('树枝已删除')
    } catch (err: any) { setError(err.message) } finally { setBusy(false) }
  }

  const toggleBranch = (id: string) => {
    setCollapsedBranches((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const moveNode = async (direction: -1 | 1) => {
    if (!selectedNode) return
    const siblings = (data?.nodes || []).filter((n) => n.thread_id === selectedNode.thread_id && n.parent_node_id === selectedNode.parent_node_id)
      .sort((a, b) => a.order_index - b.order_index)
    const index = siblings.findIndex((n) => n.id === selectedNode.id)
    const other = siblings[index + direction]
    if (!other) return
    await updateNode({ order_index: other.order_index })
    await treeApi.updateTreeNode(other.id, { order_index: selectedNode.order_index })
    if (storyId) await loadTree(storyId)
  }

  const nodeChildren = (threadId: string, parentId?: string | null) =>
    (data?.nodes || []).filter((n) => n.thread_id === threadId && (n.parent_node_id || null) === (parentId || null))
      .sort((a, b) => a.order_index - b.order_index)
  const childBranches = (parentId: string) =>
    (data?.branches || []).filter((b) => b.parent_thread_id === parentId).sort((a, b) => a.order_index - b.order_index)

  const renderNodes = (threadId: string, parentId?: string | null, depth = 0): React.ReactNode =>
    nodeChildren(threadId, parentId).map((node) => {
      const filled = Boolean(node.event_id)
      const selected = node.id === selectedNodeId
      return (
        <div key={node.id} style={{ marginLeft: depth ? 18 : 0, marginTop: 6 }}>
          <div
            draggable={false}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
            onDrop={(e) => { e.preventDefault(); e.stopPropagation(); const eventId = e.dataTransfer.getData('text/ws-event'); if (eventId) void dropEvent(threadId, eventId, node.id) }}
            onClick={() => { setSelectedNodeId(node.id); setSelectedBranchId(threadId); setSelectedEventId(node.event_id || '') }}
            style={{
              ...card, padding: '9px 10px', cursor: 'pointer', position: 'relative',
              borderStyle: filled ? 'solid' : 'dashed',
              borderColor: selected ? 'var(--primary-color)' : filled ? 'var(--card-border)' : '#b9883e',
              background: selected ? 'color-mix(in srgb, var(--primary-color) 12%, var(--card-bg))'
                : filled ? 'var(--card-bg)' : 'color-mix(in srgb, #b9883e 9%, var(--card-bg))',
            }}
            title={filled ? node.event_name : '待填充位置：点击后从右侧选事件，或直接拖事件进来'}
          >
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 10, background: filled ? 'rgba(128,128,128,.15)' : 'rgba(185,136,62,.18)', color: filled ? 'var(--text-muted)' : '#8a6429' }}>
                {filled ? '事件叶' : '待填充'}
              </span>
              {node.event_polarity && <span style={tiny}>{node.event_polarity}</span>}
              <strong style={{ fontSize: 11.5, color: 'var(--text-main)' }}>{filled ? (node.event_name || node.title) : (node.title || '待填充事件')}</strong>
              <span style={{ flex: 1 }} />
              <button
                type="button"
                title="在该事件叶下新增延伸位置"
                onClick={(e) => { e.stopPropagation(); void addChildNode(node) }}
                style={{ ...btn, padding: '0 5px', fontSize: 11 }}
              >＋</button>
            </div>
            {filled && node.event_description && <div style={{ ...tiny, marginTop: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{node.event_description}</div>}
            {!filled && <div style={{ ...tiny, marginTop: 4 }}>拖入 05 事件，或点击后在右侧选择。之后仍可编辑。</div>}
            {nodeChildren(threadId, node.id).length > 0 && (
              <div style={{ marginTop: 6, borderLeft: '1px dashed var(--card-border)', paddingLeft: 8 }}>
                {renderNodes(threadId, node.id, depth + 1)}
              </div>
            )}
          </div>
        </div>
      )
    })

  const renderBranch = (branch: treeApi.TreeBranch, depth = 0): React.ReactNode => {
    const collapsed = collapsedBranches.has(branch.id)
    const nodes = nodeChildren(branch.id, null)
    const children = childBranches(branch.id)
    const isTrunk = branch.kind === 'main'
    return (
      <div key={branch.id} style={{ marginLeft: depth ? 26 : 0, marginTop: depth ? 8 : 14, position: 'relative' }}>
        {depth > 0 && (
          <div aria-hidden style={{ position: 'absolute', left: -16, top: 16, width: 14, height: 1, background: 'var(--card-border)' }} />
        )}
        <div
          onClick={() => { setSelectedBranchId(branch.id); setSelectedNodeId(''); setSelectedEventId('') }}
          style={{
            ...card, padding: '10px 12px', cursor: 'pointer',
            borderLeft: `4px solid ${KIND_COLOR[branch.kind] || 'var(--card-border)'}`,
            background: selectedBranchId === branch.id ? 'color-mix(in srgb, var(--primary-color) 10%, var(--card-bg))' : 'var(--card-bg)',
            boxShadow: isTrunk ? '0 4px 18px rgba(0,0,0,.08)' : 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); toggleBranch(branch.id) }}
              style={{ ...btn, padding: '0 5px', fontSize: 12, lineHeight: '18px' }}
              title={collapsed ? '展开' : '收起'}
            >{collapsed ? '▸' : '▾'}</button>
            <span style={{ fontSize: 9, color: '#fff', background: KIND_COLOR[branch.kind] || '#777', borderRadius: 10, padding: '2px 7px' }}>
              {KIND_LABEL[branch.kind] || branch.kind}
            </span>
            <strong style={{ fontSize: isTrunk ? 15 : 13, color: 'var(--text-main)' }}>{branch.title}</strong>
            {branch.character_name && <span style={{ ...tiny, border: '1px solid var(--card-border)', borderRadius: 9, padding: '0 5px' }}>归属：{branch.character_name}</span>}
            <span style={tiny}>{nodes.length} 个事件叶 · {children.length} 个子枝</span>
            <span style={{ flex: 1 }} />
            <button type="button" onClick={(e) => { e.stopPropagation(); setSelectedBranchId(branch.id); openBranchForm('create', branch.id) }} style={btn}>＋子枝</button>
            <button type="button" onClick={(e) => { e.stopPropagation(); void addPending(branch.id) }} style={btn}>＋待填充位置</button>
          </div>
          {isTrunk && <div style={{ ...tiny, marginTop: 5 }}>树干：这条线是故事主线；其他颜色从树干或彼此分叉。</div>}
        </div>
        {!collapsed && (
          <div style={{ paddingLeft: 14, borderLeft: `1px solid ${isTrunk ? 'var(--primary-color)' : 'var(--card-border)'}`, marginLeft: 10 }}>
            <div
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
              onDrop={(e) => { e.preventDefault(); const eventId = e.dataTransfer.getData('text/ws-event'); if (eventId) void dropEvent(branch.id, eventId) }}
              style={{ display: 'flex', flexDirection: 'column', gap: 2, minHeight: 34 }}
            >
              {nodes.length === 0 ? (
                <div style={{ ...tiny, border: '1px dashed var(--card-border)', borderRadius: 8, padding: 10 }}>
                  这里还没有事件叶。从右侧拖一个 05 事件进来，或先加一个待填充位置。
                </div>
              ) : renderNodes(branch.id, null)}
            </div>
            {children.map((child) => renderBranch(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0, color: 'var(--text-main)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18 }}>故事线 · 真实树状图</h2>
          <div style={tiny}>树干是主线，树枝是人物/副本/暗线，树叶是事件或待填充位置；节点只引用 05 事件，不复制。</div>
        </div>
        <span style={{ flex: 1 }} />
        <select value={storyId} onChange={(e) => { setStoryId(e.target.value); resetSelection() }} style={{ ...input, width: 260 }}>
          <option value="">选择故事</option>
          {stories.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
        </select>
        <button type="button" style={btn} onClick={() => storyId && void loadTree(storyId)}>刷新</button>
      </div>

      {notice && <div style={{ fontSize: 11, color: '#2f7d57', background: 'rgba(47,125,87,.1)', border: '1px solid rgba(47,125,87,.25)', borderRadius: 8, padding: '7px 10px' }}>{notice}</div>}
      {error && <div style={{ fontSize: 11, color: 'var(--danger-color)', background: 'rgba(239,68,68,.08)', borderRadius: 8, padding: '7px 10px' }}>{error}</div>}

      {!stories.length && (
        <div style={{ ...card, maxWidth: 520 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>当前世界还没有故事项目</div>
          <div style={{ ...tiny, margin: '4px 0 8px' }}>创建一个故事项目，再把已有 05 事件放进树里。</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={newStoryTitle} onChange={(e) => setNewStoryTitle(e.target.value)} placeholder="故事名称" style={input} />
            <button type="button" style={btn} disabled={busy} onClick={() => void createStory()}>创建</button>
          </div>
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 12 }}>
        <div style={{ overflow: 'auto', minWidth: 0, paddingRight: 4 }}>
          {loading && <div style={tiny}>加载故事树…</div>}
          {!loading && data && roots.length === 0 && (
            <div style={{ ...card, maxWidth: 540 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>还没有故事树</div>
              <div style={{ ...tiny, margin: '4px 0 8px' }}>先创建主线树干，再向树干添加事件叶和支线。</div>
              <button type="button" style={btn} onClick={() => openBranchForm('create')}>＋ 创建主线树干</button>
            </div>
          )}
          {!loading && data && roots.length > 0 && (
            <>
              {roots.map((branch) => renderBranch(branch, 0))}
              <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                <button type="button" style={btn} onClick={() => openBranchForm('create', trunk?.id)}>＋ 从树干新增树枝</button>
                <span style={{ ...tiny, alignSelf: 'center' }}>也可以点任一树枝上的「＋子枝」做层级分叉。</span>
              </div>
            </>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
          <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 7, maxHeight: '42%', minHeight: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <strong style={{ fontSize: 12 }}>05 事件库</strong>
              <span style={tiny}>{events.length} 个事件</span>
              <span style={{ flex: 1 }} />
              <button type="button" style={btn} onClick={onOpenEvents}>去 05</button>
            </div>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索事件" style={input} />
            <div style={{ overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 5, minHeight: 0 }}>
              {filteredEvents.map((event) => (
                <div
                  key={event.id}
                  draggable
                  onDragStart={(e) => { e.dataTransfer.setData('text/ws-event', event.id); e.dataTransfer.effectAllowed = 'copy' }}
                  onClick={() => setSelectedEventId(event.id)}
                  style={{
                    padding: '7px 8px', borderRadius: 8, cursor: 'grab',
                    border: `1px solid ${selectedEventId === event.id ? 'var(--primary-color)' : 'var(--card-border)'}`,
                    background: selectedEventId === event.id ? 'color-mix(in srgb, var(--primary-color) 10%, var(--card-bg))' : 'transparent',
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 600 }}>{event.name}</div>
                  <div style={{ ...tiny, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{event.story_time || '时间未定'} · {event.storyline || event.polarity || '事件'}</div>
                </div>
              ))}
              {!filteredEvents.length && <div style={tiny}>没有匹配事件。</div>}
            </div>
            {selectedEvent && (
              <button type="button" style={{ ...btn, borderColor: 'var(--primary-color)', color: 'var(--primary-color)' }} onClick={() => void addEventToSelected(selectedEvent.id)}>
                {selectedNode && !selectedNode.event_id ? '填入当前待填充位置' : `加入「${selectedBranch?.title || trunk?.title || '所选树枝'}」`}
              </button>
            )}
          </div>

          <div style={{ ...card, overflow: 'auto', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {selectedNode ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <strong style={{ fontSize: 12 }}>{selectedNode.event_id ? '事件叶' : '待填充节点'}</strong>
                  <span style={{ flex: 1 }} />
                  <button type="button" style={btn} onClick={() => void moveNode(-1)}>↑</button>
                  <button type="button" style={btn} onClick={() => void moveNode(1)}>↓</button>
                </div>
                <label style={tiny}>节点标题
                  <input key={selectedNode.id + selectedNode.title} defaultValue={selectedNode.title} onBlur={(e) => { if (e.target.value !== selectedNode.title) void updateNode({ title: e.target.value }) }} style={{ ...input, marginTop: 3 }} />
                </label>
                <div style={tiny}>引用事件：{selectedNode.event_name || '未绑定'}（{selectedNode.event_id ? selectedNode.event_id.slice(0, 8) : '待填充'}）</div>
                <label style={tiny}>备注
                  <textarea key={selectedNode.id + (selectedNode.note || '')} defaultValue={selectedNode.note || ''} rows={2} onBlur={(e) => { if (e.target.value !== (selectedNode.note || '')) void updateNode({ note: e.target.value }) }} style={{ ...input, marginTop: 3, resize: 'vertical' }} />
                </label>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {selectedNode.event_id && <button type="button" style={btn} onClick={onOpenEvents}>在 05 查看原事件</button>}
                  <button type="button" style={{ ...btn, color: 'var(--danger-color)', borderColor: 'var(--danger-color)' }} onClick={() => void removeNode()}>移除节点</button>
                </div>
              </>
            ) : selectedBranch ? (
              <>
                <strong style={{ fontSize: 12 }}>树枝设置</strong>
                <div style={{ fontSize: 12 }}>{selectedBranch.title}</div>
                <div style={tiny}>{KIND_LABEL[selectedBranch.kind] || selectedBranch.kind} · 归属 {selectedBranch.character_name || '未指定'} · 上级 {selectedBranch.parent_thread_id ? (branchById.get(selectedBranch.parent_thread_id)?.title || '已删除') : '无（根）'}</div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  <button type="button" style={btn} onClick={() => openBranchForm('edit')}>编辑名称/层级/归属</button>
                  <button type="button" style={btn} onClick={() => void addPending(selectedBranch.id)}>＋待填充位置</button>
                  <button type="button" style={{ ...btn, color: 'var(--danger-color)', borderColor: 'var(--danger-color)' }} onClick={() => void removeBranch()}>删除树枝</button>
                </div>
              </>
            ) : (
              <>
                <strong style={{ fontSize: 12 }}>这棵树怎么用</strong>
                <div style={tiny}>1. 选中待填充位置，再从右侧事件库点选，或把事件拖到位置上。<br />2. 把事件拖进树枝空白处，会在枝上追加一片事件叶。<br />3. 「＋子枝」建立层级分叉，可设名称、类型、归属人物与上级。<br />4. 收起树枝后仍保留数据，不影响 05 事件。</div>
                <div style={{ ...tiny, borderTop: '1px dashed var(--card-border)', paddingTop: 7 }}>
                  当前：{data?.counts.branches || 0} 根树枝 / {data?.counts.filled || 0} 片事件叶 / {data?.counts.pending || 0} 个待填充。
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {branchForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ ...card, width: 440, maxWidth: '100%', padding: 18, background: 'var(--bg-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <strong style={{ fontSize: 14 }}>{branchForm.mode === 'create' ? '新增树枝' : '编辑树枝'}</strong>
              <span style={{ flex: 1 }} />
              <button type="button" style={btn} onClick={() => setBranchForm(null)}>关闭</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
              <label style={tiny}>树枝名称
                <input autoFocus value={branchForm.title} onChange={(e) => setBranchForm({ ...branchForm, title: e.target.value })} placeholder="例如：韩立人物线" style={{ ...input, marginTop: 3 }} />
              </label>
              <label style={tiny}>类型 / 层级角色
                <select value={branchForm.kind} onChange={(e) => setBranchForm({ ...branchForm, kind: e.target.value })} style={{ ...input, marginTop: 3 }}>
                  {Object.entries(KIND_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
              </label>
              <label style={tiny}>归属人物（可选）
                <select value={branchForm.character_id} onChange={(e) => setBranchForm({ ...branchForm, character_id: e.target.value })} style={{ ...input, marginTop: 3 }}>
                  <option value="">不指定</option>
                  {characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label style={tiny}>上级树枝 / 排列层级
                <select value={branchForm.parent_thread_id} onChange={(e) => setBranchForm({ ...branchForm, parent_thread_id: e.target.value })} style={{ ...input, marginTop: 3 }}>
                  <option value="">无（根级分支）</option>
                  {(data?.branches || []).filter((b) => !selectedBranch || b.id !== selectedBranch.id).map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
                </select>
              </label>
              {branchForm.mode === 'edit' && (
                <label style={tiny}>同级排列序号
                  <input type="number" value={branchForm.order_index} onChange={(e) => setBranchForm({ ...branchForm, order_index: e.target.value })} style={{ ...input, marginTop: 3 }} />
                </label>
              )}
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" style={btn} onClick={() => setBranchForm(null)}>取消</button>
                <button type="button" style={{ ...btn, background: 'var(--primary-color)', color: 'var(--primary-text)', borderColor: 'var(--primary-color)' }} disabled={busy || !branchForm.title.trim()} onClick={() => void saveBranch()}>保存</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
