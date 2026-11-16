import { useEffect, useMemo, useRef, useState } from 'react' 
import { Cloud, PanelLeftClose, PanelLeftOpen, Sparkles } from 'lucide-react'
import './App.css'
import './styles/creation-center.css'
import WorldsPage from './pages/WorldsPage'
import WorldBuildingPage from './pages/WorldBuildingPage'
import CharacterListPage from './pages/CharacterListPage' 
import RelationshipsPage from './pages/RelationshipsPage'
import UnifiedTimelinePage from './pages/UnifiedTimelinePage'
import ErrorBoundary from './components/ErrorBoundary'
import AiAccessModal from './components/AiAccessModal'
import { hasPersonalAiKey } from './api/aiSettings'
import { getAllWorlds } from './services/worldService'
import { checkBackendHealth } from "./api/client";
import EventsPage from './pages/EventsPage'
import SimulationPage from './pages/SimulationPage'
import MultiPathPage from './pages/MultiPathPage'
import StorylinePage from './pages/StorylinePage'
import ChatPage from './pages/ChatPage'
import WritingPage from './pages/WritingPage'
import SimulationWritingPage from './pages/SimulationWritingPage'
import WorldDataPage from './pages/WorldDataPage'
import WorldStructurePage from './pages/WorldStructurePage'
import ArchivePage from './pages/ArchivePage'
import CreatorAssetsPage from './pages/CreatorAssetsPage'
import TrashPage from './pages/TrashPage'
import JournalPage from './pages/JournalPage'
import { authLogout, type AuthUser } from './api/auth'
import { resolveMediaUrl } from './api/media'
import { AUTH_USER_KEY } from './api/authToken'
import TimeMachinePage from './pages/TimeMachinePage'
import AIAssistantPanel from './components/AIAssistantPanel'
import { setAssistantPage } from './api/assistantContext'
import PersonaPage from './pages/PersonaPage'
import YunbaoWorkspacePage from './pages/YunbaoWorkspacePage'
import YunbaoSeedPage from './pages/YunbaoSeedPage'
import MemoryPage from './pages/MemoryPage'
import CompanionRuntimePage from './pages/CompanionRuntimePage'
import InformationSourcesPage from './pages/InformationSourcesPage'
import CreationCenterPage, { type CreationAssetKey, type CreationToolKey } from './pages/CreationCenterPage'
import CreationCenterSidebar, { type HomeNavTarget } from './components/creation-center/CreationCenterSidebar'
import CreationCenterTopbar from './components/creation-center/CreationCenterTopbar'
import YunbaoOverviewPage from './components/creation-center/YunbaoOverviewPage'
import YunbaoGroupNav from './components/creation-center/YunbaoGroupNav'
import ProductWorkspaceNav from './components/workspace/ProductWorkspaceNav'
import ProductWorkspaceHome from './pages/ProductWorkspaceHome'
import UserCenterPage, { type UserAssetTarget } from './pages/UserCenterPage'
import CommunityPage from './pages/CommunityPage'
import CommunitySocialPage from './pages/CommunitySocialPage'
import AICenterPage from './pages/AICenterPage'
import GameCenterPage from './pages/GameCenterPage'
import ContentStorePage from './pages/ContentStorePage'
import SettingsPage from './pages/SettingsPage'
import BillingCenterPage from './pages/BillingCenterPage'
import WorksPage from './pages/WorksPage'
import SpiritEconomyPage from './pages/SpiritEconomyPage'
import type { WorkScene } from './api/creativeWorks'
import { getSettings, updateSettings } from './api/settings'
import { applyDocumentLanguage, hasStoredLanguage, loadLanguage, saveLanguage, type Lang } from './i18n'
import { applyExperience } from './utils/experience'
import { ensureProductWorkspace, fetchProductMatrix } from './api/productConfig'
import { FALLBACK_MATRIX, getStoredProduct, navigationConfig, productByKey, storeProduct, YUNBAO_HIDDEN_PAGES } from './product/products'
import { localizedProduct, NAV_GROUP_EN, PAGE_LABELS_EN } from './product/labels'
import type { ProductConfig, ProductKey, ProductMatrix } from './product/types'

type PageKey = 
  | 'home'
  | 'user-center'
  | 'community'
  | 'settings'
  | 'community-social'
  | 'business'
  | 'spirit-economy'
  | 'ai-center'
  | 'game-center'
  | 'content-store'
  | 'yunbao'
  | 'workspace-home'
  | 'overview' 
  | 'world-management' 
  | 'character-management' 
  | 'relationships' 
  | 'events' 
  | 'timeline' 
  | 'simulation' 
  | 'multipath'
  | 'storyline'
  | 'chat'
  | 'writing' 
  | 'world-building'
  | 'world-data' 
  | 'world-structure'
  | 'archive'
  | 'trash'
  | 'time-machine'
  | 'diary'
  | 'personas'
  | 'yunbao-seed'
  | 'memories'
  | 'companion-runtime'
  | 'information-sources'
  | 'creator-assets'
  | 'works'

export type Language = 'zh' | 'en'

export const t = {
  zh: {
    overview: '01 世界总览', worldManagement: '02 世界管理', 
    characterManagement: '03 人物管理', relationships: '04 关系与组织', 
    events: '05 事件管理', timeline: '06 时间线',
    simulation: '07 模拟运行', writing: '08 写作辅助', worldBuilding: '世界建设配置', worldStructure: '世界结构',
    workbench: '工作台', worldBuild: '世界构建', simSystem: '模拟与推演',
    dashboard: '世界模拟器 / 仪表盘', overviewDesc: '管理你的世界、人物与事件，观察世界的持续演化。',
    createWorld: '+ 创建世界', worldCount: '世界数量', charCount: '人物数量', eventCount: '事件数量', simCount: '模拟次数',
    createdWorlds: '已创建的模拟世界', builtChars: '已建立的人物档案', recordedEvents: '已记录的世界事件', totalSims: '累计模拟运行次数',
    workspace: '世界工作区', currentWorlds: '当前管理的模拟世界', recentEvents: '最近事件', latestChanges: '世界中发生的最新变化',
    noEvents: '暂无事件记录', noWorlds: '尚未创建世界', createFirstWorld: '创建你的第一个世界，开始配置世界背景、人物与事件。',
    createFirstBtn: '创建第一个世界', devEnv: '开发环境', localWS: '本地工作区', switchLang: '切换到英文'
  },
  en: {
    overview: '01 Overview', worldManagement: '02 Worlds', 
    characterManagement: '03 Characters', relationships: '04 Relations', 
    events: '05 Events', timeline: '06 Timeline',
    simulation: '07 Simulation', writing: '08 Writing', worldBuilding: 'World Config', worldStructure: 'World Structure',
    workbench: 'WORKBENCH', worldBuild: 'BUILDING', simSystem: 'SIMULATION',
    dashboard: 'WORLD SIMULATOR / DASHBOARD', overviewDesc: 'Manage your worlds, characters, and events.',
    createWorld: '+ Create World', worldCount: 'Worlds', charCount: 'Characters', eventCount: 'Events', simCount: 'Simulations',
    createdWorlds: 'Created worlds', builtChars: 'Built characters', recordedEvents: 'Recorded events', totalSims: 'Total simulations',
    workspace: 'World Workspace', currentWorlds: 'Currently managed worlds', recentEvents: 'Recent Events', latestChanges: 'Latest changes',
    noEvents: 'No events recorded', noWorlds: 'No worlds created', createFirstWorld: 'Create your first world.',
    createFirstBtn: 'Create First World', devEnv: 'Dev Env', localWS: 'Local Workspace', switchLang: 'Switch to Chinese'
  }
}

function pageLabel(key: PageKey, dict: Record<string, string>, lang: string): string {
  if (lang === 'en') return PAGE_LABELS_EN[key] || dict[key] || key
  const map: Partial<Record<PageKey, string>> = {
    'user-center': '用户与身份中心 / 个人管理',
    community: '内容社区 / 发现',
    'ai-center': 'AI 互动中心 / 角色与关系',
    'game-center': '游戏体验中心 / 剧情与探索',
    'content-store': '内容商城 / 资产与授权',
    overview: dict.overview,
    'world-building': dict.worldBuilding,
    'world-structure': dict.worldStructure || '世界结构',
    'world-data': '世界设定',
    'world-management': dict.worldManagement,
    'character-management': dict.characterManagement,
    chat: 'AI 角色聊天',
    relationships: dict.relationships,
    events: dict.events,
    timeline: dict.timeline,
    simulation: dict.simulation,
    storyline: '故事线管理',
    writing: dict.writing,
    'archive': '归档库',
    'trash': '回收站',
    'creator-assets': '创作者资产库',
    works: '我的作品',
    'time-machine': '时光机',
    personas: '云宝人格',
    'yunbao-seed': '人物种子编辑器',
    settings: '设置中心',
    'community-social': '社区社交',
    business: '商业与服务中心',
    'spirit-economy': '灵果资源',
    yunbao: '云宝工作台',
    memories: '记忆管理',
    'companion-runtime': '人格运行',
    'information-sources': '信息来源管理',
    diary: '日记与传记',
    'workspace-home': '工作区总览',
  }
  return map[key] || dict[key] || key
}

