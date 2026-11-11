import { API_ORIGIN } from './config'
import { FALLBACK_MATRIX, normalizeProduct } from '../product/products'
import type { ProductConfig, ProductKey, ProductMatrix } from '../product/types'

export async function fetchProductMatrix(): Promise<ProductMatrix> {
  try {
    const res = await fetch(`${API_ORIGIN}/api/products/config`)
    if (!res.ok) return FALLBACK_MATRIX
    const data = await res.json()
    if (!Array.isArray(data?.products) || data.products.length !== 4) return FALLBACK_MATRIX
    return data as ProductMatrix
  } catch {
    return FALLBACK_MATRIX
  }
}

export async function ensureProductWorkspace(product: ProductKey): Promise<any> {
  const res = await fetch(`${API_ORIGIN}/api/products/${product}/workspace`, { method: 'POST' })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.detail || `工作空间创建失败（HTTP ${res.status}）`)
  return body.world
}

export async function fetchProductWorkspace(product: ProductKey): Promise<any> {
  const res = await fetch(`${API_ORIGIN}/api/products/${product}/workspace`)
  if (!res.ok) return null
  return (await res.json()).world
}

export async function fetchProductAccess(product: string, module: string): Promise<boolean> {
  const res = await fetch(`${API_ORIGIN}/api/products/${normalizeProduct(product)}/access/${encodeURIComponent(module)}`)
  if (!res.ok) return false
  return Boolean((await res.json()).allowed)
}

export function configFor(matrix: ProductMatrix, product: ProductKey): ProductConfig {
  return matrix.products.find((item) => item.key === product) || FALLBACK_MATRIX.products.find((item) => item.key === product)!
}
