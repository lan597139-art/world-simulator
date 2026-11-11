import { useEffect, useRef, useState } from 'react' 
import './App.css'
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
import DiaryPage from './pages/DiaryPage'
import { authLogout } from './api/auth'
import TimeMachinePage from './pages/TimeMachinePage'
import AIAssistantPanel from './components/AIAssistantPanel'
import { setAssistantPage } from './api/assistantContext'
import ProductSwitcher from './components/ProductSwitcher'
import PersonaPage from './pages/PersonaPage'
import MemoryPage from './pages/MemoryPage'
import CompanionRuntimePage from './pages/CompanionRuntimePage'
import InformationSourcesPage from './pages/InformationSourcesPage'
import { ensureProductWorkspace, fetchProductMatrix } from './api/productConfig'
import { FALLBACK_MATRIX, getStoredProduct, productByKey, storeProduct } from './product/products'
import type { ProductConfig, ProductKey, ProductMatrix } from './product/types'

type PageKey = 
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
    personas: '个人 AI 人格',
    memories: '记忆管理',
    'companion-runtime': '人格运行',
    'information-sources': '信息来源管理',
    diary: '日记与传记',
  }
  return map[key] || dict[key] || key
}

const initialParams = new URLSearchParams(window.location.search)
const initialWorldId = initialParams.get('world') || sessionStorage.getItem('ws.worldId') || ''
const initialPage = (initialParams.get('page') as PageKey) || 'overview'
const initialProduct = getStoredProduct()
const WORLD_FREE_PAGES: PageKey[] = [
  'overview', 'world-management', 'world-building', 'diary', 'archive', 'trash',
  'information-sources', 'personas', 'memories', 'companion-runtime',
]

