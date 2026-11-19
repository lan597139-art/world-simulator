/**
 * 统一导航注册表：全站面包屑的层级来源。
 *
 * 面包屑必须根据项目真实的模块结构与路由关系生成，不允许虚构层级。
 * 一级分组来自全局侧边栏（GLOBAL_NAV_GROUPS），二级分组来自各产品的
 * nav_groups（ProductConfig），因此面包屑与侧边栏、分组导航始终同源，
 * 不会出现两套互相漂移的层级定义。
 */
import type { ProductConfig, ProductKey } from '../product/types'
import { NAV_GROUP_EN, PAGE_LABELS_EN, PRODUCT_EN } from '../product/labels'

export type PageKey =
  | 'home'
  | 'user-center'
  | 'community'
  | 'settings'
  | 'community-social'
  | 'business'
  | 'spirit-economy'
  | 'ai-center'
  | 'game-center'
  | 'content-store'
  | 'yunbao'
  | 'workspace-home'
  | 'overview'
  | 'world-management'
  | 'character-management'
  | 'relationships'
  | 'events'
  | 'timeline'
  | 'simulation'
  | 'multipath'
  | 'storyline'
  | 'chat'
  | 'writing'
  | 'world-building'
  | 'world-data'
  | 'world-structure'
  | 'archive'
  | 'trash'
  | 'time-machine'
  | 'diary'
  | 'personas'
  | 'yunbao-seed'
  | 'memories'
  | 'companion-runtime'
  | 'information-sources'
  | 'creator-assets'
  | 'works'

export type Lang = 'zh' | 'en'

export interface BreadcrumbCrumb {
  /** 稳定标识，用于 React key 与折叠状态。 */
  key: string
  label: string
  /** 可点击跳转的目标页；缺省表示不可点击。 */
  page?: PageKey
  /** 是否为当前页面（最后一级，不可点击）。 */
  isCurrent?: boolean
}

interface GlobalNavItem {
  page: PageKey
  label: { zh: string; en: string }
}

export interface GlobalNavGroup {
  title: { zh: string; en: string }
  items: GlobalNavItem[]
}

/**
 * 全局侧边栏的唯一分组定义。
 * 该数组同时用于侧边栏渲染与面包屑生成，避免两处漂移。
 */
export const GLOBAL_NAV_GROUPS: GlobalNavGroup[] = [
  {
    title: { zh: '个人空间', en: 'Personal Space' },
    items: [
      { page: 'user-center', label: { zh: '用户与身份中心', en: 'User & Identity Center' } },
    ],
  },
  {
    title: { zh: '创作与体验', en: 'Create & Explore' },
    items: [
      { page: 'home', label: { zh: '创作中心', en: 'Creation Center' } },
      { page: 'community', label: { zh: '内容社区', en: 'Content Community' } },
      { page: 'community-social', label: { zh: '社区社交', en: 'Community Social' } },
      { page: 'ai-center', label: { zh: 'AI 互动中心', en: 'AI Interaction Center' } },
      { page: 'game-center', label: { zh: '游戏体验中心', en: 'Game Experience Center' } },
      { page: 'content-store', label: { zh: '内容商城', en: 'Content Store' } },
    ],
  },
  {
    title: { zh: '创作管理', en: 'Creation Management' },
    items: [
      { page: 'creator-assets', label: { zh: '创作者资产库', en: 'Creator Assets' } },
      { page: 'works', label: { zh: '我的作品', en: 'My Works' } },
    ],
  },
  {
    title: { zh: '账户服务', en: 'Account Services' },
    items: [
      { page: 'spirit-economy', label: { zh: '灵果资源', en: 'Spirit Resources' } },
      { page: 'business', label: { zh: '商业与服务中心', en: 'Business & Services' } },
    ],
  },
]

/** 设置中心独立于分组，作为一级入口单独成层。 */
export const GLOBAL_SETTINGS: GlobalNavItem = {
  page: 'settings',
  label: { zh: '设置中心', en: 'Settings Center' },
}

/**
 * 产品工作空间中未出现在 nav_groups 的页面（历史保留入口或专用工作流），
 * 为其补充真实归属分组，避免面包屑出现“无父级”的孤立层级。
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
}

/** 全局中心页面（不属于任何产品工作空间）。 */
const GLOBAL_PAGES: PageKey[] = [
  'home', 'user-center', 'community', 'community-social', 'business', 'spirit-economy',
  'ai-center', 'game-center', 'content-store', 'settings', 'creator-assets', 'works',
]

function pick(zh: string, en: string, lang: Lang): string {
  return lang === 'en' ? en : zh
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
      return [
        root,
        { key: 'settings-group', label: pick('设置', 'Settings', lang), page: 'settings' },
        { key: 'current', label: pick(GLOBAL_SETTINGS.label.zh, GLOBAL_SETTINGS.label.en, lang), isCurrent: true },
      ]
    }
    for (const group of GLOBAL_NAV_GROUPS) {
      const item = group.items.find((entry) => entry.page === page)
      if (item) {
        return [
          root,
          { key: `group:${group.title.zh}`, label: pick(group.title.zh, group.title.en, lang), page: group.items[0].page },
          { key: 'current', label: pick(item.label.zh, item.label.en, lang), isCurrent: true },
        ]
      }
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
