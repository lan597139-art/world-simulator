import { reportClientError } from '../api/observability'

const seen = new Map<string, number>()
let sent = 0
let windowStarted = Date.now()
let installed = false

function shouldSend(message: string) {
  const now = Date.now()
  if (now - windowStarted > 60_000) {
    seen.clear()
    sent = 0
    windowStarted = now
  }
  if (sent >= 12) return false
  const last = seen.get(message) || 0
  if (now - last < 30_000) return false
  seen.set(message, now)
  sent += 1
  return true
}

function send(message: string, stack?: string) {
  if (!message || !shouldSend(message)) return
  if (/ResizeObserver loop|Script error\.?$/i.test(message)) return
  const page = new URLSearchParams(window.location.search).get('page') || ''
  void reportClientError({ message: message.slice(0, 2000), stack: (stack || '').slice(0, 12000), page })
}

export function reportRenderFailure(error: Error, componentStack?: string) {
  send(error?.message || String(error), `${error?.stack || ''}\n${componentStack || ''}`)
}

export function installErrorReporting() {
  if (installed || typeof window === 'undefined') return
  installed = true
  window.addEventListener('error', (event) => {
    const error = event.error
    send(error?.message || event.message || 'Unknown window error', error?.stack || '')
  })
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    const message = reason?.message || (typeof reason === 'string' ? reason : 'Unhandled promise rejection')
    send(message, reason?.stack || '')
  })
}
