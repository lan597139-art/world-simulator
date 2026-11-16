import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCircle2,
  Clock3,
  Gamepad2,
  Globe2,
  ImagePlus,
  Link2,
  NotebookPen,
  PanelsTopLeft,
  Pencil,
  PenLine,
  Plus,
  Route,
  Search,
  Sparkles,
  Trash2,
  Upload,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import { API_ORIGIN } from '../api/config'
import { listCharacters } from '../api/structure'
import { recordMediaAsset, resolveMediaUrl, uploadMedia } from '../api/media'
import ComicWorkbenchPage from './ComicWorkbenchPage'
import {
  createWork,
  deleteWork,
  getWorkSummary,
  listWorks,
  SCENE_CATEGORIES,
  updateWork,
  type CreativeWork,
  type WorkScene,
  type WorkStatus,
} from '../api/creativeWorks'
import { getAllWorlds } from '../services/worldService'
import '../styles/works.css'

type Lang = 'zh' | 'en'
type WorldLite = { id: string; name: string; product_scene?: string | null; is_product_workspace?: boolean; is_official?: boolean }
type CharacterLite = { id: string; name: string; world_id?: string | null; basic_profile?: Record<string, unknown> }

type SceneMeta = { key: WorkScene; label: string; short: string; description: string; icon: LucideIcon; tone: string }
type StatusCopy = { label: string; short: string }

const SCENES: SceneMeta[] = [
  { key: 'game', label: '游戏创作', short: '游戏', description: '游戏世界、规则、角色与多结局剧情。', icon: Gamepad2, tone: '#4f7cff' },
  { key: 'literature', label: '文学创作', short: '文学', description: '小说、故事、章节与文学人物。', icon: BookOpen, tone: '#2f9e6f' },
  { key: 'comic', label: '漫画创作', short: '漫画', description: '漫画作品、章节、页面与连续画格。', icon: PanelsTopLeft, tone: '#d4674f' },
  { key: 'companion', label: '虚拟角色', short: '角色', description: '角色设定、长期关系与互动体验。', icon: Sparkles, tone: '#8b5cf6' },
  { key: 'diary', label: '日记与传记', short: '日记', description: '日记、人生经历、回忆录与传记。', icon: NotebookPen, tone: '#c08a2e' },
]

const SCENES_EN: Record<WorkScene, Pick<SceneMeta, 'label' | 'short' | 'description'>> = {
  game: { label: 'Game Creation', short: 'Game', description: 'Game worlds, rules, characters and branching stories.' },
  literature: { label: 'Literature', short: 'Literature', description: 'Novels, stories, chapters and literary characters.' },
  comic: { label: 'Comic Creation', short: 'Comic', description: 'Comic works, chapters, pages and sequential panels.' },
  companion: { label: 'Virtual Companion', short: 'Companion', description: 'Character settings, long-term bonds and interaction.' },
  diary: { label: 'Diary & Biography', short: 'Diary', description: 'Journals, life events, memoirs and biography.' },
}

function localizedScenes(lang: Lang): SceneMeta[] {
  return SCENES.map((scene) => lang === 'zh' ? scene : { ...scene, ...SCENES_EN[scene.key] })
}

const STATUSES: Array<{ key: WorkStatus; zh: string; en: string; icon: LucideIcon }> = [
  { key: 'draft', zh: '草稿', en: 'Draft', icon: Clock3 },
  { key: 'in_progress', zh: '创作中', en: 'In progress', icon: Pencil },
  { key: 'completed', zh: '已完成', en: 'Completed', icon: CheckCircle2 },
  { key: 'archived', zh: '已归档', en: 'Archived', icon: FileArchiveIcon },
]

function FileArchiveIcon(props: { size?: number }) {
  return <span className="cw-status-archive-icon" aria-hidden="true" {...props}>▣</span>
}