export default function App() {
  const [activePage, setActivePage] = useState<PageKey>(
    !initialWorldId && !WORLD_FREE_PAGES.includes(initialPage) ? 'overview' : initialPage
  )
  const [product, setProduct] = useState<ProductKey>(initialProduct)
  const [productMatrix, setProductMatrix] = useState<ProductMatrix>(FALLBACK_MATRIX)
  const [productError, setProductError] = useState('')
  const productConfig = productByKey(productMatrix.products, product)
  const [selectedWorldId, setSelectedWorldId] = useState<string | null>(null) // 用于建设页
  const [lang, setLang] = useState<Language>('zh')
  const dict = t[lang]

  // ✅ 核心状态：当前所在的世界
  const [currentWorldId, setCurrentWorldId] = useState<string>(initialWorldId)
  const [focusCharacterId, setFocusCharacterId] = useState<string | null>(null)
  const [writingSeedEventIds, setWritingSeedEventIds] = useState<string[]>([])
  const [currentWorldName, setCurrentWorldName] = useState<string>(
    () => sessionStorage.getItem('ws.worldName') || ""
  )
  const [allWorldsList, setAllWorldsList] = useState<any[]>([])
  const [backendStatus, setBackendStatus] = useState<"loading" | "connected" | "error">("loading")
  const [aiAccessOpen, setAiAccessOpen] = useState(false)
  const [hasPersonalAi, setHasPersonalAi] = useState(() => hasPersonalAiKey())
  const [navStack, setNavStack] = useState<PageKey[]>([])
  const activePageRef = useRef(activePage)

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
      setActivePage(currentWorldId ? 'world-management' : 'overview')
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
    if (nextKey === product) return
    const next = productByKey(productMatrix.products, nextKey)
    setProductError('')
    storeProduct(nextKey)
    setProduct(nextKey)
    setNavStack([])
    setWritingSeedEventIds([])
    const current = allWorldsList.find((item) => item.id === currentWorldId)
    if (current && current.product_scene !== nextKey) clearProductWorld()
    setActivePage(next.home as PageKey)
    // 自动工作空间由下方 effect 统一创建，避免切换时重复 POST。
  }

  // 伴侣/日记产品没有世界管理：首次进入自动准备隐藏工作空间，不让用户配置世界。
  useEffect(() => {
    if (!productConfig.auto_workspace) return
    const current = allWorldsList.find((item) => item.id === currentWorldId)
    if (current && current.product_scene === product) return
    let cancelled = false
    void ensureProductWorkspace(product).then((world) => {
      if (!cancelled) applyProductWorld(world)
    }).catch((error) => {
      if (!cancelled) setProductError(error?.message || `${productConfig.label}工作空间创建失败`)
    })
    return () => { cancelled = true }
  }, [product, productConfig.auto_workspace, allWorldsList.length])

  // 产品级路由守卫：未开放模块不可通过 URL、快捷键或遗留入口直接进入。
  useEffect(() => {
    if (!productConfig.allowed_modules.includes(activePage)) {
      setActivePage(productConfig.home as PageKey)
      return
    }
    if (!WORLD_FREE_PAGES.includes(activePage) && !currentWorldId) {
      setActivePage(productConfig.permissions.world_management ? 'world-management' : (productConfig.home as PageKey))
    }
  }, [product, productConfig, activePage, currentWorldId])

  useEffect(() => {
    if (productConfig.auto_workspace && !currentWorldId) {
      // 防止空白：正在创建工作空间时显示产品首页的空状态，而不是通用世界页。
      if (activePage === 'world-management') setActivePage(productConfig.home as PageKey)
    }
  }, [productConfig, currentWorldId, activePage])

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
    setActivePage((productConfig.auto_workspace ? productConfig.home : 'world-management') as PageKey);
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

  return (
    <div className="app-shell" style={{ display: 'flex', height: '100vh', overflow: 'hidden', backgroundColor: 'var(--bg-color)' }}>
      
      <aside className="sidebar" style={{ width: '260px', height: '100%', backgroundColor: 'var(--sidebar-bg)', backdropFilter: 'blur(40px) saturate(180%)', borderRight: '1px solid var(--card-border)', display: 'flex', flexDirection: 'column' }}>
        
        <div className="brand" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="brand-mark" style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'var(--sidebar-text)', color: 'var(--sidebar-bg)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', fontSize: '20px' }}>W</div>
          <div className="brand-text" style={{ display: 'flex', flexDirection: 'column' }}>
            <strong style={{ fontSize: '16px', color: 'var(--sidebar-text)' }}>{lang === 'zh' ? '世界模拟器' : 'World Sim'}</strong>
            <span style={{ fontSize: '10px', color: 'var(--sidebar-text-muted)', textTransform: 'uppercase' }}>World Simulator</span>
          </div>
        </div>

        <div style={{ padding: '0 1rem', marginBottom: '0.8rem' }}>
          <ProductSwitcher product={productConfig} configs={productMatrix.products} onSelect={(key) => void switchProduct(key)} />
          {productError && <div style={{ marginTop: 6, fontSize: 9.5, color: 'var(--danger-color)', lineHeight: 1.5 }}>{productError}</div>}
        </div>

        {/* 隐藏产品工作空间不允许退出；普通世界可返回书架 */}
        {currentWorldId && !productConfig.auto_workspace && (
          <div style={{ padding: '0 1rem', marginBottom: '1rem' }}>
            <button onClick={handleExitWorld} style={{ width: '100%', padding: '10px', background: 'rgba(128,128,128,0.1)', color: 'var(--text-main)', border: '1px solid var(--card-border)', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', textAlign: 'left', display: 'flex', gap: '8px' }}>
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
                  transition: 'all 0.2s ease', fontWeight: activePage === item.key ? 600 : 400
                }}
              >
                <span className="nav-icon">{item.icon}</span>
                <span>{item.label}</span>
              </button>
              ))}
            </div>
          ))}
        </nav>
        
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

      <main className="main-area" style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-color)', overflow: 'hidden' }}>
        <header className="topbar" style={{ height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2rem', borderBottom: '1px solid var(--card-border)' }}>
          <div className="breadcrumb" style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
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
                <strong style={{ color: 'var(--text-main)' }}>
                  {pageLabel(activePage, dict)}
                </strong>
              </>
            ) : (
              <>
                <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 8, border: '1px solid var(--card-border)', marginRight: 8 }}>{productConfig.icon} {productConfig.short}</span>
                <span>{dict.workbench}</span><span style={{ margin: '0 8px' }}>/</span>
                <strong style={{ color: 'var(--text-main)' }}>
                  {pageLabel(activePage, dict)}
                </strong>
              </>
            )}
          </div>
          <div className="topbar-right" style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '12px', color: 'var(--text-muted)' }}>
            <ProductSwitcher compact product={productConfig} configs={productMatrix.products} onSelect={(key) => void switchProduct(key)} />
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

        <div className="page-content" style={{ flex: 1, overflowY: 'auto', backgroundColor: 'transparent' }}>
          <ErrorBoundary onReset={() => setActivePage(productConfig.home as PageKey)}>
          {activePage === 'overview' ? (
            <OverviewPage
              onNavigate={navigate} lang={lang} dict={dict}
              product={product} productConfig={productConfig}
              onSelectProduct={(key) => void switchProduct(key)}
            />
          ) : activePage === 'diary' ? (
            <DiaryPage product={product} worldId={currentWorldId} onOpenSources={() => navigate('information-sources')} />
          ) : activePage === 'world-management' ? (
            <WorldsPage 
              lang={lang} dict={dict} product={product}
              onEnterWorld={handleEnterWorld}
              onOpenWorldBuilding={(id) => { setSelectedWorldId(id); navigate('world-building');}} 
            />
          ) : activePage === 'world-building' ? (
            <WorldBuildingPage 
              lang={lang as 'zh' | 'en'} 
              worldId={selectedWorldId || currentWorldId || ''} 
              product={product}
              onBack={goBack} 
            />
          ) : activePage === 'character-management' ? (
            <CharacterListPage 
              worldId={currentWorldId || undefined} 
              worldName={currentWorldName || ''}
              focusCharacterId={focusCharacterId}
              productMode={productConfig.modes['character-management'] || 'full'}
              showPersonas={product === 'companion'}
              onBack={() => { setFocusCharacterId(null); goBack(); }}
              onNavigate={(page) => navigate(page as PageKey)}
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
          ) : activePage === 'personas' ? (
            <PersonaPage />
          ) : activePage === 'memories' ? (
            <MemoryPage />
          ) : activePage === 'companion-runtime' ? (
            <CompanionRuntimePage onOpenPersonas={() => navigate('personas')} />
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
            <ChatPage worldId={currentWorldId} product={product} onOpenPersonas={() => navigate('personas')} />
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
      <AIAssistantPanel product={product} onNavigate={(page) => navigate(page as PageKey)} />
    </div>
  )
}

