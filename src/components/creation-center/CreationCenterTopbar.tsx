import { Menu } from 'lucide-react'
import type { ReactNode } from 'react'
import type { BreadcrumbCrumb } from '../../navigation/navRegistry'
import Breadcrumb from '../../components/navigation/Breadcrumb'
import '../../styles/product-workspace.css'

type Lang = 'zh' | 'en'

/**
 * 全站顶部导航（唯一一行）。
 *
 * 只保留「导航开关 + 面包屑 + 内嵌产品标签」。全局搜索、AI 接入 /
 * 后端状态、提醒与个人空间入口已下沉到侧边栏；世界选择已收敛到
 * 「世界库」，顶栏不再单独占用世界选择位。
 *
 * workspace 模式下，产品标签以 `inline` 形式嵌入本行，与面包屑合并为
 * 同一个顶部导航，避免出现两行顶部导航。
 */
export default function CreationCenterTopbar({
  lang,
  page,
  crumbs,
  onOpenNav,
  navOpen,
  onNavigate,
  children,
}: {
  lang: Lang
  page: 'home' | 'identity' | 'community' | 'community-social' | 'spirit-economy' | 'assets' | 'works' | 'workspace'
  crumbs: BreadcrumbCrumb[]
  onOpenNav?: () => void
  /** 抽屉是否展开：供开关的 aria-expanded 使用。 */
  navOpen?: boolean
  onNavigate: (page: string) => void
  /** workspace 模式下嵌入的产品标签，与面包屑同属一行。 */
  children?: ReactNode
}) {
  const isWorkspace = page === 'workspace'

  return (
    <header className="cc-topbar">
      <div className={isWorkspace ? 'cc-workspace-head' : 'cc-breadcrumb'}>
        {onOpenNav && (
          <button
            type="button"
            className="cc-nav-toggle"
            onClick={onOpenNav}
            aria-label={lang === 'zh' ? '打开导航' : 'Open navigation'}
            aria-expanded={navOpen ?? undefined}
            aria-controls="cc-global-nav"
          >
            <Menu size={17} strokeWidth={1.8} aria-hidden="true" />
          </button>
        )}
        <Breadcrumb crumbs={crumbs} onNavigate={onNavigate} lang={lang} />
        {isWorkspace && children}
      </div>
    </header>
  )
}
