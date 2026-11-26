import { useEffect, useMemo, useState } from 'react'
import {
  ArrowUpRight,
  BookOpen,
  Compass,
  Globe2,
  Handshake,
  LayoutGrid,
  PenLine,
  Route,
  Search,
  Share2,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react'
import type { AuthUser } from '../api/auth'
import { API_ORIGIN } from '../api/config'
import { listStories as listStoryProjects, type StoryProject } from '../api/storyline'
import { createStory, listStories, type StoryItem } from '../api/writing'
import { publishDirect } from '../api/community'
import { quadCheer } from '../api/socialCore'
import CommunityPublicWorks from '../components/CommunityPublicWorks'
import CommunityWorkCard from '../components/CommunityWorkCard'
import CommunityWorkDetail, { type CommunityDetailTarget } from '../components/CommunityWorkDetail'
import type { World } from '../types/world'
import './../styles/community.css'

type Lang = 'zh' | 'en'
type CommunityTab = 'all' | 'works' | 'worlds' | 'ocs' | 'stories' | 'creators'

const COMMUNITY_TABS: Array<{ key: CommunityTab; zh: string; en: string }> = [
  { key: 'all', zh: '全部', en: 'All' },
  { key: 'works', zh: '作品', en: 'Works' },
  { key: 'worlds', zh: '世界', en: 'Worlds' },
  { key: 'ocs', zh: 'OC', en: 'OCs' },
  { key: 'stories', zh: '剧情', en: 'Stories' },
  { key: 'creators', zh: '创作者', en: 'Creators' },
]

type CommunityFilter = 'all' | 'works' | 'worlds' | 'characters' | 'storylines'

type CharacterCard = {
  id: string
  name: string
  worldId: string
  worldName: string
  role: string
  intro: string
}

type SearchResult = {
  id: string
  type: Exclude<CommunityFilter, 'all'>
  title: string
  summary: string
  meta: string
  updated: string
  worldId?: string
  work?: StoryItem
}

const WORLD_TYPE_LABELS: Record<string, { zh: string; en: string }> = {
  reality: { zh: '现实', en: 'Reality' },
  fiction: { zh: '虚构', en: 'Fiction' },
  historical: { zh: '历史', en: 'Historical' },
  experimental: { zh: '实验', en: 'Experimental' },
}

const STORY_STATUS_LABELS: Record<StoryProject['status'], { zh: string; en: string }> = {
  planning: { zh: '筹备中', en: 'Planning' },
  active: { zh: '进行中', en: 'Active' },
  completed: { zh: '已完成', en: 'Completed' },
  archived: { zh: '已归档', en: 'Archived' },
}

const CREATOR_IDENTITY_LABELS: Record<string, { zh: string; en: string }> = {
  world: { zh: '世界创作者', en: 'World creator' },
  character: { zh: '人物创作者', en: 'Character creator' },
  narrative: { zh: '叙事作者', en: 'Narrative writer' },
  companion: { zh: 'AI 角色创作者', en: 'AI character creator' },
  chronicler: { zh: '人生记录者', en: 'Life chronicler' },
}

function text(lang: Lang) {
  return lang === 'zh'
    ? {
        eyebrow: 'CONTENT COMMUNITY',
        title: '作品集',
        subtitle: '发现世界、角色与故事，和创作者一起把想象继续写下去。',
        publish: '发布作品',
        composeKicker: 'NEW WORK',
        composeTitle: '发布作品',
        composeHint: '发布后会创建独立公开快照；私人原稿与公开版本互不覆盖。',
        fieldTitle: '作品标题',
        titlePlaceholder: '给这篇作品一个标题',
        fieldWorld: '关联世界',
        noWorld: '不关联世界',
        fieldBody: '正文',
        bodyPlaceholder: '从一句开场、一个场景或一段对白开始…',
        saveDraft: '保存草稿',
        publishNow: '立即发布',
        cancel: '取消',
        charCount: '字符',
        titleRequired: '请填写作品标题。',
        bodyRequired: '发布需要正文；也可以先保存为草稿。',
        submitting: '正在保存…',
        publishCreated: '作品已发布为社区公开作品。',
        draftCreated: '草稿已保存，可在社区创作动态中继续编辑。',
        createFailed: '发布失败，请稍后重试。',
        searchPlaceholder: '搜索作品、世界、角色、剧情…',
        all: '全部',
        works: '作品',
        worlds: '世界',
        characters: 'OC',
        storylines: '剧情',
        resultUnit: '条内容',
        noResults: '没有找到匹配内容',
        noResultsHint: '换一个关键词，或切换分类继续发现。',
        clear: '清除筛选',
        recommended: '我的写作库',
        recommendedKicker: 'LOCAL WRITING LIBRARY',
        read: '阅读作品',
        openWorkbench: '在写作页打开',
        share: '分享',
        shared: '社区链接已复制',
        shareManual: '自动复制未获授权，请手动复制以下链接。',
        words: '字',
        draft: '草稿',
        published: '已发布',
        architect: '推演生成',
        explorer: '手写',
        updatedAt: '更新于',
        worldZone: '世界专区',
        worldZoneKicker: 'WORLDS & CIVILIZATIONS',
        enterWorld: '进入世界',
        openCharacters: '查看人物',
        characterCount: '位人物',
        storyCount: '个剧情',
        ocZone: 'OC 专区',
        ocZoneKicker: 'ORIGINAL CHARACTERS',
        viewAllOcs: '查看全部 OC',
        storyZone: '剧情专区',
        storyZoneKicker: 'STORIES & STORYLINES',
        openStoryline: '查看剧情',
        creationFeed: '创作动态',
        creationFeedKicker: 'RECENT UPDATES',
        following: '关注动态',
        followingKicker: 'FOLLOWING',
        followingCount: '关注',
        followerCount: '粉丝',
        followingEmpty: '还没有关注关系',
        followingHint: '当前为单用户本地空间，关注动态会在互动模块接入后出现。',
        activeUpdates: '近期更新',
        creatorZone: '创作者专区',
        creatorZoneKicker: 'CREATOR PROFILE',
        creatorWorks: '创作者作品',
        creatorSince: '加入于',
        identityCenter: '进入个人中心',
        hotZone: '热门榜单',
        hotZoneKicker: 'TRENDING',
        hotWorks: '作品榜',
        hotCharacters: '角色榜',
        hotWorlds: '世界榜',
        waitingData: '等待互动数据',
        hotHint: '点赞、评论与收藏数据接入后，这里会生成真实榜单。',
        coCreateZone: '共创专区',
        coCreateKicker: 'CO-CREATION',
        coCreateEmpty: '暂无开放中的共创项目',
        coCreateHint: '协作、招募与项目版本将在共创模块接入后开放。',
        noWorks: '还没有作品',
        noWorksHint: '发布第一篇作品后，推荐与动态会出现在这里。',
        noWorlds: '还没有世界',
        noOcs: '还没有 OC',
        noStories: '还没有剧情项目',
        readerBy: '创作者',
        readerStatus: '状态',
        readerMode: '创作方式',
        readerWords: '字数',
        readerUpdated: '最近更新',
        socialNote: '点赞、评论与收藏将在互动模块开放；当前可阅读与分享真实作品。',
        close: '关闭',
        contents: '全部内容',
        permissionKicker: 'PERMISSIONS',
        permissionTitle: '作者内容权限',
        permissionHint: '普通体验展示你允许公开的内容；灵果体验需明确开启，并填写消耗数量与深度内容。消耗数量留空即不开放收费体验。',
        publicContent: '普通公开内容',
        enableExperience: '开放灵果体验',
        experienceFruit: '灵果消耗数量',
        experienceContent: '深度体验内容',
        experienceContentPlaceholder: '灵果体验用户进入后将看到的深度内容…',
        pricePending: '未填写消耗数量，灵果体验暂不开放',
        loading: '正在读取社区内容…',
      }
    : {
        eyebrow: 'CONTENT COMMUNITY',
        title: 'Content Community',
        subtitle: 'Discover worlds, characters, and stories, and keep imagining with creators.',
        publish: 'Publish work',
        composeKicker: 'NEW WORK',
        composeTitle: 'Publish a work',
        composeHint: 'Publishing creates an immutable public snapshot; the private draft is never overwritten.',
        fieldTitle: 'Title',
        titlePlaceholder: 'Give this work a title',
        fieldWorld: 'World',
        noWorld: 'No world',
        fieldBody: 'Body',
        bodyPlaceholder: 'Start with a line, a scene, or a piece of dialogue…',
        saveDraft: 'Save draft',
        publishNow: 'Publish now',
        cancel: 'Cancel',
        charCount: 'characters',
        titleRequired: 'Please enter a title.',
        bodyRequired: 'Publishing needs a body. You can save a draft instead.',
        submitting: 'Saving…',
        publishCreated: 'Work published as a public community snapshot.',
        draftCreated: 'Draft saved. Continue from the creation feed.',
        createFailed: 'Publish failed. Please try again.',
        searchPlaceholder: 'Search works, worlds, characters, storylines…',
        all: 'All',
        works: 'Works',
        worlds: 'Worlds',
        characters: 'OCs',
        storylines: 'Storylines',
        resultUnit: 'items',
        noResults: 'No matching content',
        noResultsHint: 'Try another keyword or switch category.',
        clear: 'Clear filters',
        recommended: 'My writing library',
        recommendedKicker: 'LOCAL WRITING LIBRARY',
        read: 'Read work',
        openWorkbench: 'Open in writing',
        share: 'Share',
        shared: 'Community link copied',
        shareManual: 'Automatic copy was blocked. Copy the link below manually.',
        words: 'words',
        draft: 'Draft',
        published: 'Published',
        architect: 'Simulation-generated',
        explorer: 'Handwritten',
        updatedAt: 'Updated',
        worldZone: 'World zone',
        worldZoneKicker: 'WORLDS & CIVILIZATIONS',
        enterWorld: 'Enter world',
        openCharacters: 'View characters',
        characterCount: 'characters',
        storyCount: 'storylines',
        ocZone: 'OC zone',
        ocZoneKicker: 'ORIGINAL CHARACTERS',
        viewAllOcs: 'View all OCs',
        storyZone: 'Story zone',
        storyZoneKicker: 'STORIES & STORYLINES',
        openStoryline: 'View story',
        creationFeed: 'Creation feed',
        creationFeedKicker: 'RECENT UPDATES',
        following: 'Following feed',
        followingKicker: 'FOLLOWING',
        followingCount: 'Following',
        followerCount: 'Followers',
        followingEmpty: 'No following relationships yet',
        followingHint: 'This is a single-user local space. Following activity will appear when social features are connected.',
        activeUpdates: 'Recent updates',
        creatorZone: 'Creator zone',
        creatorZoneKicker: 'CREATOR PROFILE',
        creatorWorks: 'Creator works',
        creatorSince: 'Joined',
        identityCenter: 'Open identity center',
        hotZone: 'Trending',
        hotZoneKicker: 'TRENDING',
        hotWorks: 'Works',
        hotCharacters: 'Characters',
        hotWorlds: 'Worlds',
        waitingData: 'Waiting for activity data',
        hotHint: 'Real rankings will be generated once likes, comments, and favorites are connected.',
        coCreateZone: 'Co-creation',
        coCreateKicker: 'CO-CREATION',
        coCreateEmpty: 'No open co-creation projects',
        coCreateHint: 'Collaboration, recruitment, and project versions will open with the co-creation module.',
        noWorks: 'No works yet',
        noWorksHint: 'Publish your first work and picks and updates will appear here.',
        noWorlds: 'No worlds yet',
        noOcs: 'No OCs yet',
        noStories: 'No story projects yet',
        readerBy: 'Creator',
        readerStatus: 'Status',
        readerMode: 'Mode',
        readerWords: 'Length',
        readerUpdated: 'Updated',
        socialNote: 'Likes, comments, and favorites will open with social features. Real works can be read and shared now.',
        close: 'Close',
        contents: 'All content',
        permissionKicker: 'PERMISSIONS',
        permissionTitle: 'Author content permissions',
        permissionHint: 'Normal experience shows the content you allow publicly; spirit-fruit experience requires an explicit toggle plus a cost and deep content. Leave the cost empty to keep it unpaid.',
        publicContent: 'Public content',
        enableExperience: 'Open spirit-fruit experience',
        experienceFruit: 'Spirit-fruit cost',
        experienceContent: 'Deep experience content',
        experienceContentPlaceholder: 'The deep content spirit-fruit users will see…',
        pricePending: 'No cost set, spirit-fruit experience is not open',
        loading: 'Loading community content…',
      }
}

function formatDate(value: string | null | undefined, lang: Lang) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric' })
}

