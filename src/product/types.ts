export type ProductKey = 'game' | 'literature' | 'companion' | 'diary' | 'yunbao'

export type ProductMode = string

export interface ProductNavItem {
  module: string
  label: string
  page: string
}

export interface ProductNavGroup {
  title: string
  items: ProductNavItem[]
}

export interface ProductConfig {
  key: ProductKey
  label: string
  short: string
  icon: string
  description: string
  home: string
  auto_workspace: boolean
  workspace_name?: string | null
  allowed_modules: string[]
  nav_groups: ProductNavGroup[]
  modes: Record<string, ProductMode>
  permissions: Record<string, boolean>
}

export interface ProductMatrix {
  version: string
  products: ProductConfig[]
  modules: Record<string, { label: string; page: string; description?: string }>
}
