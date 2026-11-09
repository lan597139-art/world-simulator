import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import type { Editor } from '@tiptap/core'
import * as writingApi from '../api/writing'
import type { DraftItem, StoryItem } from '../api/writing'

type Mode = 'architect' | 'explorer'
type SidebarTab = 'reference' | 'extract'
type SaveState = 'saved' | 'dirty' | 'saving' | 'error'

const API_BASE = 'http://127.0.0.1:8000/api'

const card: CSSProperties = {
  background: 'var(--card-bg)',
  border: '1px solid var(--card-border)',
  borderRadius: '14px',
  boxShadow: 'var(--card-shadow)',
  backdropFilter: 'blur(18px)',
}

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: '8px',
  border: '1px solid var(--card-border)',
  background: 'transparent',
  color: 'var(--text-main)',
  fontSize: '13px',
  outline: 'none',
}

const tinyBtn: CSSProperties = {
  padding: '5px 9px',
  borderRadius: '7px',
  border: '1px solid var(--card-border)',
  background: 'transparent',
  color: 'var(--text-main)',
  fontSize: '11px',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function textToHtml(text: string): string {
  const blocks = (text || '').replace(/\r\n/g, '\n').split(/\n{2,}/)
  return blocks
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('') || '<p></p>'
}

function contentToHtml(content: string): string {
  if (!content) return '<p></p>'
  if (/<(p|div|h[1-6]|ul|ol|li|blockquote|strong|em)[\s>]/i.test(content)) return content
  return textToHtml(content)
}

function stripHtml(value: string): string {
  const div = document.createElement('div')
  div.innerHTML = value || ''
  return (div.textContent || '').replace(/\u00a0/g, ' ').trim()
}

function fmtTime(value?: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function Btn({
  children,
  onClick,
  kind = 'ghost',
  disabled,
  title,
  style,
}: {
  children: ReactNode
  onClick?: () => void
  kind?: 'primary' | 'ghost' | 'danger'
  disabled?: boolean
  title?: string
  style?: CSSProperties
}) {
  const palette: CSSProperties =
    kind === 'primary'
      ? { background: 'var(--primary-color)', color: 'var(--primary-text)', border: '1px solid var(--primary-color)' }
      : kind === 'danger'
        ? { background: 'transparent', color: 'var(--danger-color)', border: '1px solid var(--danger-color)' }
        : { background: 'transparent', color: 'var(--text-main)', border: '1px solid var(--card-border)' }
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      style={{
        ...palette,
        padding: '7px 12px',
        borderRadius: '8px',
        fontSize: '12px',
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </button>
  )
}

function ModeBadge({ mode }: { mode: Mode }) {
  return (
    <span
      style={{
        fontSize: '10px',
        padding: '2px 7px',
        borderRadius: '999px',
        border: `1px solid ${mode === 'architect' ? 'var(--primary-color)' : 'var(--card-border)'}`,
        color: mode === 'architect' ? 'var(--primary-color)' : 'var(--text-muted)',
        whiteSpace: 'nowrap',
      }}
    >
      {mode === 'architect' ? '架构师' : '探险家'}
    </span>
  )
}

const DRAFT_LABELS: Record<DraftItem['entity_type'], string> = {
  character: '人物',
  location: '地点',
  event: '事件',
  organization: '组织',
  relationship: '关系',
}

const EDITOR_CSS = `
.ws-editor .ProseMirror {
  min-height: 420px;
  outline: none;
  font-family: "Songti SC", "Noto Serif SC", Georgia, serif;
  font-size: 17px;
  line-height: 1.95;
  color: var(--text-main);
  caret-color: var(--primary-color);
}
.ws-editor .ProseMirror p { margin: 0 0 1.05em; }
.ws-editor .ProseMirror h1, .ws-editor .ProseMirror h2, .ws-editor .ProseMirror h3 {
  font-family: "Songti SC", Georgia, serif;
  letter-spacing: 0.04em;
  margin: 1.4em 0 0.7em;
  line-height: 1.4;
}
.ws-editor .ProseMirror h2 { font-size: 22px; }
.ws-editor .ProseMirror h3 { font-size: 18px; }
.ws-editor .ProseMirror blockquote {
  margin: 1.2em 0;
  padding: 0.2em 0 0.2em 1em;
  border-left: 3px solid var(--primary-color);
  color: var(--text-muted);
  font-style: italic;
}
.ws-editor .ProseMirror ul, .ws-editor .ProseMirror ol { padding-left: 1.5em; margin: 0 0 1em; }
.ws-editor .ProseMirror code {
  background: rgba(128,128,128,0.14);
  border-radius: 4px;
  padding: 0.1em 0.35em;
  font-size: 0.9em;
}
.ws-editor .ProseMirror p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  float: left;
  color: var(--text-muted);
  opacity: 0.6;
  pointer-events: none;
  height: 0;
}
.ws-editor .ProseMirror ::selection { background: rgba(128,128,128,0.25); }
`

export default function WritingPage({
  worldId,
  seedEventIds,
}: {
  worldId?: string
  seedEventIds?: string[]
}) {
  const [stories, setStories] = useState<StoryItem[]>([])
  const [current, setCurrent] = useState<StoryItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [words, setWords] = useState(0)
  const [events, setEvents] = useState<any[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([])
  const [direction, setDirection] = useState<string>(() => localStorage.getItem('ws.write.direction') || '')
  const [perspective, setPerspective] = useState<string>(() => localStorage.getItem('ws.write.perspective') || '第三人称限知 · 跟随主角')
  const [generating, setGenerating] = useState(false)
  const [generatingText, setGeneratingText] = useState('')
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('reference')
  const [drafts, setDrafts] = useState<DraftItem[]>([])
  const [analyzing, setAnalyzing] = useState(false)
  const [approvingId, setApprovingId] = useState('')
  const [bulkApproving, setBulkApproving] = useState(false)
  const [runsByEvent, setRunsByEvent] = useState<Record<string, any[]>>({})
  useEffect(() => { localStorage.setItem('ws.write.direction', direction) }, [direction])
  useEffect(() => { localStorage.setItem('ws.write.perspective', perspective) }, [perspective])
  const [assist, setAssist] = useState<{ label: string; preview: string } | null>(null)
  const [toast, setToast] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [modeBusy, setModeBusy] = useState(false)

  const currentRef = useRef<StoryItem | null>(null)
  const editorRef = useRef<Editor | null>(null)
  const latestHtml = useRef('')
  const latestText = useRef('')
  const dirtyRef = useRef(false)
  const suppressRef = useRef(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const selectionRange = useRef<{ from: number; to: number } | null>(null)

  useEffect(() => {
    currentRef.current = current
  }, [current])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 3200)
    return () => clearTimeout(timer)
  }, [toast])

  const saveCurrent = useCallback(async () => {
    const story = currentRef.current
    if (!story) return
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    setSaveState('saving')
    try {
      const updated = await writingApi.updateStory(story.id, {
        title: story.title,
        content: latestHtml.current || story.content,
        plain_text: latestText.current,
      })
      setCurrent((prev) => (prev && prev.id === updated.id ? { ...prev, ...updated } : prev))
      setStories((prev) => prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)))
      dirtyRef.current = false
      setSaveState('saved')
      setWords(updated.word_count || 0)
    } catch (error: any) {
      setSaveState('error')
      setToast(String(error.message || error))
    }
  }, [])

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      void saveCurrent()
    }, 800)
  }, [saveCurrent])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Placeholder.configure({
        placeholder: '从这里开始写。可以是一句对白、一个场景，或一段还没想好去哪里的开头……',
      }),
    ],
    content: '<p></p>',
    editorProps: {
      attributes: { class: 'ws-prose' },
    },
    onUpdate: ({ editor: instance }) => {
      if (suppressRef.current) return
      latestHtml.current = instance.getHTML()
      latestText.current = instance.getText({ blockSeparator: '\n' })
      setWords((latestText.current.match(/[\u4e00-\u9fff]|[A-Za-z0-9]+/g) || []).length)
      dirtyRef.current = true
      setSaveState('dirty')
      scheduleSave()
    },
  })

  useEffect(() => {
    editorRef.current = editor || null
  }, [editor])

  const loadDrafts = useCallback(async (storyId: string) => {
    try {
      setDrafts(await writingApi.listStoryDrafts(storyId, 'all'))
    } catch (error) {
      console.warn('草稿加载失败', error)
    }
  }, [])

  const loadStories = useCallback(async () => {
    setLoading(true)
    try {
      const [rows, eventRows] = await Promise.all([
        writingApi.listStories(worldId),
        fetch(`${API_BASE}/events${worldId ? `?world_id=${worldId}` : ''}`).then((res) => res.json()),
      ])
      setStories(Array.isArray(rows) ? rows : [])
      setEvents(Array.isArray(eventRows) ? eventRows : [])
      const first = Array.isArray(rows) && rows.length > 0 ? rows[0] : null
      setCurrent(first)
      setSidebarTab(first?.mode === 'architect' ? 'reference' : 'extract')
      if (first) {
        setWords(first.word_count || 0)
        void loadDrafts(first.id)
      } else {
        setDrafts([])
      }
    } catch (error: any) {
      setToast(String(error.message || error))
    } finally {
      setLoading(false)
    }
  }, [worldId, loadDrafts])

  useEffect(() => {
    setCurrent(null)
    setDrafts([])
    void loadStories()
  }, [loadStories])

  useEffect(() => {
    if (!seedEventIds || seedEventIds.length === 0) return
    setSelectedEventIds(seedEventIds)
    setModalOpen(true)
  }, [seedEventIds?.join(',')])

  useEffect(() => {
    if (!editor || !current) return
    suppressRef.current = true
    const html = contentToHtml(current.content)
    editor.commands.setContent(html, { emitUpdate: false })
    suppressRef.current = false
    latestHtml.current = editor.getHTML()
    latestText.current = editor.getText({ blockSeparator: '\n' })
    setWords(current.word_count || (latestText.current.match(/[\u4e00-\u9fff]|[A-Za-z0-9]+/g) || []).length)
    dirtyRef.current = false
    setSaveState('saved')
  }, [editor, current?.id])

  useEffect(() => {
    if (!current) {
      setRunsByEvent({})
      return
    }
    const ids = current.source_event_ids || []
    if (ids.length === 0) {
      setRunsByEvent({})
      return
    }
    let cancelled = false
    Promise.all(
      ids.map((id) =>
        fetch(`${API_BASE}/simulations/${id}`)
          .then((res) => (res.ok ? res.json() : []))
          .catch(() => [])
      )
    ).then((groups) => {
      if (cancelled) return
      const map: Record<string, any[]> = {}
      ids.forEach((id, index) => {
        map[id] = Array.isArray(groups[index]) ? groups[index] : []
      })
      setRunsByEvent(map)
    })
    return () => {
      cancelled = true
    }
  }, [current?.id, current?.source_event_ids?.join(',')])

  useEffect(() => {
    if (!current) return
    void loadDrafts(current.id)
  }, [current?.id, loadDrafts])

  const selectStory = async (story: StoryItem) => {
    if (currentRef.current?.id === story.id) return
    if (currentRef.current && dirtyRef.current) await saveCurrent()
    setCurrent(story)
    setSidebarTab(story.mode === 'architect' ? 'reference' : 'extract')
    setWords(story.word_count || 0)
  }

  const createBlank = async () => {
    if (!worldId) {
      setToast('请先进入一个世界')
      return
    }
    try {
      if (currentRef.current && dirtyRef.current) await saveCurrent()
      const story = await writingApi.createStory({
        world_id: worldId,
        title: `第 ${stories.length + 1} 章`,
        mode: 'explorer',
        content: '<p></p>',
        plain_text: '',
      })
      setStories((prev) => [story, ...prev])
      setCurrent(story)
      setSidebarTab('extract')
      setToast('空白章节已创建，直接开始写')
    } catch (error: any) {
      setToast(String(error.message || error))
    }
  }

  const generateStory = async () => {
    if (!worldId) {
      setToast('请先进入一个世界')
      return
    }
    setModalOpen(false)
    setGenerating(true)
    setGeneratingText('')
    const effectiveEventIds = selectedEventIds.length > 0 ? selectedEventIds : events.slice(0, 5).map((event) => event.id)
    try {
      if (currentRef.current && dirtyRef.current) await saveCurrent()
      const full = await writingApi.streamGenerate(
        {
          world_id: worldId,
          event_ids: effectiveEventIds,
          user_direction: direction,
          perspective,
        },
        (chunk) => setGeneratingText((prev) => prev + chunk)
      )
      if (!full.trim() || full.trim().length < 80 || full.includes('[生成中断')) {
        throw new Error(full.replace('[生成中断', '').trim() || 'AI 没有返回正文，请检查模型额度后重试')
      }
      const chosen = events.filter((event) => effectiveEventIds.includes(event.id))
      const title = chosen[0]?.name ? `推演 · ${chosen[0].name}` : `推演章节 ${stories.length + 1}`
      const story = await writingApi.createStory({
        world_id: worldId,
        title,
        content: textToHtml(full),
        plain_text: full,
        mode: 'architect',
        source_event_ids: effectiveEventIds,
      })
      setStories((prev) => [story, ...prev])
      setCurrent(story)
      setSidebarTab('reference')
      setWords(story.word_count || 0)
      setToast('推演正文已生成，已自动存入手稿库')
    } catch (error: any) {
      setToast(String(error.message || error))
    } finally {
      setGenerating(false)
      setGeneratingText('')
    }
  }

  const changeMode = async (mode: Mode) => {
    if (!current || mode === current.mode) return
    setModeBusy(true)
    try {
      const updated = await writingApi.updateStory(current.id, { mode })
      setCurrent(updated)
      setStories((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      setSidebarTab(mode === 'architect' ? 'reference' : 'extract')
      setToast(mode === 'architect' ? '已切换到架构师模式' : '已切换到探险家模式')
    } catch (error: any) {
      setToast(String(error.message || error))
    } finally {
      setModeBusy(false)
    }
  }

  const analyzeCurrent = async (targetTypes?: string[]) => {
    if (!current) return
    if (dirtyRef.current) await saveCurrent()
    setAnalyzing(true)
    try {
      if (targetTypes && selectionRange.current) {
        const { from, to } = selectionRange.current
        const text = editorRef.current?.state.doc.textBetween(from, to, '\n').trim() || ''
        if (!text) throw new Error('选区为空')
        const result = await writingApi.analyzeStory(current.id, { text, target_types: targetTypes })
        const suffix = result.engine === 'heuristic' ? '（AI 不可用，已改用规则抽取）' : ''
        setToast(result.count > 0 ? `已提取 ${result.count} 条草稿${suffix}，等待你入库细化` : '没有发现新的素材（可能已存在同名实体）')
      } else {
        const result = await writingApi.analyzeStory(current.id, {})
        const suffix = result.engine === 'heuristic' ? '（AI 不可用，已改用规则抽取）' : ''
        setToast(result.count > 0 ? `已解析本章，提取 ${result.count} 条草稿${suffix}` : '本章没有发现新的素材')
      }
      await loadDrafts(current.id)
      setSidebarTab('extract')
    } catch (error: any) {
      setToast(String(error.message || error))
    } finally {
      setAnalyzing(false)
      selectionRange.current = null
    }
  }

  const runAssist = async (action: 'polish' | 'expand' | 'dialogue') => {
    const instance = editorRef.current
    if (!instance) return
    const { from, to } = instance.state.selection
    if (from === to) {
      setToast('请先选中一段文字')
      return
    }
    const text = instance.state.doc.textBetween(from, to, '\n').trim()
    if (!text) {
      setToast('请先选中一段文字')
      return
    }
    const label = action === 'polish' ? 'AI 润色' : action === 'expand' ? 'AI 扩写' : '生成对白'
    setAssist({ label, preview: '' })
    try {
      const full = await writingApi.streamAssist(
        {
          action,
          text,
          context: instance.getText({ blockSeparator: '\n' }).slice(0, 2400),
        },
        (chunk) => setAssist((prev) => (prev ? { ...prev, preview: prev.preview + chunk } : prev))
      )
      if (full.startsWith('\n[AI')) {
        setToast(full.trim())
      } else {
        instance.chain().focus().insertContentAt({ from, to }, textToHtml(full)).run()
        setToast(`${label}完成，已替换选区`)
      }
    } catch (error: any) {
      setToast(String(error.message || error))
    } finally {
      setAssist(null)
    }
  }

  const approveDraft = async (draft: DraftItem) => {
    const target = draft.target_label || DRAFT_LABELS[draft.entity_type]
    if (!window.confirm(`将「${draft.name}」入库到【${target}】？\n\n${draft.target_detail || ''}`)) return
    setApprovingId(draft.id)
    try {
      const result = await writingApi.approveDraft(draft.id)
      setToast(result.message || `${draft.name} 已入库`)
      if (current) await loadDrafts(current.id)
    } catch (error: any) {
      setToast(String(error.message || error))
    } finally {
      setApprovingId('')
    }
  }

  const approveAllDrafts = async () => {
    if (!current || pendingDrafts.length === 0) return
    const byTarget = pendingDrafts.reduce<Record<string, number>>((acc, draft) => {
      const target = draft.target_label || DRAFT_LABELS[draft.entity_type]
      acc[target] = (acc[target] || 0) + 1
      return acc
    }, {})
    const summary = Object.entries(byTarget).map(([target, count]) => `${target} ${count} 条`).join('；')
    if (!window.confirm(`将 ${pendingDrafts.length} 条草稿入库：\n${summary}\n\n入库后可随时撤销。`)) return
    setBulkApproving(true)
    let done = 0
    let failure = ''
    for (const draft of pendingDrafts) {
      try {
        await writingApi.approveDraft(draft.id)
        done += 1
      } catch (error: any) {
        failure = `${draft.name}：${String(error.message || error)}`
      }
    }
    setToast(`已入库 ${done} 条${failure ? `；${failure}` : ''}`)
    setBulkApproving(false)
    await loadDrafts(current.id)
  }

  const undoDraft = async (draft: DraftItem) => {
    const target = draft.target_label || DRAFT_LABELS[draft.entity_type]
    if (!window.confirm(`撤销「${draft.name}」的入库？\n\n这会删除刚创建的${target}实体，草稿退回待入库。`)) return
    setApprovingId(draft.id)
    try {
      const result = await writingApi.undoDraftApproval(draft.id)
      setToast(result.message)
      if (current) await loadDrafts(current.id)
    } catch (error: any) {
      setToast(String(error.message || error))
    } finally {
      setApprovingId('')
    }
  }

  const ignoreDraft = async (draft: DraftItem) => {
    setApprovingId(draft.id)
    try {
      await writingApi.ignoreDraft(draft.id)
      if (current) await loadDrafts(current.id)
    } catch (error: any) {
      setToast(String(error.message || error))
    } finally {
      setApprovingId('')
    }
  }

  const archiveStory = async () => {
    if (!current) return
    if (!window.confirm(`把《${current.title}》封存到归档库？\n\n归档后不会出现在章节列表，也不参与后续生成，可随时恢复。`)) return
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/archive/story/${current.id}`, { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.detail || `HTTP ${res.status}`)
      const next = stories.filter((item) => item.id !== current.id)
      setStories(next)
      setCurrent(next[0] || null)
      setToast('章节已封存到归档库')
    } catch (error: any) {
      setToast(String(error.message || error))
    }
  }

  const removeStory = async () => {
    if (!current) return
    try {
      await writingApi.deleteStory(current.id)
      const next = stories.filter((item) => item.id !== current.id)
      setStories(next)
      setCurrent(next[0] || null)
      setDeleteOpen(false)
      setToast('章节已移入回收站')
    } catch (error: any) {
      setToast(String(error.message || error))
    }
  }

  const exportTxt = () => {
    if (stories.length === 0) {
      setToast('暂无内容可导出')
      return
    }
    const sorted = [...stories].sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime())
    const text = sorted
      .map((story, index) => `第 ${index + 1} 章  ${story.title}\n\n${story.plain_text || stripHtml(story.content)}\n`)
      .join('\n=========================================\n\n')
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `小说导出_${new Date().toLocaleDateString()}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const sourceEvents = current
    ? events.filter((event) => (current.source_event_ids || []).includes(event.id))
    : []
  const pendingDrafts = drafts.filter((draft) => draft.status === 'pending')
  const acceptedDrafts = drafts.filter((draft) => draft.status !== 'pending')
  const saveLabel =
    saveState === 'saving'
      ? '保存中…'
      : saveState === 'dirty'
        ? '未保存'
        : saveState === 'error'
          ? '保存失败'
          : '已自动保存'

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 640, overflow: 'hidden' }}>
      <style>{EDITOR_CSS}</style>

      {/* 手稿库 */}
      <aside style={{ width: '286px', flexShrink: 0, borderRight: '1px solid var(--card-border)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '18px 16px 12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.12em' }}>MANUSCRIPTS</div>
              <h2 style={{ margin: '5px 0 0', fontSize: '19px', color: 'var(--text-main)' }}>手稿库</h2>
            </div>
            <Btn kind="primary" onClick={createBlank} disabled={!worldId} title="新建空白章节">
              ＋ 新章
            </Btn>
          </div>
          <div style={{ marginTop: '10px', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            {stories.length} 章 · 两种入口共用同一份世界设定
          </div>
          <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
            <button style={tinyBtn} onClick={exportTxt}>导出 TXT</button>
            <button style={tinyBtn} onClick={() => setModalOpen(true)} disabled={generating}>从推演生成</button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 10px 16px' }}>
          {loading && <div style={{ padding: '20px', fontSize: '12px', color: 'var(--text-muted)' }}>加载手稿…</div>}
          {!loading && stories.length === 0 && (
            <div style={{ padding: '20px 10px', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.8 }}>
              还没有章节。可以新建一张白纸，也可以从 07 推演生成第一章。
            </div>
          )}
          {stories.map((story) => {
            const active = current?.id === story.id
            return (
              <button
                key={story.id}
                onClick={() => void selectStory(story)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '11px 12px',
                  marginBottom: '6px',
                  borderRadius: '10px',
                  border: `1px solid ${active ? 'var(--primary-color)' : 'transparent'}`,
                  background: active ? 'var(--card-bg)' : 'transparent',
                  cursor: 'pointer',
                  color: 'var(--text-main)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {story.title}
                  </span>
                  <ModeBadge mode={story.mode} />
                </div>
                <div style={{ marginTop: '6px', fontSize: '10px', color: 'var(--text-muted)', display: 'flex', gap: '8px' }}>
                  <span>{story.word_count || 0} 字</span>
                  <span>{fmtTime(story.updated_at)}</span>
                  {story.status === 'published' && <span style={{ color: 'var(--primary-color)' }}>已定稿</span>}
                </div>
              </button>
            )
          })}
        </div>

        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--card-border)', fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.7 }}>
          <strong style={{ color: 'var(--text-main)' }}>增量入库</strong><br />
          提取结果先进入草稿箱，不会直接塞进正式设定。
        </div>
      </aside>

      {/* 工作台 */}
      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: '18px 22px', gap: '12px' }}>
        <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
              08 写作工作台
              {current && <ModeBadge mode={current.mode} />}
            </div>
            {current ? (
              <input
                value={current.title}
                onChange={(event) => {
                  const title = event.target.value
                  setCurrent((prev) => (prev ? { ...prev, title } : prev))
                  setStories((prev) => prev.map((item) => (item.id === current.id ? { ...item, title } : item)))
                  dirtyRef.current = true
                  setSaveState('dirty')
                  scheduleSave()
                }}
                style={{
                  ...inputStyle,
                  marginTop: '6px',
                  padding: '2px 0',
                  border: 'none',
                  fontSize: '26px',
                  fontWeight: 700,
                  letterSpacing: '0.01em',
                  background: 'transparent',
                }}
              />
            ) : (
              <h1 style={{ margin: '6px 0 0', fontSize: '26px', color: 'var(--text-main)' }}>写作工作台</h1>
            )}
            <div style={{ marginTop: '5px', fontSize: '11px', color: 'var(--text-muted)' }}>
              {current ? `${current.word_count || words} 字 · ${saveLabel} · 最后修改 ${fmtTime(current.updated_at)}` : '先选一种模式开始'}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {current && (
              <div style={{ display: 'flex', border: '1px solid var(--card-border)', borderRadius: '8px', overflow: 'hidden' }}>
                {(['architect', 'explorer'] as Mode[]).map((mode) => (
                  <button
                    key={mode}
                    disabled={modeBusy}
                    onClick={() => void changeMode(mode)}
                    style={{
                      padding: '6px 10px',
                      border: 'none',
                      cursor: modeBusy ? 'wait' : 'pointer',
                      background: current.mode === mode ? 'var(--primary-color)' : 'transparent',
                      color: current.mode === mode ? 'var(--primary-text)' : 'var(--text-muted)',
                      fontSize: '11px',
                      fontWeight: 600,
                    }}
                  >
                    {mode === 'architect' ? '架构师' : '探险家'}
                  </button>
                ))}
              </div>
            )}
            <Btn onClick={() => void analyzeCurrent()} disabled={!current || analyzing}>
              {analyzing ? '解析中…' : '解析本章'}
            </Btn>
            <Btn onClick={() => setModalOpen(true)} disabled={!worldId || generating}>素材 / 生成</Btn>
            {current && (
              <Btn onClick={() => void archiveStory()}>归档</Btn>
            )}
            {current && (
              <Btn kind="danger" onClick={() => setDeleteOpen(true)}>删除</Btn>
            )}
          </div>
        </header>

        {!current ? (
          <div style={{ ...card, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '22px', padding: '40px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '11px', letterSpacing: '0.16em', color: 'var(--text-muted)' }}>CHOOSE YOUR FLOW</div>
              <h2 style={{ margin: '8px 0 6px', fontSize: '30px', color: 'var(--text-main)' }}>先写，还是先建世界？</h2>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>不用被迫填表。两条路最终汇入同一份世界设定。</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(220px, 300px))', gap: '16px', width: '100%', maxWidth: '680px' }}>
              <button
                onClick={() => setModalOpen(true)}
                style={{ ...card, padding: '22px', textAlign: 'left', cursor: 'pointer', color: 'var(--text-main)' }}
              >
                <div style={{ fontSize: '22px', marginBottom: '10px' }}>◈</div>
                <h3 style={{ margin: '0 0 6px', fontSize: '17px' }}>架构师模式</h3>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.8 }}>
                  选择已推演的事件，让 AI 在既定世界规则下生成章节。适合先掌控全局，再落笔。
                </p>
                <div style={{ marginTop: '14px', fontSize: '11px', color: 'var(--primary-color)' }}>从推演生成 →</div>
              </button>
              <button
                onClick={createBlank}
                style={{ ...card, padding: '22px', textAlign: 'left', cursor: 'pointer', color: 'var(--text-main)' }}
              >
                <div style={{ fontSize: '22px', marginBottom: '10px' }}>✎</div>
                <h3 style={{ margin: '0 0 6px', fontSize: '17px' }}>探险家模式</h3>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.8 }}>
                  不填任何前置表格，新建空白章节直接写。写完后一键解析，把人物、地点、事件收回世界树。
                </p>
                <div style={{ marginTop: '14px', fontSize: '11px', color: 'var(--primary-color)' }}>新建空白章节 →</div>
              </button>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>已有手稿：从左侧手稿库选择一章继续。</div>
          </div>
        ) : (
          <div style={{ ...card, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 12px', borderBottom: '1px solid var(--card-border)', flexWrap: 'wrap' }}>
              <ToolbarBtn label="B" title="加粗" onClick={() => editor?.chain().focus().toggleBold().run()} />
              <ToolbarBtn label="I" title="斜体" onClick={() => editor?.chain().focus().toggleItalic().run()} />
              <ToolbarBtn label="S" title="删除线" onClick={() => editor?.chain().focus().toggleStrike().run()} />
              <span style={{ width: '1px', height: '16px', background: 'var(--card-border)', margin: '0 4px' }} />
              <ToolbarBtn label="H2" title="小标题" onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} />
              <ToolbarBtn label="“”" title="引用" onClick={() => editor?.chain().focus().toggleBlockquote().run()} />
              <ToolbarBtn label="•" title="无序列表" onClick={() => editor?.chain().focus().toggleBulletList().run()} />
              <ToolbarBtn label="1." title="有序列表" onClick={() => editor?.chain().focus().toggleOrderedList().run()} />
              <span style={{ width: '1px', height: '16px', background: 'var(--card-border)', margin: '0 4px' }} />
              <ToolbarBtn label="↶" title="撤销" onClick={() => editor?.chain().focus().undo().run()} />
              <ToolbarBtn label="↷" title="重做" onClick={() => editor?.chain().focus().redo().run()} />
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                {current.mode === 'architect' ? '推演正文可直接精修' : '选中文字可提取或 AI 辅助'}
              </span>
            </div>

            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', position: 'relative' }}>
              {generating && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 10, background: 'var(--bg-color)', padding: '34px 44px', overflowY: 'auto' }}>
                  <div style={{ fontSize: '11px', letterSpacing: '0.12em', color: 'var(--primary-color)', marginBottom: '12px' }}>
                    AI 正在依据推演写正文…
                  </div>
                  <div style={{ fontFamily: '"Songti SC", Georgia, serif', fontSize: '17px', lineHeight: 1.95, whiteSpace: 'pre-wrap', color: 'var(--text-main)' }}>
                    {generatingText}
                    <span style={{ opacity: 0.5 }}>▌</span>
                  </div>
                </div>
              )}
              {editor && (
                <BubbleMenu
                  editor={editor}
                  shouldShow={({ from, to }) => from !== to}
                  options={{ placement: 'top' }}
                  style={{
                    display: 'flex',
                    gap: '2px',
                    flexWrap: 'wrap',
                    maxWidth: '420px',
                    padding: '5px',
                    borderRadius: '10px',
                    border: '1px solid var(--card-border)',
                    background: 'var(--bg-color)',
                    boxShadow: '0 12px 30px rgba(0,0,0,0.22)',
                  }}
                >
                  <BubbleBtn
                    label="提取人物"
                    onClick={() => {
                      const { from, to } = editor.state.selection
                      selectionRange.current = { from, to }
                      void analyzeCurrent(['character'])
                    }}
                  />
                  <BubbleBtn
                    label="提取地点"
                    onClick={() => {
                      const { from, to } = editor.state.selection
                      selectionRange.current = { from, to }
                      void analyzeCurrent(['location'])
                    }}
                  />
                  <BubbleBtn
                    label="提取事件"
                    onClick={() => {
                      const { from, to } = editor.state.selection
                      selectionRange.current = { from, to }
                      void analyzeCurrent(['event'])
                    }}
                  />
                  <span style={{ width: '1px', background: 'var(--card-border)', margin: '2px 3px' }} />
                  <BubbleBtn label="AI 润色" onClick={() => void runAssist('polish')} />
                  <BubbleBtn label="AI 扩写" onClick={() => void runAssist('expand')} />
                  <BubbleBtn label="生成对白" onClick={() => void runAssist('dialogue')} />
                </BubbleMenu>
              )}
              <div className="ws-editor" style={{ padding: '30px 46px 80px' }}>
                <EditorContent editor={editor} />
              </div>
              {assist && (
                <div
                  style={{
                    position: 'sticky',
                    bottom: 0,
                    margin: '0 20px 16px',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--primary-color)',
                    background: 'var(--bg-color)',
                    boxShadow: '0 10px 24px rgba(0,0,0,0.18)',
                    maxHeight: '180px',
                    overflowY: 'auto',
                  }}
                >
                  <div style={{ fontSize: '10px', color: 'var(--primary-color)', marginBottom: '5px' }}>{assist.label} · 生成中</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-main)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                    {assist.preview || '正在连接 AI…'}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 14px', borderTop: '1px solid var(--card-border)', fontSize: '10px', color: 'var(--text-muted)' }}>
              <span>{words} 字 · {saveLabel}</span>
              <span>{current.mode === 'architect' ? '架构师：推演 → 正文 → 精修' : '探险家：手写 → 解析 → 入库'}</span>
            </div>
          </div>
        )}
      </main>

      {/* 侧边栏 */}
      <aside style={{ width: '340px', flexShrink: 0, borderLeft: '1px solid var(--card-border)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--card-border)' }}>
          {([
            ['reference', '推演参照'],
            ['extract', `素材提取${pendingDrafts.length ? ` ${pendingDrafts.length}` : ''}`],
          ] as [SidebarTab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSidebarTab(key)}
              style={{
                flex: 1,
                padding: '13px 8px',
                border: 'none',
                borderBottom: sidebarTab === key ? '2px solid var(--primary-color)' : '2px solid transparent',
                background: 'transparent',
                color: sidebarTab === key ? 'var(--text-main)' : 'var(--text-muted)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '14px' }}>
          {sidebarTab === 'reference' ? (
            !current ? (
              <SidebarEmpty text="选择一章后查看推演参照" />
            ) : sourceEvents.length === 0 ? (
              <div>
                <SidebarEmpty text="这一章还没有绑定推演事件" />
                <Btn onClick={() => setModalOpen(true)} style={{ width: '100%' }}>
                  去选推演素材
                </Btn>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.8, marginTop: '12px' }}>
                  探险家模式不需要推演参照。写完后切到“素材提取”，把本章内容解析回世界树。
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {sourceEvents.map((event) => {
                  const runs = runsByEvent[event.id] || []
                  return (
                    <div key={event.id} style={{ ...card, padding: '13px', borderRadius: '10px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)' }}>{event.name}</div>
                      <div style={{ marginTop: '4px', fontSize: '10px', color: 'var(--text-muted)' }}>
                        {event.story_time || '时间未定'} · {event.polarity || '—'} / {event.intensity || '—'}
                      </div>
                      {event.description && (
                        <p style={{ margin: '8px 0 0', fontSize: '11px', color: 'var(--text-main)', lineHeight: 1.7, opacity: 0.9 }}>
                          {event.description}
                        </p>
                      )}
                      {runs.length === 0 ? (
                        <div style={{ marginTop: '9px', fontSize: '10px', color: 'var(--text-muted)' }}>尚未推演。可先到 07 模拟运行。</div>
                      ) : (
                        <div style={{ marginTop: '10px', borderTop: '1px dashed var(--card-border)', paddingTop: '9px' }}>
                          <div style={{ fontSize: '10px', color: 'var(--primary-color)', marginBottom: '4px' }}>最近一次推演</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-main)', lineHeight: 1.7 }}>{runs[0].world_changes}</div>
                          {(runs[0].character_actions || []).map((action: any, index: number) => (
                            <div key={index} style={{ marginTop: '7px', padding: '7px 8px', borderRadius: '6px', background: 'rgba(128,128,128,0.07)' }}>
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{action.name} · {action.engine}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-main)', marginTop: '2px', lineHeight: 1.6 }}>{action.action}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          ) : !current ? (
            <SidebarEmpty text="选择一章后开始提取" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ ...card, padding: '14px', borderRadius: '10px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>解析本章</div>
                <p style={{ margin: '6px 0 10px', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.7 }}>
                  AI 会从正文中抽取人物、地点、事件与关系，先存为草稿，不会直接改动正式设定。
                </p>
                <Btn kind="primary" onClick={() => void analyzeCurrent()} disabled={analyzing} style={{ width: '100%' }}>
                  {analyzing ? '正在解析…' : '一键提取设定'}
                </Btn>
                <p style={{ margin: '8px 0 0', fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  也可以在正文里选中文字，用悬浮菜单只提取人物、地点或事件。AI 额度不可用时，解析会自动降级为规则抽取；润色/扩写/对白仍需可用额度。
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>本章草稿</div>
                  <div style={{ marginTop: '2px', fontSize: '10px', color: 'var(--text-muted)' }}>{pendingDrafts.length} 待入库 · {acceptedDrafts.length} 已处理</div>
                </div>
                {pendingDrafts.length > 0 && (
                  <Btn onClick={() => void approveAllDrafts()} disabled={bulkApproving} style={{ padding: '5px 8px', fontSize: '10px' }}>
                    {bulkApproving ? '入库中…' : '全部入库'}
                  </Btn>
                )}
              </div>

              {drafts.length === 0 && <SidebarEmpty text="还没有提取记录" />}
              {[...pendingDrafts, ...acceptedDrafts].map((draft) => (
                <div
                  key={draft.id}
                  style={{
                    ...card,
                    padding: '12px',
                    borderRadius: '10px',
                    opacity: draft.status === 'pending' ? 1 : 0.55,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '6px', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)' }}>{draft.name}</span>
                    <span style={{ fontSize: '9px', padding: '1px 6px', borderRadius: '999px', border: '1px solid var(--card-border)', color: 'var(--text-muted)' }}>
                      {DRAFT_LABELS[draft.entity_type]} · {Math.round((draft.confidence || 0) * 100)}%
                    </span>
                  </div>
                  {draft.summary && (
                    <p style={{ margin: '6px 0 0', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.65 }}>{draft.summary}</p>
                  )}
                  <div style={{ marginTop: '7px', fontSize: '9px', color: 'var(--text-muted)' }}>
                    入库去向：{draft.target_label || DRAFT_LABELS[draft.entity_type]}
                    {draft.target_branch ? ` · ${draft.target_branch}` : ''}
                  </div>
                  {draft.status === 'pending' ? (
                    <div style={{ display: 'flex', gap: '6px', marginTop: '9px' }}>
                      <Btn kind="primary" onClick={() => void approveDraft(draft)} disabled={approvingId === draft.id} style={{ flex: 1 }}>
                        {approvingId === draft.id ? '入库中…' : `入库到${draft.target_label || DRAFT_LABELS[draft.entity_type]}`}
                      </Btn>
                      <Btn onClick={() => void ignoreDraft(draft)} disabled={approvingId === draft.id}>忽略</Btn>
                    </div>
                  ) : draft.status === 'accepted' ? (
                    <div style={{ display: 'flex', gap: '6px', marginTop: '9px' }}>
                      <Btn kind="danger" onClick={() => void undoDraft(draft)} disabled={approvingId === draft.id} style={{ flex: 1 }}>
                        {approvingId === draft.id ? '撤销中…' : '撤销入库'}
                      </Btn>
                    </div>
                  ) : (
                    <div style={{ marginTop: '8px', fontSize: '10px', color: 'var(--text-muted)' }}>已忽略</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* 素材选择 / 生成弹窗 */}
      {modalOpen && (
        <div
          onClick={() => setModalOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{ ...card, width: '640px', maxHeight: '86vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-color)' }}
          >
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', color: 'var(--text-main)' }}>架构师模式 · 选素材</h2>
                <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>不选事件时，默认取最近 5 个事件生成。</p>
              </div>
              <button onClick={() => setModalOpen(false)} style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-muted)' }}>×</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {events.length === 0 ? (
                <SidebarEmpty text="当前世界还没有事件" />
              ) : (
                events.map((event) => {
                  const checked = selectedEventIds.includes(event.id)
                  return (
                    <label
                      key={event.id}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        padding: '10px 12px',
                        border: `1px solid ${checked ? 'var(--primary-color)' : 'var(--card-border)'}`,
                        borderRadius: '9px',
                        cursor: 'pointer',
                        background: checked ? 'rgba(128,128,128,0.08)' : 'transparent',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setSelectedEventIds((prev) => (prev.includes(event.id) ? prev.filter((id) => id !== event.id) : [...prev, event.id]))
                        }
                        style={{ marginTop: '3px', accentColor: 'var(--primary-color)' }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)' }}>{event.name}</div>
                        <div style={{ marginTop: '3px', fontSize: '10px', color: 'var(--text-muted)' }}>
                          {event.story_time || '时间未定'} · {event.event_status || 'occurred'}
                        </div>
                        {event.description && (
                          <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.6 }}>{event.description}</div>
                        )}
                      </div>
                    </label>
                  )
                })
              )}
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px dashed var(--card-border)', display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: '12px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', color: 'var(--primary-color)', fontWeight: 700 }}>
                作者预设推演方向（可选）
                <textarea
                  value={direction}
                  onChange={(event) => setDirection(event.target.value)}
                  rows={3}
                  placeholder="例如：这场戏不要让韩立当场摊牌，先隐忍观察。留空则由 AI 推演。"
                  style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.7, fontWeight: 400 }}
                />
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 400, lineHeight: 1.6 }}>方向约束剧情走向，不直接改写人物底色。</span>
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', color: 'var(--primary-color)', fontWeight: 700 }}>
                  推演视角
                </label>
                <input
                  value={perspective}
                  onChange={(event) => setPerspective(event.target.value)}
                  placeholder="例如：第三人称限知 · 跟随韩立"
                  style={{ ...inputStyle, fontWeight: 400 }}
                />
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {['第一人称 · 主角', '第三人称限知 · 跟随主角', '第三人称全知', '群像多视角'].map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setPerspective(item)}
                      style={{ padding: '3px 7px', borderRadius: '999px', border: `1px solid ${perspective === item ? 'var(--primary-color)' : 'var(--card-border)'}`, background: 'transparent', color: perspective === item ? 'var(--primary-color)' : 'var(--text-muted)', fontSize: '9px', cursor: 'pointer' }}
                    >
                      {item}
                    </button>
                  ))}
                </div>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.6 }}>视角决定读者跟随谁，不改变事件事实。设置会自动记住。</span>
              </div>
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button onClick={() => setSelectedEventIds([])} style={tinyBtn}>清空选择</button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Btn onClick={() => setModalOpen(false)}>取消</Btn>
                <Btn kind="primary" onClick={() => void generateStory()} disabled={generating || !worldId}>
                  {generating ? '生成中…' : '生成并打开章节'}
                </Btn>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteOpen && current && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ ...card, width: '380px', padding: '22px', background: 'var(--bg-color)' }}>
            <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-main)' }}>删除《{current.title}》？</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.7 }}>
              章节与本章草稿会一起移入全局回收站，可随时恢复；已入库的实体不受影响。
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' }}>
              <Btn onClick={() => setDeleteOpen(false)}>取消</Btn>
              <Btn kind="danger" onClick={() => void removeStory()}>删除章节</Btn>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          style={{
            position: 'fixed',
            left: '50%',
            bottom: '26px',
            transform: 'translateX(-50%)',
            zIndex: 1200,
            padding: '10px 16px',
            borderRadius: '10px',
            background: 'var(--text-main)',
            color: 'var(--bg-color)',
            fontSize: '12px',
            maxWidth: '520px',
            boxShadow: '0 12px 30px rgba(0,0,0,0.25)',
          }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}

function ToolbarBtn({ label, title, onClick }: { label: string; title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      style={{
        minWidth: '28px',
        height: '26px',
        padding: '0 7px',
        borderRadius: '6px',
        border: '1px solid transparent',
        background: 'transparent',
        color: 'var(--text-main)',
        fontSize: '12px',
        fontWeight: 700,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}

function BubbleBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      style={{
        padding: '5px 8px',
        borderRadius: '6px',
        border: 'none',
        background: 'transparent',
        color: 'var(--text-main)',
        fontSize: '11px',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}

function SidebarEmpty({ text }: { text: string }) {
  return (
    <div style={{ padding: '24px 10px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.7 }}>
      {text}
    </div>
  )
}
