/**
 * 全站页面 key 的唯一定义。
 *
 * 背景：此前 PageKey 在 App.tsx 与 navRegistry.ts 各定义一份，导航分组又在
 * CreationCenterSidebar 内再硬编码一份，三处只能靠人工同步。现在统一从这里导出，
 * App.tsx 只做 re-export，navRegistry 与产品标签表都引用本文件。
 */
export type PageKey =
  | 'home'
  | 'user-center'
  | 'community'
  | 'settings'
  | 'community-social'
  | 'spirit-economy'
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
  | 'world-background'
  | 'world-map'
  | 'world-works'
  | 'world-illustration'
  | 'world-cocreation'
  | 'world-community'
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
