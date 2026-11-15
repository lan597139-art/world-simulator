import { useEffect, useMemo, useState } from 'react'
import { BookOpen, Check, Map, Sparkles, Trash2, X } from 'lucide-react'
import * as foreshadowApi from '../../api/writingForeshadows'
import type { ForeshadowItem, ForeshadowPayoff, ForeshadowStatus } from '../../api/writingForeshadows'
import type { WritingChapter, WritingVolume } from '../../api/writingVolumes'
import type { StoryItem } from '../../api/writing'

type Tab = 'board' | 'map'

type Props = {
  worldId: string
  stories: StoryItem[]
  currentStoryId?: string
  volumes: WritingVolume[]
  chapters: WritingChapter[]
  events?: Array<{ id: string; name: string }>
  initialText?: string
  onClose: () => void
  onToast: (message: string) => void
  onSelectChapter?: (id: string) => void
}

const STATUS_META: Record<ForeshadowStatus, { label: string; tone: string }> = {
  pending: { label: '待埋', tone: 'is-pending' },
  planted: { label: '已埋', tone: 'is-planted' },
  paid: { label: '已回收', tone: 'is-paid' },
  abandoned: { label: '已放弃', tone: 'is-abandoned' },
}

const PAYOFFS: ForeshadowPayoff[] = ['信息', '情绪', '危机']

