
export type WorldType =
  | 'reality'
  | 'fiction'
  | 'historical'
  | 'experimental'

export interface World {
  id: string

  name: string

  description: string

  type: WorldType

  background: string

  createdAt: string

  updatedAt: string
}

export const WORLD_TYPES: {
  value: WorldType
  label: string
  description: string
}[] = [
  {
    value: 'reality',
    label: '现实模拟',
    description: '以现实社会、组织、经济和关系为基础',
  },
  {
    value: 'fiction',
    label: '虚构世界',
    description: '自由定义世界背景、历史和社会结构',
  },
  {
    value: 'historical',
    label: '历史模拟',
    description: '以特定历史时期为背景',
  },
  {
    value: 'experimental',
    label: '抽象实验',
    description: '用于测试人物、事件和人格动力系统',
  },
]
