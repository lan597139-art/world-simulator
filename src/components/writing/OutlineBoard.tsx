import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Download, FileText, Plus, X } from 'lucide-react'
import * as writingApi from '../../api/writing'
import type { StoryItem } from '../../api/writing'
import * as volumeApi from '../../api/writingVolumes'
import type { StoryAct, WritingChapter, WritingVolume } from '../../api/writingVolumes'

type Props = {
  worldId: string
  stories: StoryItem[]
  volumes: WritingVolume[]
  chapters: WritingChapter[]
  currentStoryId?: string
  onClose: () => void
  onRefresh: () => void
  onCreateChapter: (volumeId?: string) => void
  onSelectChapter: (id: string) => void
  onChapterUpdated?: (id: string, body: Partial<Pick<StoryItem, 'title' | 'summary' | 'outline_goal' | 'target_words' | 'volume_id'>>) => void
  onToast: (message: string) => void
}

const ACTS: Array<{ value: StoryAct; label: string; hint: string }> = [
  { value: 'setup', label: '起', hint: '建立目标与缺口' },
  { value: 'develop', label: '承', hint: '加压与推进' },
  { value: 'turn', label: '转', hint: '代价与反转' },
  { value: 'climax', label: '合', hint: '回收与结算' },
]

function fmtWords(value: number) {
  return value > 0 ? value.toLocaleString() : '—'
}

