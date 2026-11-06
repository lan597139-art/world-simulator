import { useEffect, useState } from 'react' 
import './App.css'
import WorldsPage from './pages/WorldsPage'
import CharacterBuildingPage from './pages/CharacterBuildingPage'
import WorldBuildingPage from './pages/WorldBuildingPage'
import CharacterListPage from './pages/CharacterListPage' 
import { getAllWorlds } from './services/worldService'

type PageKey = 'overview' | 'worlds' | 'characters' | 'events' | 'simulation' | 'writing' | 'world-building'
export type Language = 'zh' | 'en'

export const t = {
  zh: {
    overview: '世界总览', worlds: '世界管理', characters: '人物管理', events: '事件管理',
    simulation: '模拟运行', writing: '写作辅助', worldBuilding: '世界建设配置',
    workbench: '工作台', worldBuild: '世界构建', simSystem: '模拟系统',
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
    switchLang: 'Switch to English'
  },
  en: {
    overview: 'Overview', worlds: 'Worlds', characters: 'Characters', events: 'Events',
    simulation: 'Simulation', writing: 'Writing', worldBuilding: 'World Config',
    workbench: 'WORKBENCH', worldBuild: 'BUILDING', simSystem: 'SIMULATION',
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
    switchLang: '切换到中文'
  }
}

