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
  background_opacity: 26,
  glass_blur: 28,
  glass_opacity: 92,
  glow: 14,
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

let backgroundToneToken = 0

/** 采样自定义背景的亮度/色彩/细节，给毛玻璃一个可读性下限。 */
function analyzeBackgroundTone(url: string): void {
  const token = ++backgroundToneToken
  const root = document.documentElement
  const image = new Image()
  image.decoding = 'async'
  image.onload = () => {
    if (token !== backgroundToneToken) return
    try {
      const canvas = document.createElement('canvas')
      canvas.width = 32
      canvas.height = 32
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) return
      context.drawImage(image, 0, 0, 32, 32)
      const pixels = context.getImageData(0, 0, 32, 32).data
      let luminance = 0
      let saturation = 0
      let luminanceSquared = 0
      const count = pixels.length / 4
      for (let index = 0; index < pixels.length; index += 4) {
        const r = pixels[index] / 255
        const g = pixels[index + 1] / 255
        const b = pixels[index + 2] / 255
        const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
        luminance += luma
        luminanceSquared += luma * luma
        const maximum = Math.max(r, g, b)
        const minimum = Math.min(r, g, b)
        saturation += maximum === 0 ? 0 : (maximum - minimum) / maximum
      }
      luminance /= count
      saturation /= count
      const variance = Math.max(0, luminanceSquared / count - luminance * luminance)
      let tone = 'mid'
      if (variance > 0.026) tone = 'detail'
      else if (saturation > 0.36) tone = 'vivid'
      else if (luminance < 0.3) tone = 'dark'
      else if (luminance > 0.72) tone = 'light'
      root.dataset.bgTone = tone
    } catch {
      // 远程图片可能污染 canvas；无法采样时采用更保守的玻璃下限。
      root.dataset.bgTone = 'detail'
    }
  }
  image.onerror = () => {
    if (token === backgroundToneToken) delete root.dataset.bgTone
  }
  image.src = url
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
  if (image) analyzeBackgroundTone(image)
  else {
    backgroundToneToken += 1
    delete root.dataset.bgTone
  }
}
