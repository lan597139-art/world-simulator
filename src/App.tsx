import { useEffect, useState } from 'react' 
import './App.css'
import WorldsPage from './pages/WorldsPage'
import WorldBuildingPage from './pages/WorldBuildingPage'
import CharacterListPage from './pages/CharacterListPage' 
import RelationshipsPage from './pages/RelationshipsPage'
import TimelinePage from './pages/TimelinePage'
import { getAllWorlds } from './services/worldService'
import { checkBackendHealth } from "./api/client";

// 1. 严格按照 01-08 设定 PageKey
type PageKey = 
  | 'overview' 
  | 'world-management' 
  | 'character-management' 
  | 'relationships' 
  | 'events' 
  | 'timeline' 
  | 'simulation' 
  | 'writing' 
  | 'world-building'

export type Language = 'zh' | 'en'

export const t = {
  zh: {
    overview: '01 世界总览', 
    worldManagement: '02 世界管理', 
    characterManagement: '03 人物管理', 
    relationships: '04 关系与组织', 
    events: '05 事件管理',
    timeline: '06 时间线',
    simulation: '07 模拟运行', 
    writing: '08 写作辅助', 
    worldBuilding: '世界建设配置',
    
    workbench: '工作台', 
    worldBuild: '世界构建', 
    simSystem: '模拟与推演',
    
    dashboard: '世界模拟器 / 仪表盘',
    overviewDesc: '管理你的世界、人物与事件，观察世界的持续演化。',
    createWorld: '+ 创建世界',
    worldCount: '世界数量', charCount: '人物数量', eventCount: '事件数量', simCount: '模拟次数',
    createdWorlds: '已创建的模拟世界', builtChars: '已建立的人物档案',
    recordedEvents: '已记录的世界事件', totalSims: '累计模拟运行次数',
    workspace: '世界工作区', currentWorlds: '当前管理的模拟世界',
    recentEvents: '最近事件', latestChanges: '世界中发生的最新变化',
    noEvents: '暂无事件记录', noWorlds: '尚未创建世界',
    createFirstWorld: '创建你的第一个世界，开始配置世界背景、人物与事件。',
    createFirstBtn: '创建第一个世界', devEnv: '开发环境', localWS: '本地工作区',
    switchLang: '切换到英文'
  },
  en: {
    overview: '01 Overview', 
    worldManagement: '02 Worlds', 
    characterManagement: '03 Characters', 
    relationships: '04 Relations', 
    events: '05 Events',
    timeline: '06 Timeline',
    simulation: '07 Simulation', 
    writing: '08 Writing', 
    worldBuilding: 'World Config',
    
    workbench: 'WORKBENCH', 
    worldBuild: 'BUILDING', 
    simSystem: 'SIMULATION',
    
    dashboard: 'WORLD SIMULATOR / DASHBOARD',
    overviewDesc: 'Manage your worlds, characters, and events. Observe the continuous evolution.',
    createWorld: '+ Create World',
    worldCount: 'Worlds', charCount: 'Characters', eventCount: 'Events', simCount: 'Simulations',
    createdWorlds: 'Created worlds', builtChars: 'Built characters',
    recordedEvents: 'Recorded events', totalSims: 'Total simulations',
    workspace: 'World Workspace', currentWorlds: 'Currently managed worlds',
    recentEvents: 'Recent Events', latestChanges: 'Latest changes in the world',
    noEvents: 'No events recorded', noWorlds: 'No worlds created',
    createFirstWorld: 'Create your first world to start configuring backgrounds and characters.',
    createFirstBtn: 'Create First World', devEnv: 'Dev Env', localWS: 'Local Workspace',
    switchLang: 'Switch to Chinese'
  }
}

