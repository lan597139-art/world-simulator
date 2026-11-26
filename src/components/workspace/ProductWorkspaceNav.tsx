import type { ProductConfig, ProductKey } from '../../product/types'
import { PAGE_LABELS_EN } from '../../product/labels'

type Lang = 'zh' | 'en'

type NavItem = { page: string; label: string }

/**
 * 数据安全页（时光机 / 归档库 / 回收站）保留能力但不再占用顶部标签，
 * 用户明确要求删除「更多」溢出按钮，因此这些入口不进入主标签栏。
 */
const HIDDEN_PAGES = new Set(['time-machine', 'archive', 'trash'])

function cleanLabel(label: string) {
  return label.replace(/^\d+\s*/, '')
}

/** 需要先选中具体作品才开放的模块：共创入口已移除，保留社区与后续工作工具。 */
const WORK_GATED_MODULES = new Set(['world-community'])

function collectTabs(product: ProductKey, productConfig: ProductConfig, lang: Lang, worldSelected: boolean, workSelected: boolean): NavItem[] {
  const primaryNav: NavItem[] = []
  // 仅「创作中心」类产品（游戏 / 文学）存在作品 → 共创的工作链，需要按作品选中状态收口。
  const creationProduct = product === 'game' || product === 'literature'
  for (const [groupIndex, group] of productConfig.nav_groups.entries()) {
    // 未选中具体世界时，只保留「世界库」入口；选中世界后才出现人物管理 / 背景等下游工具。
    if (!worldSelected && groupIndex > 0) continue
    // 未选中具体作品时，隐藏「共创」及后续工作工具导航，仅保留背景与作品入口。
    if (creationProduct && !workSelected && (groupIndex > 1 || WORK_GATED_MODULES.has(group.items[0]?.module))) {
      if (groupIndex > 1) continue
    }
    for (const item of group.items) {
      if (creationProduct && !workSelected && WORK_GATED_MODULES.has(item.module)) continue
      const page = item.page === 'overview' || (product === 'yunbao' && item.page === 'yunbao') ? 'workspace-home' : item.page
      if (page === 'workspace-home' || HIDDEN_PAGES.has(page)) continue
      if (primaryNav.some((row) => row.page === page)) continue
      const fallback = cleanLabel(item.label)
      primaryNav.push({ page, label: lang === 'zh' ? fallback : (PAGE_LABELS_EN[page as keyof typeof PAGE_LABELS_EN] || fallback) })
    }
  }
  return primaryNav
}

export default function ProductWorkspaceNav({
  lang,
  product,
  productConfig,
  activePage,
  error,
  onNavigate,
  inline = false,
  worldSelected = true,
  workSelected = true,
}: {
  lang: Lang
  product: ProductKey
  productConfig: ProductConfig
  activePage: string
  error?: string
  onNavigate: (page: string) => void
  /** 内联模式：嵌入顶栏，与面包屑合并为同一个顶部导航，不使用 sticky 包裹层。 */
  inline?: boolean
  /** 是否已选中具体世界；未选中时仅展示「世界库」入口。 */
  worldSelected?: boolean
  /** 是否已选中具体作品；创作中心未选中作品时仅展示背景与作品入口。 */
  workSelected?: boolean
}) {
  const primaryNav = collectTabs(product, productConfig, lang, worldSelected, workSelected)
  const isActive = (item: NavItem) =>
    activePage === item.page || (item.page === 'simulation' && activePage === 'writing')

  const tabs = (
    <nav className={`pw-tabs${inline ? ' pw-tabs--inline' : ''}`} aria-label={lang === 'zh' ? '产品模块' : 'Product modules'}>
      {primaryNav.map((item) => (
        <button
          key={item.page}
          type="button"
          className={`pw-tab${isActive(item) ? ' active' : ''}`}
          onClick={() => onNavigate(item.page)}
          aria-current={isActive(item) ? 'page' : undefined}
        >
          {item.label}
        </button>
      ))}
    </nav>
  )

  if (inline) {
    return tabs
  }

  return (
    <>
      <div className="pw-tabs-wrap">
        {tabs}
      </div>
      {error && <div className="pw-error" role="alert">{error}</div>}
    </>
  )
}