const copy = {
  zh: {
    eyebrow: 'Creative Works', title: '我的作品', subtitle: '四个创作场景共享一套作品入口。先创建作品，再进入对应场景继续创作。',
    create: '新建作品', createCard: '创建新作品', search: '搜索作品名称、简介或分类…',
    all: '全部作品', total: '作品总数', draft: '草稿', inProgress: '创作中', completed: '已完成',
    emptyTitle: '还没有作品', emptyText: '从一个名称、封面或故事想法开始。作品创建后可继续关联世界与人物。',
    filterEmpty: '当前筛选下没有作品', filterEmptyText: '换个分类或状态，或立即创建一部新作品。',
    updated: '最近更新', worlds: '关联世界', characters: '引用人物', noWorlds: '尚未关联世界', noCharacters: '尚未引用人物',
    openSpace: '进入创作空间', edit: '编辑资料', delete: '删除作品', detail: '作品管理', close: '关闭',
    formCreate: '创建作品', formEdit: '编辑作品资料', titleField: '作品名称', summaryField: '作品简介',
    categoryField: '作品分类', statusField: '作品状态', coverField: '作品封面', coverHint: '支持 JPG / PNG / WebP，上传后持久保存；建议 3:4 或 16:9。',
    uploadCover: '上传封面', replaceCover: '更换封面', removeCover: '移除', worldsField: '关联世界', worldsHint: '一部作品可以关联多个世界；官方世界可引用但不可修改。',
    charactersField: '引用人物', charactersHint: '从已关联世界中引用 OC / 人物；一部作品可引用多位人物。',
    save: '保存', saving: '保存中…', cancel: '取消', required: '请填写作品名称。', uploadFailed: '封面上传失败：',
    deleteConfirm: '确定删除这部作品吗？作品中的世界与人物不会被删除。', deleted: '作品已删除。',
    noWorldOptions: '当前没有可关联的世界，请先在创作中心创建世界。', noCharacterOptions: '关联世界后，这里会列出可引用的人物。',
    author: '作者', created: '创建于', scene: '创作场景', category: '分类', status: '状态', summary: '简介',
    sceneStats: '场景分布', manageHint: '作品元数据与世界、人物引用集中在这里管理，正文与具体内容留在对应创作空间。',
    selectAll: '全选', clear: '清空', selected: '已选', optional: '可选', cover: '封面',
    sceneLocked: '创建后场景不可更改', worldCount: '个世界', characterCount: '位人物',
  },
  en: {
    eyebrow: 'Creative Works', title: 'My Works', subtitle: 'Four creation scenes share one work entry. Create a work, then continue in its scene.',
    create: 'New work', createCard: 'Create a new work', search: 'Search title, summary, or category…',
    all: 'All works', total: 'Total works', draft: 'Drafts', inProgress: 'In progress', completed: 'Completed',
    emptyTitle: 'No works yet', emptyText: 'Start with a title, a cover, or a story idea. Link worlds and characters after creating it.',
    filterEmpty: 'Nothing in this filter', filterEmptyText: 'Try another scene or status, or create a new work now.',
    updated: 'Updated', worlds: 'Worlds', characters: 'Characters', noWorlds: 'No worlds linked', noCharacters: 'No characters linked',
    openSpace: 'Open creation space', edit: 'Edit details', delete: 'Delete work', detail: 'Work management', close: 'Close',
    formCreate: 'Create work', formEdit: 'Edit work details', titleField: 'Title', summaryField: 'Summary',
    categoryField: 'Category', statusField: 'Status', coverField: 'Cover', coverHint: 'JPG / PNG / WebP, stored persistently. 3:4 or 16:9 recommended.',
    uploadCover: 'Upload cover', replaceCover: 'Replace cover', removeCover: 'Remove', worldsField: 'Linked worlds', worldsHint: 'A work can link multiple worlds; official worlds are readable but not editable.',
    charactersField: 'Referenced characters', charactersHint: 'Reference OCs / characters from the linked worlds. A work can reference many characters.',
    save: 'Save', saving: 'Saving…', cancel: 'Cancel', required: 'Please enter a title.', uploadFailed: 'Cover upload failed: ',
    deleteConfirm: 'Delete this work? Worlds and characters inside it will not be deleted.', deleted: 'Work deleted.',
    noWorldOptions: 'No worlds available yet. Create a world in the creation center first.', noCharacterOptions: 'Link a world to see characters available for reference.',
    author: 'Author', created: 'Created', scene: 'Scene', category: 'Category', status: 'Status', summary: 'Summary',
    sceneStats: 'Scene distribution', manageHint: 'Work metadata and world/character references live here; content stays in its creation space.',
    selectAll: 'Select all', clear: 'Clear', selected: 'selected', optional: 'Optional', cover: 'Cover',
    sceneLocked: 'Scene cannot be changed after creation', worldCount: 'worlds', characterCount: 'characters',
  },
}

