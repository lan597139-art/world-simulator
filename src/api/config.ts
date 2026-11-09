/**
 * API 地址桥接：
 * - 本地开发默认 http://127.0.0.1:8000，保持现有调用不变。
 * - Vercel 等线上环境通过 VITE_API_BASE_URL 指定公网后端地址，
 *   在入口处统一改写 fetch，避免 50 多处硬编码遗漏。
 */
export const LEGACY_API_ORIGIN = 'http://127.0.0.1:8000'

const configured = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '')
export const API_ORIGIN = configured || LEGACY_API_ORIGIN

export function installApiOriginBridge() {
  if (!configured || configured === LEGACY_API_ORIGIN) return
  const nativeFetch = window.fetch.bind(window)
  const rewrite = (url: string) => url.replace(/^http:\/\/127\.0\.0\.1:8000/, configured)
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string') return nativeFetch(rewrite(input), init)
    if (input instanceof URL) return nativeFetch(rewrite(input.toString()), init)
    if (input instanceof Request) {
      const nextUrl = rewrite(input.url)
      return nextUrl === input.url ? nativeFetch(input, init) : nativeFetch(new Request(nextUrl, input), init)
    }
    return nativeFetch(input, init)
  }
}
