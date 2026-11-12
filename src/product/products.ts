import type { ProductConfig, ProductKey, ProductMatrix } from './types'

export const PRODUCT_KEYS: ProductKey[] = ['game', 'literature', 'companion', 'diary', 'yunbao']

export const PRODUCT_LABELS: Record<ProductKey, string> = {
  game: '游戏创作',
  literature: '文学创作',
  companion: 'AI 伴侣',
  diary: '日记与传记',
  yunbao: '云宝工作台',
}

export const PRODUCT_SHORT: Record<ProductKey, string> = {
  game: '游戏',
  literature: '文学',
  companion: '伴侣',
  diary: '日记',
  yunbao: '云宝',
}

export const PRODUCT_ICONS: Record<ProductKey, string> = {
  game: '🎮',
  literature: '📖',
  companion: '💬',
  diary: '📔',
  yunbao: '☁',
}

export const PRODUCT_DESCRIPTIONS: Record<ProductKey, string> = {
  game: '人物、NPC、世界规则、任务事件与多结局。',
  literature: '人物关系、事件、故事线、平行空间与写作。',
  companion: '私人角色、长期记忆、私聊与群聊。',
  diary: '独立日记、人生经历、来源标签与传记。',
  yunbao: '云宝的完整专业工作台：游戏、文学、日记与传记的全部能力。',
}

const nav = (title: string, items: [string, string][]) => ({
  title,
  items: items.map(([module, label]) => ({ module, label, page: module })),
})

const MODULE_LABELS: Record<string, string> = {
  overview: '01 世界总览',
  'world-management': '02 世界管理',
  'world-building': '世界建设配置',
  'character-management': '03 人物管理',
  chat: 'AI 角色聊天',
  'world-structure': '世界结构',
  'world-data': '世界设定',
  relationships: '04 关系与组织',
  events: '05 事件管理',
  timeline: '06 时间线',
  simulation: '07 模拟运行',
  storyline: '故事线管理',
  writing: '08 写作辅助',
  multipath: '多路径沙盒',
  'time-machine': '时光机',
  archive: '归档库',
  trash: '回收站',
  personas: '云宝 · 个人 AI 人格',
  'yunbao-seed': '云宝人物种子',
  memories: '记忆管理',
  'companion-runtime': '07 人格运行',
  'information-sources': '信息来源管理',
  diary: '日记与传记',
}

/**
 * 云宝工作台导航的唯一分组定义。
 * 分组与顺序同时用于产品配置、总览卡片和分组上方导航，避免多处漂移。
 */
export const YUNBAO_WORKSPACE_NAV_GROUPS = [
  nav('世界与设定', [
    ['world-building', '世界建设配置'],
    ['world-structure', '世界结构'],
    ['world-data', '世界设定'],
  ]),
  nav('人物与关系', [
    ['character-management', '人物管理'],
    ['relationships', '关系与组织'],
    ['chat', 'AI 角色聊天'],
  ]),
  nav('历程与记录', [
    ['events', '事件管理'],
    ['timeline', '时间线'],
    ['diary', '日记与传记'],
  ]),
  nav('人格与记忆', [
    ['personas', '云宝人格编辑器'],
    ['yunbao-seed', '人物种子编辑器'],
    ['memories', '记忆管理'],
  ]),
]

