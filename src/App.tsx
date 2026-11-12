import { useEffect, useRef, useState } from 'react' 
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
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
import StorylinePage from './pages/StoryTreePage'
import ChatPage from './pages/ChatPage'
import WritingPage from './pages/WritingPage'
import WorldDataPage from './pages/WorldDataPage'
import WorldStructurePage from './pages/WorldStructurePage'
import ArchivePage from './pages/ArchivePage'
import TrashPage from './pages/TrashPage'
import JournalPage from './pages/JournalPage'
import { authLogout, type AuthUser } from './api/auth'
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
import { getSettings } from './api/settings'
import { applyExperience } from './utils/experience'
import { ensureProductWorkspace, fetchProductMatrix } from './api/productConfig'
import { FALLBACK_MATRIX, getStoredProduct, productByKey, storeProduct } from './product/products'
import type { ProductConfig, ProductKey, ProductMatrix } from './product/types'

type PageKey = 
  | 'home'
  | 'user-center'
  | 'community'
  | 'settings'
  | 'community-social'
  | 'business'
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

function pageLabel(key: PageKey, dict: Record<string, string>): string {
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
    'time-machine': '时光机',
    personas: '云宝人格',
    'yunbao-seed': '人物种子编辑器',
    settings: '设置中心',
    'community-social': '社区社交',
    business: '商业与服务中心',
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
const SIDEBAR_COLLAPSED_KEY = 'ws.sidebarCollapsed'

const initialPage: PageKey = hasWorkbenchLink
  ? ((initialParams.get('page') as PageKey) || fallbackHome)
  : 'home'
const WORLD_FREE_PAGES: PageKey[] = [
  'home', 'user-center', 'community', 'community-social', 'business', 'settings', 'ai-center', 'game-center', 'content-store', 'workspace-home', 'overview', 'world-management', 'world-building', 'diary', 'archive', 'trash',
  'information-sources', 'personas', 'yunbao-seed', 'memories', 'companion-runtime', 'yunbao',
]

function isGlobalPage(page: PageKey): boolean {
  return page === 'home' || page === 'user-center' || page === 'community' || page === 'community-social' || page === 'business' || page === 'settings' || page === 'ai-center' || page === 'game-center' || page === 'content-store'
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
  const [selectedWorldId, setSelectedWorldId] = useState<string | null>(null) // 用于建设页
  const [creatingWorld, setCreatingWorld] = useState(false)
  const [lang, setLang] = useState<Language>('zh')
  const dict = t[lang]

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

  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? '1' : '0') } catch { /* ignore */ }
  }, [sidebarCollapsed])
  const activePageRef = useRef(activePage)

  useEffect(() => {
    let alive = true
    void getSettings()
      .then((settings) => {
        if (!alive) return
        applyExperience(settings.preferences)
        if (settings.preferences.language !== lang) setLang(settings.preferences.language)
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

  const openProductPage = (nextKey: ProductKey, page: PageKey) => {
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
    if (page === 'workspace-home' && usesWorkspaceShell(nextKey)) setActivePage('workspace-home')
    else if (next.allowed_modules.includes(page)) setActivePage(page)
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
    else openProductPage('game', 'writing')
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
    // 作品、人物与剧情都属于具体工作台；未选世界时先进入首个真实世界，避免被路由守卫打回世界管理。
    if (!ensureAssetWorld()) {
      openProductPage('game', 'world-management')
      return
    }
    openProductPage('game', target === 'works' ? 'writing' : target === 'characters' ? 'character-management' : 'storyline')
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
      if (!cancelled) setProductError(error?.message || `${productConfig.label}工作空间创建失败`)
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
    if (!productConfig.allowed_modules.includes(activePage)) {
      setActivePage(usesWorkspaceShell(product) ? 'workspace-home' : productConfig.home as PageKey)
      return
    }
    if (!WORLD_FREE_PAGES.includes(activePage) && !currentWorldId) {
      setActivePage(productConfig.permissions.world_management ? 'world-management' : (usesWorkspaceShell(product) ? 'workspace-home' : productConfig.home as PageKey))
    }
  }, [product, productConfig, activePage, currentWorldId])

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
      label: pageLabel(activePage, dict),
      worldId: currentWorldId || '',
      worldName: currentWorldName || '',
    })
  }, [activePage, currentWorldId, currentWorldName, lang])

  useEffect(() => {
    if (activePage === 'home') {
      window.history.replaceState(null, '', window.location.pathname)
      return
    }
    if (activePage === 'user-center' || activePage === 'community' || activePage === 'community-social' || activePage === 'business' || activePage === 'settings' || activePage === 'ai-center' || activePage === 'game-center' || activePage === 'content-store') {
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
  const isGlobalShell = isHome || isUserCenter || isCommunity || isCommunitySocial || isBusiness || isSettings || isAiCenter || isGameCenter || isContentStore
  const isProductWorkspace = !isGlobalShell && usesWorkspaceShell(product)

  return (
    <div className="app-shell" style={{ display: 'flex', height: '100vh', overflow: 'hidden', backgroundColor: 'var(--bg-color)' }}>
      
      {(isGlobalShell || isProductWorkspace) && (
        <CreationCenterSidebar
          lang={lang}
          active={isUserCenter ? 'identity' : isCommunity ? 'community' : isCommunitySocial ? 'community-social' : isBusiness ? 'business' : isAiCenter ? 'ai-interaction' : isGameCenter ? 'game-experience' : isContentStore ? 'content-store' : 'home'}
          onNavigate={handleHomeNav}
          onToggleLang={() => setLang(lang === 'zh' ? 'en' : 'zh')}
          onCollapse={() => setSidebarCollapsed(true)}
          collapsed={sidebarCollapsed}
          canAccessYunbao={Boolean(authUser?.is_owner)}
        />
      )}

      <aside className={`sidebar${sidebarCollapsed ? ' is-collapsed' : ''}`} style={{ width: sidebarCollapsed ? 0 : 260, height: '100%', padding: sidebarCollapsed ? 0 : undefined, minWidth: 0, overflow: 'hidden', backgroundColor: 'var(--sidebar-bg)', backdropFilter: 'blur(40px) saturate(180%)', borderRight: sidebarCollapsed ? 'none' : '1px solid var(--card-border)', display: isGlobalShell || isProductWorkspace ? 'none' : 'flex', flexDirection: 'column' }}>
        
        <div className="brand" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="brand-mark" style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'var(--sidebar-text)', color: 'var(--sidebar-bg)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', fontSize: '20px' }}>W</div>
          <div className="brand-text" style={{ display: 'flex', flexDirection: 'column' }}>
            <strong style={{ fontSize: '16px', color: 'var(--sidebar-text)' }}>{lang === 'zh' ? '世界模拟器' : 'World Sim'}</strong>
            <span style={{ fontSize: '10px', color: 'var(--sidebar-text-muted)', textTransform: 'uppercase' }}>{isHome ? 'Choose Product' : 'World Simulator'}</span>
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
            <div style={{ fontSize: 10, letterSpacing: '0.12em', color: 'var(--sidebar-text-muted)', padding: '0 0.5rem 10px' }}>四大创作产品</div>
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
                  <strong style={{ display: 'block', fontSize: 13 }}>{item.label}</strong>
                  <span style={{ display: 'block', marginTop: 3, fontSize: 9.5, lineHeight: 1.55, color: 'var(--sidebar-text-muted)' }}>{item.description}</span>
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
                <span>←</span> 返回产品主页
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 9, padding: '7px 9px', borderRadius: 9, border: '1px solid var(--card-border)', background: 'rgba(128,128,128,0.08)' }}>
                <span style={{ fontSize: 16 }}>{productConfig.icon}</span>
                <span style={{ minWidth: 0 }}>
                  <strong style={{ display: 'block', fontSize: 11.5, color: 'var(--sidebar-text)' }}>{productConfig.label}</strong>
                  <span style={{ display: 'block', fontSize: 9, color: 'var(--sidebar-text-muted)' }}>当前工作台 · 仅显示本产品功能</span>
                </span>
              </div>
              {productError && <div style={{ marginTop: 6, fontSize: 9.5, color: 'var(--danger-color)', lineHeight: 1.5 }}>{productError}</div>}
            </div>

            {/* 隐藏产品工作空间不允许退出；普通世界可返回书架 */}
            {currentWorldId && !productConfig.auto_workspace && (
              <div style={{ padding: '0 1rem', marginBottom: '1rem' }}>
                <button onClick={handleExitWorld} style={{ width: '100%', padding: '10px', background: 'rgba(128,128,128,0.1)', color: 'var(--text-main)', border: '1px solid var(--card-border)', borderRadius: '8px', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', gap: '8px' }}>
                  <span>←</span> 退出当前世界
                </button>
              </div>
            )}

            <nav className="navigation" style={{ flex: 1, overflowY: 'auto', padding: '0 1rem' }}>
              {navigation.map((group) => (
                <div className="nav-group" key={group.title} style={{ marginBottom: '1.5rem' }}>
                  <div className="nav-group-title" style={{ fontSize: '11px', color: 'var(--sidebar-text-muted)', marginBottom: '0.5rem', paddingLeft: '0.5rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{group.title}</div>
                  {group.items.map((item) => (
                    <button
                      key={item.key}
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
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              ))}
            </nav>
          </>
        )}

        <div className="sidebar-footer" style={{ padding: '1.5rem', borderTop: '1px solid var(--card-border)' }}>
          <button onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')} style={{ width: '100%', padding: '10px', background: 'rgba(128, 128, 128, 0.1)', color: 'var(--sidebar-text)', border: '1px solid var(--card-border)', borderRadius: '8px', cursor: 'pointer', marginBottom: '0.6rem', fontSize: '13px' }}>
            {dict.switchLang}
          </button>
          <button onClick={() => { void authLogout().then(() => window.location.reload()) }} style={{ width: '100%', padding: '7px', background: 'transparent', color: 'var(--sidebar-text-muted)', border: '1px solid var(--card-border)', borderRadius: '8px', cursor: 'pointer', marginBottom: '0.8rem', fontSize: '11px' }}>
            退出登录
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
          onClick={() => setSidebarCollapsed(false)}
          title={lang === 'zh' ? '展开侧边栏' : 'Expand sidebar'}
          aria-label={lang === 'zh' ? '展开侧边栏' : 'Expand sidebar'}
        >
          <PanelLeftOpen size={16} strokeWidth={1.7} aria-hidden="true" />
        </button>
      )}

      <main className="main-area" style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-color)', overflow: 'hidden', marginLeft: sidebarCollapsed ? 0 : 260 }}>
        {(isGlobalShell || isProductWorkspace) ? (
          <CreationCenterTopbar
            lang={lang}
            page={isProductWorkspace ? 'workspace' : isUserCenter ? 'identity' : isCommunity ? 'community' : isCommunitySocial ? 'community-social' : isBusiness ? 'business' : isAiCenter ? 'ai-center' : isGameCenter ? 'game-center' : isContentStore ? 'content-store' : 'home'}
            productLabel={isProductWorkspace ? productConfig.label : undefined}
            user={authUser}
            backendStatus={backendStatus}
            hasPersonalAi={hasPersonalAi}
            onOpenAi={() => setAiAccessOpen(true)}
            onOpenSettings={() => handleHomeNav('settings')}
            onOpenIdentity={() => handleHomeNav('identity')}
            onLogout={() => { void authLogout().then(() => window.location.reload()) }}
          />
        ) : (
        <header className="topbar" style={{ height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2rem', borderBottom: '1px solid var(--card-border)' }}>
          <div className="breadcrumb" style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
            {isHome ? (
              <>
                <strong style={{ color: 'var(--text-main)', fontSize: 14 }}>选择产品</strong>
                <span style={{ margin: '0 8px' }}>/</span>
                <span>四大创作产品 · 云宝独立工作台</span>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={goBack}
                  title="返回上一页"
                  style={{ marginRight: '12px', padding: '5px 10px', borderRadius: '7px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer', fontSize: '12px' }}
                >
                  ← 返回
                </button>
                {currentWorldId ? (
                  <>
                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 8, border: '1px solid var(--card-border)', marginRight: 8 }}>{productConfig.icon} {productConfig.short}</span>
                    <span style={{ color: 'var(--primary-color)', fontWeight: 600 }}>[{currentWorldName}]</span>
                    <span style={{ margin: '0 8px' }}>/</span>
                    <strong style={{ color: 'var(--text-main)' }}>{pageLabel(activePage, dict)}</strong>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 8, border: '1px solid var(--card-border)', marginRight: 8 }}>{productConfig.icon} {productConfig.short}</span>
                    <span>{dict.workbench}</span><span style={{ margin: '0 8px' }}>/</span>
                    <strong style={{ color: 'var(--text-main)' }}>{pageLabel(activePage, dict)}</strong>
                  </>
                )}
              </>
            )}
          </div>
          <div className="topbar-right" style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '12px', color: 'var(--text-muted)' }}>
            <button
              type="button"
              onClick={() => setAiAccessOpen(true)}
              title="填写自己的 API Key，避免消耗站长额度"
              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 9px', borderRadius: '7px', border: '1px solid var(--card-border)', background: hasPersonalAi ? 'rgba(128,128,128,0.12)' : 'transparent', color: 'var(--text-main)', fontSize: '11px', cursor: 'pointer' }}
            >
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: hasPersonalAi ? '#10b981' : 'var(--text-muted)' }} />
              AI 接入{hasPersonalAi ? ' · 已配置' : ''}
            </button>
            <span className="workspace-status" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="status-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: backendStatus === 'connected' ? '#10b981' : '#ef4444' }} />
              {backendStatus === 'connected' ? '后端已连接' : '后端未连接'}
            </span>
            <div className="avatar" style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--text-main)', color: 'var(--bg-color)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold' }}>U</div>
          </div>
        </header>
        )}

        <div
          className={isGlobalShell || isProductWorkspace ? 'cc-page-scroll' : 'page-content'}
          style={{
            flex: 1,
            overflowY: 'auto',
            backgroundColor: 'transparent',
            ...(isGlobalShell || isProductWorkspace ? { padding: 0, maxWidth: 'none' } : {}),
          }}
        >
          {isProductWorkspace && (
            <ProductWorkspaceNav
              lang={lang}
              product={product}
              productConfig={productConfig}
              activePage={activePage}
              currentWorldName={currentWorldName}
              error={productError}
              onNavigate={(page) => navigate(page as PageKey)}
              onNewWorld={() => { setCreatingWorld(true); setSelectedWorldId(''); navigate('world-building') }}
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
              onOpenScene={(key) => void switchProduct(key)}
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
              onLangChange={(next) => setLang(next)}
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
              onNewWorld={() => { setCreatingWorld(true); setSelectedWorldId(''); navigate('world-building') }}
              onOpenWorldBuilding={(id) => { setCreatingWorld(false); setSelectedWorldId(id); navigate('world-building') }}
            />
          ) : activePage === 'overview' ? (
            <OverviewPage
              onNavigate={navigate} lang={lang} dict={dict}
              product={product} productConfig={productConfig}
            />
          ) : activePage === 'diary' ? (
            <JournalPage product={product} worldId={currentWorldId} onOpenSources={() => navigate('information-sources')} />
          ) : activePage === 'world-management' ? (
            <WorldsPage 
              lang={lang} dict={dict} product={product}
              readOnly={product === 'yunbao' && !!authUser && !authUser.is_owner}
              onEnterWorld={handleEnterWorld}
              onOpenWorldBuilding={(id) => { setCreatingWorld(false); setSelectedWorldId(id); navigate('world-building');}} 
            />
          ) : activePage === 'world-building' ? (
            <WorldBuildingPage 
              lang={lang as 'zh' | 'en'} 
              worldId={creatingWorld ? '' : (selectedWorldId || currentWorldId || '')} 
              product={product}
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
              showYunbaoEntry={product === 'yunbao'}
              readOnly={product === 'yunbao' && !!authUser && !authUser.is_owner}
            />
                     ) : activePage === 'world-data' ? (
            <WorldDataPage worldId={currentWorldId} />
          ) : activePage === 'world-structure' ? (
            <WorldStructurePage worldId={currentWorldId} worldName={currentWorldName} />
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
            <YunbaoSeedPage onBack={() => setActivePage('yunbao')} />
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
            <SimulationPage
              worldId={currentWorldId}
              auxiliary={productConfig.modes.simulation === 'auxiliary'}
              onWriteChapter={(eventId) => {
                setWritingSeedEventIds([eventId])
                navigate('writing')
              }}
            />
          ) : activePage === 'multipath' ? (
            <MultiPathPage worldId={currentWorldId} />
          ) : activePage === 'storyline' ? (
            <StorylinePage worldId={currentWorldId} onOpenEvents={() => navigate('events')} />
          ) : activePage === 'chat' ? (
            <ChatPage worldId={currentWorldId} product={product} />
          ) : activePage === 'writing' ? (
            <WritingPage worldId={currentWorldId} seedEventIds={writingSeedEventIds} productMode={productConfig.modes.writing} />
           ) : activePage === 'timeline' ? (
           <UnifiedTimelinePage worldId={currentWorldId} worldName={currentWorldName} mode={productConfig.modes.timeline} />
          ) : (
            <div style={{ padding: '2rem', color: 'var(--text-main)' }}><h1>开发中</h1></div>
          )}
          </ErrorBoundary>
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
            {productConfig.icon} {productConfig.label} · {dict.dashboard}
          </div>
          <h1 style={{ margin: 0, color: 'var(--text-main)', fontSize: '24px' }}>{productConfig.label}工作台</h1>
          <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: '14px', maxWidth: 760, lineHeight: 1.7 }}>{productConfig.description}</p>
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
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>编辑 →</span>
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