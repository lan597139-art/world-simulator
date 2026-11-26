/**
 * 全局侧边栏（唯一渲染实现）。
 *
 * 分组与条目全部来自 navigation/globalNav.ts 的 GLOBAL_NAV / TOOL_NAV，
 * 不再在本文件硬编码——侧边栏与面包屑消费同一份定义，避免双轨漂移。
 *
 * 结构：创作与体验（创作中心 / 作品集 / 广场）/ 创作管理 / 账户服务，
 * 底部固定工具入口：云宝工作台（开发者）、设置、语言切换。
 * 「个人中心」已按信息架构规划移入侧栏个人入口，不再占业务区域。
 *
 * 平铺导航：取消分组上下级选择，创作管理、账户服务等全部条目平铺展示，
 * 与面包屑共用同一 GLOBAL_NAV 定义，避免双轨漂移。
 */
import { ChevronLeft, Cloud, PanelLeftClose } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { GLOBAL_NAV, TOOL_NAV } from '../../navigation/globalNav'
import type { Lang, PageKey } from '../../navigation/types'
import type { AuthUser } from '../../api/auth'
import SidebarSearch from './SidebarSearch'
import SidebarAccount from './SidebarAccount'

/**
 * 侧边栏向外的导航目标。
 * 除真实页面 key 外，保留顶栏个人菜单等历史别名，避免调用方改动：
 * identity → 个人中心；assets 为旧分区名。
 */
export type HomeNavTarget =
  | PageKey
  | 'identity'
  | 'assets'

function isActive(active: PageKey, key: PageKey): boolean {
  return active === key
}

export default function CreationCenterSidebar({
  lang,
  active,
  onNavigate,
  onToggleLang,
  onCollapse,
  collapsed = false,
  autoHidden = false,
  drawerOpen = false,
  narrow = false,
  canAccessYunbao = false,
  user = null,
  backendStatus = 'loading',
  hasPersonalAi = false,
  onOpenAi,
  onOpenSettings,
  onOpenIdentity,
  onLogout,
  onBackToProducts,
}: {
  lang: Lang
  active: PageKey
  onNavigate: (target: HomeNavTarget) => void
  onToggleLang: () => void
  onCollapse: () => void
  collapsed?: boolean
  autoHidden?: boolean
  drawerOpen?: boolean
  /** 窄屏抽屉态：导航后自动关闭，并把语义切换为 modal 对话框。 */
  narrow?: boolean
  canAccessYunbao?: boolean
  user?: AuthUser | null
  backendStatus?: 'loading' | 'connected' | 'error'
  hasPersonalAi?: boolean
  onOpenAi: () => void
  onOpenSettings: () => void
  onOpenIdentity: () => void
  onLogout: () => void
  /** 产品工作台下的返回入口：不单独占用导航，折叠为符号按钮。 */
  onBackToProducts?: () => void
}) {
  // 抽屉里点任一条目即完成任务，立即收起，避免遮住刚打开的页面。
  const handleNavigate = (target: HomeNavTarget) => {
    onNavigate(target)
    if (narrow) onCollapse()
  }

  // 平铺导航：取消分组上下级选择，全部条目平铺展示。
  const toolItems: Array<{ key: PageKey; label: string; icon: LucideIcon | null }> = [
    ...(canAccessYunbao ? [{ key: 'yunbao' as PageKey, label: lang === 'zh' ? '云宝工作台' : 'Yunbao Workspace', icon: Cloud }] : []),
    ...TOOL_NAV.map((item) => ({ key: item.key, label: lang === 'zh' ? item.label.zh : item.label.en, icon: item.icon })),
  ]

  const renderNavItem = (key: PageKey, label: string, icon: ReactNode, extra?: ReactNode) => (
    <button
      key={key}
      type="button"
      className={`cc-nav-item${isActive(active, key) ? ' active' : ''}`}
      onClick={() => handleNavigate(key)}
      aria-current={isActive(active, key) ? 'page' : undefined}
    >
      {icon}
      <span>{label}</span>
      {extra}
    </button>
  )

  return (
    <aside
      className={`cc-sidebar${collapsed ? ' is-collapsed' : ''}${autoHidden ? ' is-auto-hidden' : ''}${drawerOpen ? ' is-drawer-open' : ''}`}
      aria-label={lang === 'zh' ? '全局导航' : 'Global navigation'}
      aria-hidden={collapsed || autoHidden ? true : undefined}
      role={drawerOpen ? 'dialog' : undefined}
      aria-modal={drawerOpen ? true : undefined}
      id="cc-global-nav"
    >
      <div className="cc-brand">
        <div className="cc-brand-copy">
          <strong>{'foster'}</strong>
          <span>foster</span>
        </div>
        {onBackToProducts && (
          <button
            type="button"
            className="cc-sidebar-back"
            onClick={onBackToProducts}
            title={lang === 'zh' ? '上一级' : 'Previous level'}
            aria-label={lang === 'zh' ? '上一级' : 'Previous level'}
          >
            <ChevronLeft size={16} strokeWidth={1.9} aria-hidden="true" />
          </button>
        )}
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

      <SidebarSearch lang={lang} onNavigate={(page) => handleNavigate(page as HomeNavTarget)} />

      <SidebarAccount
        lang={lang}
        user={user}
        backendStatus={backendStatus}
        hasPersonalAi={hasPersonalAi}
        onOpenAi={onOpenAi}
        onOpenSettings={onOpenSettings}
        onOpenIdentity={onOpenIdentity}
        onLogout={onLogout}
        onNavigate={(page) => handleNavigate(page as HomeNavTarget)}
      />

      <nav className="cc-nav-scroll">
        <div className="cc-nav-group">
          {GLOBAL_NAV.flatMap((group) => group.items.map((item) => {
            const Icon = item.icon
            return renderNavItem(
              item.key,
              lang === 'zh' ? item.label.zh : item.label.en,
              <Icon className="cc-nav-icon" aria-hidden="true" strokeWidth={1.6} />,
            )
          }))}
        </div>
        <div className="cc-nav-group">
          {toolItems.map((item) => {
            const isYunbao = item.key === 'yunbao'
            const Icon = item.icon
            return renderNavItem(
              item.key,
              item.label,
              Icon ? <Icon className="cc-nav-icon" aria-hidden="true" strokeWidth={1.6} /> : null,
              isYunbao ? <small>{lang === 'zh' ? '开发者' : 'Dev'}</small> : undefined,
            )
          })}
        </div>
      </nav>

      <div className="cc-sidebar-bottom">
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
