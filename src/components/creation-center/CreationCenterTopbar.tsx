import { useEffect, useRef, useState } from 'react'
import { Bell, ChevronDown, LogOut, Search, Settings, UserRound } from 'lucide-react'
import type { AuthUser } from '../../api/auth'

type Lang = 'zh' | 'en'

export default function CreationCenterTopbar({
  lang,
  page,
  productLabel,
  user,
  backendStatus,
  hasPersonalAi,
  onOpenAi,
  onOpenSettings,
  onOpenIdentity,
  onLogout,
  autoHidden = false,
}: {
  lang: Lang
  page: 'home' | 'identity' | 'community' | 'community-social' | 'business' | 'ai-center' | 'game-center' | 'content-store' | 'workspace'
  productLabel?: string
  user: AuthUser | null
  backendStatus: 'loading' | 'connected' | 'error'
  hasPersonalAi: boolean
  onOpenAi: () => void
  onOpenSettings: () => void
  onOpenIdentity: () => void
  onLogout: () => void
  autoHidden?: boolean
}) {
  const [panel, setPanel] = useState<'profile' | 'notifications' | null>(null)
  const topRightRef = useRef<HTMLDivElement>(null)
  const displayName = user?.display_name || (lang === 'zh' ? '本地用户' : 'Local user')
  const initial = displayName.trim().charAt(0).toUpperCase() || 'U'

  useEffect(() => {
    if (!panel) return
    const close = (event: MouseEvent) => {
      if (!topRightRef.current?.contains(event.target as Node)) setPanel(null)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPanel(null)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [panel])

  const breadcrumbRoot = page === 'identity' ? (lang === 'zh' ? '用户与身份中心' : 'User & Identity Center') : page === 'community' ? (lang === 'zh' ? '内容社区' : 'Content Community') : page === 'community-social' ? (lang === 'zh' ? '社区社交' : 'Community Social') : page === 'business' ? (lang === 'zh' ? '商业与服务中心' : 'Business & Services') : page === 'ai-center' ? (lang === 'zh' ? 'AI 互动中心' : 'AI Interaction Center') : page === 'game-center' ? (lang === 'zh' ? '游戏体验中心' : 'Game Experience Center') : page === 'content-store' ? (lang === 'zh' ? '内容商城' : 'Content Store') : (lang === 'zh' ? '创作中心' : 'Creation Center')
  const breadcrumbCurrent = productLabel || (page === 'identity' ? (lang === 'zh' ? '个人管理' : 'Profile') : page === 'community' ? (lang === 'zh' ? '发现' : 'Discover') : page === 'community-social' ? (lang === 'zh' ? '讨论与关系' : 'Discussions & Relations') : page === 'business' ? (lang === 'zh' ? '账户与服务' : 'Account & Services') : page === 'ai-center' ? (lang === 'zh' ? '角色与关系' : 'Characters & Relations') : page === 'game-center' ? (lang === 'zh' ? '剧情与探索' : 'Story & Exploration') : page === 'content-store' ? (lang === 'zh' ? '资产与授权' : 'Assets & Licensing') : (lang === 'zh' ? '首页' : 'Home'))

  return (
    <header className={`cc-topbar${autoHidden ? ' is-auto-hidden' : ''}`}>
      <div className="cc-breadcrumb">
        <span>{breadcrumbRoot}</span>
        <span className="cc-breadcrumb-sep">/</span>
        <strong>{breadcrumbCurrent}</strong>
      </div>

      <form
        className="cc-search"
        role="search"
        onSubmit={(event) => event.preventDefault()}
      >
        <Search className="cc-search-icon" aria-hidden="true" strokeWidth={1.7} />
        <input
          type="search"
          aria-label={lang === 'zh' ? '搜索' : 'Search'}
          placeholder={lang === 'zh' ? '搜索世界、人物、作品…' : 'Search worlds, characters, works…'}
        />
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
            className="cc-icon-button has-dot"
            title={lang === 'zh' ? '提醒' : 'Notifications'}
            aria-label={lang === 'zh' ? '提醒' : 'Notifications'}
            aria-expanded={panel === 'notifications'}
            onClick={() => setPanel(panel === 'notifications' ? null : 'notifications')}
          >
            <Bell aria-hidden="true" strokeWidth={1.6} />
          </button>
          {panel === 'notifications' && (
            <div className="cc-popover" role="dialog" aria-label={lang === 'zh' ? '提醒' : 'Notifications'}>
              <div className="cc-popover-title">{lang === 'zh' ? '提醒' : 'Notifications'}</div>
              <div className="cc-popover-empty">
                {lang === 'zh' ? '暂无新提醒' : 'No new notifications'}
              </div>
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
            <span className="cc-avatar">{initial}</span>
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