export default function App() {
  const [activePage, setActivePage] = useState<PageKey>('overview')
  const [selectedWorldId, setSelectedWorldId] = useState<string | null>(null)
  
  const [activeCharWorldId, setActiveCharWorldId] = useState<string | null>(null) 
  // ✅ 新增：用来记录当前人物管理对应的世界名字
  const [activeCharWorldName, setActiveCharWorldName] = useState<string>('') 
  
  const [lang, setLang] = useState<Language>('zh')
  const dict = t[lang]

  const navigation = [
    { title: dict.workbench, items: [{ key: 'overview', label: dict.overview, icon: '◫' }] },
    { title: dict.worldBuild, items: [
      { key: 'worlds', label: dict.worlds, icon: '◎' },
      { key: 'characters', label: dict.characters, icon: '♙' },
      { key: 'events', label: dict.events, icon: '◇' },
    ]},
    { title: dict.simSystem, items: [
      { key: 'simulation', label: dict.simulation, icon: '▷' },
      { key: 'writing', label: dict.writing, icon: '▤' },
    ]},
  ] satisfies { title: string; items: { key: PageKey; label: string; icon: string }[] }[]

  function handleNavigate(page: PageKey) {
    setActivePage(page)
    if (page === 'worlds') setSelectedWorldId(null)
    if (page === 'characters') {
      setActiveCharWorldId(null)
      setActiveCharWorldName('') // ✅ 左侧直接点人物管理时清空
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">W</div>
          <div className="brand-text">
            <strong>{lang === 'zh' ? '世界模拟器' : 'World Sim'}</strong>
            <span>WORLD SIMULATOR</span>
          </div>
        </div>
        <div className="workspace-label">PROJECT WORKSPACE</div>
        <nav className="navigation">
          {navigation.map((group) => (
            <div className="nav-group" key={group.title}>
              <div className="nav-group-title">{group.title}</div>
              {group.items.map((item) => (
                <button key={item.key} className={`nav-item ${activePage === item.key ? 'active' : ''}`} onClick={() => handleNavigate(item.key)}>
                  <span className="nav-icon">{item.icon}</span><span>{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
        
        <div className="sidebar-footer" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <button 
            onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
            style={{ padding: '0.5rem', background: '#333', color: '#fff', border: '1px solid #555', borderRadius: '4px', cursor: 'pointer', transition: 'all 0.2s' }}
          >
            {dict.switchLang}
          </button>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div className="status-dot" />
            <span style={{ marginLeft: '0.5rem' }}>{dict.localWS}</span>
            <span className="version" style={{ marginLeft: 'auto' }}>V1.0</span>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            <span>{dict.workbench}</span><span className="breadcrumb-divider">/</span>
            <strong>{activePage === 'world-building' ? dict.worldBuilding : dict[activePage as keyof typeof dict]}</strong>
          </div>
          <div className="topbar-right">
            <span className="workspace-status"><span className="status-dot" />{dict.devEnv}</span>
            <div className="avatar">U</div>
          </div>
        </header>

        <div className="page-content">
          {activePage === 'overview' ? (
            <OverviewPage onNavigate={handleNavigate} lang={lang} dict={dict} />
          ) : activePage === 'worlds' ? (
            <WorldsPage 
              lang={lang} dict={dict}
              onOpenWorldBuilding={(id) => { setSelectedWorldId(id); setActivePage('world-building'); }} 
              // ✅ 核心修改：接收 worldId 和 worldName
              onOpenCharacterList={(worldId, worldName) => { 
                setActiveCharWorldId(worldId); 
                setActiveCharWorldName(worldName); 
                setActivePage('characters'); 
              }}
            />
          ) : activePage === 'world-building' ? (
            <WorldBuildingPage 
              lang={lang as 'zh' | 'en'} 
              worldId={selectedWorldId || ''} 
              onBack={() => { setActivePage('worlds'); window.location.reload(); }} 
            />
          ) : activePage === 'characters' ? (
  <CharacterListPage 
    worldId={activeCharWorldId || undefined} // 允许为空
    worldName={activeCharWorldName || ''}
    onBack={() => setActivePage('worlds')} 
  />
) : (
            <div style={{ padding: '2rem' }}><h1>{dict[activePage as keyof typeof dict]}</h1></div>
          )}
        </div>
      </main>
    </div>
  )
}

function OverviewPage({ onNavigate, lang, dict }: { onNavigate: (page: PageKey) => void, lang: Language, dict: any }) {
  const [worlds, setWorlds] = useState<any[]>([])

  useEffect(() => {
    getAllWorlds().then(data => setWorlds(data))
  }, [])

  return (
    <div className="overview-page" style={{ padding: '2rem' }}>
      <section className="page-heading">
        <div>
          <div className="eyebrow">{dict.dashboard}</div>
          <h1>{dict.overview}</h1>
          <p>{dict.overviewDesc}</p>
        </div>
        <button className="primary-button" type="button" onClick={() => onNavigate('worlds')}>{dict.createWorld}</button>
      </section>

      <section className="stats-grid" style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
        <StatCard label={dict.worldCount} value={String(worlds.length)} description={dict.createdWorlds} icon="◎" />
        <StatCard label={dict.charCount} value="0" description={dict.builtChars} icon="♙" />
        <StatCard label={dict.eventCount} value="0" description={dict.recordedEvents} icon="◇" />
        <StatCard label={dict.simCount} value="0" description={dict.totalSims} icon="▷" />
      </section>

      <section className="dashboard-grid" style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
        <div className="panel main-panel" style={{ flex: 2, background: '#fff', padding: '1.5rem', borderRadius: '8px' }}>
          <div className="panel-heading" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div><h2>{dict.workspace}</h2><p>{dict.currentWorlds}</p></div>
            <span className="panel-tag">WORLD SPACE</span>
          </div>
          {worlds.length === 0 ? (
            <div className="empty-state" style={{ textAlign: 'center', padding: '3rem 0' }}>
              <div className="empty-icon" style={{ fontSize: '3rem' }}>◎</div>
              <h3>{dict.noWorlds}</h3>
              <p style={{ color: '#666' }}>{dict.createFirstWorld}</p>
              <button className="secondary-button" type="button" onClick={() => onNavigate('worlds')} style={{ marginTop: '1rem' }}>{dict.createFirstBtn}</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
              {worlds.map(w => (
                <div key={w.id} onClick={() => { onNavigate('worlds'); }} style={{ padding: '1rem', border: '1px solid #eee', borderRadius: '6px', cursor: 'pointer', background: '#fafafa' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: '#333' }}>{w.name}</h4>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#888' }}>ID: {w.id}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="panel" style={{ flex: 1, background: '#fff', padding: '1.5rem', borderRadius: '8px' }}>
          <div className="panel-heading"><h2>{dict.recentEvents}</h2><p>{dict.latestChanges}</p></div>
          <div className="simple-empty" style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>{dict.noEvents}</div>
        </div>
      </section>
    </div>
  )
}

function StatCard({ label, value, description, icon }: { label: string; value: string; description: string; icon: string }) {
  return (
    <div className="stat-card" style={{ flex: 1, background: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #eee' }}>
      <div className="stat-card-top" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: '#666' }}>{label}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <div className="stat-value" style={{ fontSize: '2rem', fontWeight: 'bold', margin: '0.5rem 0' }}>{value}</div>
      <div className="stat-description" style={{ fontSize: '0.8rem', color: '#999' }}>{description}</div>
    </div>
  )
}