/**
 * 全局导航的唯一真源。
 *
 * 侧边栏（CreationCenterSidebar）与面包屑（navRegistry）全部消费本文件，
 * 避免"侧边栏一套、面包屑一套"的双轨定义。
 *
 * 结构依据《阶段一·信息架构规划与新旧映射表》第一章：
 * 创作与体验（创作中心 / 作品集 / 广场）
 * 创作管理（创作者资产库 / 我的作品）
 * 账户服务（灵果资源）
 *
 * 体验中心已合并进作品集：作品发现、作品详情与灵果消耗统一在作品集
 * 完成，不再保留独立的体验中心产品入口，因此此处不再定义体验中心分组。
 *
 * AI 互动能力已并入作品集的 OC 详情（开始对话 / 关系 / 事件 / 记忆 / 模拟），
 * 不再单开 AI 互动中心入口。
 */
import {
  BookOpen,
  Compass,
  FolderKanban,
  MessagesSquare,
  Settings,
  Sprout,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { PageKey } from './types'

export interface GlobalNavItem {
  key: PageKey
  label: { zh: string; en: string }
  icon: LucideIcon
  /** 该入口是否为分组容器，用于面包屑与高亮判定。 */
  group?: boolean
}

export interface GlobalNavGroup {
  title: { zh: string; en: string }
  items: GlobalNavItem[]
}

export const GLOBAL_NAV: GlobalNavGroup[] = [
  {
    title: { zh: '创作与体验', en: 'Create & Explore' },
    items: [
      { key: 'home', label: { zh: '创作中心', en: 'Creation Center' }, icon: Compass },
      { key: 'community', label: { zh: '作品集', en: 'Creator Works' }, icon: MessagesSquare },
      { key: 'community-social', label: { zh: '广场', en: 'Plaza' }, icon: Users },
    ],
  },
  {
    title: { zh: '创作管理', en: 'Creation Management' },
    items: [
      { key: 'creator-assets', label: { zh: '创作者资产库', en: 'Creator Assets' }, icon: FolderKanban },
      { key: 'works', label: { zh: '我的作品', en: 'My Works' }, icon: BookOpen },
    ],
  },
  {
    title: { zh: '账户服务', en: 'Account Services' },
    items: [
      { key: 'spirit-economy', label: { zh: '灵果资源', en: 'Spirit Resources' }, icon: Sprout },
    ],
  },
]

/** 工具入口：不占业务区域，固定在侧边栏底部。 */
export const TOOL_NAV: GlobalNavItem[] = [
  { key: 'settings', label: { zh: '设置', en: 'Settings' }, icon: Settings },
]