function fmtTime(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

export default function ForeshadowBoard({
  worldId,
  stories,
  currentStoryId,
  volumes,
  chapters,
  events = [],
  initialText,
  onClose,
  onToast,
  onSelectChapter,
}: Props) {
  const [tab, setTab] = useState<Tab>('board')
  const [rows, setRows] = useState<ForeshadowItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formOpen, setFormOpen] = useState(Boolean(initialText))
  const [text, setText] = useState(initialText || '')
  const [promise, setPromise] = useState('')
  const [cost, setCost] = useState('')
  const [payoff, setPayoff] = useState<ForeshadowPayoff>('信息')
  const [plannedStoryId, setPlannedStoryId] = useState('')
  const [statusFilter, setStatusFilter] = useState<ForeshadowStatus | 'all'>('all')

  const sourceStoryId = currentStoryId || ''

  const load = async () => {
    if (!worldId) return
    setLoading(true)
    try {
      const list = await foreshadowApi.listForeshadows(worldId)
      setRows(Array.isArray(list) ? list : [])
    } catch (error: any) {
      onToast(String(error?.message || error))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // 只在世界切换时重新拉取；行内操作会局部更新。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldId])

  const filtered = useMemo(
    () => (statusFilter === 'all' ? rows : rows.filter((row) => row.status === statusFilter)),
    [rows, statusFilter],
  )

  const counts = useMemo(() => {
    const result: Record<ForeshadowStatus, number> = { pending: 0, planted: 0, paid: 0, abandoned: 0 }
    for (const row of rows) result[row.status] += 1
    return result
  }, [rows])

  const create = async () => {
    if (!sourceStoryId) {
      onToast('先选择一个章节，再标记伏笔')
      return
    }
    if (!text.trim()) {
      onToast('请先填写伏笔文字')
      return
    }
    setSaving(true)
    try {
      const created = await foreshadowApi.createForeshadow(sourceStoryId, {
        text: text.trim(),
        promise: promise.trim(),
        cost: cost.trim(),
        payoff_form: payoff,
        planned_story_id: plannedStoryId || undefined,
      })
      setRows((prev) => [created, ...prev])
      setText('')
      setPromise('')
      setCost('')
      setPayoff('信息')
      setPlannedStoryId('')
      setFormOpen(false)
      setStatusFilter('all')
      onToast('伏笔已登记，进入待埋清单')
    } catch (error: any) {
      onToast(String(error?.message || error))
    } finally {
      setSaving(false)
    }
  }

  const patch = async (id: string, body: Parameters<typeof foreshadowApi.updateForeshadow>[1]) => {
    try {
      const updated = await foreshadowApi.updateForeshadow(id, body)
      setRows((prev) => prev.map((row) => (row.id === id ? updated : row)))
    } catch (error: any) {
      onToast(String(error?.message || error))
    }
  }

  const resolve = async (row: ForeshadowItem) => {
    try {
      const updated = await foreshadowApi.resolveForeshadow(row.id, sourceStoryId || undefined)
      setRows((prev) => prev.map((item) => (item.id === row.id ? updated : item)))
      onToast('伏笔已标记回收')
    } catch (error: any) {
      onToast(String(error?.message || error))
    }
  }

  const remove = async (row: ForeshadowItem) => {
    if (!window.confirm(`删除伏笔“${row.text.slice(0, 24)}…”？`)) return
    try {
      await foreshadowApi.deleteForeshadow(row.id)
      setRows((prev) => prev.filter((item) => item.id !== row.id))
    } catch (error: any) {
      onToast(String(error?.message || error))
    }
  }

  const mapVolumes = useMemo(() => {
    const groups = volumes.map((volume) => ({
      volume,
      chapters: chapters.filter((chapter) => chapter.volume_id === volume.id),
    }))
    groups.push({ volume: null as unknown as WritingVolume, chapters: chapters.filter((chapter) => !chapter.volume_id) })
    return groups.filter((group) => group.chapters.length > 0)
  }, [volumes, chapters])

  const storyById = useMemo(() => {
    const map: Record<string, StoryItem> = {}
    for (const story of stories) map[story.id] = story
    return map
  }, [stories])

  const eventById = useMemo(() => {
    const map: Record<string, string> = {}
    for (const event of events) map[event.id] = event.name
    return map
  }, [events])

  const byChapter = useMemo(() => {
    const map: Record<string, ForeshadowItem[]> = {}
    for (const row of rows) {
      if (!row.story_id) continue
      map[row.story_id] = map[row.story_id] || []
      map[row.story_id].push(row)
    }
    return map
  }, [rows])

  return (
    <div className="fb-overlay" role="dialog" aria-modal="true" aria-label="伏笔与故事路线">
      <div className="fb-modal">
        <header className="fb-head">
          <div>
            <div className="fb-kicker">FORESHADOW LEDGER / STORY ROUTE</div>
            <h2>伏笔与路线图</h2>
            <p>伏笔只存在写作层，不会污染 05 事件与 07 推演。每埋一条，都要写清承诺、代价和计划回收。</p>
          </div>
          <button type="button" className="fb-close" onClick={onClose} aria-label="关闭"><X size={15} /></button>
        </header>

        <div className="fb-tabs">
          <button type="button" className={tab === 'board' ? 'is-on' : ''} onClick={() => setTab('board')}>
            <BookOpen size={12} /> 伏笔看板
          </button>
          <button type="button" className={tab === 'map' ? 'is-on' : ''} onClick={() => setTab('map')}>
            <Map size={12} /> 故事路线图
          </button>
          <span className="fb-summary">待埋 {counts.pending} · 已埋 {counts.planted} · 已回收 {counts.paid}</span>
        </div>

        <div className="fb-body">
          {tab === 'board' ? (
            <>
              <div className="fb-board-head">
                <div className="fb-filters">
                  {(['all', 'pending', 'planted', 'paid', 'abandoned'] as const).map((key) => (
                    <button
                      key={key}
                      type="button"
                      className={statusFilter === key ? 'is-on' : ''}
                      onClick={() => setStatusFilter(key)}
                    >
                      {key === 'all' ? '全部' : STATUS_META[key].label}
                    </button>
                  ))}
                </div>
                <button type="button" className="fb-primary" onClick={() => setFormOpen((prev) => !prev)}>
                  <Sparkles size={12} /> 标记伏笔
                </button>
              </div>

              {formOpen && (
                <div className="fb-form">
                  <label>
                    <span>伏笔文字 / 读者看到的异常</span>
                    <textarea value={text} onChange={(event) => setText(event.target.value)} rows={2} placeholder="例：他反复擦那把没有血的刀。" />
                  </label>
                  <div className="fb-form-grid">
                    <label>
                      <span>承诺（读者会期待什么）</span>
                      <input value={promise} onChange={(event) => setPromise(event.target.value)} placeholder="这把刀与旧案有关" />
                    </label>
                    <label>
                      <span>代价（回收时要付什么）</span>
                      <input value={cost} onChange={(event) => setCost(event.target.value)} placeholder="主角必须承认自己撒过谎" />
                    </label>
                    <label>
                      <span>回收形式</span>
                      <select value={payoff} onChange={(event) => setPayoff(event.target.value as ForeshadowPayoff)}>
                        {PAYOFFS.map((item) => <option key={item} value={item}>{item}</option>)}
                      </select>
                    </label>
                    <label>
                      <span>计划回收章节</span>
                      <select value={plannedStoryId} onChange={(event) => setPlannedStoryId(event.target.value)}>
                        <option value="">暂不指定</option>
                        {stories.map((story) => <option key={story.id} value={story.id}>{story.title}</option>)}
                      </select>
                    </label>
                  </div>
                  <div className="fb-form-foot">
                    <span>{sourceStoryId ? `登记在：${stories.find((story) => story.id === sourceStoryId)?.title || '当前章节'}` : '尚未选择章节'}</span>
                    <div>
                      <button type="button" onClick={() => setFormOpen(false)}>取消</button>
                      <button type="button" className="fb-primary" disabled={saving} onClick={() => void create()}>
                        {saving ? '登记中…' : '登记伏笔'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {loading ? (
                <div className="fb-empty">正在读伏笔账本…</div>
              ) : filtered.length === 0 ? (
                <div className="fb-empty">
                  <strong>{rows.length === 0 ? '还没有伏笔' : '这个状态下没有伏笔'}</strong>
                  <span>在正文选中一句可疑的话，点“埋伏笔”，或者直接点右上角登记。</span>
                </div>
              ) : (
                <div className="fb-grid">
                  {filtered.map((row) => (
                    <article key={row.id} className={`fb-card ${STATUS_META[row.status].tone}`}>
                      <div className="fb-card-top">
                        <span className={`fb-status ${STATUS_META[row.status].tone}`}>{STATUS_META[row.status].label}</span>
                        <span className="fb-payoff">{row.payoff_form}</span>
                        <button type="button" className="fb-del" onClick={() => void remove(row)} title="删除伏笔"><Trash2 size={11} /></button>
                      </div>
                      <p className="fb-text">{row.text}</p>
                      {row.promise && <p className="fb-line"><b>承诺</b>{row.promise}</p>}
                      {row.cost && <p className="fb-line"><b>代价</b>{row.cost}</p>}
                      <div className="fb-meta">
                        <span>埋于 {row.story_title || '—'}</span>
                        <span>{row.planned_story_title ? `计划回收 ${row.planned_story_title}` : '未定回收章'}</span>
                        {row.status === 'paid' && row.resolved_story_title && <span>实际回收 {row.resolved_story_title}</span>}
                        <span>{fmtTime(row.created_at)}</span>
                      </div>
                      <div className="fb-actions">
                        {row.status === 'pending' && (
                          <button type="button" onClick={() => void patch(row.id, { status: 'planted' })}><Check size={11} /> 已埋下</button>
                        )}
                        {row.status !== 'paid' && (
                          <button type="button" onClick={() => void resolve(row)}><Check size={11} /> 标记回收</button>
                        )}
                        {row.status !== 'abandoned' && row.status !== 'paid' && (
                          <button type="button" onClick={() => void patch(row.id, { status: 'abandoned' })}>放弃</button>
                        )}
                        {row.status === 'paid' && <span className="fb-done">已闭环</span>}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="fb-map">
              <div className="fb-map-note">路线图按“卷 → 章 → 伏笔”读取现有目录；事件因果与分支仍以 05/07 为准。</div>
              {mapVolumes.length === 0 ? (
                <div className="fb-empty"><strong>还没有章节</strong><span>先在左侧新建卷和章节，路线图会自动长出来。</span></div>
              ) : mapVolumes.map((group, index) => {
                const volume = group.volume
                const progress = volume?.target_words ? Math.min(100, Math.round((volume.word_count / volume.target_words) * 100)) : 0
                return (
                  <section key={volume?.id || 'unfiled'} className="fb-map-volume">
                    <header>
                      <span className={`fb-map-act is-${volume?.act || 'setup'}`}>{volume ? ({ setup: '起', develop: '承', turn: '转', climax: '合' } as const)[volume.act] : '未分卷'}</span>
                      <strong>{volume?.title || '未分卷章节'}</strong>
                      {volume && <span className="fb-map-progress">{volume.word_count}/{volume.target_words || '—'} 字 {progress ? `· ${progress}%` : ''}</span>}
                      <span className="fb-map-index">VOL {String(index + 1).padStart(2, '0')}</span>
                    </header>
                    {volume?.outline_goal && <p className="fb-map-goal">{volume.outline_goal}</p>}
                    <ol className="fb-map-chapters">
                      {group.chapters.map((chapter) => {
                        const marks = byChapter[chapter.id] || []
                        return (
                          <li key={chapter.id}>
                            <button type="button" className="fb-map-node" onClick={() => onSelectChapter?.(chapter.id)}>
                              <span className="fb-map-dot" />
                              <span className="fb-map-title">{chapter.title}</span>
                              <span className="fb-map-count">{chapter.word_count} 字</span>
                            </button>
                            {(() => {
                              const sourceEvents = (storyById[chapter.id]?.source_event_ids || [])
                                .map((id) => eventById[id])
                                .filter(Boolean)
                                .slice(0, 3)
                              return sourceEvents.length > 0 ? (
                                <div className="fb-map-events">
                                  {sourceEvents.map((name) => <span key={name}>{name}</span>)}
                                </div>
                              ) : null
                            })()}
                            {marks.length > 0 && (
                              <div className="fb-map-marks">
                                {marks.map((mark) => (
                                  <button
                                    key={mark.id}
                                    type="button"
                                    className={`fb-mark ${STATUS_META[mark.status].tone}`}
                                    title={mark.text}
                                    onClick={() => { setTab('board'); setStatusFilter('all') }}
                                  >
                                    {mark.text.slice(0, 16)}{mark.text.length > 16 ? '…' : ''}
                                  </button>
                                ))}
                              </div>
                            )}
                          </li>
                        )
                      })}
                    </ol>
                  </section>
                )
              })}
            </div>
          )}
        </div>

        <footer className="fb-foot">
          <span>{rows.length} 条伏笔 · 只影响写作层</span>
          <button type="button" className="fb-primary" onClick={onClose}>关闭</button>
        </footer>
      </div>
    </div>
  )
}
