/**
 * 统一导航注册表：全站面包屑的层级来源。
 *
 * 面包屑必须根据项目真实的模块结构与路由关系生成，不允许虚构层级。
 * 一级分组来自全局导航真源（navigation/globalNav.ts）的 GLOBAL_NAV，
 * 二级分组来自各产品的 nav_groups（ProductConfig），因此面包屑与侧边栏、
 * 分组导航始终同源，不会出现两套互相漂移的层级定义。
 *
 * 体验中心已合并进作品集，作品发现、作品详情与普通/灵果体验统一在
 * 作品集完成，不再有独立的体验中心入口，面包屑中不再出现该层级。
 */
import type { ProductConfig, ProductKey } from '../product/types'
import { NAV_GROUP_EN, PAGE_LABELS_EN, PRODUCT_EN } from '../product/labels'
import { GLOBAL_NAV, TOOL_NAV } from './globalNav'
import type { GlobalNavItem } from './globalNav'
import type { Lang, PageKey } from './types'

export type { Lang, PageKey } from './types'
export type { GlobalNavGroup, GlobalNavItem } from './globalNav'

export interface BreadcrumbCrumb {
  /** 稳定标识，用于 React key 与折叠状态。 */
  key: string
  label: string
  /** 可点击跳转的目标页；缺省表示不可点击。 */
  page?: PageKey
  /** 是否为当前页面（最后一级，不可点击）。 */
  isCurrent?: boolean
}

/** 兼容旧引用的别名：全局导航分组与工具入口。 */
export const GLOBAL_NAV_GROUPS = GLOBAL_NAV
export const GLOBAL_SETTINGS: GlobalNavItem = TOOL_NAV[0]

/**
 * 产品工作空间中未出现在 nav_groups 的页面（历史保留入口或专用工作流），
 * 为其补充真实归属分组，避免面包屑出现"无父级"的孤立层级。
 */
const EXTRA_GROUP: Partial<Record<PageKey, { zh: string; en: string }>> = {
  'world-building': { zh: '世界构建', en: 'World Building' },
  multipath: { zh: '模拟与推演', en: 'Simulation' },
  writing: { zh: '写作辅助', en: 'Writing' },
  'companion-runtime': { zh: '人格与记忆', en: 'Persona & Memory' },
  memories: { zh: '人格与记忆', en: 'Persona & Memory' },
  personas: { zh: '人格与记忆', en: 'Persona & Memory' },
  'yunbao-seed': { zh: '人格与记忆', en: 'Persona & Memory' },
  'information-sources': { zh: '经历与来源', en: 'Experience & Sources' },
  'workspace-home': { zh: '工作区总览', en: 'Workspace Overview' },
  yunbao: { zh: '云宝工作台', en: 'Yunbao Workspace' },
  'world-background': { zh: '背景', en: 'Background' },
  'world-map': { zh: '地图', en: 'Maps' },
  'world-works': { zh: '作品', en: 'Works' },
  'world-illustration': { zh: '插画集', en: 'Illustrations' },
  'world-cocreation': { zh: '共创', en: 'Co-creation' },
  'world-community': { zh: '社区', en: 'Community' },
}

/** 全局中心页面（不属于任何产品工作空间）。 */
const GLOBAL_PAGES: PageKey[] = [
  'home', 'user-center', 'community', 'community-social', 'spirit-economy',
  'settings',
  'creator-assets', 'works',
]

function pick(zh: string, en: string, lang: Lang): string {
  return lang === 'en' ? en : zh
}

function itemLabel(item: GlobalNavItem, lang: Lang): string {
  return lang === 'en' ? item.label.en : item.label.zh
}

function pageName(page: PageKey, fallback: string, lang: Lang): string {
  return lang === 'en' ? PAGE_LABELS_EN[page] || fallback : fallback
}

function groupName(title: string, lang: Lang): string {
  return lang === 'en' ? NAV_GROUP_EN[title] || title : title
}

function productLabel(product: ProductKey, config: ProductConfig | null, lang: Lang): string {
  const english = PRODUCT_EN[product]
  if (lang === 'en' && english) return english.label
  return config?.label || english?.label || product
}

/** 找到全局导航中承载某页面的分组与条目（消费体验子页会命中其分区）。 */
function findGlobalEntry(page: PageKey): { group: (typeof GLOBAL_NAV)[number]; item: GlobalNavItem } | null {
  for (const group of GLOBAL_NAV) {
    const item = group.items.find((entry) => entry.key === page)
    if (item) return { group, item }
  }
  return null
}

/**
 * 根据当前页面、产品与真实导航结构生成面包屑层级。
 * 返回的层级顺序为：世界模拟器 > 一级模块 > 二级模块 > 当前页面。
 */
export function buildBreadcrumb(options: {
  page: PageKey
  product: ProductKey
  productConfig: ProductConfig | null
  lang: Lang
}): BreadcrumbCrumb[] {
  const { page, product, productConfig, lang } = options
  const root: BreadcrumbCrumb = {
    key: 'root',
    label: pick('世界模拟器', 'World Simulator', lang),
    page: 'home',
  }

  if (GLOBAL_PAGES.includes(page)) {
    if (page === 'settings') {
      const settings = GLOBAL_SETTINGS
      return [
        root,
        { key: 'settings-group', label: itemLabel(settings, lang), page: 'settings' },
        { key: 'current', label: itemLabel(settings, lang), isCurrent: true },
      ]
    }

    // 个人中心已从业务区域移入顶栏个人入口，不再挂在一级分组下。
    if (page === 'user-center') {
      return [
        root,
        { key: 'current', label: pick('个人中心', 'Personal Center', lang), isCurrent: true },
      ]
    }

    const entry = findGlobalEntry(page)
    if (entry) {
      return [
        root,
        {
          key: `group:${entry.group.title.zh}`,
          label: pick(entry.group.title.zh, entry.group.title.en, lang),
          page: entry.group.items[0].key,
        },
        { key: 'current', label: itemLabel(entry.item, lang), isCurrent: true },
      ]
    }

    return [root, { key: 'current', label: pick('创作中心', 'Creation Center', lang), isCurrent: true }]
  }

  // 产品工作空间页面：世界模拟器 > 产品 > 分组 > 当前页面
  const productCrumb: BreadcrumbCrumb = {
    key: `product:${product}`,
    label: productLabel(product, productConfig, lang),
    page: productConfig?.home as PageKey | undefined,
  }

  if (productConfig) {
    for (const group of productConfig.nav_groups) {
      const item = group.items.find((entry) => entry.page === page)
      if (item) {
        return [
          root,
          productCrumb,
          { key: `group:${group.title}`, label: groupName(group.title, lang), page: group.items[0].page as PageKey },
          { key: 'current', label: pageName(item.page as PageKey, item.label, lang), isCurrent: true },
        ]
      }
    }
  }

  const extra = EXTRA_GROUP[page]
  if (extra) {
    return [
      root,
      productCrumb,
      { key: `group:extra:${page}`, label: pick(extra.zh, extra.en, lang), page: productConfig?.home as PageKey | undefined },
      { key: 'current', label: pageName(page, page, lang), isCurrent: true },
    ]
  }

  return [root, productCrumb, { key: 'current', label: pageName(page, page, lang), isCurrent: true }]
}

