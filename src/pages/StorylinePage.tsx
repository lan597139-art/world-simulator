import { useEffect, useMemo, useState } from 'react'
import { API_ORIGIN } from '../api/config'
import * as api from '../api/storyline'
import { listStories as listChapters } from '../api/writing'
import type { StoryChoice, StoryDetail, StoryEnding, StoryProject, StorySpace, StoryUnit, StoryUnitEvent } from '../api/storyline'

const card: React.CSSProperties = {
  background: 'var(--card-bg)',
  border: '1px solid var(--card-border)',
  borderRadius: '12px',
  padding: '14px',
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
  minHeight: 0,
}

const sectionTitle: React.CSSProperties = { margin: 0, fontSize: '14px', color: 'var(--text-main)' }
const hint: React.CSSProperties = { fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.6 }
const input: React.CSSProperties = {
  padding: '6px 8px',
  borderRadius: '6px',
  border: '1px solid var(--card-border)',
  background: 'var(--card-bg)',
  color: 'var(--text-main)',
  fontSize: '11px',
  minWidth: 0,
}
const btn: React.CSSProperties = {
  padding: '5px 10px',
  borderRadius: '6px',
  border: '1px solid var(--primary-color)',
  background: 'transparent',
  color: 'var(--primary-color)',
  fontSize: '10px',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

const UNIT_LABEL: Record<string, string> = { mainline: '主线', side: '支线', instance: '副本', phase: '阶段' }
const ENDING_LABEL: Record<string, string> = { final: '最终', stage: '阶段', open: '开放' }

export default function StorylinePage({ worldId }: { worldId?: string }) {
  const [stories, setStories] = useState<StoryProject[]>([])
  const [storyId, setStoryId] = useState('')
  const [detail, setDetail] = useState<StoryDetail | null>(null)
  const [spaceId, setSpaceId] = useState('')
  const [units, setUnits] = useState<StoryUnit[]>([])
  const [unitEvents, setUnitEvents] = useState<Record<string, StoryUnitEvent[]>>({})
  const [selectedUnitId, setSelectedUnitId] = useState('')
  const [choices, setChoices] = useState<StoryChoice[]>([])
  const [endings, setEndings] = useState<StoryEnding[]>([])
  const [chapterOptions, setChapterOptions] = useState<any[]>([])
  const [spaceChapters, setSpaceChapters] = useState<any[]>([])
  const [chapterPick, setChapterPick] = useState('')
  const [events, setEvents] = useState<any[]>([])
  const [log, setLog] = useState('')

  const [newStoryTitle, setNewStoryTitle] = useState('')
  const [newSpaceName, setNewSpaceName] = useState('')
  const [newUnitTitle, setNewUnitTitle] = useState('')
  const [newUnitKind, setNewUnitKind] = useState('side')
  const [eventPick, setEventPick] = useState('')
  const [sharedPick, setSharedPick] = useState(false)
  const [newChoiceTitle, setNewChoiceTitle] = useState('')
  const [newChoiceAnchor, setNewChoiceAnchor] = useState('')
  const [optionDraft, setOptionDraft] = useState<Record<string, string>>({})
  const [newEndingName, setNewEndingName] = useState('')
  const [newEndingKind, setNewEndingKind] = useState('open')

  const space = useMemo(() => detail?.spaces.find((item) => item.id === spaceId) || null, [detail, spaceId])
  const selectedUnit = useMemo(() => units.find((item) => item.id === selectedUnitId) || null, [units, selectedUnitId])

  useEffect(() => {
    if (!worldId) return
    Promise.all([
      api.listStories(worldId),
      fetch(`${API_ORIGIN}/api/events?world_id=${worldId}`).then((res) => res.json()),
    ])
      .then(([rows, eventRows]) => {
        setStories(rows)
        setEvents(Array.isArray(eventRows) ? eventRows : [])
        setStoryId((prev) => (prev && rows.some((row) => row.id === prev) ? prev : rows[0]?.id || ''))
      })
      .catch((error) => setLog(String(error.message || error)))
  }, [worldId])

  useEffect(() => {
    if (!storyId) {
      setDetail(null)
      return
    }
    listChapters(worldId).then((rows) => setChapterOptions(rows)).catch(() => undefined)
    api.getStory(storyId)
      .then((data) => {
        setDetail(data)
        setSpaceId((prev) => (prev && data.spaces.some((s) => s.id === prev) ? prev : data.original_space_id || data.spaces[0]?.id || ''))
      })
      .catch((error) => setLog(String(error.message || error)))
  }, [storyId])

  const reloadStory = () => storyId && api.getStory(storyId).then(setDetail).catch(() => undefined)

  useEffect(() => {
    if (!spaceId) {
      setUnits([]); setChoices([]); setEndings([])
      return
    }
    Promise.all([api.listUnits(spaceId), api.listChoices(spaceId), api.listEndings(spaceId), api.listSpaceChapters(spaceId)])
      .then(async ([unitRows, choiceRows, endingRows, chapterRows]) => {
        setUnits(unitRows)
        setChoices(choiceRows)
        setEndings(endingRows)
        setSpaceChapters(chapterRows)
        const pairs = await Promise.all(unitRows.map((unit) => api.listUnitEvents(unit.id).then((rows) => [unit.id, rows] as const)))
        setUnitEvents(Object.fromEntries(pairs))
        setSelectedUnitId((prev) => (prev && unitRows.some((u) => u.id === prev) ? prev : unitRows[0]?.id || ''))
      })
      .catch((error) => setLog(String(error.message || error)))
  }, [spaceId])

  const guard = async (work: () => Promise<string | void>, success: string) => {
    try {
      const detail = await work()
      setLog(detail || success)
    } catch (error: any) {
      setLog(`❌ ${error.message || error}`)
    }
  }

  const createStoryNow = () => guard(async () => {
    if (!worldId || !newStoryTitle.trim()) throw new Error('请填写故事名')
    const story = await api.createStory({ world_id: worldId, title: newStoryTitle.trim() })
    setStories((prev) => [...prev, story])
    setStoryId(story.id)
    setNewStoryTitle('')
  }, '故事已创建')

  const addOriginal = () => guard(async () => {
    if (!detail || !newSpaceName.trim()) throw new Error('请填写空间名')
    const created = await api.createSpace(detail.id, { name: newSpaceName.trim(), is_original: true })
    await reloadStory()
    setSpaceId(created.id)
    setNewSpaceName('')
  }, '原始空间已创建')

  const addUnitNow = () => guard(async () => {
    if (!space) return
    if (!newUnitTitle.trim()) throw new Error('请填写单元名')
    await api.createUnit(space.id, { kind: newUnitKind, title: newUnitTitle.trim() })
    setNewUnitTitle('')
    setSpaceId(space.id)
    const rows = await api.listUnits(space.id)
    setUnits(rows)
  }, '结构单元已创建')

  const addEventNow = () => guard(async () => {
    if (!selectedUnit || !eventPick) throw new Error('先选单元和事件')
    await api.addUnitEvent(selectedUnit.id, { event_id: eventPick, is_shared: sharedPick })
    const rows = await api.listUnitEvents(selectedUnit.id)
    setUnitEvents((prev) => ({ ...prev, [selectedUnit.id]: rows }))
    setEventPick('')
    setSharedPick(false)
  }, '事件已挂接')

  const removeEvent = (unitId: string, eventId: string) => guard(async () => {
    await api.removeUnitEvent(unitId, eventId)
    const rows = await api.listUnitEvents(unitId)
    setUnitEvents((prev) => ({ ...prev, [unitId]: rows }))
  }, '已解除挂接')

  const createChoiceNow = () => guard(async () => {
    if (!space || !newChoiceTitle.trim()) throw new Error('请填写选择标题')
    const choice = await api.createChoice(space.id, {
      title: newChoiceTitle.trim(),
      anchor_event_id: newChoiceAnchor || undefined,
    })
    setChoices((prev) => [...prev, choice])
    setNewChoiceTitle('')
    setNewChoiceAnchor('')
  }, '选择节点已创建')

  const addOptionNow = (choiceId: string) => guard(async () => {
    const label = (optionDraft[choiceId] || '').trim()
    if (!label) throw new Error('请填写选项文案')
    const option = await api.addOption(choiceId, { label })
    setChoices((prev) => prev.map((item) => (item.id === choiceId ? { ...item, options: [...item.options, option] } : item)))
    setOptionDraft((prev) => ({ ...prev, [choiceId]: '' }))
  }, '选项已添加')

  const resolveNow = (choice: StoryChoice, optionId: string) => guard(async () => {
    const result = await api.resolveChoice(choice.id, { option_id: optionId })
    setChoices((prev) => prev.map((item) => (item.id === choice.id ? result.choice : item)))
    await reloadStory()
    setSpaceId(result.space.id)
  }, '已进入新空间')

  const addEndingNow = () => guard(async () => {
    if (!space || !newEndingName.trim()) throw new Error('请填写结局名')
    const ending = await api.createEnding(space.id, {
      name: newEndingName.trim(),
      kind: newEndingKind,
      is_final: newEndingKind === 'final',
    })
    setEndings((prev) => [...prev, ending])
    setNewEndingName('')
  }, '结局已保存')

  const linkChapterNow = () => guard(async () => {
    if (!detail || !space || !chapterPick) throw new Error('先选章节和空间')
    await api.linkChapter(detail.id, { chapter_id: chapterPick, space_id: space.id })
    setSpaceChapters(await api.listSpaceChapters(space.id))
    await reloadStory()
    setChapterPick('')
  }, '章节已关联')

  const unlinkChapterNow = (linkId: string) => guard(async () => {
    await api.unlinkChapter(linkId)
    setSpaceChapters((prev) => prev.filter((row) => row.id !== linkId))
  }, '章节关联已解除')

  const compareNow = () => guard(async () => {
    const original = detail?.spaces.find((item) => item.is_original)
    if (!original || !space) throw new Error('缺少可对比的空间')
    if (original.id === space.id) throw new Error('当前就是正史空间')
    const result = await api.compareSpaces([original.id, space.id])
    const counts = result.differences?.event_counts || {}
    return `对比：${Object.entries(counts).map(([name, count]) => `${name} ${count} 个事件`).join(' · ')}`
  }, '对比完成')

  const rollbackNow = () => guard(async () => {
    if (!space?.base_node_id) throw new Error('该空间没有可回溯的分叉节点')
    await api.rollbackSpace(space.id, space.base_node_id, '故事线回溯')
    await reloadStory()
  }, '已回溯到分叉节点')

  const availableEvents = useMemo(() => {
    if (!space) return events
    if (space.branch_id) return events.filter((event) => event.branch_id === space.branch_id || !event.branch_id)
    return events.filter((event) => !event.branch_id)
  }, [events, space])

  if (!worldId) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>请先进入一个世界。</div>

  return (
    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '12px', height: 'calc(100vh - 60px)', boxSizing: 'border-box' }}>
      <div style={{ ...card, flexDirection: 'row', alignItems: 'center', gap: '10px', padding: '10px 14px' }}>
        <h2 style={{ ...sectionTitle, fontSize: '16px', marginRight: '6px' }}>故事线管理</h2>
        <select value={storyId} onChange={(e) => setStoryId(e.target.value)} style={{ ...input, maxWidth: '200px' }}>
          <option value="">选择故事</option>
          {stories.map((story) => <option key={story.id} value={story.id}>{story.title}</option>)}
        </select>
        <input value={newStoryTitle} onChange={(e) => setNewStoryTitle(e.target.value)} placeholder="新故事名" style={{ ...input, width: '150px' }} />
        <button style={btn} onClick={() => void createStoryNow()}>+ 故事</button>
        <div style={{ flex: 1 }} />
        {log && <div style={{ ...hint, maxWidth: '45%', color: 'var(--text-main)' }}>{log}</div>}
      </div>

      <div style={{ display: 'flex', gap: '12px', flex: 1, minHeight: 0 }}>
        <div style={{ ...card, width: '240px', overflowY: 'auto' }}>
          <h3 style={sectionTitle}>空间</h3>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input value={newSpaceName} onChange={(e) => setNewSpaceName(e.target.value)} placeholder="空间名" style={{ ...input, flex: 1 }} />
            <button style={btn} onClick={() => void addOriginal()}>+ 正史</button>
          </div>
          <div style={{ ...hint }}>正史空间只挂主时间线事件；分叉空间由「选择节点」生成。</div>
          {detail?.spaces.map((item) => (
            <button
              key={item.id}
              onClick={() => setSpaceId(item.id)}
              style={{
                textAlign: 'left', padding: '8px', borderRadius: '8px', cursor: 'pointer',
                border: `1px solid ${item.id === spaceId ? 'var(--primary-color)' : 'var(--card-border)'}`,
                background: item.id === spaceId ? 'rgba(128,128,128,0.12)' : 'transparent',
                color: 'var(--text-main)', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '3px',
              }}
            >
              <span style={{ fontWeight: 600 }}>{item.is_original ? '◉ 正史' : '⑂'} {item.name}</span>
              <span style={hint}>{item.unit_count} 单元 · {item.ending_count} 结局 · {item.chapter_count} 章{item.branch_id ? ` · ${item.node_count} 节点` : ''}</span>
            </button>
          ))}
          {space && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button style={btn} onClick={() => void compareNow()}>对比正史</button>
              {space.branch_id && <button style={btn} onClick={() => void rollbackNow()}>回溯分叉点</button>}
            </div>
          )}
        </div>

        <div style={{ ...card, flex: 1, overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3 style={sectionTitle}>结构单元 {space ? `· ${space.name}` : ''}</h3>
            <div style={{ flex: 1 }} />
            <select value={newUnitKind} onChange={(e) => setNewUnitKind(e.target.value)} style={input}>
              {Object.entries(UNIT_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <input value={newUnitTitle} onChange={(e) => setNewUnitTitle(e.target.value)} placeholder="单元名" style={{ ...input, width: '110px' }} />
            <button style={btn} onClick={() => void addUnitNow()}>+ 单元</button>
          </div>
          {units.map((unit) => (
            <div
              key={unit.id}
              onClick={() => setSelectedUnitId(unit.id)}
              style={{
                border: `1px solid ${unit.id === selectedUnitId ? 'var(--primary-color)' : 'var(--card-border)'}`,
                borderRadius: '8px', padding: '9px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '6px',
              }}
            >
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12px', color: 'var(--text-main)' }}>
                <span style={{ color: 'var(--primary-color)', fontSize: '10px' }}>{UNIT_LABEL[unit.kind] || unit.kind}</span>
                <strong>{unit.title}</strong>
                <span style={hint}>{unit.event_count} 事件</span>
              </div>
              {unit.summary && <div style={hint}>{unit.summary}</div>}
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                {(unitEvents[unit.id] || []).map((link) => (
                  <span
                    key={link.id}
                    style={{ padding: '2px 7px', borderRadius: '999px', border: '1px solid var(--card-border)', fontSize: '10px', color: 'var(--text-muted)' }}
                    title={link.is_shared ? '正史共享事件' : '专属事件'}
                  >
                    {link.event_name || link.event_id.slice(0, 6)}{link.is_shared ? ' · 共享' : ''}
                    <button
                      style={{ border: 'none', background: 'transparent', color: 'var(--danger-color)', cursor: 'pointer', fontSize: '10px', padding: '0 0 0 4px' }}
                      onClick={(e) => { e.stopPropagation(); void removeEvent(unit.id, link.event_id) }}
                    >×</button>
                  </span>
                ))}
              </div>
            </div>
          ))}
          {space && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px dashed var(--card-border)', paddingTop: '10px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-main)' }}>挂事件到：{selectedUnit?.title || '（先选单元）'}</div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <select value={eventPick} onChange={(e) => setEventPick(e.target.value)} style={{ ...input, flex: 1 }}>
                  <option value="">选择事件</option>
                  {availableEvents.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
                </select>
                <label style={{ ...hint, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input type="checkbox" checked={sharedPick} onChange={(e) => setSharedPick(e.target.checked)} /> 正史共享
                </label>
                <button style={btn} onClick={() => void addEventNow()}>挂接</button>
              </div>
            </div>
          )}
        </div>

        <div style={{ ...card, width: '320px', overflowY: 'auto' }}>
          <h3 style={sectionTitle}>选择节点</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <input value={newChoiceTitle} onChange={(e) => setNewChoiceTitle(e.target.value)} placeholder="选择标题，如：是否反杀" style={input} />
            <select value={newChoiceAnchor} onChange={(e) => setNewChoiceAnchor(e.target.value)} style={input}>
              <option value="">锚定事件（可选）</option>
              {availableEvents.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
            </select>
            <button style={btn} onClick={() => void createChoiceNow()}>+ 选择节点</button>
          </div>
          {choices.map((choice) => (
            <div key={choice.id} style={{ border: '1px solid var(--card-border)', borderRadius: '8px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-main)' }}><strong>{choice.title}</strong> <span style={hint}>{choice.status === 'resolved' ? '已确定' : '待选择'}</span></div>
              {choice.options.map((option) => (
                <div key={option.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-main)', flex: 1 }}>{option.label}{option.target_space_id ? ' → 已建空间' : ''}</span>
                  {!option.target_space_id && choice.status !== 'resolved' && (
                    <button style={btn} onClick={() => void resolveNow(choice, option.id)}>进入</button>
                  )}
                </div>
              ))}
              <div style={{ display: 'flex', gap: '5px' }}>
                <input
                  value={optionDraft[choice.id] || ''}
                  onChange={(e) => setOptionDraft((prev) => ({ ...prev, [choice.id]: e.target.value }))}
                  placeholder="新选项"
                  style={{ ...input, flex: 1 }}
                />
                <button style={btn} onClick={() => void addOptionNow(choice.id)}>+ 选项</button>
              </div>
            </div>
          ))}

          <h3 style={{ ...sectionTitle, marginTop: '6px' }}>结局</h3>
          <div style={{ display: 'flex', gap: '5px' }}>
            <input value={newEndingName} onChange={(e) => setNewEndingName(e.target.value)} placeholder="结局名" style={{ ...input, flex: 1 }} />
            <select value={newEndingKind} onChange={(e) => setNewEndingKind(e.target.value)} style={input}>
              {Object.entries(ENDING_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <button style={btn} onClick={() => void addEndingNow()}>+</button>
          </div>
          {endings.map((ending) => (
            <div key={ending.id} style={{ border: '1px solid var(--card-border)', borderRadius: '7px', padding: '7px', fontSize: '11px', color: 'var(--text-main)' }}>
              <strong>{ending.name}</strong> <span style={hint}>{ENDING_LABEL[ending.kind] || ending.kind}{ending.source_ending_id ? ' · 来自推演' : ''}</span>
            </div>
          ))}
          {!space && <div style={hint}>先创建/选择一个空间。</div>}

          <h3 style={{ ...sectionTitle, marginTop: '6px' }}>关联章节</h3>
          <div style={{ display: 'flex', gap: '5px' }}>
            <select value={chapterPick} onChange={(e) => setChapterPick(e.target.value)} style={{ ...input, flex: 1 }}>
              <option value="">选择章节</option>
              {chapterOptions.map((chapter) => <option key={chapter.id} value={chapter.id}>{chapter.title}{chapter.word_count ? ` · ${chapter.word_count}字` : ''}</option>)}
            </select>
            <button style={btn} onClick={() => void linkChapterNow()}>关联</button>
          </div>
          {spaceChapters.map((row) => (
            <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid var(--card-border)', borderRadius: '7px', padding: '6px', fontSize: '11px', color: 'var(--text-main)' }}>
              <span style={{ flex: 1 }}>{row.title}{row.unit_id ? ' · 单元内' : ''}</span>
              <span style={hint}>{row.word_count} 字</span>
              <button style={{ ...btn, padding: '2px 6px', borderColor: 'var(--danger-color)', color: 'var(--danger-color)' }} onClick={() => void unlinkChapterNow(row.id)}>解除</button>
            </div>
          ))}
          {!spaceChapters.length && <div style={hint}>该空间还没有关联章节。</div>}
        </div>
      </div>
    </div>
  )
}
