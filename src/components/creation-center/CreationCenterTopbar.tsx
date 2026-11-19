import { useEffect, useRef, useState } from 'react'
import { Bell, ChevronDown, LogOut, Menu, Plus, Search, Settings, UserRound } from 'lucide-react'
import type { AuthUser } from '../../api/auth'
import { resolveMediaUrl } from '../../api/media'
import type { BreadcrumbCrumb } from '../../navigation/navRegistry'
import Breadcrumb from '../../components/navigation/Breadcrumb'
import { listGlobalNotifications, readAllGlobalNotifications, searchGlobal, type GlobalNotification, type SearchGroup } from '../../api/platform'

type Lang = 'zh' | 'en'

export default function CreationCenterTopbar({
  lang,
  page,
  crumbs,
  productLabel,
  currentWorldName,
  currentWorldId,
  worlds,
  onSelectWorld,
  onOpenWorlds,
  onCreateWorld,
  onOpenNav,
  user,
  backendStatus,
  hasPersonalAi,
  onOpenAi,
  onOpenSettings,
  onOpenIdentity,
  onLogout,
  onNavigate,
}: {
  lang: Lang
  page: 'home' | 'identity' | 'community' | 'community-social' | 'business' | 'spirit-economy' | 'ai-center' | 'game-center' | 'content-store' | 'assets' | 'works' | 'workspace'
  crumbs: BreadcrumbCrumb[]
  productLabel?: string
  currentWorldName?: string
  currentWorldId?: string
  worlds?: Array<{ id: string; name: string }>
  onSelectWorld?: (id: string) => void
  onOpenWorlds?: () => void
  onCreateWorld?: () => void
  onBackToCenter?: () => void
  onOpenNav?: () => void
  user: AuthUser | null
  backendStatus: 'loading' | 'connected' | 'error'
  hasPersonalAi: boolean
  onOpenAi: () => void
  onOpenSettings: () => void
  onOpenIdentity: () => void
  onLogout: () => void
  onNavigate: (page: string) => void
}) {
  const [panel, setPanel] = useState<'profile' | 'notifications' | null>(null)
  const [worldOpen, setWorldOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [searchGroups, setSearchGroups] = useState<SearchGroup[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const [notifications, setNotifications] = useState<GlobalNotification[]>([])
  const [notificationCount, setNotificationCount] = useState(0)
  const topRightRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLFormElement>(null)
  const displayName = user?.display_name || (lang === 'zh' ? '本地用户' : 'Local user')
  const initial = displayName.trim().charAt(0).toUpperCase() || 'U'
  const avatarUrl = user?.avatar_url ? resolveMediaUrl(user.avatar_url) : ''

  useEffect(() => {
    if (!panel && !worldOpen) return
    const close = (event: MouseEvent) => {
      const target = event.target as Node
      if (panel && !topRightRef.current?.contains(target)) setPanel(null)
      if (worldOpen && !worldRef.current?.contains(target)) setWorldOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPanel(null)
        setWorldOpen(false)
      }
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [panel, worldOpen])

  useEffect(() => {
    let live = true
    const load = () => {
      void listGlobalNotifications()
        .then((data) => {
          if (!live) return
          setNotifications(data.items)
          setNotificationCount(data.counts.unread)
        })
        .catch(() => undefined)
    }
    load()
    const timer = window.setInterval(load, 60000)
    return () => { live = false; window.clearInterval(timer) }
  }, [])

  useEffect(() => {
    const value = query.trim()
    if (value.length < 1) {
      setSearchGroups([])
      setSearching(false)
      return
    }
    setSearching(true)
    const timer = window.setTimeout(() => {
      void searchGlobal(value)
        .then((data) => setSearchGroups(data.groups))
        .catch(() => setSearchGroups([]))
        .finally(() => setSearching(false))
    }, 220)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    if (!searchOpen) return
    const close = (event: MouseEvent) => {
      if (!searchRef.current?.contains(event.target as Node)) setSearchOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [searchOpen])

  const isWorkspace = page === 'workspace' && Boolean(productLabel)

  return (
    <header className="cc-topbar">
      {isWorkspace ? (
        <div className="cc-workspace-head">
          {onOpenNav && (
            <button
              type="button"
              className="cc-nav-toggle"
              onClick={onOpenNav}
              aria-label={lang === 'zh' ? '打开导航' : 'Open navigation'}
            >
              <Menu size={17} strokeWidth={1.8} aria-hidden="true" />
            </button>
          )}
          <Breadcrumb crumbs={crumbs} onNavigate={onNavigate} lang={lang} />
          <div className="cc-world-wrap" ref={worldRef}>
            <button
              type="button"
              className="cc-world-trigger"
              aria-expanded={worldOpen}
              aria-haspopup="menu"
              onClick={() => setWorldOpen((value) => !value)}
            >
              <span className="cc-world-copy">
                <small>{lang === 'zh' ? '选择世界' : 'Choose world'}</small>
                <strong>{currentWorldName || (lang === 'zh' ? '选择世界' : 'Choose world')}</strong>
              </span>
              <ChevronDown size={13} strokeWidth={1.8} aria-hidden="true" />
            </button>
            {worldOpen && (
              <div className="cc-world-menu" role="menu">
                <div className="cc-world-menu-head">
                  <span>{lang === 'zh' ? '切换世界' : 'Switch world'}</span>
                  {productLabel && <small>{lang === 'zh' ? `仅 ${productLabel} 场景` : `${productLabel} only`}</small>}
                </div>
                {(worlds || []).length === 0 ? (
                  <div className="cc-world-empty">{lang === 'zh' ? '当前创作场景还没有世界' : 'No worlds in this scene yet'}</div>
                ) : (
                  (worlds || []).map((world) => (
                    <button
                      key={world.id}
                      type="button"
                      role="menuitem"
                      className={`cc-world-item${world.id === currentWorldId ? ' is-active' : ''}`}
                      onClick={() => {
                        setWorldOpen(false)
                        onSelectWorld?.(world.id)
                      }}
                    >
                      <span>{world.name}</span>
                      {world.id === currentWorldId && <span className="cc-world-current">{lang === 'zh' ? '当前' : 'Current'}</span>}
                    </button>
                  ))
                )}
                {(onCreateWorld || onOpenWorlds) && (
                  <div className="cc-world-menu-foot">
                    {onCreateWorld && (
                      <button
                        type="button"
                        className="cc-world-create"
                        onClick={() => {
                          setWorldOpen(false)
                          onCreateWorld()
                        }}
                      >
                        <Plus size={12} strokeWidth={1.8} aria-hidden="true" />
                        {lang === 'zh' ? '新建世界' : 'New world'}
                      </button>
                    )}
                    {onOpenWorlds && (
                      <button
                        type="button"
                        className="cc-world-manage"
                        onClick={() => {
                          setWorldOpen(false)
                          onOpenWorlds()
                        }}
                      >
                        {lang === 'zh' ? '管理世界' : 'Manage worlds'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="cc-breadcrumb">
          {onOpenNav && (
            <button
              type="button"
              className="cc-nav-toggle"
              onClick={onOpenNav}
              aria-label={lang === 'zh' ? '打开导航' : 'Open navigation'}
            >
              <Menu size={17} strokeWidth={1.8} aria-hidden="true" />
            </button>
          )}
          <Breadcrumb crumbs={crumbs} onNavigate={onNavigate} lang={lang} />
        </div>
      )}

      <form
        ref={searchRef}
        className="cc-search"
        role="search"
        onSubmit={(event) => {
          event.preventDefault()
          const first = searchGroups[0]?.items[0]
          if (first) {
            setSearchOpen(false)
            setQuery('')
            onNavigate(first.page)
          }
        }}
      >
        <Search className="cc-search-icon" aria-hidden="true" strokeWidth={1.7} />
        <input
          type="search"
          aria-label={lang === 'zh' ? '搜索' : 'Search'}
          placeholder={lang === 'zh' ? '搜索世界、人物、作品…' : 'Search worlds, characters, works…'}
          value={query}
          onChange={(event) => { setQuery(event.target.value); setSearchOpen(true) }}
          onFocus={() => setSearchOpen(true)}
        />
        {searchOpen && query.trim() && (
          <div className="cc-search-results" role="listbox">
            {searching && <div className="cc-search-state">{lang === 'zh' ? '搜索中…' : 'Searching…'}</div>}
            {!searching && searchGroups.length === 0 && <div className="cc-search-state">{lang === 'zh' ? '没有找到匹配内容' : 'No matches'}</div>}
            {!searching && searchGroups.map((group) => (
              <section key={group.key} className="cc-search-group">
                <div className="cc-search-group-label">
                  {lang === 'zh' ? group.label : ({ worlds: 'Worlds', characters: 'Characters', events: 'Events', works: 'Works', posts: 'Posts', users: 'Users', topics: 'Discussions' } as Record<string, string>)[group.key] || group.label}
                </div>
                {group.items.map((item) => (
                  <button
                    key={`${group.key}:${item.id}`}
                    type="button"
                    className="cc-search-hit"
                    onClick={() => {
                      setSearchOpen(false)
                      setQuery('')
                      onNavigate(item.page)
                    }}
                  >
                    <strong>{item.title}</strong>
                    {item.subtitle && <span>{item.subtitle}</span>}
                  </button>
                ))}
              </section>
            ))}
          </div>
        )}
      </form>

      <div className="cc-top-right" ref={topRightRef}>
        <button
          type="button"
          className="cc-status-chip"
          onClick={onOpenAi}
          title={lang === 'zh' ? '填写自己的 API Key，避免消耗站长额度' : 'Use your own API key'}
        >
          <span className={`cc-status-dot${hasPersonalAi ? '' : ' error'}`} />
          <span>
            {lang === 'zh'
              ? `AI 接入 · ${hasPersonalAi ? '已配置' : '未配置'}`
              : `AI access · ${hasPersonalAi ? 'Configured' : 'Not configured'}`}
          </span>
        </button>

        <span className={`cc-status-chip backend`}>
          <span className={`cc-status-dot${backendStatus === 'connected' ? '' : ' error'}`} />
          <span>
            {backendStatus === 'connected'
              ? (lang === 'zh' ? '后端已连接' : 'Backend connected')
              : backendStatus === 'loading'
                ? (lang === 'zh' ? '正在连接' : 'Connecting')
                : (lang === 'zh' ? '后端未连接' : 'Backend offline')}
          </span>
        </span>

        <div className="cc-notify-wrap">
          <button
            type="button"
            className={`cc-icon-button${notificationCount > 0 ? ' has-dot' : ''}`}
            title={lang === 'zh' ? '提醒' : 'Notifications'}
            aria-label={lang === 'zh' ? '提醒' : 'Notifications'}
            aria-expanded={panel === 'notifications'}
            onClick={() => setPanel(panel === 'notifications' ? null : 'notifications')}
          >
            <Bell aria-hidden="true" strokeWidth={1.6} />
          </button>
          {panel === 'notifications' && (
            <div className="cc-popover" role="dialog" aria-label={lang === 'zh' ? '提醒' : 'Notifications'}>
              <div className="cc-popover-title">
                <span>{lang === 'zh' ? '提醒' : 'Notifications'}</span>
                {notificationCount > 0 && <small>{notificationCount} {lang === 'zh' ? '条未读' : 'unread'}</small>}
              </div>
              {notifications.length === 0 ? (
                <div className="cc-popover-empty">{lang === 'zh' ? '暂无新提醒' : 'No new notifications'}</div>
              ) : (
                <div className="cc-notify-list">
                  {notifications.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`cc-notify-item${item.read ? '' : ' is-unread'}`}
                      onClick={() => {
                        setPanel(null)
                        onNavigate(item.page)
                      }}
                    >
                      <strong>{item.title}</strong>
                      {item.body && <span>{item.body}</span>}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="cc-notify-read"
                    onClick={() => {
                      void readAllGlobalNotifications().then(() => {
                        setNotifications((prev) => prev.map((item) => ({ ...item, read: true })))
                        setNotificationCount(0)
                      }).catch(() => undefined)
                    }}
                  >
                    {lang === 'zh' ? '全部标为已读' : 'Mark all as read'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="cc-profile-wrap">
          <button
            type="button"
            className="cc-profile"
            title={lang === 'zh' ? '个人入口' : 'Personal menu'}
            aria-expanded={panel === 'profile'}
            onClick={() => setPanel(panel === 'profile' ? null : 'profile')}
          >
            <span className={`cc-avatar${avatarUrl ? ' has-image' : ''}`}>{avatarUrl ? <img src={avatarUrl} alt="" /> : initial}</span>
            <span className="cc-profile-copy">
              <strong>{displayName}</strong>
              <span>{lang === 'zh' ? '个人空间' : 'Personal space'}</span>
            </span>
            <ChevronDown className="cc-chevron" aria-hidden="true" strokeWidth={1.8} />
          </button>

          {panel === 'profile' && (
            <div className="cc-popover" role="menu" aria-label={lang === 'zh' ? '个人菜单' : 'Personal menu'}>
              <div className="cc-popover-profile">
                <strong>{displayName}</strong>
                <span>{user?.username || (lang === 'zh' ? '本地工作区' : 'Local workspace')}</span>
              </div>
              <button
                type="button"
                className="cc-popover-action"
                role="menuitem"
                onClick={() => {
                  setPanel(null)
                  onOpenIdentity()
                }}
              >
                <UserRound width={14} height={14} aria-hidden="true" strokeWidth={1.6} />
                {lang === 'zh' ? '用户与身份中心' : 'User & Identity Center'}
              </button>
              <button
                type="button"
                className="cc-popover-action"
                role="menuitem"
                onClick={() => {
                  setPanel(null)
                  onOpenSettings()
                }}
              >
                <Settings width={14} height={14} aria-hidden="true" strokeWidth={1.6} />
                {lang === 'zh' ? '设置' : 'Settings'}
              </button>
              <button type="button" className="cc-popover-action" role="menuitem" onClick={onLogout}>
                <LogOut width={14} height={14} aria-hidden="true" strokeWidth={1.6} />
                {lang === 'zh' ? '退出登录' : 'Sign out'}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