const initialParams = new URLSearchParams(window.location.search)
const initialWorldId = initialParams.get('world') || sessionStorage.getItem('ws.worldId') || ''
const initialProduct = getStoredProduct()
const hasWorkbenchLink = ['product', 'page', 'world'].some((key) => initialParams.has(key))
const WORKSPACE_PRODUCTS: ProductKey[] = ['game', 'literature', 'companion', 'diary', 'yunbao']
const usesWorkspaceShell = (key: ProductKey) => WORKSPACE_PRODUCTS.includes(key)
const fallbackProductConfig = productByKey(FALLBACK_MATRIX.products, initialProduct)
const fallbackHome = (usesWorkspaceShell(initialProduct) ? 'workspace-home' : fallbackProductConfig.home) as PageKey
const SIDEBAR_COLLAPSED_KEY = 'ws.sidebarCollapsed.v2'

const initialPage: PageKey = hasWorkbenchLink
  ? ((initialParams.get('page') as PageKey) || fallbackHome)
  : 'home'
const WORLD_FREE_PAGES: PageKey[] = [
  'home', 'user-center', 'community', 'community-social', 'business', 'settings', 'ai-center', 'game-center', 'content-store', 'workspace-home', 'overview', 'world-management', 'world-building', 'diary', 'archive', 'trash',
  'information-sources', 'personas', 'yunbao-seed', 'memories', 'companion-runtime', 'yunbao',
  'creator-assets', 'works', 'spirit-economy',
]

function isGlobalPage(page: PageKey): boolean {
  return page === 'home' || page === 'user-center' || page === 'community' || page === 'community-social' || page === 'business' || page === 'spirit-economy' || page === 'settings' || page === 'ai-center' || page === 'game-center' || page === 'content-store' || page === 'creator-assets' || page === 'works'
}

function readStoredAuthUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY)
    return raw ? JSON.parse(raw) as AuthUser : null
  } catch {
    return null
  }
}

