import type { PageKey } from '../App'

export const PAGE_LABELS_EN: Partial<Record<PageKey, string>> = {
  home: 'Creation Center', 'user-center': 'Identity Center', community: 'Creator Works',
  'community-social': 'Plaza',
  overview: '01 World Overview', 'world-management': '02 World Management',
  'world-building': 'World Building', 'character-management': '03 Characters', chat: 'AI Character Chat',
  'world-structure': 'World Structure', 'world-data': 'World Settings', 'world-background': 'Background',
  'world-map': 'Maps', 'world-works': 'Works', 'world-illustration': 'Illustrations',
  'world-cocreation': 'Co-creation', 'world-community': 'Community', relationships: '04 Relations & Groups',
  events: '05 Events', timeline: '06 Timeline', simulation: '07 Simulation', storyline: 'Storyline',
  writing: '08 Writing', 'time-machine': 'Time Machine', archive: 'Archive', trash: 'Trash',
  'creator-assets': 'Creator Assets', works: 'My Works', personas: 'Yunbao Personas',
  'yunbao-seed': 'Persona Seed Editor', settings: 'Settings Center',
  'spirit-economy': 'Spirit Fruit', yunbao: 'Yunbao Workspace', memories: 'Memory',
  'companion-runtime': 'Persona Runtime', 'information-sources': 'Information Sources',
  diary: 'Diary & Biography', 'workspace-home': 'Workspace Overview', multipath: 'Multipath Sandbox',
}

export const PRODUCT_EN: Record<string, { label: string; short: string; description: string }> = {
  game: { label: 'Game Creation', short: 'Game', description: 'Characters, NPCs, world rules, quests and multiple endings.' },
  literature: { label: 'Literature', short: 'Literature', description: 'Relationships, events, storylines, parallel worlds and writing.' },
  companion: { label: 'Virtual Companion', short: 'Companion', description: 'Private characters, long-term memory, private and group chat.' },
  diary: { label: 'Diary & Biography', short: 'Diary', description: 'Private journals, life events, source tags and biography.' },
  yunbao: { label: 'Yunbao Workspace', short: 'Yunbao', description: 'The full professional workspace for games, literature, diary and biography.' },
  comic: { label: 'Comic Creation', short: 'Comic', description: 'Comic works, chapters, pages and sequential panels.' },
}

export const NAV_GROUP_EN: Record<string, string> = {
  '世界构建': 'World Building', '模拟与推演': 'Simulation', '数据安全': 'Data & Safety',
  '故事创作': 'Story Creation', '虚拟角色空间': 'Companion Space', '长期互动': 'Long-term Interaction',
  '角色与关系': 'Characters & Relations', '私人记录': 'Private Records', '世界与设定': 'World & Settings',
  '人物与关系': 'Characters & Relations', '历程与记录': 'History & Records', '人格与记忆': 'Persona & Memory',
  '创作与体验': 'Create & Explore', '创作管理': 'Creation Management', '账户服务': 'Account Services',
}

export function localizedProduct(key: string, label: string, description = '') {
  const english = PRODUCT_EN[key]
  return english ? { label: english.label, description: english.description } : { label, description }
}