function config(
  key: ProductKey,
  navGroups: ReturnType<typeof nav>[],
  modes: Record<string, string>,
  extraAllowed: string[] = [],
): ProductConfig {
  const navModules = navGroups.flatMap((group) => group.items.map((item) => item.module))
  const allowed = Array.from(new Set([...navModules, ...extraAllowed]))
  return {
    key,
    label: PRODUCT_LABELS[key],
    short: PRODUCT_SHORT[key],
    icon: PRODUCT_ICONS[key],
    description: PRODUCT_DESCRIPTIONS[key],
    home: key === 'game' ? 'overview' : key === 'literature' ? 'world-management' : key === 'companion' ? 'character-management' : key === 'yunbao' ? 'yunbao' : 'diary',
    auto_workspace: key === 'companion' || key === 'diary' || key === 'yunbao',
    workspace_name: key === 'companion' ? 'AI 伴侣空间' : key === 'diary' ? '人生记录空间' : key === 'yunbao' ? '云宝领域' : null,
    allowed_modules: allowed,
    nav_groups: navGroups,
    modes,
    permissions: {
      world_management: allowed.includes('world-management'),
      world_structure: allowed.includes('world-structure'),
      world_data: allowed.includes('world-data'),
      storyline: allowed.includes('storyline'),
      simulation: allowed.includes('simulation'),
      writing: allowed.includes('writing'),
      personas: allowed.includes('personas'),
      memories: allowed.includes('memories'),
      information_sources: allowed.includes('information-sources'),
    },
  }
}

/**
 * 云宝工作台导航白名单：只控制导航展示。
 * 底层页面与功能不删除；未展示的旧入口仍可按既有逻辑访问。
 */
export const YUNBAO_VISIBLE_PAGES = new Set<string>([
  'workspace-home',
  'world-building',
  'world-structure',
  'world-data',
  'character-management',
  'relationships',
  'chat',
  'events',
  'timeline',
  'diary',
  'personas',
  'yunbao-seed',
  'memories',
])

/** 云宝工作台明确要求隐藏且禁止直达的模块。 */
export const YUNBAO_HIDDEN_PAGES = new Set<string>([
  'world-management',
  'simulation',
  'storyline',
  'writing',
  'multipath',
  'companion-runtime',
  'information-sources',
])

export function navigationConfig(config: ProductConfig): ProductConfig {
  if (config.key !== 'yunbao') return config
  const navGroups = config.nav_groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => YUNBAO_VISIBLE_PAGES.has(item.page)),
    }))
    .filter((group) => group.items.length > 0)
  return {
    ...config,
    nav_groups: navGroups,
    permissions: {
      ...config.permissions,
      world_management: false,
      storyline: false,
      simulation: false,
      writing: false,
      information_sources: false,
    },
  }
}