export default function App() {
  const [activePage, setActivePage] = useState<PageKey>(
    !initialWorldId && !WORLD_FREE_PAGES.includes(initialPage) ? fallbackHome : initialPage
  )
  const [product, setProduct] = useState<ProductKey>(initialProduct)
  useEffect(() => {
    if (product === 'yunbao') sessionStorage.setItem('ws.yunbaoWorkspace', '1')
    else sessionStorage.removeItem('ws.yunbaoWorkspace')
  }, [product])
  const [productMatrix, setProductMatrix] = useState<ProductMatrix>(FALLBACK_MATRIX)
  const [productError, setProductError] = useState('')
  const productConfig = productByKey(productMatrix.products, product)
  const navigationProductConfig = useMemo(() => navigationConfig(productConfig), [productConfig])
  const [selectedWorldId, setSelectedWorldId] = useState<string | null>(null) // 用于建设页
  const [creatingWorld, setCreatingWorld] = useState(false)
  const [worksEntryScene, setWorksEntryScene] = useState<WorkScene | null>(null)
  const [lang, setLang] = useState<Language>(() => loadLanguage())
  const dict = t[lang]

  const changeLanguage = (next: Lang) => {
    setLang(next)
    saveLanguage(next)
    applyDocumentLanguage(next)
    void updateSettings({ preferences: { language: next } }).catch(() => { /* 离线时仍保留本地语言 */ })
  }

  useEffect(() => {
    applyDocumentLanguage(lang)
  }, [lang])

  // ✅ 核心状态：当前所在的世界
  const [currentWorldId, setCurrentWorldId] = useState<string>(initialWorldId)
  const [focusCharacterId, setFocusCharacterId] = useState<string | null>(null)
  const [focusYunbao, setFocusYunbao] = useState(false)
  const [writingSeedEventIds, setWritingSeedEventIds] = useState<string[]>([])
  const [currentWorldName, setCurrentWorldName] = useState<string>(
    () => sessionStorage.getItem('ws.worldName') || ""
  )
  const [allWorldsList, setAllWorldsList] = useState<any[]>([])
  const [backendStatus, setBackendStatus] = useState<"loading" | "connected" | "error">("loading")
  const [aiAccessOpen, setAiAccessOpen] = useState(false)
  const [hasPersonalAi, setHasPersonalAi] = useState(() => hasPersonalAiKey())
  const [navStack, setNavStack] = useState<PageKey[]>([])
  const [authUser, setAuthUser] = useState<AuthUser | null>(readStoredAuthUser)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1' } catch { return false }
  })
  const [navAutoHidden, setNavAutoHidden] = useState(false)
  const navHiddenRef = useRef(false)
  const autoCollapseRef = useRef(false)
  const contentScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // 窄屏自动收起属于临时布局，不写入用户偏好。
    if (autoCollapseRef.current) {
      autoCollapseRef.current = false
      return
    }
    try { localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? '1' : '0') } catch { /* ignore */ }
  }, [sidebarCollapsed])

  // 窄屏自动收起全局侧边栏，避免 800px 左右窗口只剩一条被裁切的主区域。
  useEffect(() => {
    const media = window.matchMedia('(max-width: 900px)')
    const apply = () => {
      if (!media.matches) return
      setSidebarCollapsed((prev) => {
        if (prev) return prev
        autoCollapseRef.current = true
        return true
      })
    }
    apply()
    media.addEventListener?.('change', apply)
    return () => media.removeEventListener?.('change', apply)
  }, [])

  // 工作区二级导航：下滚隐藏，上滚恢复。
  useEffect(() => {
    navHiddenRef.current = false
    setNavAutoHidden(false)
    if (isGlobalPage(activePage) || product !== 'yunbao') return
    const el = contentScrollRef.current
    if (!el) {
      setNavAutoHidden(false)
      return
    }
    let lastTop = el.scrollTop
    let frame = 0
    const applyHidden = (next: boolean) => {
      if (navHiddenRef.current === next) return
      navHiddenRef.current = next
      setNavAutoHidden(next)
    }
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        const top = el.scrollTop
        const delta = top - lastTop
        lastTop = top
        if (top <= 24) {
          applyHidden(false)
          return
        }
        if (delta > 10 && top > 72) applyHidden(true)
        else if (delta < -8) applyHidden(false)
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [product, activePage])

  const activePageRef = useRef(activePage)

  useEffect(() => {
    let alive = true
    void getSettings()
      .then((settings) => {
        if (!alive) return
        applyExperience(settings.preferences)
        if (hasStoredLanguage()) {
          // 用户在登录页或侧边栏显式选择过语言；本地选择优先，并同步到账号。
          if (settings.preferences.language !== lang) {
            void updateSettings({ preferences: { language: lang } }).catch(() => { /* 离线保留本地 */ })
          }
        } else if (settings.preferences.language !== lang) {
          setLang(settings.preferences.language)
          saveLanguage(settings.preferences.language)
        } else {
          saveLanguage(lang)
        }
      })
      .catch(() => { /* 设置读取失败不阻塞工作区 */ })
    return () => { alive = false }
  }, [authUser?.id])

  useEffect(() => {
    activePageRef.current = activePage
  }, [activePage])

  useEffect(() => {
    const openSettings = () => setAiAccessOpen(true)
    window.addEventListener('open-ai-settings', openSettings)
    return () => window.removeEventListener('open-ai-settings', openSettings)
  }, [])

  const navigate = (page: PageKey) => {
    const current = activePageRef.current
    if (page === current) return
    setNavStack((prev) => [...prev, current].slice(-50))
    setActivePage(page)
  }

  const goBack = () => {
    if (navStack.length === 0) {
      setActivePage('home')
      return
    }
    const next = navStack[navStack.length - 1]
    setNavStack((prev) => prev.slice(0, -1))
    setActivePage(next)
  }

  useEffect(() => {
    void fetchProductMatrix().then((data) => setProductMatrix(data))
  }, [])

  const applyProductWorld = (world: any) => {
    if (!world) return
    setCurrentWorldId(world.id)
    setCurrentWorldName(world.name)
    sessionStorage.setItem('ws.worldId', world.id)
    sessionStorage.setItem('ws.worldName', world.name)
    setAllWorldsList((prev) => {
      const exists = prev.some((item) => item.id === world.id)
      return exists ? prev : [...prev, world]
    })
  }

  const clearProductWorld = () => {
    setCurrentWorldId('')
    setCurrentWorldName('')
    sessionStorage.removeItem('ws.worldId')
    sessionStorage.removeItem('ws.worldName')
  }

  /** 世界创建/编辑统一入口：空 id 明确进入“新建”状态，避免回退到当前世界。 */
  const openWorldBuilding = (id?: string) => {
    const nextId = id || ''
    setCreatingWorld(!nextId)
    setSelectedWorldId(nextId)
    navigate('world-building')
  }

  /** 保存世界后刷新列表并切换到新世界，保证顶栏、总览与列表立即看到结果。 */
  const handleWorldSaved = async (world?: { id: string; name: string; product_scene?: string | null }) => {
    let nextList: any[] = []
    try {
      nextList = await getAllWorlds(true)
      setAllWorldsList(nextList)
    } catch (error) {
      console.error('刷新世界列表失败', error)
    }
    if (!world) return
    const saved = nextList.find((item) => item.id === world.id) || world
    applyProductWorld(saved)
    const scene = saved.product_scene as ProductKey | undefined
    if (scene && scene !== product) {
      storeProduct(scene)
      setProduct(scene)
    }
  }

  const handleCreationScene = (scene: WorkScene) => {
    if (scene === 'comic') {
      setWorksEntryScene('comic')
      setActivePage('works')
      setNavStack([])
      window.setTimeout(() => document.querySelector('.cc-page-scroll')?.scrollTo({ top: 0 }), 0)
      return
    }
    setWorksEntryScene(null)
    void switchProduct(scene)
  }

  const switchProduct = async (nextKey: ProductKey) => {
    const next = productByKey(productMatrix.products, nextKey)
    setProductError('')
    storeProduct(nextKey)
    if (nextKey === 'yunbao') sessionStorage.setItem('ws.yunbaoWorkspace', '1')
    else sessionStorage.removeItem('ws.yunbaoWorkspace')
    setProduct(nextKey)
    setNavStack([])
    setCreatingWorld(false)
    setFocusCharacterId(null)
    setFocusYunbao(false)
    setWritingSeedEventIds([])
    const current = allWorldsList.find((item) => item.id === currentWorldId)
    if (currentWorldId && (!current || current.product_scene !== nextKey)) clearProductWorld()
    setActivePage(usesWorkspaceShell(nextKey) ? 'workspace-home' : next.home as PageKey)
    // 自动工作空间由下方 effect 统一创建，避免切换时重复 POST。
  }

  const openWorkSpace = (scene: WorkScene, worldId?: string) => {
    if (scene === 'comic') {
      setWorksEntryScene('comic')
      setActivePage('works')
      return
    }
    const next = productByKey(productMatrix.products, scene)
    storeProduct(scene)
    setProduct(scene)
    setProductError('')
    setNavStack([])
    setCreatingWorld(false)
    setFocusCharacterId(null)
    setFocusYunbao(false)
    const world = worldId ? allWorldsList.find((item) => item.id === worldId) : undefined
    if (world && world.product_scene === scene) applyProductWorld(world)
    setActivePage(usesWorkspaceShell(scene) ? 'workspace-home' : next.home as PageKey)
    window.setTimeout(() => document.querySelector('.cc-page-scroll')?.scrollTo({ top: 0 }), 0)
  }

  const openWorkNarrative = (scene: WorkScene, worldId: string, page: 'storyline' | 'writing') => {
    storeProduct(scene)
    setProduct(scene)
    setProductError('')
    setNavStack([])
    setFocusCharacterId(null)
    setFocusYunbao(false)
    const world = allWorldsList.find((item) => item.id === worldId)
    if (world && world.product_scene === scene) applyProductWorld(world)
    setActivePage(page)
    window.setTimeout(() => document.querySelector('.cc-page-scroll')?.scrollTo({ top: 0 }), 0)
  }

  const openProductPage = (nextKey: ProductKey, page: PageKey) => {
    const next = productByKey(productMatrix.products, nextKey)
    const nextNavigation = navigationConfig(next)
    setProductError('')
    storeProduct(nextKey)
    if (nextKey === 'yunbao') sessionStorage.setItem('ws.yunbaoWorkspace', '1')
    else sessionStorage.removeItem('ws.yunbaoWorkspace')
    setProduct(nextKey)
    setNavStack([])
    setCreatingWorld(false)
    setFocusCharacterId(null)
    setFocusYunbao(false)
    setWritingSeedEventIds([])
    const current = allWorldsList.find((item) => item.id === currentWorldId)
    if (currentWorldId && (!current || current.product_scene !== nextKey)) clearProductWorld()
    const blocked = nextKey === 'yunbao' && YUNBAO_HIDDEN_PAGES.has(page)
    if (page === 'workspace-home' && usesWorkspaceShell(nextKey)) setActivePage('workspace-home')
    else if (!blocked && nextNavigation.allowed_modules.includes(page)) setActivePage(page)
  }

  const handleHomeNav = (target: HomeNavTarget) => {
    if (target === 'home') {
      if (activePage !== 'home') {
        setNavStack([])
        setActivePage('home')
        window.setTimeout(() => document.querySelector('.cc-page-scroll')?.scrollTo({ top: 0 }), 0)
        return
      }
      document.querySelector('.cc-page-scroll')?.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    if (target === 'works') {
      setWorksEntryScene(null)
      setNavStack([])
      setFocusCharacterId(null)
      setFocusYunbao(false)
      setActivePage('works')
      window.setTimeout(() => document.querySelector('.cc-page-scroll')?.scrollTo({ top: 0 }), 0)
      return
    }
    if (target === 'settings') {
      setNavStack([])
      setActivePage('settings')
      window.setTimeout(() => document.querySelector('.cc-page-scroll')?.scrollTo({ top: 0 }), 0)
      return
    }
    if (target === 'identity') {
      setNavStack([])
      setFocusCharacterId(null)
      setFocusYunbao(false)
      setActivePage('user-center')
      window.setTimeout(() => document.querySelector('.cc-page-scroll')?.scrollTo({ top: 0 }), 0)
      return
    }
    if (target === 'community') {
      setNavStack([])
      setFocusCharacterId(null)
      setFocusYunbao(false)
      setActivePage('community')
      window.setTimeout(() => document.querySelector('.cc-page-scroll')?.scrollTo({ top: 0 }), 0)
      return
    }
    if (target === 'community-social') {
      setNavStack([])
      setFocusCharacterId(null)
      setFocusYunbao(false)
      setActivePage('community-social')
      window.setTimeout(() => document.querySelector('.cc-page-scroll')?.scrollTo({ top: 0 }), 0)
      return
    }
    if (target === 'spirit-economy') {
      setNavStack([])
      setFocusCharacterId(null)
      setFocusYunbao(false)
      setActivePage('spirit-economy')
      window.setTimeout(() => document.querySelector('.cc-page-scroll')?.scrollTo({ top: 0 }), 0)
      return
    }
    if (target === 'business') {
      setNavStack([])
      setFocusCharacterId(null)
      setFocusYunbao(false)
      setActivePage('business')
      window.setTimeout(() => document.querySelector('.cc-page-scroll')?.scrollTo({ top: 0 }), 0)
      return
    }
    if (target === 'ai-interaction') {
      setNavStack([])
      setFocusCharacterId(null)
      setFocusYunbao(false)
      setActivePage('ai-center')
      window.setTimeout(() => document.querySelector('.cc-page-scroll')?.scrollTo({ top: 0 }), 0)
      return
    }
    if (target === 'game-experience') {
      setNavStack([])
      setFocusCharacterId(null)
      setFocusYunbao(false)
      setActivePage('game-center')
      window.setTimeout(() => document.querySelector('.cc-page-scroll')?.scrollTo({ top: 0 }), 0)
      return
    }
    if (target === 'content-store') {
      setNavStack([])
      setFocusCharacterId(null)
      setFocusYunbao(false)
      setActivePage('content-store')
      window.setTimeout(() => document.querySelector('.cc-page-scroll')?.scrollTo({ top: 0 }), 0)
      return
    }
    if (target === 'assets') {
      setNavStack([])
      setFocusCharacterId(null)
      setFocusYunbao(false)
      setActivePage('creator-assets')
      window.setTimeout(() => document.querySelector('.cc-page-scroll')?.scrollTo({ top: 0 }), 0)
      return
    }
    if (target === 'yunbao') {
      openYunbao()
      return
    }
    openProductPage('game', 'archive')
  }

  const handleOpenTool = (page: CreationToolKey) => {
    openProductPage('game', page as PageKey)
  }

  const handleOpenAsset = (asset: CreationAssetKey) => {
    if (asset === 'worlds') openProductPage('game', 'world-management')
    else if (asset === 'characters') openProductPage('game', 'character-management')
    else { setWorksEntryScene(null); setActivePage('works') }
  }

  const ensureAssetWorld = (): boolean => {
    const current = allWorldsList.find((world) => world.id === currentWorldId)
    if (current && current.product_scene === 'game' && !current.is_product_workspace) return true
    const firstWorld = allWorldsList.find((world) => world.product_scene === 'game' && !world.is_product_workspace) || allWorldsList.find((world) => !world.is_product_workspace) || allWorldsList[0]
    if (!firstWorld) return false
    storeProduct('game')
    setProduct('game')
    applyProductWorld(firstWorld)
    return true
  }

  const handleOpenUserAsset = (target: UserAssetTarget) => {
    if (target === 'worlds') {
      openProductPage('game', 'world-management')
      return
    }
    if (target === 'works') {
      setWorksEntryScene(null)
      setActivePage('works')
      return
    }
    // 人物与剧情都属于具体工作台；未选世界时先进入首个真实世界，避免被路由守卫打回世界管理。
    if (!ensureAssetWorld()) {
      openProductPage('game', 'world-management')
      return
    }
    openProductPage('game', target === 'characters' ? 'character-management' : 'storyline')
  }

  const handleUserUpdated = (nextUser: AuthUser) => {
    setAuthUser(nextUser)
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(nextUser))
  }

  const openYunbao = () => {
    // 云宝已从 AI 伴侣产品迁出，是独立的全局专业工作台。
    setFocusCharacterId(null)
    setFocusYunbao(false)
    openProductPage('yunbao', 'workspace-home')
  }

  const openCenterChat = (worldId: string, characterId?: string) => {
    if (characterId) sessionStorage.setItem('ws.chatCharacterId', characterId)
    else sessionStorage.removeItem('ws.chatCharacterId')
    const world = allWorldsList.find((item) => item.id === worldId) ||
      allWorldsList.find((item) => item.product_scene === 'game' && !item.is_product_workspace) ||
      allWorldsList[0]
    const nextProduct = ((world?.product_scene || 'game') as ProductKey)
    openProductPage(nextProduct, 'chat')
    if (world) {
      storeProduct(nextProduct)
      setProduct(nextProduct)
      applyProductWorld(world)
      setActivePage('chat')
    }
  }

  const openCenterGamePage = (page: PageKey) => {
    const world = allWorldsList.find((item) => item.id === currentWorldId && item.product_scene === 'game' && !item.is_product_workspace) ||
      allWorldsList.find((item) => item.product_scene === 'game' && !item.is_product_workspace) ||
      allWorldsList[0]
    openProductPage('game', page)
    if (world) {
      storeProduct('game')
      setProduct('game')
      applyProductWorld(world)
      setActivePage(page)
    }
  }

  // 伴侣/日记产品没有世界管理：首次进入自动准备隐藏工作空间，不让用户配置世界。
  useEffect(() => {
    if (isGlobalPage(activePage) || !productConfig.auto_workspace) return
    const current = allWorldsList.find((item) => item.id === currentWorldId)
    if (current && current.product_scene === product) return
    let cancelled = false
    void ensureProductWorkspace(product).then((world) => {
      if (!cancelled) applyProductWorld(world)
    }).catch((error) => {
      if (!cancelled) setProductError(error?.message || lang === 'zh' ? `${productConfig.label}工作空间创建失败` : `${localizedProduct(productConfig.key, productConfig.label).label} workspace creation failed`)
    })
    return () => { cancelled = true }
  }, [product, productConfig.auto_workspace, allWorldsList.length, activePage])

  // 云宝是开发者私有工作台；非所有者不能通过 URL 进入。
  useEffect(() => {
    if (product !== 'yunbao' || !authUser || authUser.is_owner) return
    setProductError('云宝工作台仅限开发者访问')
    setProduct('game')
    setActivePage('home')
  }, [product, authUser])

  // 产品级路由守卫：未开放模块不可通过 URL、快捷键或遗留入口直接进入。
  useEffect(() => {
    if (isGlobalPage(activePage)) return
    if (activePage === 'workspace-home' && usesWorkspaceShell(product)) return
    if (product === 'yunbao' && activePage === 'yunbao') {
      setActivePage('workspace-home')
      return
    }
    const hiddenByProduct = product === 'yunbao' && YUNBAO_HIDDEN_PAGES.has(activePage)
    if (hiddenByProduct || !navigationProductConfig.allowed_modules.includes(activePage)) {
      setActivePage(usesWorkspaceShell(product) ? 'workspace-home' : navigationProductConfig.home as PageKey)
      return
    }
    if (!WORLD_FREE_PAGES.includes(activePage) && !currentWorldId) {
      setActivePage(navigationProductConfig.permissions.world_management ? 'world-management' : (usesWorkspaceShell(product) ? 'workspace-home' : navigationProductConfig.home as PageKey))
    }
  }, [product, navigationProductConfig, activePage, currentWorldId])

  useEffect(() => {
    if (isGlobalPage(activePage)) return
    if (productConfig.auto_workspace && !currentWorldId) {
      // 防止空白：正在创建工作空间时显示产品首页的空状态，而不是通用世界页。
      if (activePage === 'world-management') setActivePage(usesWorkspaceShell(product) ? 'workspace-home' : productConfig.home as PageKey)
    }
  }, [product, productConfig, currentWorldId, activePage])

  // 全局 AI 助手：路由切换时同步页面上下文，助手面板统一读取。
  useEffect(() => {
    setAssistantPage({
      page: activePage,
      label: pageLabel(activePage, dict, lang),
      worldId: currentWorldId || '',
      worldName: currentWorldName || '',
    })
  }, [activePage, currentWorldId, currentWorldName, lang])

  useEffect(() => {
    if (activePage === 'home') {
      window.history.replaceState(null, '', window.location.pathname)
      return
    }
    if (activePage === 'user-center' || activePage === 'community' || activePage === 'community-social' || activePage === 'business' || activePage === 'spirit-economy' || activePage === 'settings' || activePage === 'ai-center' || activePage === 'game-center' || activePage === 'content-store') {
      window.history.replaceState(null, '', `${window.location.pathname}?page=${activePage}`)
      return
    }
    const params = new URLSearchParams()
    params.set('product', product)
    if (currentWorldId) params.set('world', currentWorldId)
    if (activePage !== productConfig.home) params.set('page', activePage)
    const qs = params.toString()
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
  }, [activePage, currentWorldId, product, productConfig.home])

  useEffect(() => {
    checkBackendHealth().then(data => {
      setBackendStatus(data && data.status === "ok" ? "connected" : "error")
    })
    getAllWorlds(true).then(data => {
      setAllWorldsList(data)
      const stored = sessionStorage.getItem('ws.worldId')
      const target = initialWorldId || stored
      if (target) {
        const found = data.find((w: any) => w.id === target)
        if (found) {
          setCurrentWorldId(found.id)
          setCurrentWorldName(found.name)
          sessionStorage.setItem('ws.worldName', found.name)
        } else {
          // 缓存的世界已被删除：清掉失效状态，避免进入一个不存在的世界导致整页空白
          setCurrentWorldId('')
          setCurrentWorldName('')
          sessionStorage.removeItem('ws.worldId')
          sessionStorage.removeItem('ws.worldName')
          setActivePage((page) => (WORLD_FREE_PAGES.includes(page) ? page : 'world-management'))
        }
      }
    })
  }, [])

  // ✅ 进入世界：锁定全局状态，并跳转到人物管理
  function handleEnterWorld(id: string) {
    const world = allWorldsList.find(w => w.id === id);
    if (world) {
      if (world.product_scene && world.product_scene !== product) {
        const next = world.product_scene as ProductKey
        storeProduct(next)
        setProduct(next)
      }
      setCurrentWorldId(id);
      setCurrentWorldName(world.name);
      sessionStorage.setItem('ws.worldId', id);
      sessionStorage.setItem('ws.worldName', world.name);
      window.history.replaceState(null, '', `?world=${id}`);
      navigate('character-management');
    }
  }

  // 顶栏世界下拉：切换世界但停留在当前模块。
  function handleTopbarWorldSelect(id: string) {
    const world = allWorldsList.find((item) => item.id === id)
    if (!world) return
    const nextProduct = (world.product_scene || product) as ProductKey
    if (nextProduct !== product) {
      const nextConfig = productByKey(productMatrix.products, nextProduct)
      const nextNavigation = navigationConfig(nextConfig)
      storeProduct(nextProduct)
      setProduct(nextProduct)
      setNavStack([])
      setWritingSeedEventIds([])
      if (activePage !== 'workspace-home' && !nextNavigation.allowed_modules.includes(activePage)) {
        setActivePage('workspace-home')
      }
    }
    setCurrentWorldId(world.id)
    setCurrentWorldName(world.name)
    sessionStorage.setItem('ws.worldId', world.id)
    sessionStorage.setItem('ws.worldName', world.name)
  }

  // ✅ 退出世界：清空状态，回到书架
  function handleExitWorld() {
    setCurrentWorldId("");
    setCurrentWorldName("");
    sessionStorage.removeItem('ws.worldId');
    sessionStorage.removeItem('ws.worldName');
    window.history.replaceState(null, '', window.location.pathname);
    setNavStack([]);
    setActivePage(usesWorkspaceShell(product) ? 'workspace-home' : (productConfig.auto_workspace ? productConfig.home : 'world-management') as PageKey);
  }
  const navIcons: Record<string, string> = {
    overview: '◫', 'world-management': '◎', 'character-management': '♙', chat: '✉',
    'world-structure': '◈', 'world-data': '🌍', relationships: '⛓', events: '◇',
    timeline: '⏱', simulation: '▷', storyline: '☰', writing: '▤',
    'time-machine': '⏳', archive: '▣', trash: '♻', personas: '✦', memories: '◉',
    'companion-runtime': '◌', 'information-sources': '⌕', diary: '✎',
  }
  const navigation: { title: string; items: { key: PageKey; label: string; icon: string }[] }[] =
    productConfig.nav_groups.map((group) => ({
      title: group.title,
      items: group.items.map((item) => ({
        key: item.page as PageKey,
        label: item.label,
        icon: navIcons[item.module] || '•',
      })),
    }))

  const isHome = activePage === 'home'
  const isUserCenter = activePage === 'user-center'
  const isCommunity = activePage === 'community'
  const isAiCenter = activePage === 'ai-center'
  const isGameCenter = activePage === 'game-center'
  const isContentStore = activePage === 'content-store'
  const isSettings = activePage === 'settings'
  const isCommunitySocial = activePage === 'community-social'
  const isBusiness = activePage === 'business'
  const isSpirit = activePage === 'spirit-economy'
  const isCreatorAssets = activePage === 'creator-assets'
  const isWorks = activePage === 'works'
  const isGlobalShell = isHome || isUserCenter || isCommunity || isCommunitySocial || isBusiness || isSpirit || isSettings || isAiCenter || isGameCenter || isContentStore || isCreatorAssets || isWorks
  const isProductWorkspace = !isGlobalShell && usesWorkspaceShell(product)
  const isYunbaoWorkspace = isProductWorkspace && product === 'yunbao'
  const topbarWorlds = allWorldsList.filter(
    (world) => !world.is_product_workspace && world.product_scene === product,
  )

  return (
    <div className="app-shell" style={{ display: 'flex', height: '100vh', overflow: 'hidden', backgroundColor: 'transparent' }}>
      
      {(isGlobalShell || isProductWorkspace) && (
        <CreationCenterSidebar
          lang={lang}
          active={isUserCenter ? 'identity' : isCommunity ? 'community' : isCommunitySocial ? 'community-social' : isBusiness ? 'business' : isSpirit ? 'spirit-economy' : isAiCenter ? 'ai-interaction' : isGameCenter ? 'game-experience' : isContentStore ? 'content-store' : isCreatorAssets ? 'assets' : isWorks ? 'works' : 'home'}
          onNavigate={handleHomeNav}
          onToggleLang={() => changeLanguage(lang === 'zh' ? 'en' : 'zh')}
          onCollapse={() => setSidebarCollapsed(true)}
          collapsed={sidebarCollapsed}
          canAccessYunbao={Boolean(authUser?.is_owner)}
        />
      )}

      <aside className={`sidebar app-sidebar${sidebarCollapsed ? ' is-collapsed' : ''}`} style={{ width: sidebarCollapsed ? 0 : 260, height: '100%', padding: sidebarCollapsed ? 0 : undefined, minWidth: 0, overflow: 'hidden', backdropFilter: 'blur(40px) saturate(180%)', borderRight: sidebarCollapsed ? 'none' : '1px solid var(--card-border)', display: isGlobalShell || isProductWorkspace ? 'none' : 'flex', flexDirection: 'column' }}>
        
        <div className="brand" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="brand-mark" style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'var(--sidebar-text)', color: 'var(--sidebar-bg)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', fontSize: '20px' }}>W</div>
          <div className="brand-text" style={{ display: 'flex', flexDirection: 'column' }}>
            <strong style={{ fontSize: '16px', color: 'var(--sidebar-text)' }}>{lang === 'zh' ? '世界模拟器' : 'World Sim'}</strong>
            <span style={{ fontSize: '10px', color: 'var(--sidebar-text-muted)', textTransform: 'uppercase' }}>{isHome ? (lang === 'zh' ? '选择产品' : 'Choose Product') : 'World Simulator'}</span>
          </div>
          <button
            type="button"
            className="sidebar-collapse"
            onClick={() => setSidebarCollapsed(true)}
            title={lang === 'zh' ? '收起侧边栏' : 'Collapse sidebar'}
            aria-label={lang === 'zh' ? '收起侧边栏' : 'Collapse sidebar'}
          >
            <PanelLeftClose size={16} strokeWidth={1.7} aria-hidden="true" />
          </button>
        </div>

        {isHome ? (
          <nav className="navigation" style={{ flex: 1, overflowY: 'auto', padding: '0 1rem' }}>
            <div style={{ fontSize: 10, letterSpacing: '0.12em', color: 'var(--sidebar-text-muted)', padding: '0 0.5rem 10px' }}>{lang === 'zh' ? '四大创作产品' : 'Four creation products'}</div>
            {productMatrix.products.filter((item) => item.key !== 'yunbao').map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => void switchProduct(item.key)}
                className="home-product-link"
                style={{
                  width: '100%', display: 'flex', alignItems: 'flex-start', gap: 11,
                  padding: '12px 11px', marginBottom: 6, borderRadius: 10,
                  border: '1px solid transparent', background: 'transparent',
                  color: 'var(--sidebar-text)', textAlign: 'left', cursor: 'pointer',
                  transition: 'background 160ms ease',
                }}
              >
                <span style={{ fontSize: 19, lineHeight: 1.3 }}>{item.icon}</span>
                <span style={{ minWidth: 0 }}>
                  <strong style={{ display: 'block', fontSize: 13 }}>{lang === 'zh' ? item.label : localizedProduct(item.key, item.label).label}</strong>
                  <span style={{ display: 'block', marginTop: 3, fontSize: 9.5, lineHeight: 1.55, color: 'var(--sidebar-text-muted)' }}>{lang === 'zh' ? item.description : localizedProduct(item.key, item.label, item.description).description}</span>
                </span>
              </button>
            ))}
          </nav>
        ) : (
          <>
            <div style={{ padding: '0 1rem', marginBottom: '0.75rem' }}>
              <button
                type="button"
                onClick={() => { setNavStack([]); setActivePage('home') }}
                style={{ width: '100%', padding: '8px 10px', background: 'rgba(128,128,128,0.07)', color: 'var(--text-main)', border: '1px solid var(--card-border)', borderRadius: 8, cursor: 'pointer', fontSize: 11, textAlign: 'left', display: 'flex', gap: 8 }}
              >
                <span>←</span> {lang === 'zh' ? '返回产品主页' : 'Back to products'}
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 9, padding: '7px 9px', borderRadius: 9, border: '1px solid var(--card-border)', background: 'rgba(128,128,128,0.08)' }}>
                <span style={{ fontSize: 16 }}>{productConfig.icon}</span>
                <span style={{ minWidth: 0 }}>
                  <strong style={{ display: 'block', fontSize: 11.5, color: 'var(--sidebar-text)' }}>{lang === 'zh' ? productConfig.label : localizedProduct(productConfig.key, productConfig.label).label}</strong>
                  <span style={{ display: 'block', fontSize: 9, color: 'var(--sidebar-text-muted)' }}>{lang === 'zh' ? '当前工作台 · 仅显示本产品功能' : 'Current workspace · product-only modules'}</span>
                </span>
              </div>
              {productError && <div style={{ marginTop: 6, fontSize: 9.5, color: 'var(--danger-color)', lineHeight: 1.5 }}>{productError}</div>}
            </div>

            {/* 隐藏产品工作空间不允许退出；普通世界可返回书架 */}
            {currentWorldId && !productConfig.auto_workspace && (
              <div style={{ padding: '0 1rem', marginBottom: '1rem' }}>
                <button onClick={handleExitWorld} style={{ width: '100%', padding: '10px', background: 'rgba(128,128,128,0.1)', color: 'var(--text-main)', border: '1px solid var(--card-border)', borderRadius: '8px', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', gap: '8px' }}>
                  <span>←</span> {lang === 'zh' ? '退出当前世界' : 'Leave this world'}
                </button>
              </div>
            )}

            <nav className="navigation" style={{ flex: 1, overflowY: 'auto', padding: '0 1rem' }}>
              {navigation.map((group) => (
                <div className="nav-group" key={group.title} style={{ marginBottom: '1.5rem' }}>
                  <div className="nav-group-title" style={{ fontSize: '11px', color: 'var(--sidebar-text-muted)', marginBottom: '0.5rem', paddingLeft: '0.5rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lang === 'zh' ? group.title : (NAV_GROUP_EN[group.title] || group.title)}</div>
                  {group.items.map((item) => (
                    <button
                      key={item.key}
                      className={`sidebar-nav-item${activePage === item.key ? ' is-active' : ''}`}
                      onClick={() => {
                        setWritingSeedEventIds([])
                        navigate(item.key)
                      }}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px',
                        background: activePage === item.key ? 'rgba(128, 128, 128, 0.15)' : 'transparent',
                        color: activePage === item.key ? 'var(--sidebar-text)' : 'var(--sidebar-text-muted)',
                        border: activePage === item.key ? '1px solid rgba(128, 128, 128, 0.2)' : '1px solid transparent',
                        borderRadius: '8px', cursor: 'pointer', marginBottom: '4px', textAlign: 'left',
                        transition: 'all 0.2s ease', fontWeight: activePage === item.key ? 600 : 400,
                      }}
                    >
                      <span className="nav-icon">{item.icon}</span>
                      <span>{lang === 'zh' ? item.label : pageLabel(item.key, dict, lang)}</span>
                    </button>
                  ))}
                </div>
              ))}
            </nav>
          </>
        )}

        <div className="sidebar-footer" style={{ padding: '1.5rem', borderTop: '1px solid var(--card-border)' }}>
          <button onClick={() => changeLanguage(lang === 'zh' ? 'en' : 'zh')} style={{ width: '100%', padding: '10px', background: 'rgba(128, 128, 128, 0.1)', color: 'var(--sidebar-text)', border: '1px solid var(--card-border)', borderRadius: '8px', cursor: 'pointer', marginBottom: '0.6rem', fontSize: '13px' }}>
            {dict.switchLang}
          </button>
          <button onClick={() => { void authLogout().then(() => window.location.reload()) }} style={{ width: '100%', padding: '7px', background: 'transparent', color: 'var(--sidebar-text-muted)', border: '1px solid var(--card-border)', borderRadius: '8px', cursor: 'pointer', marginBottom: '0.8rem', fontSize: '11px' }}>
            {lang === 'zh' ? '退出登录' : 'Sign out'}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: 'var(--sidebar-text-muted)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: backendStatus === 'connected' ? '#10b981' : '#ef4444' }} />
              <span>{dict.localWS}</span>
            </div>
            <span>V1.0</span>
          </div>
        </div>
      </aside>

      {sidebarCollapsed && (
        <button
          type="button"
          className="sidebar-reveal-tab"
          onClick={() => {
            setSidebarCollapsed(false)
            setNavAutoHidden(false)
          }}
          title={lang === 'zh' ? '展开侧边栏' : 'Expand sidebar'}
          aria-label={lang === 'zh' ? '展开侧边栏' : 'Expand sidebar'}
        >
          <PanelLeftOpen size={16} strokeWidth={1.7} aria-hidden="true" />
        </button>
      )}

      <main className="main-area" style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: 'transparent', overflow: 'hidden', marginLeft: sidebarCollapsed ? 0 : 260 }}>
        {isYunbaoWorkspace && (
          <>
            <header className="yb-pinned-nav">
              <nav className="yb-pinned-tabs" aria-label="云宝工作台置顶导航">
                <button
                  type="button"
                  className={`yb-pinned-tab${activePage === 'workspace-home' ? ' is-active' : ''}`}
                  onClick={() => navigate('workspace-home')}
                >
                  <Cloud size={14} strokeWidth={1.7} aria-hidden="true" />
                  云宝领域
                </button>
                <button
                  type="button"
                  className={`yb-pinned-tab${activePage === 'personas' ? ' is-active' : ''}`}
                  onClick={() => navigate('personas')}
                >
                  <Sparkles size={14} strokeWidth={1.7} aria-hidden="true" />
                  人格编辑器
                </button>
              </nav>
            </header>
            <YunbaoGroupNav
              lang={lang}
              activePage={activePage}
              hidden={navAutoHidden}
              onNavigate={(page) => navigate(page as PageKey)}
            />
          </>
        )}

              {!isYunbaoWorkspace && (
                (isProductWorkspace || isGlobalShell) ? (
                    <CreationCenterTopbar
                      lang={lang}
                      page={isProductWorkspace ? 'workspace' : isUserCenter ? 'identity' : isCommunity ? 'community' : isCommunitySocial ? 'community-social' : isBusiness ? 'business' : isSpirit ? 'spirit-economy' : isAiCenter ? 'ai-center' : isGameCenter ? 'game-center' : isContentStore ? 'content-store' : isCreatorAssets ? 'assets' : isWorks ? 'works' : 'home'}
                      productLabel={isProductWorkspace ? (lang === 'zh' ? productConfig.label : localizedProduct(productConfig.key, productConfig.label).label) : undefined}
                      productKey={isProductWorkspace ? product : undefined}
                      currentWorldName={isProductWorkspace ? (productConfig.auto_workspace ? productConfig.workspace_name || currentWorldName : currentWorldName) : undefined}
                      currentWorldId={isProductWorkspace ? currentWorldId : undefined}
                      worlds={isProductWorkspace ? topbarWorlds : undefined}
                      onSelectWorld={handleTopbarWorldSelect}
                      onOpenWorlds={navigationProductConfig.allowed_modules.includes('world-management') ? () => navigate('world-management') : undefined}
                      onCreateWorld={navigationProductConfig.permissions.world_management ? () => openWorldBuilding() : undefined}
                      onBackToCenter={() => handleHomeNav('home')}
                      user={authUser}
                      backendStatus={backendStatus}
                      hasPersonalAi={hasPersonalAi}
                      onOpenAi={() => setAiAccessOpen(true)}
                      onOpenSettings={() => handleHomeNav('settings')}
                      onOpenIdentity={() => handleHomeNav('identity')}
                      onLogout={() => { void authLogout().then(() => window.location.reload()) }}
                              />
                ) : (
                  <header className="topbar app-topbar" style={{ height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2rem', borderBottom: '1px solid var(--card-border)' }}>
                    <div className="breadcrumb" style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                      {isHome ? (
                        <>
                          <strong style={{ color: 'var(--text-main)', fontSize: 14 }}>{lang === 'zh' ? '选择产品' : 'Choose product'}</strong>
                          <span style={{ margin: '0 8px' }}>/</span>
                          <span>{lang === 'zh' ? '四大创作产品 · 云宝独立工作台' : 'Four products · Yunbao workspace'}</span>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={goBack}
                            title={lang === 'zh' ? '返回上一页' : 'Back'}
                            style={{ marginRight: '12px', padding: '5px 10px', borderRadius: '7px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer', fontSize: '12px' }}
                          >
                            {lang === 'zh' ? '← 返回' : '← Back'}
                          </button>
                          {currentWorldId ? (
                            <>
                              <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 8, border: '1px solid var(--card-border)', marginRight: 8 }}>{productConfig.icon} {productConfig.short}</span>
                              <span style={{ color: 'var(--primary-color)', fontWeight: 600 }}>[{currentWorldName}]</span>
                              <span style={{ margin: '0 8px' }}>/</span>
                              <strong style={{ color: 'var(--text-main)' }}>{pageLabel(activePage, dict, lang)}</strong>
                            </>
                          ) : (
                            <>
                              <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 8, border: '1px solid var(--card-border)', marginRight: 8 }}>{productConfig.icon} {productConfig.short}</span>
                              <span>{dict.workbench}</span><span style={{ margin: '0 8px' }}>/</span>
                              <strong style={{ color: 'var(--text-main)' }}>{pageLabel(activePage, dict, lang)}</strong>
                            </>
                          )}
                        </>
                      )}
                    </div>
                    <div className="topbar-right" style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '12px', color: 'var(--text-muted)' }}>
                      <button
                        type="button"
                        onClick={() => setAiAccessOpen(true)}
                        title={lang === 'zh' ? '填写自己的 API Key，避免消耗站长额度' : 'Use your own API key instead of the owner quota'}
                        style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 9px', borderRadius: '7px', border: '1px solid var(--card-border)', background: hasPersonalAi ? 'rgba(128,128,128,0.12)' : 'transparent', color: 'var(--text-main)', fontSize: '11px', cursor: 'pointer' }}
                      >
                        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: hasPersonalAi ? '#10b981' : 'var(--text-muted)' }} />
                        AI 接入{hasPersonalAi ? ' · 已配置' : ''}
                      </button>
                      <span className="workspace-status" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="status-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: backendStatus === 'connected' ? '#10b981' : '#ef4444' }} />
                        {backendStatus === 'connected' ? lang === 'zh' ? '后端已连接' : 'Backend connected' : lang === 'zh' ? '后端未连接' : 'Backend offline'}
                      </span>
                      <div className="avatar" style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--text-main)', color: 'var(--bg-color)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', overflow: 'hidden' }}>
                        {authUser?.avatar_url
                          ? <img src={resolveMediaUrl(authUser.avatar_url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : (authUser?.display_name || authUser?.username || 'U').slice(0, 1)}
                      </div>
                    </div>
                  </header>
                )
              )}

        <div className="main-area-body">
          <div className="main-area-body-inner">
            <div
              ref={contentScrollRef}
              className={isGlobalShell || isProductWorkspace ? 'cc-page-scroll' : 'page-content'}
              style={{
                flex: 1,
                overflowY: 'auto',
                backgroundColor: 'transparent',
                ...(isGlobalShell || isProductWorkspace ? { padding: 0, maxWidth: 'none' } : {}),
              }}
            >
              {isProductWorkspace && !isYunbaoWorkspace && (
                <ProductWorkspaceNav
                  lang={lang}
                  product={product}
                  productConfig={navigationProductConfig}
                  activePage={activePage}
                  error={productError}
                  onNavigate={(page) => navigate(page as PageKey)}
                />
              )}
          {!isGlobalShell && product === 'yunbao' && authUser && !authUser.is_owner && (
            <div className="pw-access-note">
              云宝工作台当前为只读访问。你可以查看世界、人物、日记与创作数据；所有编辑、删除与状态切换仅限开发者「兰哆哆」。
            </div>
          )}
          <ErrorBoundary onReset={() => setActivePage(usesWorkspaceShell(product) ? 'workspace-home' : productConfig.home as PageKey)}>
          {activePage === 'home' ? (
            <CreationCenterPage
              lang={lang}
              onOpenScene={handleCreationScene}
              onOpenTool={handleOpenTool}
              onOpenAsset={handleOpenAsset}
            />
          ) : activePage === 'user-center' ? (
            <UserCenterPage
              lang={lang}
              user={authUser}
              onUserUpdated={handleUserUpdated}
              onOpenAsset={handleOpenUserAsset}
              onOpenWorks={() => handleOpenUserAsset('works')}
              onLogout={() => { void authLogout().then(() => window.location.reload()) }}
              onOpenSettings={() => setActivePage('settings')}
              onOpenBusiness={() => setActivePage('business')}
            />
          ) : activePage === 'settings' ? (
            <SettingsPage
              lang={lang}
              user={authUser}
              onUserUpdated={handleUserUpdated}
              onLangChange={(next) => changeLanguage(next)}
              onOpenAiSettings={() => setAiAccessOpen(true)}
              onLogout={() => { void authLogout().then(() => window.location.reload()) }}
            />
          ) : activePage === 'business' ? (
            <BillingCenterPage
              lang={lang}
              user={authUser}
              onOpenAi={() => setAiAccessOpen(true)}
            />
          ) : activePage === 'community-social' ? (
            <CommunitySocialPage
              lang={lang}
              currentUserId={authUser?.id}
              onBack={() => setActivePage('home')}
            />
          ) : activePage === 'community' ? (
            <CommunityPage
              lang={lang}
              user={authUser}
              onOpenWorkbench={() => handleOpenUserAsset('works')}
              onOpenWorld={() => handleOpenUserAsset('worlds')}
              onOpenCharacters={() => handleOpenUserAsset('characters')}
              onOpenStorylines={() => handleOpenUserAsset('storylines')}
              onOpenIdentity={() => { setNavStack([]); setActivePage('user-center') }}
            />
          ) : activePage === 'ai-center' ? (
            <AICenterPage
              lang={lang}
              user={authUser}
              onOpenChat={openCenterChat}
              onOpenCharacters={() => handleOpenUserAsset('characters')}
              onOpenRelationships={() => openCenterGamePage('relationships')}
              onOpenEvents={() => openCenterGamePage('events')}
              onOpenMemories={() => openProductPage('yunbao', 'memories')}
              onOpenSimulation={() => openCenterGamePage('simulation')}
            />
          ) : activePage === 'game-center' ? (
            <GameCenterPage
              lang={lang}
              onOpenMultipath={() => openCenterGamePage('multipath')}
              onOpenSimulation={() => openCenterGamePage('simulation')}
              onOpenStoryline={() => handleOpenUserAsset('storylines')}
              onOpenCharacters={() => handleOpenUserAsset('characters')}
              onOpenWorld={() => handleOpenUserAsset('worlds')}
              onOpenWorldData={() => openCenterGamePage('world-data')}
              onOpenWorldStructure={() => openCenterGamePage('world-structure')}
              onOpenRelationships={() => openCenterGamePage('relationships')}
            />
          ) : activePage === 'content-store' ? (
            <ContentStorePage
              lang={lang}
              user={authUser}
              onOpenWorld={() => handleOpenUserAsset('worlds')}
              onOpenCharacters={() => handleOpenUserAsset('characters')}
              onOpenStorylines={() => handleOpenUserAsset('storylines')}
              onOpenWorks={() => handleOpenUserAsset('works')}
            />
          ) : activePage === 'workspace-home' && isYunbaoWorkspace ? (
            <YunbaoOverviewPage onNavigate={(page) => navigate(page as PageKey)} />
          ) : activePage === 'workspace-home' && usesWorkspaceShell(product) ? (
            <ProductWorkspaceHome
              product={product}
              lang={lang}
              worlds={allWorldsList}
              currentWorldId={currentWorldId}
              currentWorldName={currentWorldName}
              onNavigate={(page) => navigate(page as PageKey)}
              onSwitchProduct={(next) => void switchProduct(next)}
              onEnterWorld={handleEnterWorld}
              onNewWorld={() => openWorldBuilding()}
              onOpenWorldBuilding={(id) => openWorldBuilding(id)}
            />
          ) : activePage === 'overview' ? (
            <OverviewPage
              onNavigate={navigate} lang={lang} dict={dict}
              product={product} productConfig={productConfig}
            />
          ) : activePage === 'diary' ? (
            <JournalPage product={product} worldId={currentWorldId} />
          ) : activePage === 'world-management' ? (
            <WorldsPage 
              lang={lang} dict={dict} product={product}
              readOnly={product === 'yunbao' && !!authUser && !authUser.is_owner}
              onEnterWorld={handleEnterWorld}
              onOpenWorldBuilding={(id) => openWorldBuilding(id)}
            />
          ) : activePage === 'world-building' ? (
            <WorldBuildingPage 
              lang={lang as 'zh' | 'en'} 
              worldId={creatingWorld ? '' : (selectedWorldId || currentWorldId || '')} 
              product={product}
              onSaved={handleWorldSaved}
              onBack={() => { setCreatingWorld(false); goBack() }} 
            />
          ) : activePage === 'character-management' ? (
            <CharacterListPage 
              worldId={currentWorldId || undefined} 
              worldName={currentWorldName || ''}
              focusCharacterId={focusCharacterId}
              focusYunbao={focusYunbao}
              productMode={productConfig.modes['character-management'] || 'full'}
              onBack={() => { setFocusCharacterId(null); setFocusYunbao(false); goBack(); }}
              onNavigate={(page) => navigate(page as PageKey)}
              onOpenYunbaoEditor={() => openProductPage('yunbao', 'personas')}
              showYunbaoEntry={false}
              hidePageHeader={product === 'yunbao'}
              readOnly={product === 'yunbao' && !!authUser && !authUser.is_owner}
            />
                     ) : activePage === 'world-data' ? (
            <WorldDataPage worldId={currentWorldId} />
          ) : activePage === 'world-structure' ? (
            <WorldStructurePage worldId={currentWorldId} worldName={currentWorldName} />
          ) : activePage === 'spirit-economy' ? (
            <SpiritEconomyPage lang={lang} user={authUser} onBack={() => setActivePage('home')} />
          ) : activePage === 'works' ? (
            <WorksPage
              lang={lang}
              userName={authUser?.display_name || authUser?.username || ''}
              onOpenScene={openWorkSpace}
              onOpenNarrative={openWorkNarrative}
              initialScene={worksEntryScene}
            />
          ) : activePage === 'creator-assets' ? (
            <CreatorAssetsPage worldId={currentWorldId} />
          ) : activePage === 'archive' ? (
            <ArchivePage />
          ) : activePage === 'trash' ? (
            <TrashPage />
          ) : activePage === 'time-machine' ? (
            <TimeMachinePage worldId={currentWorldId} worldName={currentWorldName} />
          ) : activePage === 'relationships' ? (
            <RelationshipsPage
              worldId={currentWorldId}
              mode={productConfig.modes.relationships}
              onOpenCharacter={(characterId) => {
                setFocusCharacterId(characterId)
                navigate('character-management')
              }}
              onNavigate={(page) => navigate(page as PageKey)}
            />
          ) : activePage === 'yunbao' ? (
            <YunbaoWorkspacePage onNavigate={(page) => navigate(page as PageKey)} />
          ) : activePage === 'yunbao-seed' ? (
            <YunbaoSeedPage onBack={() => setActivePage('personas')} />
          ) : activePage === 'personas' ? (
            <PersonaPage onOpenSeedEditor={() => navigate('yunbao-seed')} />
          ) : activePage === 'memories' ? (
            <MemoryPage />
          ) : activePage === 'companion-runtime' ? (
            <CompanionRuntimePage onOpenPersonas={openYunbao} />
          ) : activePage === 'information-sources' ? (
            <InformationSourcesPage worldId={currentWorldId} />
          ) : activePage === 'events' ? (
            <EventsPage worldId={currentWorldId} mode={productConfig.modes.events} onOpenSandbox={() => navigate('multipath')} onNavigate={(page) => navigate(page as PageKey)} />
          ) : activePage === 'simulation' ? (
            (product === 'game' || product === 'literature') ? (
              <SimulationWritingPage
                worldId={currentWorldId}
                initialMode="simulation"
                seedEventIds={writingSeedEventIds}
                simulationAuxiliary={productConfig.modes.simulation === 'auxiliary'}
                writingMode={productConfig.modes.writing}
              />
            ) : (
              <SimulationPage
                worldId={currentWorldId}
                auxiliary={productConfig.modes.simulation === 'auxiliary'}
              />
            )
          ) : activePage === 'multipath' ? (
            <MultiPathPage worldId={currentWorldId} />
          ) : activePage === 'storyline' ? (
            <StorylinePage worldId={currentWorldId} onOpenEvents={() => navigate('events')} lang={lang} />
          ) : activePage === 'chat' ? (
            <ChatPage worldId={currentWorldId} product={product} />
          ) : activePage === 'writing' ? (
            (product === 'game' || product === 'literature') ? (
              <SimulationWritingPage
                worldId={currentWorldId}
                initialMode="writing"
                seedEventIds={writingSeedEventIds}
                simulationAuxiliary={productConfig.modes.simulation === 'auxiliary'}
                writingMode={productConfig.modes.writing}
              />
            ) : (
              <WritingPage worldId={currentWorldId} seedEventIds={writingSeedEventIds} productMode={productConfig.modes.writing} />
            )
           ) : activePage === 'timeline' ? (
           <UnifiedTimelinePage worldId={currentWorldId} worldName={currentWorldName} mode={productConfig.modes.timeline} />
          ) : (
            <div style={{ padding: '2rem', color: 'var(--text-main)' }}><h1>{lang === 'zh' ? '开发中' : 'In development'}</h1></div>
          )}
          </ErrorBoundary>
            </div>
          </div>
        </div>
      </main>
      <AiAccessModal
        open={aiAccessOpen}
        onClose={() => setAiAccessOpen(false)}
        onSaved={() => setHasPersonalAi(hasPersonalAiKey())}
      />
      <AIAssistantPanel product={product} onNavigate={(page) => { if (page === 'personas') openYunbao(); else navigate(page as PageKey) }} onOpenYunbao={openYunbao} />
    </div>
  )
}

