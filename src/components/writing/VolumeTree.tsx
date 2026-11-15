import { useMemo, useState } from 'react'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronDown, ChevronRight, GripVertical, Plus, Trash2 } from 'lucide-react'
import * as volumeApi from '../../api/writingVolumes'
import type { StoryAct, WritingChapter, WritingVolume } from '../../api/writingVolumes'

type Props = {
  worldId: string
  volumes: WritingVolume[]
  chapters: WritingChapter[]
  currentId?: string
  busy?: boolean
  onSelectChapter: (id: string) => void
  onCreateChapter: (volumeId?: string) => void
  onRefresh: () => void
  onToast: (message: string) => void
}

const ACT_LABELS: Record<StoryAct, string> = {
  setup: '起',
  develop: '承',
  turn: '转',
  climax: '合',
}

const ACT_TONES: Record<StoryAct, string> = {
  setup: 'is-setup',
  develop: 'is-develop',
  turn: 'is-turn',
  climax: 'is-climax',
}

function chapterIds(chapters: WritingChapter[]) {
  return chapters.map((chapter) => `chap:${chapter.id}`)
}

function SortableChapter({
  chapter,
  volumes,
  currentId,
  onSelect,
  onMove,
  onToast,
}: {
  chapter: WritingChapter
  volumes: WritingVolume[]
  currentId?: string
  onSelect: () => void
  onMove: (volumeId: string | null) => void
  onToast: (message: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `chap:${chapter.id}`,
    data: { type: 'chapter', volumeId: chapter.volume_id },
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
  }
  const active = currentId === chapter.id

  return (
    <div ref={setNodeRef} style={style} className={`vt-chapter${active ? ' is-active' : ''}`}>
      <button
        type="button"
        className="vt-grip"
        {...attributes}
        {...listeners}
        title="拖动排序"
        aria-label="拖动章节"
      >
        <GripVertical size={11} />
      </button>
      <button type="button" className="vt-chapter-main" onClick={onSelect}>
        <span className="vt-chapter-title">{chapter.title || '未命名章节'}</span>
        <span className="vt-chapter-meta">
          {chapter.word_count || 0} 字
          {chapter.status === 'published' ? ' · 已定稿' : ''}
        </span>
      </button>
      <select
        className="vt-move"
        value={chapter.volume_id || ''}
        onChange={(event) => {
          const value = event.target.value
          if (value === '__new__') {
            onToast('先创建卷，再把章节移入')
            return
          }
          onMove(value || null)
        }}
        title="移动到卷"
      >
        <option value="">未分卷</option>
        {volumes.map((volume) => (
          <option key={volume.id} value={volume.id}>{volume.title}</option>
        ))}
      </select>
    </div>
  )
}

function VolumeBlock({
  volume,
  chapters,
  volumes,
  currentId,
  collapsed,
  onToggle,
  onSelect,
  onMoveChapter,
  onCreateChapter,
  onRename,
  onDelete,
  onToast,
}: {
  volume: WritingVolume
  chapters: WritingChapter[]
  volumes: WritingVolume[]
  currentId?: string
  collapsed: boolean
  onToggle: () => void
  onSelect: (id: string) => void
  onMoveChapter: (chapterId: string, volumeId: string | null) => void
  onCreateChapter: (volumeId: string) => void
  onRename: (volume: WritingVolume) => void
  onDelete: (volume: WritingVolume) => void
  onToast: (message: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `vol:${volume.id}`,
    data: { type: 'volume' },
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
  }
  const ids = chapterIds(chapters)

  return (
    <section ref={setNodeRef} style={style} className="vt-volume">
      <header className={`vt-volume-head ${ACT_TONES[volume.act] || ''}`}>
        <button type="button" className="vt-grip" {...attributes} {...listeners} title="拖动卷排序" aria-label="拖动卷">
          <GripVertical size={12} />
        </button>
        <button type="button" className="vt-volume-toggle" onClick={onToggle}>
          {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
          <span className="vt-act">{ACT_LABELS[volume.act] || '起'}</span>
          <strong>{volume.title}</strong>
        </button>
        <span className="vt-volume-count">{volume.chapter_count}章 · {volume.word_count}字</span>
        <button type="button" className="vt-mini" onClick={() => onRename(volume)} title="编辑卷">…</button>
        <button type="button" className="vt-mini is-danger" onClick={() => onDelete(volume)} title="删除卷">
          <Trash2 size={10} />
        </button>
      </header>
      {collapsed ? null : (
        <div className="vt-volume-body">
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            {chapters.map((chapter) => (
              <SortableChapter
                key={chapter.id}
                chapter={chapter}
                volumes={volumes}
                currentId={currentId}
                onSelect={() => onSelect(chapter.id)}
                onMove={(volumeId) => onMoveChapter(chapter.id, volumeId)}
                onToast={onToast}
              />
            ))}
          </SortableContext>
          <button type="button" className="vt-add-chapter" onClick={() => onCreateChapter(volume.id)}>
            <Plus size={10} /> 在卷内新建章节
          </button>
        </div>
      )}
    </section>
  )
}

export default function VolumeTree({
  worldId,
  volumes,
  chapters,
  currentId,
  busy,
  onSelectChapter,
  onCreateChapter,
  onRefresh,
  onToast,
}: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [newTitle, setNewTitle] = useState('')
  const [adding, setAdding] = useState(false)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const grouped = useMemo(() => {
    const map: Record<string, WritingChapter[]> = {}
    for (const chapter of chapters) {
      const key = chapter.volume_id || ''
      map[key] = map[key] || []
      map[key].push(chapter)
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    }
    return map
  }, [chapters])

  const unfiled = grouped[''] || []

  const handleDragEnd = async (event: DragEndEvent) => {
    const activeId = String(event.active.id)
    const overId = event.over ? String(event.over.id) : ''
    if (!overId || activeId === overId) return

    if (activeId.startsWith('vol:') && overId.startsWith('vol:')) {
      const ids = volumes.map((volume) => volume.id)
      const from = ids.indexOf(activeId.slice(4))
      const to = ids.indexOf(overId.slice(4))
      if (from < 0 || to < 0) return
      const next = arrayMove(ids, from, to)
      try {
        await volumeApi.reorderWritingVolumes(next)
        onRefresh()
      } catch (error: any) {
        onToast(String(error?.message || error))
      }
      return
    }

    if (activeId.startsWith('chap:')) {
      const activeChapterId = activeId.slice(5)
      const active = chapters.find((chapter) => chapter.id === activeChapterId)
      if (!active) return
      const overChapterId = overId.startsWith('chap:') ? overId.slice(5) : ''
      const over = chapters.find((chapter) => chapter.id === overChapterId)
      const targetVolumeId = overId.startsWith('vol:')
        ? overId.slice(4)
        : over
          ? over.volume_id
          : active.volume_id
      if (targetVolumeId !== active.volume_id) {
        try {
          const targetList = [...(grouped[targetVolumeId || ''] || [])]
          const index = over ? targetList.findIndex((chapter) => chapter.id === over.id) : targetList.length
          await volumeApi.moveWritingChapter(active.id, targetVolumeId, Math.max(0, index))
          await volumeApi.reorderWritingChapters(targetVolumeId, [
            ...targetList.slice(0, Math.max(0, index)).map((chapter) => chapter.id),
            active.id,
            ...targetList.slice(Math.max(0, index)).map((chapter) => chapter.id),
          ])
          onRefresh()
        } catch (error: any) {
          onToast(String(error?.message || error))
        }
        return
      }
      const list = grouped[active.volume_id || ''] || []
      const ids = list.map((chapter) => chapter.id)
      const from = ids.indexOf(active.id)
      const to = over ? ids.indexOf(over.id) : ids.length - 1
      if (from < 0 || to < 0) return
      const next = arrayMove(ids, from, to)
      try {
        await volumeApi.reorderWritingChapters(active.volume_id, next)
        onRefresh()
      } catch (error: any) {
        onToast(String(error?.message || error))
      }
    }
  }

  const moveChapter = async (chapterId: string, volumeId: string | null) => {
    try {
      const targetList = grouped[volumeId || ''] || []
      await volumeApi.moveWritingChapter(chapterId, volumeId, targetList.length)
      onRefresh()
    } catch (error: any) {
      onToast(String(error?.message || error))
    }
  }

  const createVolume = async () => {
    const title = newTitle.trim()
    if (!title) return
    try {
      await volumeApi.createWritingVolume(worldId, { title, act: 'setup' })
      setNewTitle('')
      setAdding(false)
      onRefresh()
      onToast('已创建卷')
    } catch (error: any) {
      onToast(String(error?.message || error))
    }
  }

  const renameVolume = async (volume: WritingVolume) => {
    const title = window.prompt('卷名', volume.title)
    if (title === null) return
    const outline = window.prompt('本卷大纲核心目标（可留空）', volume.outline_goal || '')
    try {
      await volumeApi.updateWritingVolume(volume.id, { title: title.trim() || volume.title, outline_goal: outline || '' })
      onRefresh()
    } catch (error: any) {
      onToast(String(error?.message || error))
    }
  }

  const deleteVolume = async (volume: WritingVolume) => {
    if (!window.confirm(`删除卷《${volume.title}》？卷内章节会回到“未分卷”，不会删除章节。`)) return
    try {
      await volumeApi.deleteWritingVolume(volume.id)
      onRefresh()
      onToast('卷已删除，章节已回到未分卷')
    } catch (error: any) {
      onToast(String(error?.message || error))
    }
  }

  return (
    <div className={`vt-root${busy ? ' is-busy' : ''}`}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => void handleDragEnd(event)}>
        <SortableContext items={volumes.map((volume) => `vol:${volume.id}`)} strategy={verticalListSortingStrategy}>
          {volumes.map((volume) => (
            <VolumeBlock
              key={volume.id}
              volume={volume}
              chapters={grouped[volume.id] || []}
              volumes={volumes}
              currentId={currentId}
              collapsed={Boolean(collapsed[volume.id])}
              onToggle={() => setCollapsed((prev) => ({ ...prev, [volume.id]: !prev[volume.id] }))}
              onSelect={onSelectChapter}
              onMoveChapter={(chapterId, volumeId) => void moveChapter(chapterId, volumeId)}
              onCreateChapter={onCreateChapter}
              onRename={(item) => void renameVolume(item)}
              onDelete={(item) => void deleteVolume(item)}
              onToast={onToast}
            />
          ))}
          <SortableContext items={chapterIds(unfiled)} strategy={verticalListSortingStrategy}>
            {unfiled.length > 0 && (
              <section className="vt-volume is-unfiled">
                <header className="vt-volume-head is-unfiled">
                  <span className="vt-unfiled-label">未分卷</span>
                  <span className="vt-volume-count">{unfiled.length}章</span>
                </header>
                <div className="vt-volume-body">
                  {unfiled.map((chapter) => (
                    <SortableChapter
                      key={chapter.id}
                      chapter={chapter}
                      volumes={volumes}
                      currentId={currentId}
                      onSelect={() => onSelectChapter(chapter.id)}
                      onMove={(volumeId) => void moveChapter(chapter.id, volumeId)}
                      onToast={onToast}
                    />
                  ))}
                </div>
              </section>
            )}
          </SortableContext>
        </SortableContext>
      </DndContext>

      {adding ? (
        <div className="vt-add-volume-form">
          <input
            autoFocus
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void createVolume()
              if (event.key === 'Escape') setAdding(false)
            }}
            placeholder="卷名，回车创建"
          />
          <button type="button" onClick={() => void createVolume()}>创建</button>
          <button type="button" onClick={() => setAdding(false)}>取消</button>
        </div>
      ) : (
        <button type="button" className="vt-add-volume" onClick={() => setAdding(true)}>
          <Plus size={11} /> 新建卷
        </button>
      )}
    </div>
  )
}