export default function App() {
  const [activePage, setActivePage] = useState<PageKey>('overview')
  const [selectedWorldId, setSelectedWorldId] = useState<string | null>(null)
  const [activeCharWorldId, setActiveCharWorldId] = useState<string | null>(null) 
  const [activeCharWorldName, setActiveCharWorldName] = useState<string>('') 
  const [lang, setLang] = useState<Language>('zh')
  const dict = t[lang]

  const [backendStatus, setBackendStatus] = useState<"loading" | "connected" | "error">("loading")

  useEffect(() => {
    checkBackendHealth().then(data => {
      if (data && data.status === "ok") {
        setBackendStatus("connected")
      } else {
        setBackendStatus("error")
      }
    })
  }, [])

  // 2. 严格按照新模块分组构建导航
  const navigation = [
    { 
      title: dict.workbench, 
      items: [
        { key: 'overview', label: dict.overview, icon: '◫' }
      ] 
    },
    { 
      title: dict.worldBuild, 
      items: [
        { key: 'world-management', label: dict.worldManagement, icon: '◎' },
        { key: 'character-management', label: dict.characterManagement, icon: '♙' },
        { key: 'relationships', label: dict.relationships, icon: '⛓' },
        { key: 'events', label: dict.events, icon: '◇' },
      ]
    },
    { 
      title: dict.simSystem, 
      items: [
        { key: 'timeline', label: dict.timeline, icon: '⏱' },
        { key: 'simulation', label: dict.simulation, icon: '▷' },
        { key: 'writing', label: dict.writing, icon: '▤' },
      ]
    },
  ] satisfies { title: string; items: { key: PageKey; label: string; icon: string }[] }[]

  function handleNavigate(page: PageKey) {
    setActivePage(page)
    // 状态清理逻辑
    if (page === 'world-management') setSelectedWorldId(null)
    if (page === 'character-management') {
      setActiveCharWorldId(null)
      setActiveCharWorldName('') 
    }
  }

  return (
    <div className="app-shell" style={{ display: 'flex', height: '100vh', overflow: 'hidden', backgroundColor: 'var(--bg-color)' }}>
      
      <aside 
        className="sidebar" 
        style={{ 
          width: '260px', 
          height: '100%',
          backgroundColor: 'var(--sidebar-bg)', 
          backdropFilter: 'blur(40px) saturate(180%)', 
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          borderRight: '1px solid var(--card-border)',
          color: 'var(--sidebar-text)', 
          display: 'flex', 
          flexDirection: 'column', 
          transition: 'all 0.3s' 
        }}
      >
        <div className="brand" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="brand-mark" style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'var(--sidebar-text)', color: 'var(--sidebar-bg)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', fontSize: '20px' }}>W</div>
          <div className="brand-text" style={{ display: 'flex', flexDirection: 'column' }}>
            <strong style={{ fontSize: '16px', color: 'var(--sidebar-text)' }}>{lang === 'zh' ? '世界模拟器' : 'World Sim'}</strong>
            <span style={{ fontSize: '10px', color: 'var(--sidebar-text-muted)', textTransform: 'uppercase' }}>World Simulator</span>
          </div>
        </div>
        
        <nav className="navigation" style={{ flex: 1, overflowY: 'auto',padding: '0 1rem', marginTop: '1rem' }}>
          {navigation.map((group) => (
            <div className="nav-group" key={group.title} style={{ marginBottom: '1.5rem' }}>
              <div className="nav-group-title" style={{ fontSize: '11px', color: 'var(--sidebar-text-muted)', marginBottom: '0.5rem', paddingLeft: '0.5rem' }}>{group.title}</div>
              {group.items.map((item) => (
              <button 
                key={item.key} 
                onClick={() => handleNavigate(item.key)}
                style={{ 
                  width: '100%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px', 
                  padding: '10px 12px', 
                  background: activePage === item.key ? 'rgba(128, 128, 128, 0.15)' : 'transparent', 
                  color: activePage === item.key ? 'var(--sidebar-text)' : 'var(--sidebar-text-muted)', 
                  border: activePage === item.key ? '1px solid rgba(128, 128, 128, 0.2)' : '1px solid transparent', 
                  borderRadius: '8px', 
                  cursor: 'pointer', 
                  marginBottom: '4px', 
                  textAlign: 'left',
                  transition: 'all 0.2s ease', 
                  fontWeight: activePage === item.key ? 600 : 400,
                  boxShadow: activePage === item.key ? 'inset 0 1px 1px rgba(255,255,255,0.05), 0 4px 12px rgba(0,0,0,0.1)' : 'none'
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
          <button 
            onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
            style={{ width: '100%', padding: '10px', background: 'rgba(128, 128, 128, 0.1)', color: 'var(--sidebar-text)', border: '1px solid var(--card-border)', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s', marginBottom: '1rem', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
          >
            {dict.switchLang}
          </button>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: 'var(--sidebar-text-muted)', whiteSpace: 'nowrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
              <span>{dict.localWS}</span>
            </div>
            <span>V1.0</span>
          </div>
        </div>
      </aside>

<main className="main-area" style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-color)', overflow: 'hidden' }}>
        <header className="topbar" style={{ height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2rem', borderBottom: '1px solid var(--card-border)', backgroundColor: 'transparent' }}>
          <div className="breadcrumb" style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            <span>{dict.workbench}</span><span className="breadcrumb-divider" style={{ margin: '0 8px' }}>/</span>
            <strong style={{ color: 'var(--text-main)' }}>
              {activePage === 'world-building' ? dict.worldBuilding : dict[activePage as keyof typeof dict] || activePage}
            </strong>
          </div>
          <div className="topbar-right" style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '12px', color: 'var(--text-muted)' }}>
            <span className="workspace-status" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span 
                className="status-dot" 
                style={{ width: '6px', height: '6px', borderRadius: '50%', background: backendStatus === 'connected' ? '#10b981' : backendStatus === 'error' ? '#ef4444' : '#f59e0b' }} 
              />
              {backendStatus === 'connected' ? '后端已连接' : backendStatus === 'error' ? '后端未连接' : '连接中...'}
            </span>
            <div className="avatar" style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--text-main)', color: 'var(--bg-color)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold' }}>U</div>
          </div>
        </header>

       <div className="page-content" style={{ flex: 1, overflowY: 'auto', backgroundColor: 'transparent' }}>
          {/* 3. 路由映射到新的模块 */}
          {activePage === 'overview' ? (
            <OverviewPage onNavigate={handleNavigate} lang={lang} dict={dict} />
          ) : activePage === 'world-management' ? (
            <WorldsPage 
              lang={lang} dict={dict}
              onOpenWorldBuilding={(id) => { setSelectedWorldId(id); setActivePage('world-building'); }} 
              onOpenCharacterList={(worldId, worldName) => { 
                setActiveCharWorldId(worldId); 
                setActiveCharWorldName(worldName); 
                setActivePage('character-management'); 
              }}
            />
          ) : activePage === 'world-building' ? (
            <WorldBuildingPage 
              lang={lang as 'zh' | 'en'} 
              worldId={selectedWorldId || ''} 
              onBack={() => { setActivePage('world-management'); window.location.reload(); }} 
            />
          ) : activePage === 'character-management' ? (
            <CharacterListPage 
              worldId={activeCharWorldId || undefined} 
              worldName={activeCharWorldName || ''}
              onBack={() => setActivePage('world-management')} 
            />
          ) : activePage === 'relationships' ? (
            <RelationshipsPage />
          ) : activePage === 'timeline' ? (
            <TimelinePage />
          ) : (
            <div style={{ padding: '2rem', color: 'var(--text-main)' }}><h1>{dict[activePage as keyof typeof dict] || '开发中'}</h1></div>
          )}
        </div>
      </main>
    </div>
  )
}

function OverviewPage({ onNavigate, dict }: { onNavigate: (page: PageKey) => void, lang: Language, dict: any }) {
  const [worlds, setWorlds] = useState<any[]>([])
  const [charCount, setCharCount] = useState(0) // ✅ 新增：记录人物数量

  useEffect(() => {
    // 获取世界列表
    getAllWorlds().then(data => setWorlds(data))
    
    // ✅ 新增：获取人物数量
    fetch("http://127.0.0.1:8000/api/characters")
      .then(res => res.json())
      .then(data => setCharCount(data.length))
      .catch(err => console.error("获取人物数量失败", err))
  }, [])

  return (
    <div className="overview-page" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <section className="page-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="eyebrow" style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px' }}>{dict.dashboard}</div>
          <h1 style={{ margin: 0, color: 'var(--text-main)', fontSize: '24px' }}>{dict.overview.replace('01 ', '')}</h1>
          <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: '14px' }}>{dict.overviewDesc}</p>
        </div>
        <button 
          className="primary-button" 
          type="button" 
          onClick={() => onNavigate('world-management')}
          style={{ padding: '0.75rem 1.5rem', background: 'var(--text-main)', color: 'var(--bg-color)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          {dict.createWorld}
        </button>
      </section>

      <section className="stats-grid" style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
        <StatCard label={dict.worldCount} value={String(worlds.length)} description={dict.createdWorlds} icon="◎" />
                <StatCard label={dict.charCount} value={String(charCount)} description={dict.builtChars} icon="♙" />
        <StatCard label={dict.eventCount} value="0" description={dict.recordedEvents} icon="◇" />
        <StatCard label={dict.simCount} value="0" description={dict.totalSims} icon="▷" />
      </section>

      <section className="dashboard-grid" style={{ marginTop: '2rem', display: 'flex', gap: '1.5rem' }}>
        <div className="glass-card" style={{ flex: 2, padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <div className="panel-heading" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <div>
              <h2 style={{ margin: 0, color: 'var(--text-main)', fontSize: '18px' }}>{dict.workspace}</h2>
              <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '13px' }}>{dict.currentWorlds}</p>
            </div>
            <span className="glass-icon-wrapper" style={{ width: 'auto', borderRadius: '20px', padding: '4px 12px', height: 'auto', fontSize: '11px', fontWeight: 600, color: 'var(--text-main)' }}>WORLD SPACE</span>
          </div>
          
          {worlds.length === 0 ? (
            <div className="empty-state" style={{ textAlign: 'center', padding: '3rem 0', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div className="empty-icon" style={{ fontSize: '3rem', color: 'var(--text-muted)', opacity: 0.5, marginBottom: '1rem' }}>◎</div>
              <h3 style={{ color: 'var(--text-main)' }}>{dict.noWorlds}</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{dict.createFirstWorld}</p>
              <button 
                className="secondary-button" 
                type="button" 
                onClick={() => onNavigate('world-management')} 
                style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: 'transparent', border: '1px solid var(--text-main)', color: 'var(--text-main)', borderRadius: '6px', cursor: 'pointer' }}
              >
                {dict.createFirstBtn}
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
              {worlds.map(w => (
                <div 
                  key={w.id} 
                  onClick={() => { onNavigate('world-management'); }} 
                  style={{ padding: '1rem', border: '1px solid var(--card-border)', borderRadius: '8px', cursor: 'pointer', background: 'rgba(128,128,128,0.05)', transition: 'all 0.2s' }}
                >
                  <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)' }}>{w.name}</h4>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>ID: {w.id}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-card" style={{ flex: 1, padding: '1.5rem' }}>
          <div className="panel-heading" style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ margin: 0, color: 'var(--text-main)', fontSize: '18px' }}>{dict.recentEvents}</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '13px' }}>{dict.latestChanges}</p>
          </div>
          <div className="simple-empty" style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)', fontSize: '13px' }}>{dict.noEvents}</div>
        </div>
      </section>
    </div>
  )
}

function StatCard({ label, value, description, icon }: { label: string; value: string; description: string; icon: string }) {
  return (
    <div className="glass-card" style={{ flex: 1, padding: '1.5rem' }}>
      <div className="stat-card-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: 500 }}>{label}</span>
        <div className="glass-icon-wrapper">
          <span style={{ color: 'var(--text-main)', fontSize: '16px', opacity: 0.8 }}>{icon}</span>
        </div>
      </div>
      <div className="stat-value" style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: '0.5rem 0', color: 'var(--text-main)' }}>{value}</div>
      <div className="stat-description" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{description}</div>
    </div>
  )
}