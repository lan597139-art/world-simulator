/**
 * API 地址与访客 Key 桥接：
 * - 本地开发默认 http://127.0.0.1:8000，保持现有调用不变。
 * - 线上通过 VITE_API_BASE_URL 指定公网后端地址。
 * - 访客在「AI 接入」填写的 Key 只保存在本浏览器，
 *   每次请求通过 X-AI-* 请求头携带，服务端不保存。
 */
import { loadAiSettings } from './aiSettings'

export const LEGACY_API_ORIGIN = 'http://127.0.0.1:8000'

const configured = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '')
export const API_ORIGIN = configured || LEGACY_API_ORIGIN

function needsAiKey(url: string) {
  try {
    const path = new URL(url, window.location.origin).pathname
    return (
      path === '/api/ai/status' ||
      path === '/api/simulate' ||
      path.startsWith('/api/writing/') ||
      path.startsWith('/api/branches/') ||
      /^\/api\/events\/[^/]+\/directions\/suggest$/.test(path) ||
      path === '/api/assistant/chat' ||
      path.startsWith('/api/chat/') ||
      /^\/api\/writings\/[^/]+\/(analyze|extract)$/.test(path) ||
      /^\/api\/characters\/[^/]+\/biography\/generate$/.test(path)
    )
  } catch {
    return false
  }
}

function withAiHeaders(url: string, init?: RequestInit): RequestInit | undefined {
  if (!needsAiKey(url)) return init
  const settings = loadAiSettings()
  if (!settings.apiKey) return init
  const headers = new Headers(init?.headers)
  headers.set('X-AI-API-Key', settings.apiKey)
  if (settings.baseUrl) headers.set('X-AI-Base-URL', settings.baseUrl)
  if (settings.model) headers.set('X-AI-Model', settings.model)
  return { ...init, headers }
}

export function installApiOriginBridge() {
  const nativeFetch = window.fetch.bind(window)
  const rewrite = (url: string) => (configured ? url.replace(/^http:\/\/127\.0\.0\.1:8000/, configured) : url)
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string') {
      const url = rewrite(input)
      return nativeFetch(url, withAiHeaders(url, init))
    }
    if (input instanceof URL) {
      const url = rewrite(input.toString())
      return nativeFetch(url, withAiHeaders(url, init))
    }
    if (input instanceof Request) {
      const nextUrl = rewrite(input.url)
      if (nextUrl === input.url) return nativeFetch(input, init)
      return nativeFetch(new Request(nextUrl, input), init)
    }
    return nativeFetch(input, init)
  }
}