export const FALLBACK_PRODUCTS: ProductConfig[] = [
  config('game', [
    nav('世界构建', [
      ['overview', MODULE_LABELS.overview],
      ['world-management', MODULE_LABELS['world-management']],
      ['character-management', MODULE_LABELS['character-management']],
      ['chat', 'AI 角色聊天（NPC）'],
      ['world-structure', MODULE_LABELS['world-structure']],
      ['world-data', MODULE_LABELS['world-data']],
      ['relationships', MODULE_LABELS.relationships],
      ['events', MODULE_LABELS.events],
    ]),
    nav('模拟与推演', [
      ['timeline', MODULE_LABELS.timeline],
      ['simulation', MODULE_LABELS.simulation],
      ['storyline', MODULE_LABELS.storyline],
      ['writing', MODULE_LABELS.writing],
    ]),
    nav('数据安全', [
      ['time-machine', MODULE_LABELS['time-machine']],
      ['archive', MODULE_LABELS.archive],
      ['trash', MODULE_LABELS.trash],
    ]),
  ], {
    'character-management': 'full', events: 'narrative', timeline: 'world', simulation: 'full',
    writing: 'narrative', chat: 'npc', relationships: 'world', personas: 'hidden',
  }, ['world-building', 'multipath']),
  config('literature', [
    nav('世界构建', [
      ['world-management', MODULE_LABELS['world-management']],
      ['character-management', MODULE_LABELS['character-management']],
      ['chat', 'AI 角色聊天'],
      ['world-structure', MODULE_LABELS['world-structure']],
      ['world-data', MODULE_LABELS['world-data']],
      ['relationships', MODULE_LABELS.relationships],
      ['events', MODULE_LABELS.events],
    ]),
    nav('故事创作', [
      ['timeline', MODULE_LABELS.timeline],
      ['storyline', MODULE_LABELS.storyline],
      ['writing', MODULE_LABELS.writing],
      ['simulation', '07 模拟运行 · 辅助'],
    ]),
    nav('数据安全', [
      ['time-machine', MODULE_LABELS['time-machine']],
      ['archive', MODULE_LABELS.archive],
      ['trash', MODULE_LABELS.trash],
    ]),
  ], {
    'character-management': 'full', events: 'narrative', timeline: 'world', simulation: 'auxiliary',
    writing: 'narrative', chat: 'npc', relationships: 'world', personas: 'hidden',
  }, ['world-building', 'multipath']),
  config('companion', [
    nav('伴侣空间', [
      ['character-management', '03 人物管理 · 轻量'],
      ['chat', 'AI 伴侣角色'],
    ]),
    nav('长期互动', [
      ['relationships', '04 关系管理'],
      ['events', '05 互动事件'],
      ['timeline', '06 互动时间线'],
    ]),
    nav('数据安全', [
      ['time-machine', MODULE_LABELS['time-machine']],
      ['archive', MODULE_LABELS.archive],
      ['trash', MODULE_LABELS.trash],
    ]),
  ], {
    'character-management': 'light', events: 'interaction', timeline: 'interaction',
    simulation: 'persona', writing: 'hidden', chat: 'companion', relationships: 'relationship',
    personas: 'hidden',
  }, ['personas', 'memories', 'companion-runtime']),
  config('diary', [
    nav('人生记录', [
      ['diary', '日记与传记'],
      ['character-management', '03 人物档案 · 轻量'],
    ]),
    nav('经历与来源', [
      ['relationships', '04 人物关系'],
      ['events', '05 人生经历'],
      ['timeline', '06 人生时间线'],
      ['writing', '08 传记写作'],
      ['information-sources', MODULE_LABELS['information-sources']],
    ]),
    nav('数据安全', [
      ['time-machine', MODULE_LABELS['time-machine']],
      ['archive', MODULE_LABELS.archive],
      ['trash', MODULE_LABELS.trash],
    ]),
  ], {
    'character-management': 'light', events: 'life', timeline: 'life',
    simulation: 'hidden', writing: 'biography', chat: 'hidden', relationships: 'life',
    personas: 'hidden',
  }),
  config('yunbao', YUNBAO_WORKSPACE_NAV_GROUPS, {
    'character-management': 'full', events: 'narrative', timeline: 'world',
    simulation: 'full', writing: 'narrative', chat: 'npc', relationships: 'world',
    personas: 'full',
  }, ['yunbao', 'workspace-home']),
]

export const FALLBACK_MATRIX: ProductMatrix = {
  version: 'L2.1-fallback',
  products: FALLBACK_PRODUCTS,
  modules: Object.fromEntries(
    Object.entries(MODULE_LABELS).map(([key, label]) => [key, { label, page: key }]),
  ),
}

export function normalizeProduct(value: string | null | undefined): ProductKey {
  return value === 'literature' || value === 'companion' || value === 'diary' || value === 'yunbao' ? value : 'game'
}

export function getStoredProduct(): ProductKey {
  if (typeof window === 'undefined') return 'game'
  const fromUrl = new URLSearchParams(window.location.search).get('product')
  if (fromUrl) return normalizeProduct(fromUrl)
  return normalizeProduct(localStorage.getItem('ws.product'))
}

export function storeProduct(product: ProductKey) {
  try { localStorage.setItem('ws.product', product) } catch { /* ignore */ }
  try { sessionStorage.setItem('ws.productScene', product) } catch { /* ignore */ }
  const url = new URL(window.location.href)
  url.searchParams.set('product', product)
  window.history.replaceState(null, '', url.toString())
}

export function productByKey(products: ProductConfig[], key: ProductKey): ProductConfig {
  return products.find((item) => item.key === key) || FALLBACK_PRODUCTS.find((item) => item.key === key)!
}

export function allowedPage(config: ProductConfig, page: string): boolean {
  return config.allowed_modules.includes(page)
}