// ================= 01 总览页面组件 =================
function OverviewPage({
  onNavigate, lang, dict, product, productConfig,
}: {
  onNavigate: (page: PageKey) => void; lang: Language; dict: any
  product: ProductKey; productConfig: ProductConfig
}) {
  const [worlds, setWorlds] = useState<any[]>([])
  const [charCount, setCharCount] = useState(0)
  const [eventCount, setEventCount] = useState(0)
  const [simCount, setSimCount] = useState(0)
  const [recentEvents, setRecentEvents] = useState<any[]>([])

  useEffect(() => {
    let cancelled = false
    void getAllWorlds().then((all) => {
      if (cancelled) return
      const mine = all.filter((w: any) => w.product_scene === product && !w.is_product_workspace)
      setWorlds(mine)
      const ids = new Set(mine.map((w: any) => w.id))
      void fetch("http://127.0.0.1:8000/api/characters").then((res) => res.json()).then((data) => {
        if (!cancelled && Array.isArray(data)) setCharCount(data.filter((row: any) => ids.has(row.world_id)).length)
      }).catch(console.error)
      void fetch("http://127.0.0.1:8000/api/events").then((res) => res.json()).then((data) => {
        if (cancelled || !Array.isArray(data)) return
        const rows = data.filter((row: any) => ids.has(row.world_id))
        setEventCount(rows.length); setRecentEvents(rows.slice(0, 3))
      }).catch(console.error)
      void fetch("http://127.0.0.1:8000/api/simulations").then((res) => res.json()).then((data) => {
        if (!cancelled && Array.isArray(data)) setSimCount(data.filter((row: any) => row.world_id && ids.has(row.world_id)).length)
      }).catch(console.error)
    }).catch(console.error)
    return () => { cancelled = true }
  }, [product])

  return (
    <div className="overview-page" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <section className="page-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="eyebrow" style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px' }}>
            {productConfig.icon} {lang === 'zh' ? productConfig.label : localizedProduct(productConfig.key, productConfig.label).label} · {dict.dashboard}
          </div>
          <h1 style={{ margin: 0, color: 'var(--text-main)', fontSize: '24px' }}>{lang === 'zh' ? productConfig.label : localizedProduct(productConfig.key, productConfig.label).label}{lang === 'zh' ? '工作台' : ' Workspace'}</h1>
          <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: '14px', maxWidth: 760, lineHeight: 1.7 }}>{lang === 'zh' ? productConfig.description : localizedProduct(productConfig.key, productConfig.label, productConfig.description).description}</p>
        </div>
        <button className="primary-button" type="button" onClick={() => onNavigate('world-management')} style={{ padding: '0.75rem 1.5rem', background: 'var(--text-main)', color: 'var(--bg-color)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
          {dict.createWorld}
        </button>
      </section>

      <section className="stats-grid" style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
        <StatCard label={dict.worldCount} value={String(worlds.length)} description={dict.createdWorlds} icon="◎" />
        <StatCard label={dict.charCount} value={String(charCount)} description={dict.builtChars} icon="♙" />
        <StatCard label={dict.eventCount} value={String(eventCount)} description={dict.recordedEvents} icon="◇" />
        <StatCard label={dict.simCount} value={String(simCount)} description={dict.totalSims} icon="▷" />
      </section>

      <section className="dashboard-grid" style={{ marginTop: '2rem', display: 'flex', gap: '1.5rem' }}>
        <div className="glass-card" style={{ flex: 2, padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <div className="panel-heading" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <div>
              <h2 style={{ margin: 0, color: 'var(--text-main)', fontSize: '18px' }}>{dict.workspace}</h2>
            </div>
          </div>
          {worlds.length === 0 ? (
            <div className="empty-state" style={{ textAlign: 'center', padding: '3rem 0', flex: 1 }}>
              <div style={{ fontSize: '3rem', opacity: 0.5, marginBottom: '1rem' }}>◎</div>
              <h3 style={{ color: 'var(--text-main)' }}>{dict.noWorlds}</h3>
              <button className="secondary-button" type="button" onClick={() => onNavigate('world-management')} style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: 'transparent', border: '1px solid var(--text-main)', color: 'var(--text-main)', borderRadius: '6px', cursor: 'pointer' }}>
                {dict.createFirstBtn}
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
              {worlds.map(w => (
                <div key={w.id} onClick={() => onNavigate('world-management')} style={{ padding: '1rem', border: '1px solid var(--card-border)', borderRadius: '8px', cursor: 'pointer', background: 'rgba(128,128,128,0.05)' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)' }}>{w.name}</h4>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="glass-card" style={{ flex: 1, padding: '1.5rem' }}>
          <div className="panel-heading" style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ margin: 0, color: 'var(--text-main)', fontSize: '18px' }}>{dict.recentEvents}</h2>
          </div>
          {recentEvents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)', fontSize: '13px' }}>{dict.noEvents}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {recentEvents.map(ev => (
                <div
                  key={ev.id}
                  onClick={() => onNavigate('events')}
                  style={{ padding: '12px', background: 'rgba(128,128,128,0.05)', borderRadius: '6px', border: '1px solid var(--card-border)', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center' }}>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-main)' }}>{ev.name}</div>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{lang === 'zh' ? '编辑 →' : 'Edit →'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function StatCard({ label, value, description, icon }: { label: string, value: string, description: string, icon: string }) {
  return (
    <div className="glass-card" style={{ flex: 1, padding: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: 500 }}>{label}</span>
        <span style={{ opacity: 0.8 }}>{icon}</span>
      </div>
      <div style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: '0.5rem 0', color: 'var(--text-main)' }}>{value}</div>
      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{description}</div>
    </div>
  )
}