import { useEffect, useRef, useState } from 'react'
import { Bell, LogOut, Settings } from 'lucide-react'
import type { AuthUser } from '../../api/auth'
import { resolveMediaUrl } from '../../api/media'
import { listGlobalNotifications, readAllGlobalNotifications, type GlobalNotification } from '../../api/platform'

type Lang = 'zh' | 'en'
type BackendStatus = 'loading' | 'connected' | 'error'

/**
 * 侧边栏账户与状态区：AI 接入、后端连接状态、提醒、个人空间入口。
 *
 * 由顶部导航下沉而来，统一收纳在侧栏底部，避免顶栏长期占用。
 * 个人菜单与提醒弹出层均向内容区展开，不遮挡侧栏本身。
 */
export default function SidebarAccount({
  lang,
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
  user: AuthUser | null
  backendStatus: BackendStatus
  hasPersonalAi: boolean
  onOpenAi: () => void
  onOpenSettings: () => void
  onOpenIdentity: () => void
  onLogout: () => void
  onNavigate: (page: string) => void
}) {
  const [panel, setPanel] = useState<'notifications' | null>(null)
  const [notifications, setNotifications] = useState<GlobalNotification[]>([])
  const [notificationCount, setNotificationCount] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)
  const displayName = user?.display_name || (lang === 'zh' ? '本地用户' : 'Local user')
  const initial = displayName.trim().charAt(0).toUpperCase() || 'U'
  const avatarUrl = user?.avatar_url ? resolveMediaUrl(user.avatar_url) : ''

  useEffect(() => {
    if (!panel) return
    const close = (event: MouseEvent) => {
      const target = event.target as Node
      if (!wrapRef.current?.contains(target)) setPanel(null)
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

  return (
    <div className="cc-side-account" ref={wrapRef}>
      <div className="cc-side-status">
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
      </div>

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
          <div className="cc-popover cc-popover--up" role="dialog" aria-label={lang === 'zh' ? '提醒' : 'Notifications'}>
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
          title={lang === 'zh' ? '个人中心' : 'Personal center'}
          onClick={onOpenIdentity}
        >
          <span className={`cc-avatar${avatarUrl ? ' has-image' : ''}`}>{avatarUrl ? <img src={avatarUrl} alt="" /> : initial}</span>
          <span className="cc-profile-copy">
            <strong>{displayName}</strong>
            <span>{lang === 'zh' ? '个人中心' : 'Personal center'}</span>
          </span>
        </button>
        <span className="cc-profile-tools">
          <button
            type="button"
            className="cc-icon-button"
            title={lang === 'zh' ? '设置' : 'Settings'}
            aria-label={lang === 'zh' ? '设置' : 'Settings'}
            onClick={onOpenSettings}
          >
            <Settings width={15} height={15} aria-hidden="true" strokeWidth={1.6} />
          </button>
          <button
            type="button"
            className="cc-icon-button"
            title={lang === 'zh' ? '退出登录' : 'Sign out'}
            aria-label={lang === 'zh' ? '退出登录' : 'Sign out'}
            onClick={onLogout}
          >
            <LogOut width={15} height={15} aria-hidden="true" strokeWidth={1.6} />
          </button>
        </span>
      </div>
    </div>
  )
}
