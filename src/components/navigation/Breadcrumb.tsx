/**
 * 全站统一面包屑。
 *
 * 设计调整：不再用可点击的文本层级（世界模拟器 / 创作与体验 / 创作中心）表达
 * 往返路径，改为统一的符号化层级导航——「< 上一级 / > 下一级」+ 当前层级。
 * 层级来源仍由 navRegistry.buildBreadcrumb 生成，保证与侧栏同源，只是展示
 * 从文本路径收敛为符号移动，避免往返层级重复占用导航。
 */
import type { BreadcrumbCrumb, Lang, PageKey } from '../../navigation/navRegistry'
import LevelNavigator from './LevelNavigator'

interface BreadcrumbProps {
  crumbs: BreadcrumbCrumb[]
  onNavigate: (page: PageKey) => void
  lang: Lang
}

export default function Breadcrumb({ crumbs, onNavigate, lang }: BreadcrumbProps) {
  if (crumbs.length === 0) return null

  const levels = crumbs.map((crumb) => ({
    key: crumb.key,
    label: crumb.label,
    page: crumb.page,
  }))

  return (
    <nav
      className="ws-breadcrumb"
      aria-label={lang === 'zh' ? '层级导航' : 'Level navigation'}
    >
      <LevelNavigator levels={levels} currentIndex={crumbs.length - 1} onNavigate={onNavigate} lang={lang} />
    </nav>
  )
}