// ================= 01 总览页面组件 =================
function OverviewPage({
  onNavigate, lang, dict, product, productConfig, onSelectProduct,
}: {
  onNavigate: (page: PageKey) => void; lang: Language; dict: any
  product: ProductKey; productConfig: ProductConfig; onSelectProduct: (key: ProductKey) => void
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
    }).catch(console.error)
    void fetch("http://127.0.0.1:8000/api/simulations").then((res) => res.json()).then((data) => {
      if (!cancelled && Array.isArray(data)) setSimCount(data.length)
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

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '1rem', marginTop: '2rem' }}>
        {FALLBACK_MATRIX.products.map((scene) => (
          <button
            key={scene.key}
            type="button"
            onClick={() => onSelectProduct(scene.key)}
            style={{
              textAlign: 'left', padding: '1.25rem', borderRadius: '12px', cursor: 'pointer',
              background: scene.key === product ? 'color-mix(in srgb, var(--primary-color) 9%, var(--card-bg))' : 'var(--card-bg, rgba(128,128,128,0.05))',
              border: `1px solid ${scene.key === product ? 'var(--primary-color)' : 'var(--card-border)'}`,
              color: 'var(--text-main)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '24px' }}>{scene.icon}</span>
              <strong style={{ fontSize: '16px' }}>{scene.label}</strong>
              {scene.key === product && <span style={{ fontSize: '10px', color: 'var(--primary-color)', border: '1px solid var(--primary-color)', borderRadius: '10px', padding: '2px 6px' }}>当前产品</span>}
            </div>
            <p style={{ margin: '10px 0 0', fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.6 }}>{scene.description}</p>
            <div style={{ marginTop: 10, fontSize: 10, color: 'var(--text-muted)' }}>
              {scene.nav_groups.flatMap((group) => group.items).length} 个功能入口 · 点击切换产品
            </div>
          </button>
        ))}
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