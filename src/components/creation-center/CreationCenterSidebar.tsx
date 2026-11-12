import {
  BriefcaseBusiness,
  Cloud,
  Compass,
  Gamepad2,
  IdCard,
  MessagesSquare,
  PanelLeftClose,
  Settings,
  ShoppingBag,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react'

export type HomeNavTarget =
  | 'home'
  | 'identity'
  | 'community'
  | 'community-social'
  | 'ai-interaction'
  | 'game-experience'
  | 'content-store'
  | 'yunbao'
  | 'business'
  | 'settings'

type Lang = 'zh' | 'en'

type NavItem = {
  target: HomeNavTarget
  label: string
  icon: LucideIcon
  active?: boolean
}

type NavGroup = {
  label: string
  items: NavItem[]
}

function groups(lang: Lang, active: 'home' | 'identity' | 'community' | 'community-social' | 'ai-interaction' | 'game-experience' | 'content-store' | 'business'): NavGroup[] {
  return [
    {
      label: lang === 'zh' ? '个人空间' : 'Personal Space',
      items: [
        { target: 'identity', label: lang === 'zh' ? '用户与身份中心' : 'User & Identity Center', icon: IdCard, active: active === 'identity' },
      ],
    },
    {
      label: lang === 'zh' ? '创作与体验' : 'Creation & Experience',
      items: [
        { target: 'home', label: lang === 'zh' ? '创作中心' : 'Creation Center', icon: Compass, active: active === 'home' },
        { target: 'community', label: lang === 'zh' ? '内容社区' : 'Content Community', icon: MessagesSquare, active: active === 'community' },
        { target: 'community-social', label: lang === 'zh' ? '社区社交' : 'Community Social', icon: Users, active: active === 'community-social' },
        { target: 'ai-interaction', label: lang === 'zh' ? 'AI 互动中心' : 'AI Interaction Center', icon: Sparkles, active: active === 'ai-interaction' },
        { target: 'game-experience', label: lang === 'zh' ? '游戏体验中心' : 'Game Experience Center', icon: Gamepad2, active: active === 'game-experience' },
        { target: 'content-store', label: lang === 'zh' ? '内容商城' : 'Content Store', icon: ShoppingBag, active: active === 'content-store' },
      ],
    },
    {
      label: lang === 'zh' ? '账户服务' : 'Account Services',
      items: [
        { target: 'business', label: lang === 'zh' ? '商业与服务中心' : 'Business & Services', icon: BriefcaseBusiness, active: active === 'business' },
      ],
    },
  ]
}

export default function CreationCenterSidebar({
  lang,
  active,
  onNavigate,
  onToggleLang,
  onCollapse,
  collapsed = false,
  canAccessYunbao = false,
}: {
  lang: Lang
  active: 'home' | 'identity' | 'community' | 'community-social' | 'ai-interaction' | 'game-experience' | 'content-store' | 'business'
  onNavigate: (target: HomeNavTarget) => void
  onToggleLang: () => void
  onCollapse: () => void
  collapsed?: boolean
  canAccessYunbao?: boolean
}) {
  return (
    <aside
      className={`cc-sidebar${collapsed ? ' is-collapsed' : ''}`}
      aria-label={lang === 'zh' ? '全局导航' : 'Global navigation'}
      aria-hidden={collapsed ? true : undefined}
    >
      <div className="cc-brand">
        <div className="cc-brand-mark" aria-hidden="true">W</div>
        <div className="cc-brand-copy">
          <strong>{lang === 'zh' ? '世界模拟器' : 'World Simulator'}</strong>
          <span>World Simulator</span>
        </div>
        <button
          type="button"
          className="cc-sidebar-collapse"
          onClick={onCollapse}
          title={lang === 'zh' ? '收起侧边栏' : 'Collapse sidebar'}
          aria-label={lang === 'zh' ? '收起侧边栏' : 'Collapse sidebar'}
        >
          <PanelLeftClose size={16} strokeWidth={1.7} aria-hidden="true" />
        </button>
      </div>

      <nav className="cc-nav-scroll">
        {groups(lang, active).map((group) => (
          <div className="cc-nav-group" key={group.label}>
            <p className="cc-nav-label">{group.label}</p>
            {group.items.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.target}
                  type="button"
                  className={`cc-nav-item${item.active ? ' active' : ''}`}
                  onClick={() => onNavigate(item.target)}
                  aria-current={item.active ? 'page' : undefined}
                >
                  <Icon className="cc-nav-icon" aria-hidden="true" strokeWidth={1.6} />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="cc-sidebar-bottom">
        {canAccessYunbao && (
          <button type="button" className="cc-nav-item cc-yunbao-entry" onClick={() => onNavigate('yunbao')}>
            <Cloud className="cc-nav-icon" aria-hidden="true" strokeWidth={1.6} />
            <span>{lang === 'zh' ? '云宝工作台' : 'Yunbao Workspace'}</span>
            <small>{lang === 'zh' ? '开发者' : 'Dev'}</small>
          </button>
        )}
        <button type="button" className="cc-nav-item" onClick={() => onNavigate('settings')}>
          <Settings className="cc-nav-icon" aria-hidden="true" strokeWidth={1.6} />
          <span>{lang === 'zh' ? '设置' : 'Settings'}</span>
        </button>
        <div className="cc-sidebar-footline">
          <button
            type="button"
            className="cc-lang-button"
            onClick={onToggleLang}
            title={lang === 'zh' ? '切换到英文' : 'Switch to Chinese'}
          >
            {lang === 'zh' ? '中 / EN' : 'EN / 中'}
          </button>
          <span>V1.0</span>
        </div>
      </div>
    </aside>
  )
}