export default function OutlineBoard({
  worldId,
  stories,
  volumes,
  chapters,
  currentStoryId,
  onClose,
  onRefresh,
  onCreateChapter,
  onSelectChapter,
  onChapterUpdated,
  onToast,
}: Props) {
  const [volumeRows, setVolumeRows] = useState<WritingVolume[]>(volumes)
  const [chapterRows, setChapterRows] = useState<WritingChapter[]>(chapters)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [newVolume, setNewVolume] = useState('')
  const [savingId, setSavingId] = useState('')

  useEffect(() => { setVolumeRows(volumes) }, [volumes])
  useEffect(() => { setChapterRows(chapters) }, [chapters])

  const grouped = useMemo(() => {
    const map: Record<string, WritingChapter[]> = {}
    for (const chapter of chapterRows) {
      const key = chapter.volume_id || ''
      map[key] = map[key] || []
      map[key].push(chapter)
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    }
    return map
  }, [chapterRows])

  const totalWords = stories.reduce((sum, story) => sum + (story.word_count || 0), 0)
  const totalTarget = volumeRows.reduce((sum, volume) => sum + (volume.target_words || 0), 0)
  const unfiled = grouped[''] || []

  const updateVolumeLocal = (id: string, patch: Partial<WritingVolume>) => {
    setVolumeRows((prev) => prev.map((volume) => (volume.id === id ? { ...volume, ...patch } : volume)))
  }

  const updateChapterLocal = (id: string, patch: Partial<WritingChapter>) => {
    setChapterRows((prev) => prev.map((chapter) => (chapter.id === id ? { ...chapter, ...patch } : chapter)))
  }

  const saveVolume = async (volume: WritingVolume) => {
    setSavingId(volume.id)
    try {
      await volumeApi.updateWritingVolume(volume.id, {
        title: volume.title,
        act: volume.act,
        target_words: volume.target_words,
        outline_goal: volume.outline_goal,
        summary: volume.summary,
      })
      onRefresh()
    } catch (error: any) {
      onToast(String(error?.message || error))
    } finally {
      setSavingId('')
    }
  }

  const saveChapter = async (chapter: WritingChapter) => {
    setSavingId(chapter.id)
    try {
      const updated = await writingApi.updateStory(chapter.id, {
        title: chapter.title,
        summary: chapter.summary,
        outline_goal: chapter.outline_goal,
        target_words: chapter.target_words,
        volume_id: chapter.volume_id || undefined,
      })
      onChapterUpdated?.(updated.id, {
        title: updated.title,
        summary: updated.summary,
        outline_goal: updated.outline_goal,
        target_words: updated.target_words,
        volume_id: updated.volume_id,
      })
      onRefresh()
    } catch (error: any) {
      onToast(String(error?.message || error))
    } finally {
      setSavingId('')
    }
  }

  const addVolume = async () => {
    const title = newVolume.trim()
    if (!title) return
    try {
      await volumeApi.createWritingVolume(worldId, { title, act: 'setup' })
      setNewVolume('')
      onRefresh()
      onToast('卷已创建')
    } catch (error: any) {
      onToast(String(error?.message || error))
    }
  }

  const moveChapter = async (chapter: WritingChapter, volumeId: string | null) => {
    updateChapterLocal(chapter.id, { volume_id: volumeId })
    try {
      await volumeApi.moveWritingChapter(chapter.id, volumeId, 999)
      onRefresh()
    } catch (error: any) {
      onToast(String(error?.message || error))
    }
  }

  const exportOutline = () => {
    const lines: string[] = ['# 目录大纲', '', `全稿 ${totalWords.toLocaleString()} 字 · ${stories.length} 章`, '']
    for (const volume of volumeRows) {
      lines.push(`## ${volume.title}（${ACTS.find((item) => item.value === volume.act)?.label || '起'}）`)
      if (volume.outline_goal) lines.push('', `> ${volume.outline_goal}`)
      lines.push('', `目标 ${fmtWords(volume.target_words)} 字 / 已写 ${fmtWords(volume.word_count)} 字`, '')
      for (const chapter of grouped[volume.id] || []) {
        lines.push(`### ${chapter.title}`)
        lines.push(`- 字数：${chapter.word_count || 0}${chapter.target_words ? ` / 目标 ${chapter.target_words}` : ''}`)
        if (chapter.outline_goal) lines.push(`- 本章目标：${chapter.outline_goal}`)
        if (chapter.summary) lines.push(`- 摘要：${chapter.summary}`)
        lines.push('')
      }
    }
    if (unfiled.length > 0) {
      lines.push('## 未分卷', '')
      for (const chapter of unfiled) {
        lines.push(`### ${chapter.title}`)
        if (chapter.outline_goal) lines.push(`- 本章目标：${chapter.outline_goal}`)
        if (chapter.summary) lines.push(`- 摘要：${chapter.summary}`)
        lines.push('')
      }
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = '目录大纲.md'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const renderChapter = (chapter: WritingChapter) => (
    <div key={chapter.id} className={`ol-chapter${currentStoryId === chapter.id ? ' is-current' : ''}`}>
      <div className="ol-chapter-line">
        <span className="ol-chapter-dot" />
        <input
          className="ol-chapter-title"
          value={chapter.title}
          onChange={(event) => updateChapterLocal(chapter.id, { title: event.target.value })}
          onBlur={() => void saveChapter(chapter)}
          aria-label="章节标题"
        />
        <span className="ol-words">{chapter.word_count || 0} 字</span>
        <label className="ol-target">
          目标
          <input
            type="number"
            min={0}
            value={chapter.target_words || 0}
            onChange={(event) => updateChapterLocal(chapter.id, { target_words: Number(event.target.value) || 0 })}
            onBlur={() => void saveChapter(chapter)}
          />
        </label>
        <select
          className="ol-volume-select"
          value={chapter.volume_id || ''}
          onChange={(event) => void moveChapter(chapter, event.target.value || null)}
          aria-label="移动到卷"
        >
          <option value="">未分卷</option>
          {volumeRows.map((volume) => <option key={volume.id} value={volume.id}>{volume.title}</option>)}
        </select>
        <button type="button" className="ol-open" onClick={() => onSelectChapter(chapter.id)}>打开</button>
      </div>
      <div className="ol-chapter-fields">
        <label>
          <span>本章目标 / 冲突</span>
          <textarea
            rows={2}
            value={chapter.outline_goal}
            onChange={(event) => updateChapterLocal(chapter.id, { outline_goal: event.target.value })}
            onBlur={() => void saveChapter(chapter)}
            placeholder="这一章必须推进什么？主角要付出什么代价？"
          />
        </label>
        <label>
          <span>摘要 / 结果</span>
          <textarea
            rows={2}
            value={chapter.summary}
            onChange={(event) => updateChapterLocal(chapter.id, { summary: event.target.value })}
            onBlur={() => void saveChapter(chapter)}
            placeholder="写完后回填：本章实际发生了什么，留下什么钩子。"
          />
        </label>
      </div>
    </div>
  )

  return (
    <div className="ol-overlay" role="dialog" aria-modal="true" aria-label="目录大纲">
      <div className="ol-modal">
        <header className="ol-head">
          <div>
            <div className="ol-kicker">MANUSCRIPT OUTLINE / VOLUME &amp; CHAPTER</div>
            <h2>目录大纲</h2>
            <p>卷目标、章节目标、摘要与字数目标都落在同一份目录里；正文只负责把它们写出来。</p>
          </div>
          <button type="button" className="ol-close" onClick={onClose} aria-label="关闭"><X size={15} /></button>
        </header>

        <div className="ol-toolbar">
          <div className="ol-metrics">
            <span><b>{volumeRows.length}</b> 卷</span>
            <span><b>{chapterRows.length}</b> 章</span>
            <span><b>{totalWords.toLocaleString()}</b> 字</span>
            <span><b>{totalTarget ? `${Math.min(100, Math.round((totalWords / totalTarget) * 100))}%` : '—'}</b> 总进度</span>
          </div>
          <button type="button" className="ol-export" onClick={exportOutline}><Download size={12} /> 导出 Markdown</button>
        </div>

        <div className="ol-body">
          {volumeRows.length === 0 && unfiled.length === 0 ? (
            <div className="ol-empty">
              <FileText size={16} />
              <strong>还没有目录</strong>
              <span>先建一卷，再在卷内建章；也可以直接在下方新建未分卷章节。</span>
            </div>
          ) : null}

          {volumeRows.map((volume) => {
            const list = grouped[volume.id] || []
            const isCollapsed = Boolean(collapsed[volume.id])
            const progress = volume.target_words > 0 ? Math.min(100, Math.round((volume.word_count / volume.target_words) * 100)) : 0
            return (
              <section key={volume.id} className="ol-volume">
                <header className="ol-volume-head">
                  <button type="button" className="ol-collapse" onClick={() => setCollapsed((prev) => ({ ...prev, [volume.id]: !prev[volume.id] }))}>
                    {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                  </button>
                  <select
                    className="ol-act"
                    value={volume.act}
                    onChange={(event) => {
                      const act = event.target.value as StoryAct
                      updateVolumeLocal(volume.id, { act })
                      void saveVolume({ ...volume, act })
                    }}
                    aria-label="卷结构位置"
                  >
                    {ACTS.map((item) => <option key={item.value} value={item.value}>{item.label} · {item.hint}</option>)}
                  </select>
                  <input
                    className="ol-volume-title"
                    value={volume.title}
                    onChange={(event) => updateVolumeLocal(volume.id, { title: event.target.value })}
                    onBlur={() => void saveVolume(volume)}
                    aria-label="卷名"
                  />
                  <span className="ol-volume-progress">{progress ? `${progress}%` : '—'}</span>
                  <label className="ol-target">
                    卷目标
                    <input
                      type="number"
                      min={0}
                      value={volume.target_words || 0}
                      onChange={(event) => updateVolumeLocal(volume.id, { target_words: Number(event.target.value) || 0 })}
                      onBlur={() => void saveVolume(volume)}
                    />
                  </label>
                  <button type="button" className="ol-add-inline" onClick={() => onCreateChapter(volume.id)}><Plus size={11} /> 章</button>
                  {savingId === volume.id && <span className="ol-saving">保存中</span>}
                </header>

                {!isCollapsed && (
                  <div className="ol-volume-body">
                    <div className="ol-volume-fields">
                      <label>
                        <span>本卷大纲核心目标</span>
                        <textarea
                          rows={2}
                          value={volume.outline_goal}
                          onChange={(event) => updateVolumeLocal(volume.id, { outline_goal: event.target.value })}
                          onBlur={() => void saveVolume(volume)}
                          placeholder="这一卷结束时，世界/人物必须发生什么不可逆变化？"
                        />
                      </label>
                      <label>
                        <span>本卷摘要</span>
                        <textarea
                          rows={2}
                          value={volume.summary}
                          onChange={(event) => updateVolumeLocal(volume.id, { summary: event.target.value })}
                          onBlur={() => void saveVolume(volume)}
                          placeholder="写给未来的自己：这一卷实际完成了什么。"
                        />
                      </label>
                    </div>
                    <div className="ol-chapters">
                      {list.length === 0 ? (
                        <div className="ol-chapter-empty">本卷还没有章节。<button type="button" onClick={() => onCreateChapter(volume.id)}>新建第一章</button></div>
                      ) : list.map(renderChapter)}
                    </div>
                  </div>
                )}
              </section>
            )
          })}

          {unfiled.length > 0 && (
            <section className="ol-volume is-unfiled">
              <header className="ol-volume-head">
                <span className="ol-unfiled-title">未分卷章节</span>
                <span className="ol-words">{unfiled.length} 章</span>
              </header>
              <div className="ol-volume-body">
                <div className="ol-chapters">{unfiled.map(renderChapter)}</div>
              </div>
            </section>
          )}
        </div>

        <footer className="ol-foot">
          <div className="ol-add-volume">
            <input
              value={newVolume}
              onChange={(event) => setNewVolume(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') void addVolume() }}
              placeholder="新卷名，回车创建"
            />
            <button type="button" onClick={() => void addVolume()} disabled={!newVolume.trim()}><Plus size={11} /> 新建卷</button>
          </div>
          <div className="ol-foot-actions">
            <span>失焦自动保存</span>
            <button type="button" className="is-primary" onClick={onClose}>完成</button>
          </div>
        </footer>
      </div>
    </div>
  )
}