function storedMediaUrl(url: string) {
  return url.startsWith(API_ORIGIN) ? url.slice(API_ORIGIN.length) : url
}

function formatDate(value: string | null | undefined, lang: Lang) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 10)
  return date.toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function statusMeta(status: WorkStatus, lang: Lang): StatusCopy {
  const row = STATUSES.find((item) => item.key === status) || STATUSES[0]
  return { label: lang === 'zh' ? row.zh : row.en, short: lang === 'zh' ? row.zh : row.en }
}

type FormState = {
  scene: WorkScene
  title: string
  summary: string
  category: string
  status: WorkStatus
  cover_url: string
  world_ids: string[]
  character_ids: string[]
}

function emptyForm(scene: WorkScene): FormState {
  return {
    scene,
    title: '',
    summary: '',
    category: SCENE_CATEGORIES[scene][0],
    status: 'draft',
    cover_url: '',
    world_ids: [],
    character_ids: [],
  }
}

export default function WorksPage({
  lang,
  userName,
  onOpenScene,
  onOpenNarrative,
  initialScene,
}: {
  lang: Lang
  userName?: string
  onOpenScene: (scene: WorkScene, worldId?: string) => void
  onOpenNarrative?: (scene: WorkScene, worldId: string, page: 'storyline' | 'writing') => void
  initialScene?: WorkScene | null
}) {
  const t = copy[lang]
  const [works, setWorks] = useState<CreativeWork[]>([])
  const [summary, setSummary] = useState<{ total: number; by_scene: Record<WorkScene, number>; by_status: Record<WorkStatus, number> } | null>(null)
  const [worlds, setWorlds] = useState<WorldLite[]>([])
  const [characters, setCharacters] = useState<CharacterLite[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sceneFilter, setSceneFilter] = useState<WorkScene | 'all'>(initialScene || 'all')
  const [statusFilter, setStatusFilter] = useState<WorkStatus | 'all'>('all')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<CreativeWork | null>(null)
  const [comicWork, setComicWork] = useState<CreativeWork | null>(null)
  const [editor, setEditor] = useState<{ mode: 'create' | 'edit'; work?: CreativeWork } | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm('game'))
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [rows, summaryRow, worldRows] = await Promise.all([
        listWorks(),
        getWorkSummary(),
        getAllWorlds(false),
      ])
      setWorks(rows)
      setSummary(summaryRow)
      const visibleWorlds = (worldRows as WorldLite[]).filter((row) => !row.is_product_workspace)
      setWorlds(visibleWorlds)
      const characterRows = await Promise.all(visibleWorlds.map((world) => listCharacters(world.id).catch(() => [])))
      const merged = new Map<string, CharacterLite>()
      characterRows.flat().forEach((row) => merged.set(row.id, row as CharacterLite))
      setCharacters([...merged.values()])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])
  useEffect(() => { if (initialScene) setSceneFilter(initialScene) }, [initialScene])

  const worldById = useMemo(() => new Map(worlds.map((world) => [world.id, world])), [worlds])
  const characterById = useMemo(() => new Map(characters.map((character) => [character.id, character])), [characters])
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return works.filter((work) => {
      if (sceneFilter !== 'all' && work.scene !== sceneFilter) return false
      if (statusFilter !== 'all' && work.status !== statusFilter) return false
      if (!needle) return true
      return `${work.title} ${work.summary} ${work.category}`.toLowerCase().includes(needle)
    })
  }, [works, sceneFilter, statusFilter, query])

  const scenes = localizedScenes(lang)
  const activeScene = sceneFilter === 'all' ? null : scenes.find((scene) => scene.key === sceneFilter) || null
  const sceneCounts = summary?.by_scene || ({} as Record<WorkScene, number>)

  const openCreate = (scene: WorkScene = activeScene?.key || 'game') => {
    setForm(emptyForm(scene))
    setFormError('')
    setEditor({ mode: 'create' })
  }

  const openEdit = (work: CreativeWork) => {
    setForm({
      scene: work.scene,
      title: work.title,
      summary: work.summary,
      category: work.category || SCENE_CATEGORIES[work.scene][0],
      status: work.status,
      cover_url: work.cover_url,
      world_ids: [...work.world_ids],
      character_ids: [...work.character_ids],
    })
    setFormError('')
    setEditor({ mode: 'edit', work })
  }

  const closeEditor = () => {
    if (saving || uploading) return
    setEditor(null)
    setFormError('')
  }

  const linkedCharacters = useMemo(() => {
    const worldSet = new Set(form.world_ids)
    return characters.filter((character) => !character.world_id || worldSet.has(character.world_id))
  }, [characters, form.world_ids])

  const toggleWorld = (worldId: string) => {
    setForm((current) => {
      const selectedIds = current.world_ids.includes(worldId)
        ? current.world_ids.filter((id) => id !== worldId)
        : [...current.world_ids, worldId]
      const worldSet = new Set(selectedIds)
      return {
        ...current,
        world_ids: selectedIds,
        character_ids: current.character_ids.filter((id) => {
          const row = characterById.get(id)
          return !row?.world_id || worldSet.has(row.world_id)
        }),
      }
    })
  }

  const toggleCharacter = (characterId: string) => {
    setForm((current) => ({
      ...current,
      character_ids: current.character_ids.includes(characterId)
        ? current.character_ids.filter((id) => id !== characterId)
        : [...current.character_ids, characterId],
    }))
  }

  const uploadCover = async (file: File | undefined) => {
    if (!file) return
    setUploading(true)
    setFormError('')
    try {
      const uploaded = await uploadMedia(file)
      setForm((current) => ({ ...current, cover_url: storedMediaUrl(uploaded.file_url) }))
      await recordMediaAsset({
        title: `作品封面 · ${form.title.trim() || '未命名作品'}`,
        fileUrl: uploaded.file_url,
        mimeType: uploaded.mime_type,
        fileSize: uploaded.file_size,
        description: '作品封面 / 海报',
      }).catch(() => undefined)
    } catch (err) {
      setFormError(`${t.uploadFailed}${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const save = async () => {
    if (!form.title.trim()) {
      setFormError(t.required)
      return
    }
    setSaving(true)
    setFormError('')
    try {
      const saved = editor?.mode === 'edit' && editor.work
        ? await updateWork(editor.work.id, {
            title: form.title.trim(),
            summary: form.summary.trim(),
            category: form.category,
            status: form.status,
            cover_url: form.cover_url,
            world_ids: form.world_ids,
            character_ids: form.character_ids,
          })
        : await createWork({
            scene: form.scene,
            title: form.title.trim(),
            summary: form.summary.trim(),
            category: form.category,
            status: form.status,
            cover_url: form.cover_url,
            world_ids: form.world_ids,
            character_ids: form.character_ids,
          })
      const [rows, summaryRow] = await Promise.all([listWorks(), getWorkSummary()])
      setWorks(rows)
      setSummary(summaryRow)
      setEditor(null)
      setSelected(rows.find((row) => row.id === saved.id) || saved)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (work: CreativeWork) => {
    if (!window.confirm(t.deleteConfirm)) return
    try {
      await deleteWork(work.id)
      setWorks((rows) => rows.filter((row) => row.id !== work.id))
      const summaryRow = await getWorkSummary()
      setSummary(summaryRow)
      setSelected(null)
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err))
    }
  }

  const openWorkScene = (work: CreativeWork) => {
    if (work.scene === 'comic') {
      setSelected(null)
      setComicWork(work)
      return
    }
    const preferredWorld = work.world_ids.find((id) => worldById.get(id)?.product_scene === work.scene) || work.world_ids[0]
    onOpenScene(work.scene, preferredWorld)
  }

  if (comicWork) {
    return <ComicWorkbenchPage work={comicWork} lang={lang} onBack={() => { setComicWork(null); void load() }} />
  }

  return (
    <div className="cw-page">
      <header className="cw-hero">
        <div className="cw-hero-copy">
          <div className="cw-eyebrow">{t.eyebrow}</div>
          <h1>{t.title}</h1>
          <p>{t.subtitle}</p>
          <button type="button" className="cw-primary-button" onClick={() => openCreate()}>
            <Plus size={14} strokeWidth={2} aria-hidden="true" /> {t.create}
          </button>
        </div>
        <div className="cw-hero-stats" aria-label={t.sceneStats}>
          <div><strong>{summary?.total ?? works.length}</strong><span>{t.total}</span></div>
          <div><strong>{summary?.by_status.in_progress ?? works.filter((work) => work.status === 'in_progress').length}</strong><span>{t.inProgress}</span></div>
          <div><strong>{summary?.by_status.completed ?? works.filter((work) => work.status === 'completed').length}</strong><span>{t.completed}</span></div>
        </div>
      </header>

      <div className="cw-scene-strip" role="tablist" aria-label={t.sceneStats}>
        <button type="button" className={`cw-scene-pill${sceneFilter === 'all' ? ' is-active' : ''}`} onClick={() => setSceneFilter('all')} role="tab" aria-selected={sceneFilter === 'all'}>
          <span className="cw-scene-pill-icon"><Link2 size={13} /></span>
          <span><strong>{t.all}</strong><small>{summary?.total ?? works.length}</small></span>
        </button>
        {scenes.map((scene) => {
          const Icon = scene.icon
          return (
            <button key={scene.key} type="button" className={`cw-scene-pill${sceneFilter === scene.key ? ' is-active' : ''}`} onClick={() => setSceneFilter(scene.key)} role="tab" aria-selected={sceneFilter === scene.key}>
              <span className="cw-scene-pill-icon" style={{ color: scene.tone, borderColor: `${scene.tone}55` }}><Icon size={13} /></span>
              <span><strong>{scene.short}</strong><small>{sceneCounts[scene.key] || 0}</small></span>
            </button>
          )
        })}
      </div>

      <div className="cw-toolbar">
        <div className="cw-search">
          <Search size={13} strokeWidth={1.8} aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.search} aria-label={t.search} />
          {query && <button type="button" onClick={() => setQuery('')} title={t.clear}><X size={12} /></button>}
        </div>
        <div className="cw-status-filter">
          <button type="button" className={statusFilter === 'all' ? 'is-active' : ''} onClick={() => setStatusFilter('all')}>{t.all}</button>
          {STATUSES.filter((item) => item.key !== 'archived').map((item) => (
            <button key={item.key} type="button" className={statusFilter === item.key ? 'is-active' : ''} onClick={() => setStatusFilter(item.key)}>
              {lang === 'zh' ? item.zh : item.en}
            </button>
          ))}
        </div>
        <button type="button" className="cw-secondary-button" onClick={() => openCreate()}>
          <Plus size={13} /> {t.create}
        </button>
      </div>

      {error && <div className="cw-alert" role="alert">{error}<button type="button" onClick={() => void load()}>{lang === 'zh' ? '重试' : 'Retry'}</button></div>}

      {loading ? (
        <div className="cw-loading">{lang === 'zh' ? '正在加载作品…' : 'Loading works…'}</div>
      ) : visible.length === 0 && !query && sceneFilter === 'all' && statusFilter === 'all' ? (
        <div className="cw-empty">
          <div className="cw-empty-mark"><BookOpen size={26} strokeWidth={1.3} /></div>
          <h2>{t.emptyTitle}</h2>
          <p>{t.emptyText}</p>
          <button type="button" className="cw-primary-button" onClick={() => openCreate()}>{t.createCard}</button>
        </div>
      ) : visible.length === 0 ? (
        <div className="cw-empty is-filter">
          <h2>{t.filterEmpty}</h2>
          <p>{t.filterEmptyText}</p>
          <button type="button" className="cw-primary-button" onClick={() => openCreate()}>{t.createCard}</button>
        </div>
      ) : (
        <div className="cw-grid">
          <button type="button" className="cw-create-card" onClick={() => openCreate()}>
            <span className="cw-create-plus"><Plus size={22} strokeWidth={1.5} /></span>
            <strong>{t.createCard}</strong>
            <span>{activeScene?.description || t.manageHint}</span>
          </button>
          {visible.map((work) => {
            const scene = scenes.find((item) => item.key === work.scene) || scenes[0]
            const Icon = scene.icon
            const status = statusMeta(work.status, lang)
            const linkedWorlds = work.world_ids.map((id) => worldById.get(id)).filter(Boolean) as WorldLite[]
            const linkedPeople = work.character_ids.map((id) => characterById.get(id)).filter(Boolean) as CharacterLite[]
            return (
              <article key={work.id} className="cw-card" onClick={() => setSelected(work)} tabIndex={0} role="button" onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setSelected(work) }}>
                <div className="cw-cover" style={{ '--cw-tone': scene.tone } as React.CSSProperties}>
                  {work.cover_url ? <img src={resolveMediaUrl(work.cover_url)} alt="" loading="lazy" /> : (
                    <div className="cw-cover-placeholder"><Icon size={30} strokeWidth={1.25} /><span>{scene.short}</span></div>
                  )}
                  <span className="cw-cover-scene">{scene.short}</span>
                  <span className={`cw-cover-status is-${work.status}`}>{status.label}</span>
                </div>
                <div className="cw-card-body">
                  <div className="cw-card-meta"><span>{work.category || scene.short}</span><span>{formatDate(work.updated_at, lang)}</span></div>
                  <h3>{work.title}</h3>
                  <p>{work.summary || t.optional}</p>
                  <div className="cw-card-foot">
                    <span><Globe2 size={11} /> {linkedWorlds.length}</span>
                    <span><Users size={11} /> {linkedPeople.length}</span>
                    <span className="cw-card-open"><ArrowUpRight size={13} /></span>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {editor && (
        <div className="cw-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeEditor() }}>
          <section className="cw-modal" role="dialog" aria-modal="true" aria-labelledby="cw-editor-title">
            <header className="cw-modal-head">
              <div><span className="cw-eyebrow">{editor.mode === 'create' ? t.create : t.detail}</span><h2 id="cw-editor-title">{editor.mode === 'create' ? t.formCreate : t.formEdit}</h2></div>
              <button type="button" className="cw-icon-button" onClick={closeEditor} title={t.close}><X size={16} /></button>
            </header>

            <div className="cw-form">
              <label className="cw-field cw-field-wide">
                <span>{t.titleField}</span>
                <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} maxLength={160} autoFocus placeholder={lang === 'zh' ? '例如：七玄门篇' : 'e.g. The Seven Mystic Gates'} />
              </label>

              <label className="cw-field">
                <span>{t.scene}{editor.mode === 'edit' && <small> · {t.sceneLocked}</small>}</span>
                <select value={form.scene} disabled={editor.mode === 'edit'} onChange={(event) => {
                  const scene = event.target.value as WorkScene
                  setForm({ ...form, scene, category: SCENE_CATEGORIES[scene][0] })
                }}>
                  {scenes.map((scene) => <option key={scene.key} value={scene.key}>{scene.label}</option>)}
                </select>
              </label>

              <label className="cw-field">
                <span>{t.categoryField}</span>
                <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
                  {SCENE_CATEGORIES[form.scene].map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
              </label>

              <label className="cw-field">
                <span>{t.statusField}</span>
                <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as WorkStatus })}>
                  {STATUSES.map((item) => <option key={item.key} value={item.key}>{lang === 'zh' ? item.zh : item.en}</option>)}
                </select>
              </label>

              <label className="cw-field cw-field-wide">
                <span>{t.summaryField}</span>
                <textarea value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} rows={3} placeholder={lang === 'zh' ? '一句话说明这部作品，让它在作品列表里可以被快速识别。' : 'A short description to identify this work in the list.'} />
              </label>

              <div className="cw-field cw-field-wide">
                <span>{t.coverField}</span>
                <div className="cw-cover-upload">
                  <div className="cw-cover-preview" style={{ '--cw-tone': scenes.find((scene) => scene.key === form.scene)?.tone } as React.CSSProperties}>
                    {form.cover_url ? <img src={resolveMediaUrl(form.cover_url)} alt={t.cover} /> : <ImagePlus size={24} strokeWidth={1.3} />}
                  </div>
                  <div className="cw-cover-actions">
                    <input ref={fileRef} type="file" accept="image/*" hidden onChange={(event) => void uploadCover(event.target.files?.[0])} />
                    <button type="button" className="cw-secondary-button" onClick={() => fileRef.current?.click()} disabled={uploading}>
                      <Upload size={12} /> {uploading ? '…' : form.cover_url ? t.replaceCover : t.uploadCover}
                    </button>
                    {form.cover_url && <button type="button" className="cw-text-button" onClick={() => setForm({ ...form, cover_url: '' })}>{t.removeCover}</button>}
                    <small>{t.coverHint}</small>
                  </div>
                </div>
              </div>

              <fieldset className="cw-field cw-field-wide">
                <legend>{t.worldsField} <small>{form.world_ids.length} {t.worldCount}</small></legend>
                {worlds.length === 0 ? <p className="cw-field-empty">{t.noWorldOptions}</p> : (
                  <div className="cw-option-list">
                    {worlds.map((world) => (
                      <label key={world.id} className={`cw-option${form.world_ids.includes(world.id) ? ' is-selected' : ''}`}>
                        <input type="checkbox" checked={form.world_ids.includes(world.id)} onChange={() => toggleWorld(world.id)} />
                        <span className="cw-option-check"><Check size={11} /></span>
                        <span><strong>{world.name}</strong><small>{world.is_official ? (lang === 'zh' ? '官方世界 · 只读引用' : 'Official · read-only reference') : world.product_scene || t.optional}</small></span>
                      </label>
                    ))}
                  </div>
                )}
                <small className="cw-field-hint">{t.worldsHint}</small>
              </fieldset>

              <fieldset className="cw-field cw-field-wide">
                <legend>{t.charactersField} <small>{form.character_ids.length} {t.characterCount}</small></legend>
                {linkedCharacters.length === 0 ? <p className="cw-field-empty">{t.noCharacterOptions}</p> : (
                  <div className="cw-option-list is-characters">
                    {linkedCharacters.map((character) => {
                      const avatar = typeof character.basic_profile?.avatar === 'string' ? character.basic_profile.avatar : ''
                      return (
                        <label key={character.id} className={`cw-option${form.character_ids.includes(character.id) ? ' is-selected' : ''}`}>
                          <input type="checkbox" checked={form.character_ids.includes(character.id)} onChange={() => toggleCharacter(character.id)} />
                          <span className="cw-option-check"><Check size={11} /></span>
                          <span className="cw-option-avatar">{avatar ? <img src={resolveMediaUrl(avatar)} alt="" /> : character.name.slice(0, 1)}</span>
                          <span><strong>{character.name || (lang === 'zh' ? '未命名人物' : 'Unnamed')}</strong><small>{worldById.get(character.world_id || '')?.name || t.optional}</small></span>
                        </label>
                      )
                    })}
                  </div>
                )}
                <small className="cw-field-hint">{t.charactersHint}</small>
              </fieldset>

              {formError && <div className="cw-form-error" role="alert">{formError}</div>}
            </div>

            <footer className="cw-modal-foot">
              <button type="button" className="cw-text-button" onClick={closeEditor} disabled={saving}>{t.cancel}</button>
              <button type="button" className="cw-primary-button" onClick={() => void save()} disabled={saving || uploading}>
                {saving ? t.saving : t.save}
              </button>
            </footer>
          </section>
        </div>
      )}

      {selected && !editor && (
        <div className="cw-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null) }}>
          <section className="cw-detail" role="dialog" aria-modal="true" aria-labelledby="cw-detail-title">
            <button type="button" className="cw-icon-button cw-detail-close" onClick={() => setSelected(null)} title={t.close}><X size={16} /></button>
            <div className="cw-detail-cover">
              {selected.cover_url ? <img src={resolveMediaUrl(selected.cover_url)} alt={selected.title} /> : <div><BookOpen size={30} strokeWidth={1.2} /></div>}
            </div>
            <div className="cw-detail-body">
              <div className="cw-detail-kicker">
                <span>{scenes.find((scene) => scene.key === selected.scene)?.label || selected.scene}</span>
                <span className={`cw-detail-status is-${selected.status}`}>{statusMeta(selected.status, lang).label}</span>
              </div>
              <h2 id="cw-detail-title">{selected.title}</h2>
              <p className="cw-detail-summary">{selected.summary || t.optional}</p>
              <div className="cw-detail-meta">
                <span><strong>{t.category}</strong>{selected.category || '—'}</span>
                <span><strong>{t.author}</strong>{userName || '—'}</span>
                <span><strong>{t.updated}</strong>{formatDate(selected.updated_at, lang)}</span>
              </div>

              <section className="cw-detail-section">
                <h3><Globe2 size={12} /> {t.worlds} <small>{selected.world_ids.length}</small></h3>
                {selected.world_ids.length === 0 ? <p className="cw-field-empty">{t.noWorlds}</p> : (
                  <div className="cw-detail-chips">
                    {selected.world_ids.map((id) => <span key={id}>{worldById.get(id)?.name || id.slice(0, 8)}</span>)}
                  </div>
                )}
              </section>
              <section className="cw-detail-section">
                <h3><Users size={12} /> {t.characters} <small>{selected.character_ids.length}</small></h3>
                {selected.character_ids.length === 0 ? <p className="cw-field-empty">{t.noCharacters}</p> : (
                  <div className="cw-detail-chips">
                    {selected.character_ids.map((id) => <span key={id}>{characterById.get(id)?.name || id.slice(0, 8)}</span>)}
                  </div>
                )}
              </section>

              <div className="cw-detail-actions">
                <button type="button" className="cw-primary-button" onClick={() => openWorkScene(selected)}><ArrowUpRight size={13} /> {selected.scene === 'comic' ? (lang === 'zh' ? '打开漫画工作台' : 'Open comic workbench') : t.openSpace}</button>
                {onOpenNarrative && selected.world_ids.length > 0 && (selected.scene === 'game' || selected.scene === 'literature') && (
                  <div className="cw-narrative-actions">
                    <button type="button" className="cw-secondary-button" onClick={() => onOpenNarrative(selected.scene, selected.world_ids.find((id) => worldById.get(id)?.product_scene === selected.scene) || selected.world_ids[0], 'storyline')}>
                      <Route size={12} /> {lang === 'zh' ? '故事线' : 'Storyline'}
                    </button>
                    <button type="button" className="cw-secondary-button" onClick={() => onOpenNarrative(selected.scene, selected.world_ids.find((id) => worldById.get(id)?.product_scene === selected.scene) || selected.world_ids[0], 'writing')}>
                      <PenLine size={12} /> {lang === 'zh' ? '写作' : 'Writing'}
                    </button>
                  </div>
                )}
                <button type="button" className="cw-secondary-button" onClick={() => openEdit(selected)}><Pencil size={12} /> {t.edit}</button>
                <button type="button" className="cw-text-button is-danger" onClick={() => void remove(selected)}><Trash2 size={12} /> {t.delete}</button>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
