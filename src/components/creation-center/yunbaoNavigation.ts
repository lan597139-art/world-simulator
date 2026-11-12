import {
  BookOpen,
  Brain,
  Clock3,
  Globe2,
  HeartHandshake,
  Landmark,
  LayoutDashboard,
  MessagesSquare,
  Network,
  Settings2,
  Sparkles,
  Sprout,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'
import { YUNBAO_WORKSPACE_NAV_GROUPS } from '../../product/products'

export const YUNBAO_PAGE_ICONS: Record<string, LucideIcon> = {
  overview: LayoutDashboard,
  'world-building': Settings2,
  'world-structure': Network,
  'world-data': Globe2,
  'character-management': UsersRound,
  relationships: HeartHandshake,
  chat: MessagesSquare,
  events: Landmark,
  timeline: Clock3,
  diary: BookOpen,
  personas: Sparkles,
  'yunbao-seed': Sprout,
  memories: Brain,
}

export const YUNBAO_GROUP_ICONS: Record<string, LucideIcon> = {
  世界与设定: Globe2,
  人物与关系: UsersRound,
  历程与记录: Clock3,
  人格与记忆: Brain,
}

export const YUNBAO_GROUP_COPY: Record<string, string> = {
  世界与设定: '世界建设配置、世界结构、世界设定',
  人格与记忆: '云宝人格编辑器、人物种子编辑器、记忆管理',
  人物与关系: '人物管理、关系与组织、AI 角色聊天',
  历程与记录: '事件管理、时间线、日记与传记',
}

/** 云宝总览卡片的展示顺序；侧边栏仍沿用产品配置中的分组顺序。 */
export const YUNBAO_OVERVIEW_GROUP_ORDER = ['世界与设定', '人格与记忆', '人物与关系', '历程与记录']

export const YUNBAO_OVERVIEW_GROUPS = YUNBAO_OVERVIEW_GROUP_ORDER
  .map((title) => YUNBAO_WORKSPACE_NAV_GROUPS.find((group) => group.title === title))
  .filter((group): group is (typeof YUNBAO_WORKSPACE_NAV_GROUPS)[number] => Boolean(group))

export function yunbaoNavTarget(page: string) {
  // 总览沿用产品工作区首页，不新增重复路由。
  return page === 'overview' || page === 'yunbao' ? 'workspace-home' : page
}
