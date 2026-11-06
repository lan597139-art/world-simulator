
/**
 * 世界建设标准选项的数据结构
 * 标准选项来自 A 文件，不能被用户自定义内容覆盖。
 */

export type SelectionMode =
  | 'single'
  | 'multiple'
  | 'unspecified'

export interface CatalogOption {
  id: string
  name: string
  description?: string
  sourceOrder: number
  sourceLabel?: string
}

export interface ParameterDefinition {
  key: string
  name?: string
  description?: string
  options?: string[]
}

export interface CatalogGroup {
  id: string
  name: string
  description?: string
  selectionMode: SelectionMode
  options: CatalogOption[]
  parameters?: ParameterDefinition[]
  sourceOrder: number
}

export interface CatalogSection {
  id: string
  name: string
  description?: string
  groups: CatalogGroup[]
  sourceOrder: number
}

export interface CatalogModule {
  id: string
  name: string
  description?: string
  sections: CatalogSection[]
  sourceOrder: number
}

/**
 * 标准选项与用户自定义选项分开保存。
 */

export interface CustomOption {
  id: string
  worldModuleId?: string
  sectionId: string
  groupId: string
  name: string
  description?: string
  category?: string
  parameterKeys?: string[]
  createdAt: string
  updatedAt: string
}

/**
 * 每个世界独立保存自己的选择和参数。
 */

export interface WorldBuildingConfig {
  id: string
  worldId: string

  selections: Record<string, string[]>

  parameters: Record<string, string | number | boolean>

  updatedAt: string
}