function excerpt(value: string, limit = 170) {
  return value.replace(/\s+/g, ' ').trim().slice(0, limit)
}

function readCreatorIdentity(userId: string): string {
  try {
    const raw = localStorage.getItem(`ws.user.profile.v1.${userId}`)
    const parsed = raw ? JSON.parse(raw) : null
    return CREATOR_IDENTITY_LABELS[parsed?.creatorIdentity] ? parsed.creatorIdentity : 'world'
  } catch {
    return 'world'
  }
}

async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value)
      return true
    }
  } catch {
    /* continue to legacy copy */
  }
  try {
    const area = document.createElement('textarea')
    area.value = value
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    area.style.pointerEvents = 'none'
    document.body.appendChild(area)
    area.select()
    const copied = document.execCommand('copy')
    area.remove()
    return copied
  } catch {
    return false
  }
}

function parseProfile(row: any): Record<string, any> {
  if (row?.basic_profile && typeof row.basic_profile === 'object') return row.basic_profile
  if (typeof row?.basic_profile === 'string') {
    try { return JSON.parse(row.basic_profile) } catch { return {} }
  }
  return row || {}
}

export default function CommunityPage({
  lang,
  user,
  onOpenWorkbench,
  onOpenWorld,
  onOpenCharacters,
  onOpenStorylines,
  onOpenIdentity,
  onOpenChat,
  onOpenRelationships,
  onOpenEvents,
  onOpenMemories,
  onOpenSimulation,
}: {
  lang: Lang
  user: AuthUser | null
  onOpenWorkbench: () => void
  onOpenWorld: () => void
  onOpenCharacters: () => void
  onOpenStorylines: () => void
  onOpenIdentity: () => void
  onOpenChat?: (worldId: string, characterId?: string) => void
  onOpenRelationships?: () => void
  onOpenEvents?: () => void
  onOpenMemories?: () => void
  onOpenSimulation?: () => void
}) {
  const copy = text(lang)
  const [quadNotice, setQuadNotice] = useState('')
  const [works, setWorks] = useState<StoryItem[] | null>(null)
  const [worlds, setWorlds] = useState<World[]>([])
  const [characters, setCharacters] = useState<CharacterCard[]>([])
  const [stories, setStories] = useState<StoryProject[]>([])
  const [tab, setTab] = useState<CommunityTab>('all')
  // 分区可见性：'all' 显示全部；其余页签只显示对应分区（区块保留在 DOM，不重挂载数据）。
  const shows = (key: CommunityTab) => tab === 'all' || tab === key
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<CommunityFilter>('all')
  const [detailTarget, setDetailTarget] = useState<CommunityDetailTarget | null>(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const [composeTitle, setComposeTitle] = useState('')
  const [composeContent, setComposeContent] = useState('')
  const [composeWorldId, setComposeWorldId] = useState('')
  const [composeStatus, setComposeStatus] = useState<'draft' | 'published'>('published')
  const [composeSubmitting, setComposeSubmitting] = useState(false)
  const [composeError, setComposeError] = useState('')
  const [composePublicVisible, setComposePublicVisible] = useState(true)
  const [composeExperienceEnabled, setComposeExperienceEnabled] = useState(false)
  const [composeExperienceFruit, setComposeExperienceFruit] = useState('')
  const [composeExperienceContent, setComposeExperienceContent] = useState('')
  const [publishNotice, setPublishNotice] = useState('')
  const [shareState, setShareState] = useState<'idle' | 'copied' | 'manual'>('idle')
  const [loaded, setLoaded] = useState(false)
  const [creatorIdentity] = useState(() => readCreatorIdentity(user?.id || 'local'))

  useEffect(() => {
    let cancelled = false
    void fetch(`${API_ORIGIN}/api/worlds?include_workspace=false`)
      .then((response) => (response.ok ? response.json() : []))
      .then(async (rows) => {
        if (cancelled || !Array.isArray(rows)) return
        const visibleWorlds = rows.filter((world: World) => !world.is_product_workspace)
        const worldNames = new Map(visibleWorlds.map((world: World) => [world.id, world.name]))
        setWorlds(visibleWorlds)
        const projectGroups = await Promise.all(
          visibleWorlds.map((world: World) => listStoryProjects(world.id).catch(() => [])),
        )
        if (!cancelled) setStories(projectGroups.flat())

        const characterResponse = await fetch(`${API_ORIGIN}/api/characters`)
        const characterRows = characterResponse.ok ? await characterResponse.json() : []
        if (cancelled || !Array.isArray(characterRows)) return
        setCharacters(characterRows.map((row: any) => {
          const profile = parseProfile(row)
          return {
            id: String(row.id || profile.code || profile.name || ''),
            name: String(profile.name || row.name || '未命名角色'),
            worldId: String(row.world_id || ''),
            worldName: worldNames.get(row.world_id) || String(profile.world || ''),
            role: String(profile.role || profile.identity || '原创角色'),
            intro: String(profile.intro || profile.description || profile.background || ''),
          }
        }).filter((row: CharacterCard) => row.id))
        setLoaded(true)
      })
      .catch(() => undefined)

    void listStories()
      .then((rows) => {
        if (cancelled || !Array.isArray(rows)) return
        setWorks([...rows].sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || ''))))
      })
      .catch(() => undefined)

    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!detailTarget) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDetailTarget(null)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [detailTarget])

  useEffect(() => {
    if (!composerOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !composeSubmitting) setComposerOpen(false)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [composerOpen, composeSubmitting])

  useEffect(() => {
    if (shareState !== 'copied') return
    const timer = window.setTimeout(() => setShareState('idle'), 2600)
    return () => window.clearTimeout(timer)
  }, [shareState])

  useEffect(() => {
    if (!publishNotice) return
    const timer = window.setTimeout(() => setPublishNotice(''), 2800)
    return () => window.clearTimeout(timer)
  }, [publishNotice])

  const worldNames = useMemo(() => new Map(worlds.map((world) => [world.id, world.name])), [worlds])
  const creatorTitle = (CREATOR_IDENTITY_LABELS[creatorIdentity] || CREATOR_IDENTITY_LABELS.world)[lang]

  const featured = useMemo(() => {
    if (!works || works.length === 0) return null
    return [...works].sort((a, b) => (b.word_count - a.word_count) || String(b.updated_at).localeCompare(String(a.updated_at)))[0]
  }, [works])

  const sidePicks = useMemo(() => {
    if (!works || works.length < 2) return []
    return works.filter((work) => work.id !== featured?.id).slice(0, 2)
  }, [works, featured])

  const results = useMemo<SearchResult[]>(() => {
    const needle = query.trim().toLowerCase()
    const match = (value: string) => !needle || value.toLowerCase().includes(needle)
    const rows: SearchResult[] = []
    if (filter === 'all' || filter === 'works') {
      for (const work of works || []) {
        const summary = excerpt(work.plain_text || work.content, 140)
        if (match(`${work.title} ${summary}`)) {
          rows.push({
            id: work.id,
            type: 'works',
            title: work.title,
            summary: summary || (lang === 'zh' ? '正文尚未填写' : 'No content yet'),
            meta: `${work.word_count} ${copy.words} · ${work.status === 'published' ? copy.published : copy.draft}`,
            updated: work.updated_at,
            work,
          })
        }
      }
    }
    if (filter === 'all' || filter === 'worlds') {
      for (const world of worlds) {
        if (match(`${world.name} ${world.description} ${world.background}`)) {
          rows.push({
            id: world.id,
            type: 'worlds',
            title: world.name,
            summary: excerpt(world.description || world.background, 140),
            meta: (WORLD_TYPE_LABELS[world.type] || { zh: world.type, en: world.type })[lang],
            updated: world.updatedAt || world.createdAt,
          })
        }
      }
    }
    if (filter === 'all' || filter === 'characters') {
      for (const character of characters) {
        if (match(`${character.name} ${character.role} ${character.intro} ${character.worldName}`)) {
          rows.push({
            id: character.id,
            type: 'characters',
            title: character.name,
            summary: character.intro,
            meta: `${character.role}${character.worldName ? ` · ${character.worldName}` : ''}`,
            updated: '',
            worldId: character.worldId,
          })
        }
      }
    }
    if (filter === 'all' || filter === 'storylines') {
      for (const story of stories) {
        if (match(`${story.title} ${story.premise}`)) {
          rows.push({
            id: story.id,
            type: 'storylines',
            title: story.title,
            summary: story.premise,
            meta: `${STORY_STATUS_LABELS[story.status]?.[lang] || story.status}${worldNames.get(story.world_id) ? ` · ${worldNames.get(story.world_id)}` : ''}`,
            updated: story.created_at || '',
          })
        }
      }
    }
    return rows
  }, [characters, copy.draft, copy.published, copy.words, filter, lang, query, stories, worldNames, works, worlds])

  const searchActive = query.trim().length > 0 || filter !== 'all'
  const allCount = (works?.length || 0) + worlds.length + characters.length + stories.length

  const openResult = (result: SearchResult) => {
    if (result.type === 'works' && result.work) {
      setDetailTarget({ kind: 'story', work: result.work })
    } else if (result.type === 'worlds') {
      setDetailTarget({ kind: 'world', id: result.id, title: result.title, summary: result.summary, meta: result.meta })
    } else if (result.type === 'characters') {
      setDetailTarget({ kind: 'character', id: result.id, title: result.title, summary: result.summary, meta: result.meta, characterId: result.id, worldId: result.worldId || '' })
    } else {
      setDetailTarget({ kind: 'storyline', id: result.id, title: result.title, summary: result.summary, meta: result.meta })
    }
  }

  const openComposer = () => {
    setComposeTitle('')
    setComposeContent('')
    setComposeWorldId(worlds[0]?.id || '')
    setComposeStatus('published')
    setComposeError('')
    setComposePublicVisible(true)
    setComposeExperienceEnabled(false)
    setComposeExperienceFruit('')
    setComposeExperienceContent('')
    setComposerOpen(true)
  }

  const closeComposer = () => {
    if (composeSubmitting) return
    setComposerOpen(false)
    setComposeError('')
  }

  const submitWork = async (status: 'draft' | 'published') => {
    if (!composeTitle.trim()) {
      setComposeError(copy.titleRequired)
      return
    }
    if (status === 'published' && !composeContent.trim()) {
      setComposeError(copy.bodyRequired)
      return
    }
    setComposeSubmitting(true)
    setComposeError('')
    try {
      if (status === 'published') {
        await publishDirect({
          title: composeTitle.trim(),
          content: composeContent,
          work_type: 'diary_essay',
          anonymous: false,
          public_visible: composePublicVisible,
          experience_enabled: composeExperienceEnabled,
          experience_fruit: composeExperienceFruit === '' ? null : Number(composeExperienceFruit),
          experience_snapshot: composeExperienceContent.trim()
            ? { kind: 'direct', items: [{ title: '深度体验', content: composeExperienceContent }] }
            : null,
        })
        setPublishNotice(copy.publishCreated)
      } else {
        const draft = await createStory({
          world_id: composeWorldId || undefined,
          title: composeTitle.trim(),
          content: composeContent,
          plain_text: composeContent,
          mode: 'explorer',
          status: 'draft',
        })
        setWorks((current) => [draft, ...(current || [])])
        setPublishNotice(copy.draftCreated)
      }
      setComposerOpen(false)
      setComposeSubmitting(false)
    } catch (error) {
      setComposeError(error instanceof Error ? error.message : copy.createFailed)
      setComposeSubmitting(false)
    }
  }

  const communityUrl = `${window.location.origin}${window.location.pathname}?page=community`
  const shareCommunity = async () => {
    setShareState(await copyText(communityUrl) ? 'copied' : 'manual')
  }

  const runQuad = async (targetType: 'world' | 'character' | 'storyline', targetId: string) => {
    setQuadNotice('')
    try {
      await quadCheer(targetType, targetId)
      setQuadNotice(lang === 'zh' ? '已点赞、收藏、推荐并送上打赏鼓励（不消耗灵果）' : 'Liked, saved, recommended and cheered (no fruit spent)')
    } catch (reason) {
      setQuadNotice(reason instanceof Error ? reason.message : (lang === 'zh' ? '一键四连失败' : 'Quad failed'))
    }
  }

  const openWork = (work: StoryItem) => {
    setShareState('idle')
    setDetailTarget({ kind: 'story', work })
  }

  const filterItems: Array<{ key: CommunityFilter; label: string; count: number }> = [
    { key: 'all', label: copy.all, count: allCount },
    { key: 'works', label: copy.works, count: works?.length || 0 },
    { key: 'worlds', label: copy.worlds, count: worlds.length },
    { key: 'characters', label: copy.characters, count: characters.length },
    { key: 'storylines', label: copy.storylines, count: stories.length },
  ]

  return (
    <div className="cm-content">
      {quadNotice ? <div className="cm-notice cm-notice--ok">{quadNotice}</div> : null}
      <section className="cm-hero">
        <div className="cm-hero-copy">
          <div className="cm-eyebrow">{copy.eyebrow}</div>
          <h1>{copy.title}</h1>
          <p>{copy.subtitle}</p>
        </div>
        <div className="cm-hero-actions">
          <div className="cm-hero-stats">
            <div><strong>{works?.length ?? '—'}</strong><span>{copy.works}</span></div>
            <div><strong>{loaded ? worlds.length : '—'}</strong><span>{copy.worlds}</span></div>
            <div><strong>{loaded ? characters.length : '—'}</strong><span>{copy.characters}</span></div>
            <div><strong>{loaded ? stories.length : '—'}</strong><span>{copy.storylines}</span></div>
          </div>
          <button type="button" className="cm-primary" onClick={openComposer}>
            <PenLine aria-hidden="true" strokeWidth={1.7} />
            {copy.publish}
          </button>
        </div>
      </section>

      <CommunityPublicWorks key={publishNotice} onOpen={(work) => setDetailTarget({ kind: 'publication', work })} />

      <section className="cm-toolbar" aria-label={copy.contents}>
        <div className="cm-search">
          <Search aria-hidden="true" strokeWidth={1.7} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={copy.searchPlaceholder}
            aria-label={copy.searchPlaceholder}
          />
          {query && (
            <button type="button" className="cm-search-clear" onClick={() => setQuery('')} aria-label={copy.clear}>
              <X aria-hidden="true" strokeWidth={1.8} />
            </button>
          )}
        </div>
        <div className="cm-filters">
          {filterItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`cm-filter${filter === item.key ? ' active' : ''}`}
              onClick={() => setFilter(item.key)}
            >
              {item.label}
              <span>{item.count}</span>
            </button>
          ))}
        </div>
        <div className="cm-toolbar-meta">
          {searchActive ? `${results.length} ${copy.resultUnit}` : `${allCount} ${copy.resultUnit}`}
          {searchActive && (
            <button type="button" onClick={() => { setQuery(''); setFilter('all') }}>{copy.clear}</button>
          )}
        </div>
      </section>

      {searchActive ? (
        <section className="cm-results" aria-live="polite">
          {results.length === 0 ? (
            <div className="cm-empty large">
              <Compass aria-hidden="true" strokeWidth={1.4} />
              <strong>{copy.noResults}</strong>
              <p>{copy.noResultsHint}</p>
            </div>
          ) : (
            <div className="cm-result-grid">
              {results.map((result) => (
                <button type="button" className="cm-result-card" key={`${result.type}-${result.id}`} onClick={() => openResult(result)}>
                  <div className="cm-result-top">
                    <span className={`cm-type ${result.type}`}>{copy[result.type]}</span>
                    {result.updated && <span>{formatDate(result.updated, lang)}</span>}
                  </div>
                  <strong>{result.title}</strong>
                  <p>{result.summary || '—'}</p>
                  <div className="cm-result-foot">
                    <span>{result.meta || '—'}</span>
                    <ArrowUpRight aria-hidden="true" strokeWidth={1.8} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      ) : (
        <div className="cm-discovery" data-tab={tab}>
          <div className="cm-tabs" role="tablist" aria-label={lang === 'zh' ? '内容分区' : 'Content sections'}>
            {COMMUNITY_TABS.map((item) => (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={tab === item.key}
                className={`cm-tab${tab === item.key ? ' is-active' : ''}`}
                onClick={() => setTab(item.key)}
              >
                {lang === 'zh' ? item.zh : item.en}
              </button>
            ))}
          </div>
          <section className="cm-section cm-recommend" hidden={!shows('works')}>
            <div className="cm-section-head">
              <div>
                <span className="cm-kicker">{copy.recommendedKicker}</span>
                <h2>{copy.recommended}</h2>
              </div>
              <Sparkles aria-hidden="true" strokeWidth={1.5} />
            </div>
            {works === null ? (
              <div className="cm-loading">{copy.loading}</div>
            ) : !featured ? (
              <div className="cm-empty"><BookOpen aria-hidden="true" strokeWidth={1.4} /><strong>{copy.noWorks}</strong><p>{copy.noWorksHint}</p></div>
            ) : (
              <div className="cm-feature-layout">
                <article className="cm-feature-card">
                  <div className="cm-feature-cover">
                    <span className="cm-type works">{copy.works}</span>
                    <span>{formatDate(featured.updated_at, lang)}</span>
                  </div>
                  <div className="cm-feature-body">
                    <div className="cm-feature-meta">
                      <span>{featured.word_count} {copy.words}</span>
                      <span>{featured.status === 'published' ? copy.published : copy.draft}</span>
                      <span>{featured.mode === 'architect' ? copy.architect : copy.explorer}</span>
                    </div>
                    <h3>{featured.title}</h3>
                    <p>{excerpt(featured.plain_text || featured.content, 250) || copy.noWorksHint}</p>
                    <div className="cm-feature-actions">
                      <button type="button" className="cm-primary" onClick={() => openWork(featured)}>
                        <BookOpen aria-hidden="true" strokeWidth={1.7} />
                        {copy.read}
                      </button>
                      <button type="button" className="cm-ghost" onClick={() => void shareCommunity()}>
                        <Share2 aria-hidden="true" strokeWidth={1.7} />
                        {copy.share}
                      </button>
                    </div>
                  </div>
                </article>
                <div className="cm-side-picks">
                  <div className="cm-side-picks-title">{copy.activeUpdates}</div>
                  {sidePicks.length === 0 ? (
                    <div className="cm-inline-empty">{copy.noWorksHint}</div>
                  ) : sidePicks.map((work, index) => (
                    <button type="button" className="cm-pick" key={work.id} onClick={() => openWork(work)}>
                      <span className="cm-pick-index">{String(index + 2).padStart(2, '0')}</span>
                      <span className="cm-pick-copy">
                        <strong>{work.title}</strong>
                        <span>{work.word_count} {copy.words} · {formatDate(work.updated_at, lang)}</span>
                      </span>
                      <ArrowUpRight aria-hidden="true" strokeWidth={1.8} />
                    </button>
                  ))}
                  <button type="button" className="cm-text-link" onClick={onOpenWorkbench}>
                    {copy.openWorkbench} <ArrowUpRight aria-hidden="true" strokeWidth={1.8} />
                  </button>
                </div>
              </div>
            )}
          </section>

          <div className="cm-two-col" hidden={!(shows('worlds') || shows('ocs'))}>
            <section className="cm-section cm-world-zone" hidden={!shows('worlds')}>
              <div className="cm-section-head">
                <div>
                  <span className="cm-kicker">{copy.worldZoneKicker}</span>
                  <h2>{copy.worldZone}</h2>
                </div>
                <Globe2 aria-hidden="true" strokeWidth={1.5} />
              </div>
              {worlds.length === 0 ? (
                <div className="cm-empty"><Globe2 aria-hidden="true" strokeWidth={1.4} /><strong>{copy.noWorlds}</strong></div>
              ) : worlds.map((world) => (
                <CommunityWorkCard
                  key={world.id}
                  lang={lang}
                  type="worlds"
                  typeLabel={(WORLD_TYPE_LABELS[world.type] || { zh: world.type, en: world.type })[lang]}
                  title={world.name}
                  author={user?.display_name}
                  meta={`${characters.filter((character) => character.worldId === world.id).length} ${copy.characterCount}`}
                  content={excerpt([String(world.description || ''), String(world.background || '')].filter(Boolean).join(' '), 150)}
                  entryLabel={copy.enterWorld}
                  onOpen={() => setDetailTarget({ kind: 'world', id: world.id, title: world.name, summary: excerpt(String(world.description || world.background || ''), 150), meta: (WORLD_TYPE_LABELS[world.type] || { zh: world.type, en: world.type })[lang] })}
                  onQuad={() => void runQuad('world', world.id)}
                />
              ))}
            </section>

            <section className="cm-section cm-oc-zone" hidden={!shows('ocs')}>
              <div className="cm-section-head">
                <div>
                  <span className="cm-kicker">{copy.ocZoneKicker}</span>
                  <h2>{copy.ocZone}</h2>
                </div>
                <button type="button" className="cm-section-link" onClick={onOpenCharacters}>
                  {copy.viewAllOcs} <ArrowUpRight aria-hidden="true" strokeWidth={1.8} />
                </button>
              </div>
              {characters.length === 0 ? (
                <div className="cm-empty"><UserRound aria-hidden="true" strokeWidth={1.4} /><strong>{copy.noOcs}</strong></div>
              ) : (
                <div className="cm-oc-grid">
                  {characters.slice(0, 6).map((character) => (
                    <CommunityWorkCard
                      key={character.id}
                      lang={lang}
                      type="characters"
                      typeLabel={copy.characters}
                      title={character.name}
                      author={user?.display_name}
                      meta={character.role}
                      content={excerpt(character.intro || character.worldName, 150)}
                      entryLabel={copy.openCharacters}
                      onOpen={() => setDetailTarget({ kind: 'character', id: character.id, title: character.name, summary: excerpt(character.intro, 150), meta: character.role, characterId: character.id, worldId: character.worldId })}
                      onQuad={() => void runQuad('character', character.id)}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="cm-two-col cm-two-col-wide" hidden={!(shows('stories') || shows('works'))}>
            <section className="cm-section cm-story-zone" hidden={!shows('stories')}>
              <div className="cm-section-head">
                <div>
                  <span className="cm-kicker">{copy.storyZoneKicker}</span>
                  <h2>{copy.storyZone}</h2>
                </div>
                <Route aria-hidden="true" strokeWidth={1.5} />
              </div>
              {stories.length === 0 ? (
                <div className="cm-empty"><Route aria-hidden="true" strokeWidth={1.4} /><strong>{copy.noStories}</strong></div>
              ) : stories.slice(0, 3).map((story) => (
                <CommunityWorkCard
                  key={story.id}
                  lang={lang}
                  type="storylines"
                  typeLabel={copy.storylines}
                  title={story.title}
                  author={user?.display_name}
                  meta={worldNames.get(story.world_id) || STORY_STATUS_LABELS[story.status]?.[lang] || story.status}
                  content={excerpt(story.premise, 150)}
                  entryLabel={copy.openStoryline}
                  onOpen={() => setDetailTarget({ kind: 'storyline', id: story.id, title: story.title, summary: excerpt(story.premise, 150), meta: STORY_STATUS_LABELS[story.status]?.[lang] || story.status })}
                  onQuad={() => void runQuad('storyline', story.id)}
                />
              ))}
            </section>

            <section className="cm-section cm-feed" hidden={!shows('works')}>
              <div className="cm-section-head">
                <div>
                  <span className="cm-kicker">{copy.creationFeedKicker}</span>
                  <h2>{copy.creationFeed}</h2>
                </div>
                <LayoutGrid aria-hidden="true" strokeWidth={1.5} />
              </div>
              {!works || works.length === 0 ? (
                <div className="cm-empty"><BookOpen aria-hidden="true" strokeWidth={1.4} /><strong>{copy.noWorks}</strong></div>
              ) : (
                <div className="cm-feed-list">
                  {works.slice(0, 3).map((work) => (
                    <button type="button" className="cm-feed-row" key={work.id} onClick={() => openWork(work)}>
                      <span className="cm-feed-icon"><BookOpen aria-hidden="true" strokeWidth={1.6} /></span>
                      <span className="cm-feed-copy">
                        <strong>{work.title}</strong>
                        <span>{work.status === 'published' ? copy.published : copy.draft} · {work.word_count} {copy.words}</span>
                      </span>
                      <span className="cm-feed-date">{formatDate(work.updated_at, lang)}</span>
                      <ArrowUpRight aria-hidden="true" strokeWidth={1.8} />
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="cm-two-col cm-two-col-wide cm-creator-row is-single" hidden={!shows('creators')}>
            <section className="cm-section cm-creator-zone">
              <div className="cm-section-head">
                <div>
                  <span className="cm-kicker">{copy.creatorZoneKicker}</span>
                  <h2>{copy.creatorZone}</h2>
                </div>
                <Sparkles aria-hidden="true" strokeWidth={1.5} />
              </div>
              <div className="cm-creator-profile">
                <span className="cm-creator-avatar">{(user?.display_name || 'U').charAt(0)}</span>
                <div className="cm-creator-copy">
                  <strong>{user?.display_name || (lang === 'zh' ? '本地创作者' : 'Local creator')}</strong>
                  <span>{creatorTitle}</span>
                  <p>{user?.created_at ? `${copy.creatorSince} ${formatDate(user.created_at, lang)}` : '—'}</p>
                </div>
                <button type="button" className="cm-ghost" onClick={onOpenIdentity}>
                  {copy.identityCenter} <ArrowUpRight aria-hidden="true" strokeWidth={1.8} />
                </button>
              </div>
              <div className="cm-creator-works">
                <span>{copy.creatorWorks}</span>
                {!works || works.length === 0 ? (
                  <div className="cm-inline-empty">{copy.noWorks}</div>
                ) : works.slice(0, 3).map((work) => (
                  <button type="button" key={work.id} onClick={() => openWork(work)}>
                    <strong>{work.title}</strong>
                    <span>{work.word_count} {copy.words}</span>
                  </button>
                ))}
              </div>
            </section>

          </div>

          <section className="cm-soon" aria-label={lang === 'zh' ? '筹备中' : 'In progress'} hidden={!shows('creators')}>
            <div className="cm-section-head">
              <div>
                <span className="cm-kicker">{copy.followingKicker}</span>
                <h2>{lang === 'zh' ? '关注动态 · 热门榜单 · 共创专区' : 'Following · Rankings · Co-creation'}</h2>
              </div>
              <Handshake aria-hidden="true" strokeWidth={1.5} />
            </div>
            <p>
              {lang === 'zh'
                ? '这三块能力尚未上线，不再展示 0 值占位。上线前空状态由此行说明，避免页面长期停留在“全是空卡片”。'
                : 'These features are not live yet, so no zero-value placeholders are shown. This single line replaces the empty cards.'}
            </p>
          </section>
        </div>
      )}

      {detailTarget && (
        <CommunityWorkDetail
          lang={lang}
          user={user}
          target={detailTarget}
          onClose={() => setDetailTarget(null)}
          onOpenWorkbench={onOpenWorkbench}
          onOpenWorld={onOpenWorld}
          onOpenCharacters={onOpenCharacters}
          onOpenStorylines={onOpenStorylines}
          onOpenChat={onOpenChat}
          onOpenRelationships={onOpenRelationships}
          onOpenEvents={onOpenEvents}
          onOpenMemories={onOpenMemories}
          onOpenSimulation={onOpenSimulation}
        />
      )}

      {composerOpen && (
        <div className="cm-modal-backdrop" onClick={closeComposer}>
          <form
            className="cm-composer"
            role="dialog"
            aria-modal="true"
            aria-label={copy.composeTitle}
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => { event.preventDefault(); void submitWork(composeStatus) }}
          >
            <header className="cm-composer-head">
              <div>
                <span className="cm-kicker">{copy.composeKicker}</span>
                <h2>{copy.composeTitle}</h2>
                <p>{copy.composeHint}</p>
              </div>
              <button type="button" className="cm-modal-close" onClick={closeComposer} aria-label={copy.cancel}>
                <X aria-hidden="true" strokeWidth={1.8} />
              </button>
            </header>
            <div className="cm-composer-body">
              <label className="cm-field">
                <span>{copy.fieldTitle}</span>
                <input
                  value={composeTitle}
                  onChange={(event) => setComposeTitle(event.target.value)}
                  placeholder={copy.titlePlaceholder}
                  maxLength={80}
                  autoFocus
                />
              </label>
              <label className="cm-field">
                <span>{copy.fieldWorld}</span>
                <select value={composeWorldId} onChange={(event) => setComposeWorldId(event.target.value)}>
                  <option value="">{copy.noWorld}</option>
                  {worlds.map((world) => <option key={world.id} value={world.id}>{world.name}</option>)}
                </select>
              </label>
              <label className="cm-field cm-field-body">
                <span>{copy.fieldBody}</span>
                <textarea
                  value={composeContent}
                  onChange={(event) => setComposeContent(event.target.value)}
                  placeholder={copy.bodyPlaceholder}
                  rows={9}
                />
                <small>{composeContent.length} {copy.charCount}</small>
              </label>
              <div className="cm-field cm-field-body">
                <span>{copy.permissionKicker} · {copy.permissionTitle}</span>
                <p className="cm-notice">{copy.permissionHint}</p>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginTop: 10 }}>
                  <input type="checkbox" checked={composePublicVisible} onChange={(event) => setComposePublicVisible(event.target.checked)} />
                  <span>{copy.publicContent}</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginTop: 8 }}>
                  <input type="checkbox" checked={composeExperienceEnabled} onChange={(event) => setComposeExperienceEnabled(event.target.checked)} />
                  <span>{copy.enableExperience}</span>
                </label>
                {composeExperienceEnabled ? (
                  <>
                    <label className="cm-field" style={{ marginTop: 10 }}>
                      <span>{copy.experienceFruit}</span>
                      <input
                        type="number"
                        min="0"
                        value={composeExperienceFruit}
                        onChange={(event) => setComposeExperienceFruit(event.target.value)}
                        placeholder="0"
                      />
                      <small>{composeExperienceFruit === '' ? copy.pricePending : `${copy.experienceFruit}：${composeExperienceFruit}`}</small>
                    </label>
                    <label className="cm-field cm-field-body" style={{ marginTop: 10 }}>
                      <span>{copy.experienceContent}</span>
                      <textarea
                        value={composeExperienceContent}
                        onChange={(event) => setComposeExperienceContent(event.target.value)}
                        placeholder={copy.experienceContentPlaceholder}
                        rows={4}
                      />
                    </label>
                  </>
                ) : null}
              </div>
              {composeError && <p className="cm-form-error" role="alert">{composeError}</p>}
            </div>
            <footer className="cm-composer-foot">
              <div className="cm-compose-status">
                {(['published', 'draft'] as const).map((status) => (
                  <button
                    type="button"
                    key={status}
                    className={composeStatus === status ? 'active' : ''}
                    onClick={() => setComposeStatus(status)}
                  >
                    {status === 'published' ? copy.publishNow : copy.saveDraft}
                  </button>
                ))}
              </div>
              <div className="cm-compose-actions">
                <button type="button" className="cm-ghost" onClick={closeComposer} disabled={composeSubmitting}>{copy.cancel}</button>
                <button type="submit" className="cm-primary" disabled={composeSubmitting}>
                  <PenLine aria-hidden="true" strokeWidth={1.7} />
                  {composeSubmitting ? copy.submitting : composeStatus === 'published' ? copy.publishNow : copy.saveDraft}
                </button>
              </div>
            </footer>
          </form>
        </div>
      )}

      {publishNotice && (
        <div className="cm-toast" role="status">{publishNotice}</div>
      )}

      {shareState === 'copied' && (
        <div className="cm-toast" role="status">{copy.shared}</div>
      )}

      {shareState === 'manual' && (
        <div className="cm-share-panel" role="dialog" aria-label={copy.share}>
          <div>
            <strong>{copy.share}</strong>
            <span>{copy.shareManual}</span>
          </div>
          <input readOnly autoFocus value={communityUrl} onClick={(event) => event.currentTarget.select()} aria-label={copy.share} />
          <button type="button" onClick={() => setShareState('idle')} aria-label={copy.close}>
            <X aria-hidden="true" strokeWidth={1.8} />
          </button>
        </div>
      )}
    </div>
  )
}
