import { useEffect, useState } from 'react'
import {
  ArrowRight,
  BookOpen,
  Clock3,
  Cloud,
  Gamepad2,
  Heart,
  MessageCircle,
  NotebookPen,
  PenLine,
  Play,
  Plus,
  Quote,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { API_ORIGIN } from '../api/config'
import * as journal from '../api/journal'
import * as infoSources from '../api/informationSources'
import * as storylineApi from '../api/storyline'
import * as writingApi from '../api/writing'
import * as chatApi from '../api/chat'
import { getYunbao, listYunbaoMemories, listYunbaoThreads, type YunbaoProfile } from '../api/yunbao'
import type { ProductKey } from '../product/types'
import '../styles/product-workspace.css'

type Lang = 'zh' | 'en'
type WorldLite = {
  id: string
  name: string
  description?: string
  product_scene?: string
  is_product_workspace?: boolean
  created_at?: string
}
type CharacterLite = { id: string; name: string; avatar?: string; world_id?: string; role?: string; description?: string }
type EventLite = { id: string; name: string; description?: string; world_id?: string; created_at?: string }

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_ORIGIN}/api${path}`)
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
  return (await response.json()) as T
}

function shortDate(value?: string | null) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })
  } catch { return value }
}

function initials(name?: string) {
  return (name || '?').trim().slice(0, 1)
}

function EmptyBlock({ icon, title, hint, action, onAction }: {
  icon: React.ReactNode
  title: string
  hint: string
  action: string
  onAction: () => void
}) {
  return (
    <div className="pwh-empty">
      <span className="pwh-empty-icon">{icon}</span>
      <strong>{title}</strong>
      <p>{hint}</p>
      <button type="button" className="pwh-btn is-primary" onClick={onAction}>{action}<ArrowRight size={13} /></button>
    </div>
  )
}

function SectionHead({ kicker, title, aside }: { kicker?: string; title: string; aside?: React.ReactNode }) {
  return (
    <div className="pwh-section-head">
      <div>{kicker && <span className="pwh-kicker">{kicker}</span>}<strong>{title}</strong></div>
      {aside}
    </div>
  )
}

export default function ProductWorkspaceHome({
  product,
  lang,
  worlds,
  currentWorldId,
  currentWorldName,
  onNavigate,
  onSwitchProduct,
  onEnterWorld,
  onNewWorld,
  onOpenWorldBuilding,
}: {
  product: ProductKey
  lang: Lang
  worlds: WorldLite[]
  currentWorldId: string
  currentWorldName: string
  onNavigate: (page: string) => void
  onSwitchProduct: (product: ProductKey) => void
  onEnterWorld: (id: string) => void
  onNewWorld: () => void
  onOpenWorldBuilding: (id: string) => void
}) {
  const productWorlds = worlds.filter((world) => world.product_scene === product && !world.is_product_workspace)
  const workspace = worlds.find((world) => world.product_scene === product && world.is_product_workspace)
  const activeWorld = productWorlds.find((world) => world.id === currentWorldId) || productWorlds[0] || workspace
  const activeWorldId = activeWorld?.id || ''
  const displayWorldName = activeWorld?.name || currentWorldName

  const [characters, setCharacters] = useState<CharacterLite[]>([])
  const [events, setEvents] = useState<EventLite[]>([])
  const [stories, setStories] = useState<writingApi.StoryItem[]>([])
  const [storyProjects, setStoryProjects] = useState<storylineApi.StoryProject[]>([])
  const [threads, setThreads] = useState<chatApi.ChatThread[]>([])
  const [activeThread, setActiveThread] = useState<chatApi.ChatThread | null>(null)
  const [memories, setMemories] = useState<chatApi.ChatMemory[]>([])
  const [entries, setEntries] = useState<journal.JournalEntry[]>([])
  const [people, setPeople] = useState<journal.JournalPerson[]>([])
  const [bios, setBios] = useState<journal.UserBiography[]>([])
  const [sources, setSources] = useState<infoSources.InformationSource[]>([])
  const [journalStats, setJournalStats] = useState<Record<string, number>>({})
  const [yunbaoProfile, setYunbaoProfile] = useState<YunbaoProfile | null>(null)
  const [yunbaoThreads, setYunbaoThreads] = useState<Array<{ id: string; title: string; message_count?: number; updated_at?: string }>>([])
  const [yunbaoMemories, setYunbaoMemories] = useState<Array<{ id: string; content: string; importance?: number; kind?: string }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError('')
    setCharacters([])
    setEvents([])
    setStories([])
    setStoryProjects([])
    setThreads([])
    setActiveThread(null)
    setMemories([])
    setEntries([])
    setPeople([])
    setBios([])
    setSources([])
    setJournalStats({})
    setYunbaoProfile(null)
    setYunbaoThreads([])
    setYunbaoMemories([])

    const run = async () => {
      try {
        if (product === 'game' || product === 'literature') {
          if (!activeWorldId) { if (alive) setLoading(false); return }
          const [chars, evs, writingRows, storyRows] = await Promise.all([
            fetchJson<CharacterLite[]>('/characters').catch(() => []),
            fetchJson<EventLite[]>('/events').catch(() => []),
            writingApi.listStories(activeWorldId).catch(() => []),
            storylineApi.listStories(activeWorldId).catch(() => []),
          ])
          if (!alive) return
          setCharacters(chars.filter((row) => row.world_id === activeWorldId))
          setEvents(evs.filter((row) => row.world_id === activeWorldId))
          setStories(writingRows)
          setStoryProjects(storyRows)
        } else if (product === 'companion') {
          const [chars, threadRows] = await Promise.all([
            fetchJson<CharacterLite[]>('/characters').catch(() => []),
            activeWorldId ? chatApi.listThreads(activeWorldId).catch(() => []) : Promise.resolve([]),
          ])
          if (!alive) return
          setCharacters(chars.filter((row) => !activeWorldId || row.world_id === activeWorldId))
          setThreads(threadRows)
          if (threadRows[0]) {
            const [detail, memoryRows] = await Promise.all([
              chatApi.getThread(threadRows[0].id).catch(() => null),
              chatApi.listMemories(threadRows[0].id).catch(() => []),
            ])
            if (!alive) return
            setActiveThread(detail || threadRows[0])
            setMemories(memoryRows)
          }
        } else if (product === 'diary') {
          const [entryRows, overviewRows, peopleRows, bioRows, sourceRows] = await Promise.all([
            journal.listJournalEntries({ product: 'diary' }).catch(() => []),
            journal.getJournalOverview().catch(() => ({})),
            journal.listJournalPeople().catch(() => []),
            journal.listUserBiographies().catch(() => []),
            infoSources.listInformationSources({ product: 'diary' }).catch(() => []),
          ])
          if (!alive) return
          setEntries(entryRows)
          setJournalStats(overviewRows)
          setPeople(peopleRows)
          setBios(bioRows)
          setSources(sourceRows)
        } else if (product === 'yunbao') {
          const [profile, chars, evs, storyRows, overviewRows, peopleRows, bioRows, sourceRows, threadRows, memoryRows] = await Promise.all([
            getYunbao(),
            fetchJson<CharacterLite[]>('/characters').catch(() => []),
            fetchJson<EventLite[]>('/events').catch(() => []),
            writingApi.listStories().catch(() => []),
            journal.getJournalOverview().catch(() => ({})),
            journal.listJournalPeople().catch(() => []),
            journal.listUserBiographies().catch(() => []),
            infoSources.listInformationSources({ product: 'diary' }).catch(() => []),
            listYunbaoThreads().catch(() => []),
            listYunbaoMemories().catch(() => []),
          ])
          if (!alive) return
          setYunbaoProfile(profile)
          setCharacters(chars)
          setEvents(evs)
          setStories(storyRows)
          setJournalStats(overviewRows)
          setPeople(peopleRows)
          setBios(bioRows)
          setSources(sourceRows)
          setYunbaoThreads(threadRows)
          setYunbaoMemories(memoryRows)
        }
      } catch (err: any) {
        if (alive) setError(String(err?.message || err))
      } finally {
        if (alive) setLoading(false)
      }
    }
    void run()
    return () => { alive = false }
  }, [product, activeWorldId])

  if (loading && (product === 'companion' || product === 'diary' || product === 'yunbao')) {
    return <div className="pwh-page"><div className="pwh-loading">正在整理工作区数据…</div></div>
  }

  const shared = {
    product, lang, worlds, activeWorld, activeWorldId, displayWorldName, characters, events, stories,
    storyProjects, threads, activeThread, memories, entries, people, bios, sources, journalStats,
    yunbaoProfile, yunbaoThreads, yunbaoMemories,
    error, onNavigate, onSwitchProduct, onEnterWorld, onNewWorld, onOpenWorldBuilding,
  }
  if (product === 'game') return <GameHome {...shared} />
  if (product === 'literature') return <LiteratureHome {...shared} />
  if (product === 'companion') return <CompanionHome {...shared} />
  if (product === 'yunbao') return <YunbaoHome {...shared} />
  return <DiaryHome {...shared} />
}

type HomeShared = {
  product: ProductKey
  lang: Lang
  worlds: WorldLite[]
  activeWorld?: WorldLite
  activeWorldId: string
  displayWorldName: string
  characters: CharacterLite[]
  events: EventLite[]
  stories: writingApi.StoryItem[]
  storyProjects: storylineApi.StoryProject[]
  threads: chatApi.ChatThread[]
  activeThread: chatApi.ChatThread | null
  memories: chatApi.ChatMemory[]
  entries: journal.JournalEntry[]
  people: journal.JournalPerson[]
  bios: journal.UserBiography[]
  sources: infoSources.InformationSource[]
  journalStats: Record<string, number>
  yunbaoProfile: YunbaoProfile | null
  yunbaoThreads: Array<{ id: string; title: string; message_count?: number; updated_at?: string }>
  yunbaoMemories: Array<{ id: string; content: string; importance?: number; kind?: string }>
  error: string
  onNavigate: (page: string) => void
  onSwitchProduct: (product: ProductKey) => void
  onEnterWorld: (id: string) => void
  onNewWorld: () => void
  onOpenWorldBuilding: (id: string) => void
}

function ErrorLine({ error }: { error: string }) {
  return error ? <div className="pwh-error">{error}</div> : null
}

function ActionButton({ children, primary = false, onClick }: { children: React.ReactNode; primary?: boolean; onClick: () => void }) {
  return <button type="button" className={`pwh-btn${primary ? ' is-primary' : ''}`} onClick={onClick}>{children}</button>
}

function GameHome({ lang, activeWorld, characters, events, stories, storyProjects, error, onNavigate, onEnterWorld, onNewWorld, onOpenWorldBuilding }: HomeShared) {
  if (!activeWorld) {
    return (
      <div className="pwh-page">
        <ErrorLine error={error} />
        <div className="pwh-empty-page">
          <EmptyBlock icon={<Gamepad2 size={24} />} title={lang === 'zh' ? '还没有游戏世界' : 'No game world yet'} hint={lang === 'zh' ? '先建立一个世界，人物、事件、故事线和结局都会围绕它生长。' : 'Create a world first; characters, events and endings will grow around it.'} action={lang === 'zh' ? '创建第一个世界' : 'Create first world'} onAction={onNewWorld} />
        </div>
      </div>
    )
  }

  const recent = [...events].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))).slice(0, 3)
  const worldName = activeWorld.name

  return (
    <div className="pwh-page pwh-page--game">
      <div className="pwh-lead">
        <div><h2>{lang === 'zh' ? '世界指挥台' : 'World command deck'}</h2><p>{lang === 'zh' ? '先看世界现在的状态，再决定推进哪条人物线、事件或结局分支。' : 'See what is happening, then decide which character, event or ending to push forward.'}</p></div>
        <div className="pwh-pills"><span className="pwh-pill"><i className="pwh-dot" />{lang === 'zh' ? '运行正常' : 'Healthy'}</span><span className="pwh-pill">{events.length} {lang === 'zh' ? '个事件' : 'events'}</span></div>
      </div>
      <ErrorLine error={error} />

      <div className="pwh-game-hero">
        <article className="pwh-world-card">
          <div className="pwh-world-copy">
            <span className="pwh-kicker">ACTIVE WORLD</span>
            <h3>{worldName}</h3>
            <div className="pwh-world-sub">{activeWorld.description || (lang === 'zh' ? '当前世界正在持续运行。' : 'This world is running.')}</div>
            <div className="pwh-pills">
              <span className="pwh-pill"><strong>{characters.length}</strong> {lang === 'zh' ? '人物' : 'characters'}</span>
              <span className="pwh-pill"><strong>{events.length}</strong> {lang === 'zh' ? '事件' : 'events'}</span>
              <span className="pwh-pill"><strong>{storyProjects.length}</strong> {lang === 'zh' ? '故事线' : 'stories'}</span>
              <span className="pwh-pill"><strong>{stories.length}</strong> {lang === 'zh' ? '作品' : 'works'}</span>
            </div>
            <div className="pwh-actions">
              <ActionButton primary onClick={() => onEnterWorld(activeWorld.id)}>{lang === 'zh' ? '进入世界' : 'Enter world'}<ArrowRight size={14} /></ActionButton>
              <ActionButton onClick={() => onNavigate('simulation')}><Play size={14} />{lang === 'zh' ? '运行一轮推演' : 'Run simulation'}</ActionButton>
              <ActionButton onClick={() => onOpenWorldBuilding(activeWorld.id)}>{lang === 'zh' ? '编辑设定' : 'Edit setup'}</ActionButton>
            </div>
          </div>
          <div className="pwh-world-visual" aria-hidden="true">
            <svg viewBox="0 0 220 240">
              <path d="M-10 65C28 42 41 78 74 59s52-25 75 2 39 29 67 17" fill="none" stroke="rgba(255,255,255,.20)" strokeWidth="1" />
              <path d="M-15 94c38-24 63 11 96-4s66-11 88 13 35 20 52 8" fill="none" stroke="rgba(255,255,255,.13)" strokeWidth="1" />
              <path d="M-8 134c35-18 54 12 87 3s64-2 91 22 39 14 55 2" fill="none" stroke="rgba(255,255,255,.24)" strokeWidth="1" />
              <path d="M-8 178c41-16 58 13 91 2s60 3 84 22 37 10 50 2" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="1" />
              <path d="M35 25c9 47-12 68-3 110s-12 58 1 94" fill="none" stroke="rgba(255,255,255,.10)" />
              <path d="M141 0c-17 39 7 63-8 104s17 68 5 126" fill="none" stroke="rgba(255,255,255,.10)" />
              <circle cx="73" cy="94" r="2.5" fill="rgba(255,255,255,.8)" /><circle cx="143" cy="137" r="2.5" fill="rgba(255,255,255,.5)" /><circle cx="39" cy="164" r="2" fill="rgba(255,255,255,.55)" />
            </svg>
            <span>{lang === 'zh' ? '世界结构' : 'WORLD MAP'}</span>
          </div>
        </article>

        <aside className="pwh-card pwh-recent">
          <SectionHead title={lang === 'zh' ? '最近发生' : 'Recent'} aside={<button type="button" className="pwh-link" onClick={() => onNavigate('timeline')}>{lang === 'zh' ? '全部时间线' : 'Timeline'}<ArrowRight size={11} /></button>} />
          {recent.length === 0 ? (
            <div className="pwh-mini-empty">{lang === 'zh' ? '还没有事件。进入世界开始第一段经历。' : 'No events yet.'}</div>
          ) : recent.map((event, index) => (
            <div className="pwh-recent-row" key={event.id}>
              <i className={`pwh-timeline-dot${index === 0 ? ' is-active' : ''}`} />
              <div><strong>{event.name}</strong><span>{shortDate(event.created_at)} · {index === 0 ? (lang === 'zh' ? '最近写入' : 'Latest') : (lang === 'zh' ? '世界事件' : 'World event')}</span></div>
            </div>
          ))}
          <ActionButton onClick={() => onNavigate('timeline')}>{lang === 'zh' ? '查看完整时间线' : 'Open timeline'}<ArrowRight size={13} /></ActionButton>
        </aside>
      </div>

      <div className="pwh-triple">
        <article className="pwh-card pwh-mini-card">
          <SectionHead title={lang === 'zh' ? '人物与阵营' : 'Characters'} aside={<button type="button" className="pwh-link" onClick={() => onNavigate('character-management')}>{lang === 'zh' ? '人物管理' : 'Manage'}<ArrowRight size={11} /></button>} />
          {characters.length === 0 ? <div className="pwh-mini-empty">{lang === 'zh' ? '世界中还没有人物。' : 'No characters yet.'}</div> : (
            <>
              <div className="pwh-avatar-row">
                <div className="pwh-avatars">{characters.slice(0, 4).map((char) => <span key={char.id} title={char.name}>{char.avatar || initials(char.name)}</span>)}{characters.length > 4 && <span className="is-more">+{characters.length - 4}</span>}</div>
                <div><strong>{characters.length} {lang === 'zh' ? '位人物' : 'characters'}</strong><small>{lang === 'zh' ? '分布在当前世界' : 'in this world'}</small></div>
              </div>
              <div className="pwh-name-list">{characters.slice(0, 3).map((char) => <span key={char.id}>{char.name}</span>)}</div>
            </>
          )}
          <div className="pwh-card-foot"><span>{lang === 'zh' ? '人物档案与关系' : 'Profiles & relations'}</span><ActionButton onClick={() => onNavigate('relationships')}>{lang === 'zh' ? '查看关系' : 'Relations'}</ActionButton></div>
        </article>

        <article className="pwh-card pwh-mini-card">
          <SectionHead title={lang === 'zh' ? '事件与任务' : 'Events'} aside={<button type="button" className="pwh-link" onClick={() => onNavigate('events')}>{lang === 'zh' ? '事件管理' : 'Manage'}<ArrowRight size={11} /></button>} />
          {events.length === 0 ? <div className="pwh-mini-empty">{lang === 'zh' ? '还没有事件，先运行一轮推演。' : 'No events yet.'}</div> : (
            <div className="pwh-task-list">
              {events.slice(0, 3).map((event, index) => (
                <div className="pwh-task-row" key={event.id}><i className={`pwh-dot${index === 0 ? '' : ' is-muted'}`} /><span>{event.name}</span><small>{index === 0 ? (lang === 'zh' ? '最近' : 'Latest') : (lang === 'zh' ? '已记录' : 'Logged')}</small></div>
              ))}
            </div>
          )}
          <div className="pwh-card-foot"><span>{events.length} {lang === 'zh' ? '个世界事件' : 'events'}</span><ActionButton onClick={() => onNavigate('events')}>{lang === 'zh' ? '打开事件' : 'Open'}</ActionButton></div>
        </article>

        <article className="pwh-card pwh-mini-card">
          <SectionHead title={lang === 'zh' ? '故事线与结局' : 'Story branches'} aside={<button type="button" className="pwh-link" onClick={() => onNavigate('storyline')}>{lang === 'zh' ? '故事线' : 'Storyline'}<ArrowRight size={11} /></button>} />
          <div className="pwh-branch-map" aria-hidden="true">
            <svg viewBox="0 0 260 63"><path d="M8 32h52" stroke="rgba(0,0,0,.20)" fill="none" /><path d="M60 32C85 32 81 14 109 14h35" stroke="rgba(0,0,0,.20)" fill="none" /><path d="M60 32c26 0 23 18 49 18h35" stroke="rgba(0,0,0,.20)" fill="none" /><path d="M144 14c19 0 17-8 34-8h44" stroke="rgba(0,0,0,.16)" fill="none" /><path d="M144 50c19 0 17 8 34 8h44" stroke="rgba(0,0,0,.16)" fill="none" /><circle cx="8" cy="32" r="3" fill="#4d4f56" /><circle cx="60" cy="32" r="2.4" fill="#777a82" /><circle cx="144" cy="14" r="2.4" fill="#777a82" /><circle cx="144" cy="50" r="2.4" fill="#777a82" /><circle cx="222" cy="6" r="2" fill="#a0a3aa" /><circle cx="222" cy="58" r="2" fill="#a0a3aa" /></svg>
          </div>
          <div className="pwh-card-foot"><span>{storyProjects.length} {lang === 'zh' ? '个项目' : 'projects'} · {stories.length} {lang === 'zh' ? '份写作' : 'works'}</span><ActionButton onClick={() => onNavigate('multipath')}>{lang === 'zh' ? '进入沙盒' : 'Sandbox'}</ActionButton></div>
        </article>
      </div>
    </div>
  )
}

function LiteratureHome({ lang, activeWorld, characters, events, stories, storyProjects, error, onNavigate, onNewWorld, onOpenWorldBuilding }: HomeShared) {
  if (!activeWorld) {
    return (
      <div className="pwh-page">
        <ErrorLine error={error} />
        <div className="pwh-empty-page"><EmptyBlock icon={<BookOpen size={24} />} title={lang === 'zh' ? '还没有故事世界' : 'No story world yet'} hint={lang === 'zh' ? '先建立一个故事世界，再开始第一部长篇。' : 'Create a story world before starting your first manuscript.'} action={lang === 'zh' ? '创建故事世界' : 'Create world'} onAction={onNewWorld} /></div>
      </div>
    )
  }

  const activeStory = [...stories].sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')))[0]
  const excerpt = activeStory?.plain_text?.trim() || activeStory?.content?.replace(/<[^>]+>/g, ' ').trim() || ''

  return (
    <div className="pwh-page pwh-page--literature">
      <div className="pwh-lead">
        <div><h2>{lang === 'zh' ? '故事工作室' : 'Story studio'}</h2><p>{lang === 'zh' ? '作品是这里的主对象：继续写下一章，检查人物与线索，再决定是否用推演验证分支。' : 'Your manuscript is the main object: continue writing, inspect characters and threads, then test branches.'}</p></div>
        <div className="pwh-pills"><span className="pwh-pill"><i className="pwh-dot" />{activeStory ? (activeStory.status === 'published' ? (lang === 'zh' ? '已发布' : 'Published') : (lang === 'zh' ? '草稿中' : 'Draft')) : (lang === 'zh' ? '等待第一篇' : 'No draft')}</span><span className="pwh-pill">{storyProjects.length} {lang === 'zh' ? '条故事线' : 'storylines'}</span></div>
      </div>
      <ErrorLine error={error} />

      <div className="pwh-lit-hero">
        <article className="pwh-manuscript">
          <div className="pwh-book-cover"><span>LONGFORM / 01</span><strong>{activeStory?.title || activeWorld.name}</strong><small>{activeWorld.name}</small></div>
          <div className="pwh-manuscript-copy">
            <span className="pwh-kicker">CURRENT MANUSCRIPT</span>
            <h3>{activeStory?.title || (lang === 'zh' ? '还没有作品' : 'No manuscript yet')}</h3>
            <p>{excerpt ? `${excerpt.slice(0, 150)}${excerpt.length > 150 ? '…' : ''}` : (lang === 'zh' ? `世界「${activeWorld.name}」已经准备好，接下来创建第一份写作作品。` : `World "${activeWorld.name}" is ready. Create your first manuscript.`)}</p>
            <div className="pwh-pills">{activeStory ? <><span className="pwh-pill"><strong>{activeStory.word_count.toLocaleString()}</strong> {lang === 'zh' ? '字' : 'words'}</span><span className="pwh-pill">{lang === 'zh' ? '最近编辑' : 'Edited'} {shortDate(activeStory.updated_at)}</span><span className="pwh-pill">{activeStory.mode === 'architect' ? (lang === 'zh' ? '架构模式' : 'Architect') : (lang === 'zh' ? '探索模式' : 'Explorer')}</span></> : <span className="pwh-pill">{lang === 'zh' ? '等待创建作品' : 'No work yet'}</span>}</div>
            <div className="pwh-actions">
              <ActionButton primary onClick={() => onNavigate('writing')}><PenLine size={14} />{activeStory ? (lang === 'zh' ? '继续写作' : 'Continue writing') : (lang === 'zh' ? '开始写作' : 'Start writing')}</ActionButton>
              <ActionButton onClick={() => onNavigate('writing')}>{lang === 'zh' ? '查看章节' : 'View chapters'}</ActionButton>
              <ActionButton onClick={() => onOpenWorldBuilding(activeWorld.id)}>{lang === 'zh' ? '世界设定' : 'World setup'}</ActionButton>
            </div>
          </div>
        </article>

        <aside className="pwh-card pwh-thread-card">
          <SectionHead title={lang === 'zh' ? '故事线进度' : 'Story progress'} aside={<button type="button" className="pwh-link" onClick={() => onNavigate('storyline')}>{lang === 'zh' ? '完整树' : 'Full tree'}<ArrowRight size={11} /></button>} />
          {storyProjects.length === 0 ? <div className="pwh-mini-empty">{lang === 'zh' ? '还没有故事线项目。写作页可以从当前世界创建。' : 'No storyline project yet.'}</div> : storyProjects.slice(0, 3).map((project, index) => (
            <div className="pwh-act-row" key={project.id}>
              <span className="pwh-act-index">{String(index + 1).padStart(2, '0')}</span>
              <div><strong>{project.title}</strong><small>{project.status || (lang === 'zh' ? '进行中' : 'In progress')}</small></div>
              <i className={`pwh-dot${index === 0 ? '' : ' is-muted'}`} />
            </div>
          ))}
          <div className="pwh-card-foot"><span>{storyProjects.length} {lang === 'zh' ? '条故事线' : 'storylines'}</span><ActionButton onClick={() => onNavigate('storyline')}>{lang === 'zh' ? '打开故事线' : 'Open'}</ActionButton></div>
        </aside>
      </div>

      <div className="pwh-triple">
        <article className="pwh-card pwh-mini-card">
          <SectionHead title={lang === 'zh' ? '主要人物' : 'Cast'} aside={<button type="button" className="pwh-link" onClick={() => onNavigate('character-management')}>{lang === 'zh' ? '全部人物' : 'All'}<ArrowRight size={11} /></button>} />
          {characters.length === 0 ? <div className="pwh-mini-empty">{lang === 'zh' ? '还没有人物。' : 'No characters yet.'}</div> : (
            <>
              <div className="pwh-avatar-row"><div className="pwh-avatars">{characters.slice(0, 4).map((char) => <span key={char.id} title={char.name}>{char.avatar || initials(char.name)}</span>)}{characters.length > 4 && <span className="is-more">+{characters.length - 4}</span>}</div><div><strong>{characters.length} {lang === 'zh' ? '位人物' : 'characters'}</strong><small>{lang === 'zh' ? '当前世界阵容' : 'in this world'}</small></div></div>
              <div className="pwh-name-list">{characters.slice(0, 3).map((char) => <span key={char.id}>{char.name}</span>)}</div>
            </>
          )}
          <div className="pwh-card-foot"><span>{lang === 'zh' ? '人物与关系网络' : 'Characters & relations'}</span><ActionButton onClick={() => onNavigate('relationships')}>{lang === 'zh' ? '查看关系' : 'Relations'}</ActionButton></div>
        </article>

        <article className="pwh-card pwh-mini-card">
          <SectionHead title={lang === 'zh' ? '事件与灵感' : 'Events & sparks'} aside={<button type="button" className="pwh-link" onClick={() => onNavigate('events')}>{lang === 'zh' ? '事件' : 'Events'}<ArrowRight size={11} /></button>} />
          {events.length === 0 ? <div className="pwh-mini-empty">{lang === 'zh' ? '还没有事件，可以从写作页反推事件。' : 'No events yet.'}</div> : <div className="pwh-task-list">{events.slice(0, 3).map((event, index) => <div className="pwh-task-row" key={event.id}><i className={`pwh-dot${index === 0 ? '' : ' is-muted'}`} /><span>{event.name}</span><small>{shortDate(event.created_at)}</small></div>)}</div>}
          <div className="pwh-card-foot"><span>{events.length} {lang === 'zh' ? '个可引用事件' : 'events'}</span><ActionButton onClick={() => onNavigate('events')}>{lang === 'zh' ? '打开事件' : 'Open'}</ActionButton></div>
        </article>

        <article className="pwh-card pwh-mini-card pwh-aid-card">
          <SectionHead title={lang === 'zh' ? '辅助推演' : 'Light simulation'} aside={<button type="button" className="pwh-link" onClick={() => onNavigate('simulation')}>{lang === 'zh' ? '进入推演' : 'Open'}<ArrowRight size={11} /></button>} />
          <div className="pwh-aid-note"><Quote size={14} /><span>{lang === 'zh' ? '用短分支检验下一章的冲突与人物反应。只作为写作参考，不改正文。' : 'Test the next chapter with short branches. Reference only; the manuscript is untouched.'}</span></div>
          <div className="pwh-pills"><span className="pwh-pill">{lang === 'zh' ? '写作参考' : 'Writing aid'}</span><span className="pwh-pill">{lang === 'zh' ? '不改正文' : 'No auto-edit'}</span></div>
          <div className="pwh-card-foot"><span>{lang === 'zh' ? '轻量推演' : 'Light mode'}</span><ActionButton onClick={() => onNavigate('simulation')}>{lang === 'zh' ? '运行推演' : 'Run'}<ArrowRight size={12} /></ActionButton></div>
        </article>
      </div>
    </div>
  )
}

function CompanionHome({ lang, characters, threads, activeThread, memories, error, onNavigate }: HomeShared) {
  const activeCharacter = characters.find((char) => activeThread?.participants?.some((participant) => participant.character_id === char.id)) || characters[0]
  const messages = (activeThread?.messages || []).slice(-3)
  if (characters.length === 0) {
    return (
      <div className="pwh-page">
        <ErrorLine error={error} />
        <div className="pwh-empty-page"><EmptyBlock icon={<Heart size={24} />} title={lang === 'zh' ? '伴侣空间还是空的' : 'Your companion space is empty'} hint={lang === 'zh' ? '先创建一个私人角色，再开始一段只属于你们的长期对话。' : 'Create a private character to begin a long-term conversation.'} action={lang === 'zh' ? '创建第一位伴侣' : 'Create companion'} onAction={() => onNavigate('character-management')} /></div>
      </div>
    )
  }

  return (
    <div className="pwh-page pwh-page--companion">
      <div className="pwh-companion-summary">
        <div><strong>{characters.length}</strong><span>{lang === 'zh' ? '位伴侣' : 'companions'}</span></div><i /><div><strong>{threads.length}</strong><span>{lang === 'zh' ? '段会话' : 'threads'}</span></div><i /><div><strong>{memories.length}</strong><span>{lang === 'zh' ? '条长期记忆' : 'memories'}</span></div>
        <div className="pwh-pills"><span className="pwh-pill"><i className="pwh-dot" />{lang === 'zh' ? '陪伴空间可用' : 'Space ready'}</span></div>
      </div>
      <ErrorLine error={error} />

      <div className="pwh-companion-grid">
        <aside className="pwh-card pwh-roster">
          <SectionHead title={lang === 'zh' ? '我的伴侣' : 'Companions'} aside={<button type="button" className="pwh-icon-btn" onClick={() => onNavigate('character-management')} aria-label={lang === 'zh' ? '创建伴侣' : 'Create companion'}><Plus size={14} /></button>} />
          <div className="pwh-roster-list">
            {characters.map((char, index) => {
              const relatedThread = threads.find((thread) => thread.participants?.some((participant) => participant.character_id === char.id))
              return (
                <button type="button" key={char.id} className={`pwh-roster-row${index === 0 ? ' is-active' : ''}`} onClick={() => onNavigate('chat')}>
                  <span className="pwh-character-avatar">{char.avatar || initials(char.name)}</span>
                  <span><strong>{char.name}</strong><small>{relatedThread?.last_message?.content?.slice(0, 38) || (lang === 'zh' ? '开始一段对话' : 'Start a conversation')}</small></span>
                  <i className="pwh-dot" />
                </button>
              )
            })}
          </div>
          <p className="pwh-note">{lang === 'zh' ? '伴侣会话独立于云宝人格；这里只显示当前空间的角色。' : 'Companion chats are separate from Yunbao persona.'}</p>
        </aside>

        <article className="pwh-card pwh-chat-panel">
          <div className="pwh-chat-head">
            <span className="pwh-character-avatar">{activeCharacter?.avatar || initials(activeCharacter?.name)}</span>
            <div><strong>{activeThread?.title || activeCharacter?.name || (lang === 'zh' ? '最近会话' : 'Recent chat')}</strong><span>{activeThread?.message_count || 0} {lang === 'zh' ? '条消息' : 'messages'} · {activeThread?.last_message_at ? shortDate(activeThread.last_message_at) : (lang === 'zh' ? '尚未开始' : 'Not started')}</span></div>
            <ActionButton onClick={() => onNavigate('chat')}>{lang === 'zh' ? '打开完整会话' : 'Open chat'}<ArrowRight size={12} /></ActionButton>
          </div>
          <div className="pwh-chat-window">
            {messages.length === 0 ? (
              <div className="pwh-chat-empty"><MessageCircle size={24} /><strong>{lang === 'zh' ? '还没有对话' : 'No conversation yet'}</strong><p>{lang === 'zh' ? '从最近会话开始，或者和其中一位伴侣说第一句话。' : 'Start with a companion.'}</p><ActionButton primary onClick={() => onNavigate('chat')}>{lang === 'zh' ? '开始对话' : 'Start chat'}<ArrowRight size={13} /></ActionButton></div>
            ) : messages.map((message) => (
              <div key={message.id} className={`pwh-message${message.sender_type === 'user' ? ' is-mine' : ''}`}>
                <p>{message.content}</p><time>{shortDate(message.created_at)}</time>
              </div>
            ))}
          </div>
          <div className="pwh-composer"><span>{lang === 'zh' ? '在完整会话中继续…' : 'Continue in chat…'}</span><ActionButton primary onClick={() => onNavigate('chat')}>{lang === 'zh' ? '继续对话' : 'Continue'}<ArrowRight size={12} /></ActionButton></div>
        </article>

        <aside className="pwh-card pwh-context">
          <div className="pwh-context-block">
            <SectionHead title={lang === 'zh' ? '关系与互动' : 'Relations'} aside={<button type="button" className="pwh-link" onClick={() => onNavigate('relationships')}>{lang === 'zh' ? '关系' : 'Open'}<ArrowRight size={11} /></button>} />
            <div className="pwh-context-line"><span>{lang === 'zh' ? '会话消息' : 'Messages'}</span><strong>{activeThread?.message_count || 0}</strong></div>
            <div className="pwh-context-line"><span>{lang === 'zh' ? '互动事件' : 'Events'}</span><strong>{threads.length}</strong></div>
            <div className="pwh-context-line"><span>{lang === 'zh' ? '最近互动' : 'Latest'}</span><strong>{activeThread?.last_message_at ? shortDate(activeThread.last_message_at) : '—'}</strong></div>
          </div>
          <div className="pwh-context-block">
            <SectionHead title={lang === 'zh' ? '最近记忆' : 'Memories'} aside={<button type="button" className="pwh-link" onClick={() => onNavigate('memories')}>{lang === 'zh' ? '全部' : 'All'}<ArrowRight size={11} /></button>} />
            {memories.length === 0 ? <div className="pwh-mini-empty">{lang === 'zh' ? '这段会话还没有沉淀长期记忆。' : 'No long-term memories yet.'}</div> : memories.slice(0, 2).map((memory) => <div className="pwh-memory" key={memory.id}><strong>{memory.content.slice(0, 80)}</strong><span>{shortDate(memory.created_at)} · {memory.scope}</span></div>)}
          </div>
          <div className="pwh-context-block">
            <SectionHead title={lang === 'zh' ? '下一步' : 'Next'} />
            <ActionButton onClick={() => onNavigate('timeline')}><Clock3 size={13} />{lang === 'zh' ? '查看互动时间线' : 'Interaction timeline'}</ActionButton>
            <ActionButton onClick={() => onNavigate('diary')}><NotebookPen size={13} />{lang === 'zh' ? '把对话存为日记' : 'Save to diary'}</ActionButton>
          </div>
        </aside>
      </div>
    </div>
  )
}

function YunbaoHome({ lang, worlds, characters, events, stories, people, journalStats, yunbaoProfile, yunbaoThreads, yunbaoMemories, error, onNavigate, onSwitchProduct }: HomeShared) {
  const profile = yunbaoProfile
  const realWorlds = worlds.filter((world) => !world.is_product_workspace)
  const gameWorlds = realWorlds.filter((world) => world.product_scene === 'game')
  const literatureWorlds = realWorlds.filter((world) => world.product_scene === 'literature')
  const gameWorldIds = new Set(gameWorlds.map((world) => world.id))
  const literatureWorldIds = new Set(literatureWorlds.map((world) => world.id))
  const gameEvents = events.filter((event) => gameWorldIds.has(event.world_id || ''))
  const literatureEvents = events.filter((event) => literatureWorldIds.has(event.world_id || ''))
  const recentWorlds = [...realWorlds].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))).slice(0, 3)
  const recentWorks = [...stories].sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || ''))).slice(0, 4)
  const traits = profile?.traits || []
  const tools = profile?.tools || []
  const growth = profile?.growth_experience || []
  const canEdit = Boolean(profile?.can_edit)
  const latestThread = yunbaoThreads[0]
  const latestMemory = yunbaoMemories[0]

  return (
    <div className="pwh-page pwh-page--yunbao">
      <div className="pwh-lead">
        <div>
          <h2>{lang === 'zh' ? '云宝总览' : 'Yunbao overview'}</h2>
          <p>{lang === 'zh' ? '一个入口查看云宝的人格状态、跨产品资产与最近工作。人格、工作和记忆仍然彼此隔离。' : 'One place for Yunbao persona state, cross-product assets and recent work.'}</p>
        </div>
        <div className="pwh-pills">
          <span className="pwh-pill"><i className="pwh-dot" />{lang === 'zh' ? '云宝领域已连接' : 'Yunbao space ready'}</span>
          <span className="pwh-pill">{profile?.current_state?.label || profile?.active_state || (lang === 'zh' ? '状态读取中' : 'Loading state')}</span>
        </div>
      </div>
      <ErrorLine error={error} />

      <div className="yb-hero">
        <article className="pwh-card yb-identity">
          <div className="yb-avatar" aria-hidden="true"><Cloud size={30} strokeWidth={1.35} /></div>
          <div className="yb-identity-copy">
            <span className="pwh-kicker">YUNBAO / CORE PERSONA</span>
            <h3>{profile?.name || (lang === 'zh' ? '云宝' : 'Yunbao')}</h3>
            <p>{profile?.identity || (lang === 'zh' ? '云宝是独立于伴侣产品的全局人格与专业工作台。' : 'Yunbao is a global persona and professional workspace, separate from companion products.')}</p>
            <div className="yb-badges">
              <span className={`yb-badge${canEdit ? ' is-owner' : ''}`}>
                {canEdit ? <Sparkles size={11} /> : <ShieldCheck size={11} />}
                {profile ? (canEdit ? (lang === 'zh' ? '开发者 · 可编辑' : 'Owner · Editable') : (lang === 'zh' ? '访客 · 只读' : 'Guest · Read-only')) : (lang === 'zh' ? '权限读取中' : 'Loading access')}
              </span>
              <span className="yb-badge">{profile?.maturity || (lang === 'zh' ? '成熟度未设置' : 'Maturity unset')}</span>
              <span className="yb-badge">{traits.length} {lang === 'zh' ? '项特质' : 'traits'}</span>
            </div>
            <div className="yb-profile-meta">
              <span><strong>{tools.length}</strong>{lang === 'zh' ? '工具' : 'tools'}</span>
              <span><strong>{yunbaoThreads.length}</strong>{lang === 'zh' ? '人格会话' : 'threads'}</span>
              <span><strong>{yunbaoMemories.length}</strong>{lang === 'zh' ? '长期记忆' : 'memories'}</span>
              <span><strong>{growth.length}</strong>{lang === 'zh' ? '成长记录' : 'growth'}</span>
            </div>
            <div className="pwh-actions">
              <ActionButton primary onClick={() => onNavigate('personas')}><Sparkles size={14} />{lang === 'zh' ? '人格编辑器' : 'Persona editor'}</ActionButton>
              <ActionButton onClick={() => onNavigate('yunbao-seed')}>{lang === 'zh' ? '人物种子' : 'Seed editor'}</ActionButton>
              <ActionButton onClick={() => onNavigate('yunbao')}>{lang === 'zh' ? '云宝档案' : 'Yunbao profile'}</ActionButton>
            </div>
          </div>
        </article>

        <article className="pwh-card yb-overview">
          <SectionHead title={lang === 'zh' ? '跨产品总览' : 'Cross-product overview'} aside={<span className="yb-scope">{lang === 'zh' ? '游戏 · 文学 · 日记' : 'Game · Literature · Diary'}</span>} />
          <div className="yb-stats">
            <div><strong>{realWorlds.length}</strong><span>{lang === 'zh' ? '世界' : 'worlds'}</span></div>
            <div><strong>{characters.length}</strong><span>{lang === 'zh' ? '人物' : 'characters'}</span></div>
            <div><strong>{stories.length}</strong><span>{lang === 'zh' ? '作品' : 'works'}</span></div>
            <div><strong>{journalStats.entries ?? 0}</strong><span>{lang === 'zh' ? '日记' : 'entries'}</span></div>
          </div>
          <div className="yb-recent-worlds">
            <span className="yb-subhead">{lang === 'zh' ? '最近世界' : 'Recent worlds'}</span>
            {recentWorlds.length === 0 ? <div className="pwh-mini-empty">{lang === 'zh' ? '还没有世界。先从一个产品开始。' : 'No worlds yet.'}</div> : recentWorlds.map((world) => (
              <button type="button" key={world.id} onClick={() => onEnterWorld(world.id)}>
                <span className="yb-world-dot" />
                <span><strong>{world.name}</strong><small>{world.product_scene === 'game' ? (lang === 'zh' ? '游戏世界' : 'Game') : world.product_scene === 'literature' ? (lang === 'zh' ? '文学世界' : 'Literature') : (lang === 'zh' ? '云宝世界' : 'Yunbao')}</small></span>
                <ArrowRight size={11} />
              </button>
            ))}
          </div>
        </article>
      </div>

      {profile && !canEdit && (
        <div className="yb-readonly">
          <ShieldCheck size={14} />
          <span>{lang === 'zh' ? '当前账号只能查看云宝工作台。所有写入、编辑与状态切换仅限开发者「兰哆哆」。' : 'This account has read-only access. All edits are reserved for the developer.'}</span>
        </div>
      )}

      <div className="yb-cap-grid">
        <button type="button" className="pwh-card yb-cap" onClick={() => onSwitchProduct('game')}>
          <span className="yb-cap-icon"><Gamepad2 size={19} strokeWidth={1.5} /></span>
          <span className="yb-cap-copy"><strong>{lang === 'zh' ? '游戏创作' : 'Game creation'}</strong><small>{gameWorlds.length} {lang === 'zh' ? '个世界' : 'worlds'} · {gameEvents.length} {lang === 'zh' ? '个事件' : 'events'}</small></span>
          <ArrowRight size={13} />
        </button>
        <button type="button" className="pwh-card yb-cap" onClick={() => onSwitchProduct('literature')}>
          <span className="yb-cap-icon"><BookOpen size={19} strokeWidth={1.5} /></span>
          <span className="yb-cap-copy"><strong>{lang === 'zh' ? '文学创作' : 'Literature creation'}</strong><small>{literatureWorlds.length} {lang === 'zh' ? '个世界' : 'worlds'} · {literatureEvents.length} {lang === 'zh' ? '个事件' : 'events'}</small></span>
          <ArrowRight size={13} />
        </button>
        <button type="button" className="pwh-card yb-cap" onClick={() => onSwitchProduct('diary')}>
          <span className="yb-cap-icon"><NotebookPen size={19} strokeWidth={1.5} /></span>
          <span className="yb-cap-copy"><strong>{lang === 'zh' ? '日记与传记' : 'Diary & biography'}</strong><small>{journalStats.entries ?? 0} {lang === 'zh' ? '篇日记' : 'entries'} · {people.length} {lang === 'zh' ? '位人物' : 'people'}</small></span>
          <ArrowRight size={13} />
        </button>
      </div>

      <div className="yb-lower">
        <article className="pwh-card yb-works-card">
          <SectionHead title={lang === 'zh' ? '最近作品' : 'Recent works'} aside={<button type="button" className="pwh-link" onClick={() => onNavigate('writing')}>{lang === 'zh' ? '写作工作台' : 'Writing'}<ArrowRight size={11} /></button>} />
          {recentWorks.length === 0 ? <div className="pwh-mini-empty">{lang === 'zh' ? '还没有写作作品。' : 'No works yet.'}</div> : (
            <div className="yb-work-list">
              {recentWorks.map((work) => (
                <button type="button" key={work.id} onClick={() => onNavigate('writing')}>
                  <span className="yb-work-mark" />
                  <span><strong>{work.title || (lang === 'zh' ? '无标题作品' : 'Untitled')}</strong><small>{work.word_count.toLocaleString()} {lang === 'zh' ? '字' : 'words'} · {shortDate(work.updated_at)}</small></span>
                  <span className={`yb-work-status${work.status === 'published' ? ' is-live' : ''}`}>{work.status === 'published' ? (lang === 'zh' ? '已发布' : 'Live') : (lang === 'zh' ? '草稿' : 'Draft')}</span>
                </button>
              ))}
            </div>
          )}
        </article>

        <article className="pwh-card yb-persona-card">
          <SectionHead title={lang === 'zh' ? '人格状态' : 'Persona state'} aside={<button type="button" className="pwh-link" onClick={() => onNavigate('personas')}>{lang === 'zh' ? '编辑' : 'Edit'}<ArrowRight size={11} /></button>} />
          <div className="yb-state-block">
            <span className="yb-state-name">{profile?.current_state?.label || profile?.active_state || (lang === 'zh' ? '未读取' : 'Unknown')}</span>
            <p>{profile?.current_state?.description || (lang === 'zh' ? '人格状态决定云宝在对话与工作时的表达重心。' : 'State shapes how Yunbao speaks and works.')}</p>
          </div>
          <div className="yb-trait-list">
            {traits.length === 0 ? <span className="pwh-mini-empty">{lang === 'zh' ? '尚未设置特质。' : 'No traits yet.'}</span> : traits.slice(0, 5).map((trait) => <span key={trait}>{trait}</span>)}
          </div>
          <div className="yb-card-foot"><span>{profile?.version_id ? (lang === 'zh' ? '人格版本已绑定' : 'Version bound') : (lang === 'zh' ? '人格版本未绑定' : 'No version')}</span><ActionButton onClick={() => onNavigate('yunbao-seed')}>{lang === 'zh' ? '查看种子' : 'Seed'}</ActionButton></div>
        </article>

        <article className="pwh-card yb-memory-card">
          <SectionHead title={lang === 'zh' ? '对话与记忆' : 'Chats & memories'} aside={<button type="button" className="pwh-link" onClick={() => onNavigate('memories')}>{lang === 'zh' ? '全部记忆' : 'All'}<ArrowRight size={11} /></button>} />
          <div className="yb-thread">
            <MessageCircle size={14} />
            <div><strong>{latestThread?.title || (lang === 'zh' ? '还没有云宝会话' : 'No Yunbao thread')}</strong><span>{latestThread ? `${latestThread.message_count || 0} ${lang === 'zh' ? '条消息' : 'messages'} · ${shortDate(latestThread.updated_at)}` : (lang === 'zh' ? '在云宝档案中开始对话' : 'Start from the profile')}</span></div>
          </div>
          <div className="yb-memory-quote">
            {latestMemory ? <><Quote size={13} /><p>{latestMemory.content.slice(0, 110)}{latestMemory.content.length > 110 ? '…' : ''}</p></> : <p className="pwh-mini-empty">{lang === 'zh' ? '还没有长期记忆。' : 'No long-term memories yet.'}</p>}
          </div>
          <div className="yb-card-foot"><span>{yunbaoThreads.length} {lang === 'zh' ? '个会话' : 'threads'} · {yunbaoMemories.length} {lang === 'zh' ? '条记忆' : 'memories'}</span><ActionButton onClick={() => onNavigate('yunbao')}>{lang === 'zh' ? '进入云宝档案' : 'Open profile'}</ActionButton></div>
        </article>
      </div>
    </div>
  )
}

function DiaryHome({ lang, entries, people, bios, sources, journalStats, error, onNavigate }: HomeShared) {
  const sortedEntries = [...entries].sort((a, b) => String(b.entry_date || '').localeCompare(String(a.entry_date || '')))
  const activeBio = bios[0]
  const confirmedSources = sources.filter((source) => source.confirmed).length
  const pendingSources = sources.filter((source) => !source.confirmed).length
  const entryCount = journalStats.entries ?? entries.length
  const peopleCount = journalStats.people ?? people.length

  return (
    <div className="pwh-page pwh-page--diary">
      <div className="pwh-diary-strip">
        <div><span>{lang === 'zh' ? '现在' : 'Now'}</span><strong>{new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long' })}</strong><small>{lang === 'zh' ? '人生记录持续中' : 'Life archive in progress'}</small></div>
        <div><span>{lang === 'zh' ? '日记' : 'Entries'}</span><strong>{entryCount}<small>{lang === 'zh' ? '篇' : ''}</small></strong></div>
        <div><span>{lang === 'zh' ? '人物' : 'People'}</span><strong>{peopleCount}<small>{lang === 'zh' ? '位' : ''}</small></strong></div>
        <div><span>{lang === 'zh' ? '传记' : 'Biographies'}</span><strong>{journalStats.biographies ?? bios.length}<small>{lang === 'zh' ? '本' : ''}</small></strong></div>
        <div><span>{lang === 'zh' ? '来源' : 'Sources'}</span><strong>{sources.length}<small>{lang === 'zh' ? '条' : ''}</small></strong></div>
      </div>
      <ErrorLine error={error} />

      <div className="pwh-diary-grid">
        <article className="pwh-card pwh-journal-card">
          <SectionHead kicker="LIFE TIMELINE" title={lang === 'zh' ? '人生时间线' : 'Life timeline'} aside={<button type="button" className="pwh-link" onClick={() => onNavigate('diary')}>{lang === 'zh' ? '查看全部记录' : 'All entries'}<ArrowRight size={11} /></button>} />
          {sortedEntries.length === 0 ? (
            <div className="pwh-journal-empty"><NotebookPen size={24} /><strong>{lang === 'zh' ? '第一篇日记还在等你' : 'Your first entry is waiting'}</strong><p>{lang === 'zh' ? '从今天的一件小事开始，不需要完整，也不需要总结。' : 'Start with one small thing from today.'}</p><ActionButton primary onClick={() => onNavigate('diary')}>{lang === 'zh' ? '写今天' : 'Write today'}<PenLine size={13} /></ActionButton></div>
          ) : (
            <div className="pwh-timeline">
              {sortedEntries.slice(0, 4).map((entry, index) => (
                <button type="button" className="pwh-entry" key={entry.id} onClick={() => onNavigate('diary')}>
                  <span className="pwh-entry-date"><strong>{shortDate(entry.entry_date)}</strong><small>{index === 0 ? (lang === 'zh' ? '最近' : 'Latest') : entry.entry_type_label || ''}</small></span>
                  <i className={`pwh-entry-dot${index === 0 ? ' is-active' : ''}`} />
                  <span className="pwh-entry-copy">
                    <strong>{entry.title || (lang === 'zh' ? '无标题记录' : 'Untitled')}</strong>
                    <p>{entry.content.slice(0, 100)}{entry.content.length > 100 ? '…' : ''}</p>
                    <span className="pwh-entry-tags">{entry.mood && <i>{entry.mood}</i>}{entry.tags?.slice(0, 3).map((tag) => <i key={tag}>{tag}</i>)}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </article>

        <aside className="pwh-diary-side">
          <article className="pwh-card pwh-bio-card">
            <SectionHead kicker="BIOGRAPHY" title={lang === 'zh' ? '正在写的传记' : 'Current biography'} aside={<button type="button" className="pwh-link" onClick={() => onNavigate('diary')}>{lang === 'zh' ? '全部' : 'All'}<ArrowRight size={11} /></button>} />
            {activeBio ? (
              <>
                <div className="pwh-bio-main"><span className="pwh-book-spine" /><div><h4>{activeBio.title}</h4><p>{activeBio.summary || (lang === 'zh' ? '从已经记录的人生片段开始整理。' : 'Built from your recorded life fragments.')}</p><div className="pwh-pills"><span className="pwh-pill"><strong>{activeBio.chapter_count}</strong> {lang === 'zh' ? '章' : 'chapters'}</span><span className="pwh-pill">{activeBio.status === 'published' ? (lang === 'zh' ? '已发布' : 'Published') : (lang === 'zh' ? '整理中' : 'Draft')}</span></div></div></div>
                <ActionButton onClick={() => onNavigate('diary')}>{lang === 'zh' ? '继续整理' : 'Continue'}<ArrowRight size={12} /></ActionButton>
              </>
            ) : (
              <div className="pwh-mini-empty">{lang === 'zh' ? '还没有传记。先从日记里积累素材。' : 'No biography yet.'}</div>
            )}
          </article>

          <article className="pwh-card pwh-side-people">
            <SectionHead title={lang === 'zh' ? '人物档案' : 'People'} aside={<button type="button" className="pwh-link" onClick={() => onNavigate('diary')}>{lang === 'zh' ? '人物' : 'Open'}<ArrowRight size={11} /></button>} />
            {people.length === 0 ? <div className="pwh-mini-empty">{lang === 'zh' ? '还没有记录人物。' : 'No people yet.'}</div> : (
              <div className="pwh-avatar-row"><div className="pwh-avatars">{people.slice(0, 4).map((person) => <span key={person.id} title={person.name}>{person.avatar || initials(person.name)}</span>)}{people.length > 4 && <span className="is-more">+{people.length - 4}</span>}</div><div><strong>{peopleCount} {lang === 'zh' ? '位人物' : 'people'}</strong><small>{people.filter((person) => person.relation_label).length} {lang === 'zh' ? '位有明确关系' : 'with relation'}</small></div></div>
            )}
          </article>

          <article className="pwh-card pwh-side-people">
            <SectionHead title={lang === 'zh' ? '来源与证据' : 'Sources'} aside={<button type="button" className="pwh-link" onClick={() => onNavigate('information-sources')}>{lang === 'zh' ? '管理' : 'Manage'}<ArrowRight size={11} /></button>} />
            <div className="pwh-context-line"><span>{lang === 'zh' ? '已确认来源' : 'Confirmed'}</span><strong>{confirmedSources}</strong></div>
            <div className="pwh-context-line"><span>{lang === 'zh' ? '待核对' : 'Unconfirmed'}</span><strong>{pendingSources}</strong></div>
            <div className="pwh-context-line"><span>{lang === 'zh' ? '日记引用' : 'Citations'}</span><strong>{journalStats.citations ?? 0}</strong></div>
          </article>
        </aside>
      </div>
    </div>
  )
}
