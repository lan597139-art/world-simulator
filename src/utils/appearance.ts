import { resolveMediaUrl } from '../api/media'

export type Appearance = {
  background_url: string
  background_blur: number
  background_opacity: number
  glass_blur: number
  glass_opacity: number
  glow: number
}

const STORAGE_KEY = 'ws.ui.appearance'

export const DEFAULT_APPEARANCE: Appearance = {
  background_url: '',
  background_blur: 18,
  background_opacity: 32,
  glass_blur: 40,
  glass_opacity: 100,
  glow: 24,
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback
}

export function loadAppearance(): Appearance {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_APPEARANCE }
    const parsed = JSON.parse(raw) as Partial<Appearance>
    return {
      background_url: typeof parsed.background_url === 'string' ? parsed.background_url.slice(0, 2000) : '',
      background_blur: clamp(parsed.background_blur, 0, 40, DEFAULT_APPEARANCE.background_blur),
      background_opacity: clamp(parsed.background_opacity, 0, 100, DEFAULT_APPEARANCE.background_opacity),
      glass_blur: clamp(parsed.glass_blur, 0, 72, DEFAULT_APPEARANCE.glass_blur),
      glass_opacity: clamp(parsed.glass_opacity, 25, 100, DEFAULT_APPEARANCE.glass_opacity),
      glow: clamp(parsed.glow, 0, 80, DEFAULT_APPEARANCE.glow),
    }
  } catch {
    return { ...DEFAULT_APPEARANCE }
  }
}

export function saveAppearance(appearance: Appearance): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appearance))
  } catch { /* private mode */ }
}

export function applyAppearance(appearance: Appearance): void {
  const root = document.documentElement
  const image = resolveMediaUrl(appearance.background_url.trim())
  root.style.setProperty('--ws-bg-image', image ? `url(${JSON.stringify(image)})` : 'none')
  root.style.setProperty('--ws-bg-blur', `${appearance.background_blur}px`)
  root.style.setProperty('--ws-bg-opacity', `${appearance.background_opacity / 100}`)
  root.style.setProperty('--glass-blur', `${appearance.glass_blur}px`)
  root.style.setProperty('--glass-opacity', `${appearance.glass_opacity / 100}`)
  root.style.setProperty('--glass-glow', `${appearance.glow / 100}`)
  root.dataset.customBackground = image ? 'true' : 'false'
}
