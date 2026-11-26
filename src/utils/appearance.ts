import { resolveMediaUrl } from '../api/media'

export type GlassTarget = 'nav' | 'card' | 'modal' | 'control' | 'liquid'
export type TextScope = 'nav' | 'card' | 'body'
export type FontFamilyKey = 'auto' | 'fangsong' | 'heiti' | 'kaiti' | 'xingkai' | 'songti' | 'mono'
export type TextColorMode = 'auto' | 'custom'

export type GlassProfile = {
  blur: number
  opacity: number
  border: number
  refraction: number
  dispersion: number
  frost: number
  tint: number
  gradient: number
  thickness: number
  /** 圆角，单位 px。 */
  radius: number
  /** 外阴影强度，0–100。 */
  shadow: number
}

export type TextAppearance = {
  color_mode: TextColorMode
  color: string
  opacity: number
  font_family: FontFamilyKey
  font_size: number
  weight: number
  italic: boolean
  stroke: number
  shadow: number
  /** 字距（界面中显示为“字距 / 弯曲”）。 */
  letter_spacing: number
  /** 垂直偏移，单位 px。 */
  offset: number
  line_height: number
  background_enabled: boolean
  background_auto: boolean
  background_color: string
  background_opacity: number
  background_thickness: number
  background_blur: number
  background_radius: number
}

export type Appearance = {
  background_url: string
  background_position: string
  background_blur: number
  background_opacity: number
  /** 旧版全局值，保留用于兼容和快捷滑块。 */
  glass_blur: number
  glass_opacity: number
  glow: number
  glass_targets: GlassTarget[]
  glass_profiles: Record<GlassTarget, GlassProfile>
  text_scopes: TextScope[]
  text: TextAppearance
  readability_guard: boolean
}

export const GLASS_TARGETS: GlassTarget[] = ['nav', 'card', 'modal', 'control', 'liquid']
export const TEXT_SCOPES: TextScope[] = ['nav', 'card', 'body']

const STORAGE_KEY = 'ws.ui.appearance'
const PAGE_STORAGE_PREFIX = 'ws.ui.appearance.page.v1.'

export const FONT_STACKS: Record<FontFamilyKey, string> = {
  auto: '"Geist Variable", "Noto Sans SC Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
  fangsong: '"FangSong", "STFangsong", "FangSong_GB2312", "Noto Serif SC Variable", serif',
  heiti: '"Heiti SC", "STHeiti", "Noto Sans SC Variable", "Microsoft YaHei", sans-serif',
  kaiti: '"Kaiti SC", "STKaiti", "KaiTi", "Noto Serif SC Variable", serif',
  xingkai: '"Xingkai SC", "STXingkai", "Kaiti SC", "STKaiti", "KaiTi", cursive',
  songti: '"Songti SC", "STSong", "SimSun", "Noto Serif SC Variable", serif',
  mono: '"SFMono-Regular", "Cascadia Code", "Roboto Mono", Consolas, monospace',
}

const DEFAULT_PROFILES: Record<GlassTarget, GlassProfile> = {
  nav: { blur: 26, opacity: 88, border: 24, refraction: 18, dispersion: 6, frost: 18, tint: 8, gradient: 10, thickness: 12, radius: 0, shadow: 10 },
  card: { blur: 24, opacity: 84, border: 20, refraction: 14, dispersion: 4, frost: 16, tint: 4, gradient: 6, thickness: 10, radius: 18, shadow: 16 },
  modal: { blur: 32, opacity: 90, border: 28, refraction: 12, dispersion: 5, frost: 24, tint: 6, gradient: 8, thickness: 16, radius: 20, shadow: 30 },
  control: { blur: 14, opacity: 76, border: 18, refraction: 8, dispersion: 2, frost: 8, tint: 4, gradient: 0, thickness: 6, radius: 10, shadow: 6 },
  liquid: { blur: 24, opacity: 78, border: 34, refraction: 82, dispersion: 28, frost: 12, tint: 12, gradient: 30, thickness: 22, radius: 22, shadow: 26 },
}

const DEFAULT_TEXT: TextAppearance = {
  color_mode: 'auto',
  color: '#ffffff',
  opacity: 100,
  font_family: 'auto',
  font_size: 15,
  weight: 400,
  italic: false,
  stroke: 0,
  shadow: 0,
  letter_spacing: 0,
  offset: 0,
  line_height: 1.72,
  background_enabled: false,
  background_auto: true,
  background_color: '#ffffff',
  background_opacity: 88,
  background_thickness: 8,
  background_blur: 18,
  background_radius: 10,
}

export function defaultAppearance(): Appearance {
  return {
    background_url: '',
    background_position: 'center',
    background_blur: 18,
    background_opacity: 26,
    glass_blur: 28,
    glass_opacity: 92,
    glow: 14,
    glass_targets: [...GLASS_TARGETS],
    glass_profiles: cloneProfiles(DEFAULT_PROFILES),
    text_scopes: [...TEXT_SCOPES],
    text: { ...DEFAULT_TEXT },
    readability_guard: true,
  }
}

export const DEFAULT_APPEARANCE: Appearance = defaultAppearance()

/** 预设可同步设置的界面主题；null 表示不改动主题。 */
export type AppearanceTheme = 'light' | 'dark' | 'system'

/** 系统预设：仅经典浅色 / 经典深色，其余编号均为用户自定义。 */
export type SystemPresetId = 'classic-light' | 'classic-dark'
export type AppearancePresetId = SystemPresetId | (string & {})

export type AppearancePreset = {
  id: AppearancePresetId
  zh: string
  en: string
  theme: AppearanceTheme | null
  appearance: Appearance
}

/** 用户自定义预设：保存整套外观，包含背景照片等全部字段。 */
export type UserPreset = {
  id: string
  name: string
  appearance: Appearance
}

const PRESET_PROFILES: Record<SystemPresetId, GlassProfile> = {
  /* 经典黑白：干净、低折射、高不透明，文字对比最稳。 */
  'classic-light': { blur: 12, opacity: 94, border: 34, refraction: 2, dispersion: 0, frost: 6, tint: 2, gradient: 0, thickness: 8, radius: 12, shadow: 6 },
  'classic-dark': { blur: 12, opacity: 94, border: 34, refraction: 2, dispersion: 0, frost: 6, tint: 2, gradient: 0, thickness: 8, radius: 12, shadow: 6 },
}

export const PRESET_META: Record<SystemPresetId, { zh: string; en: string; theme: AppearanceTheme | null }> = {
  'classic-light': { zh: '预设1 经典浅色', en: 'Preset 1 Classic Light', theme: 'light' },
  'classic-dark': { zh: '预设2 经典深色', en: 'Preset 2 Classic Dark', theme: 'dark' },
}

export const PRESET_IDS: SystemPresetId[] = ['classic-light', 'classic-dark']

function withProfile(profile: GlassProfile): Appearance {
  const base = defaultAppearance()
  const profiles = cloneProfiles(base.glass_profiles)
  for (const target of GLASS_TARGETS) profiles[target] = { ...profile }
  return { ...base, glass_profiles: profiles }
}

export const PRESET_APPEARANCES: Record<SystemPresetId, Appearance> = PRESET_IDS.reduce(
  (accumulator, id) => {
    accumulator[id] = withProfile(PRESET_PROFILES[id])
    return accumulator
  },
  {} as Record<SystemPresetId, Appearance>,
)

/* ------------------------------------------------------------------ *
 * 用户自定义预设（预设 3 起 + ➕ 新增）
 * 保存整套 Appearance（含背景照片、玻璃、文字），与系统预设 1/2 并存。
 * ------------------------------------------------------------------ */

const USER_PRESET_PREFIX = 'ws.ui.preset.v1.'
const USER_PRESET_SEED_KEY = 'ws.ui.preset.seeded'
export const USER_PRESET_CHANGE_EVENT = 'ws:user-presets-change'

function parseUserPreset(id: string, raw: string | null): UserPreset | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw)
    return { id, name: typeof value?.name === 'string' && value.name.trim() ? value.name.trim() : id, appearance: normalizeAppearance(value?.appearance ?? value) }
  } catch {
    return null
  }
}

/** 读取全部用户自定义预设，按编号升序。 */
export function loadUserPresets(): UserPreset[] {
  try {
    const presets: UserPreset[] = []
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (!key || !key.startsWith(USER_PRESET_PREFIX)) continue
      const id = key.slice(USER_PRESET_PREFIX.length)
      const preset = parseUserPreset(id, localStorage.getItem(key))
      if (preset) presets.push(preset)
    }
    return presets.sort((a, b) => presetNumber(a.id) - presetNumber(b.id))
  } catch {
    return []
  }
}

function presetNumber(id: string): number {
  const match = id.match(/(\d+)$/)
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER
}

/** 下一个可用的预设编号（从 3 起）。 */
export function nextUserPresetNumber(): number {
  const existing = loadUserPresets().map((preset) => presetNumber(preset.id))
  let next = 3
  while (existing.includes(next)) next += 1
  return next
}

export function saveUserPreset(preset: UserPreset): void {
  try {
    localStorage.setItem(USER_PRESET_PREFIX + preset.id, JSON.stringify({ name: preset.name, appearance: normalizeAppearance(preset.appearance) }))
    dispatchUserPresetsChange()
  } catch { /* private mode */ }
}

export function deleteUserPreset(id: string): void {
  try {
    localStorage.removeItem(USER_PRESET_PREFIX + id)
    dispatchUserPresetsChange()
  } catch { /* private mode */ }
}

export function clearUserPresets(): void {
  try {
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index)
      if (key && key.startsWith(USER_PRESET_PREFIX)) localStorage.removeItem(key)
    }
    dispatchUserPresetsChange()
  } catch { /* private mode */ }
}

/** 首次使用时生成预设 3/4/5 三个待自定义的空位。 */
export function ensureDefaultUserPresets(): UserPreset[] {
  try {
    if (localStorage.getItem(USER_PRESET_SEED_KEY)) return loadUserPresets()
    const base = loadAppearance()
    const seeds = [3, 4, 5].map((number) => ({
      id: `user-${number}`,
      name: `预设${number}`,
      appearance: base,
    }))
    seeds.forEach((preset) => saveUserPreset(preset))
    localStorage.setItem(USER_PRESET_SEED_KEY, '1')
    return seeds
  } catch {
    return loadUserPresets()
  }
}

/** 新增一个用户自定义预设空位，返回新建的预设。 */
export function createUserPreset(appearance: Appearance, name?: string): UserPreset {
  const number = nextUserPresetNumber()
  const preset: UserPreset = { id: `user-${number}`, name: name || `预设${number}`, appearance }
  saveUserPreset(preset)
  return preset
}

function dispatchUserPresetsChange(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(USER_PRESET_CHANGE_EVENT))
}

function cloneProfiles(profiles: Record<GlassTarget, GlassProfile>): Record<GlassTarget, GlassProfile> {
  return GLASS_TARGETS.reduce((result, target) => {
    result[target] = { ...profiles[target] }
    return result
  }, {} as Record<GlassTarget, GlassProfile>)
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback
}

function safeColor(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const color = value.trim().slice(0, 80)
  return /^(#(?:[0-9a-f]{3,8})|rgba?\([^)]*\)|hsla?\([^)]*\)|oklch\([^)]*\))$/i.test(color) ? color : fallback
}

function safeList<T extends string>(value: unknown, allowed: T[], fallback: T[]): T[] {
  if (!Array.isArray(value)) return [...fallback]
  const selected = value.filter((item): item is T => typeof item === 'string' && (allowed as string[]).includes(item))
  return selected.length ? Array.from(new Set(selected)) : []
}

function normalizeProfile(value: unknown, fallback: GlassProfile): GlassProfile {
  const source = (value && typeof value === 'object' ? value : {}) as Partial<GlassProfile>
  return {
    blur: clamp(source.blur, 0, 50, fallback.blur),
    opacity: clamp(source.opacity, 0, 100, fallback.opacity),
    border: clamp(source.border, 0, 100, fallback.border),
    refraction: clamp(source.refraction, 0, 100, fallback.refraction),
    dispersion: clamp(source.dispersion, 0, 100, fallback.dispersion),
    frost: clamp(source.frost, 0, 100, fallback.frost),
    tint: clamp(source.tint, 0, 100, fallback.tint),
    gradient: clamp(source.gradient, 0, 100, fallback.gradient),
    thickness: clamp(source.thickness, 0, 80, fallback.thickness),
    radius: clamp(source.radius, 0, 60, fallback.radius),
    shadow: clamp(source.shadow, 0, 100, fallback.shadow),
  }
}

function normalizeText(value: unknown): TextAppearance {
  const source = (value && typeof value === 'object' ? value : {}) as Partial<TextAppearance>
  const font = typeof source.font_family === 'string' && source.font_family in FONT_STACKS
    ? source.font_family as FontFamilyKey
    : DEFAULT_TEXT.font_family
  return {
    color_mode: source.color_mode === 'custom' ? 'custom' : 'auto',
    color: safeColor(source.color, DEFAULT_TEXT.color),
    opacity: clamp(source.opacity, 25, 100, DEFAULT_TEXT.opacity),
    font_family: font,
    font_size: clamp(source.font_size, 11, 26, DEFAULT_TEXT.font_size),
    weight: clamp(source.weight, 300, 850, DEFAULT_TEXT.weight),
    italic: Boolean(source.italic),
    stroke: clamp(source.stroke, 0, 4, DEFAULT_TEXT.stroke),
    shadow: clamp(source.shadow, 0, 32, DEFAULT_TEXT.shadow),
    letter_spacing: clamp(source.letter_spacing, -2, 5, DEFAULT_TEXT.letter_spacing),
    offset: clamp(source.offset, -8, 8, DEFAULT_TEXT.offset),
    line_height: clamp(source.line_height, 1.15, 2.4, DEFAULT_TEXT.line_height),
    background_enabled: Boolean(source.background_enabled),
    background_auto: source.background_auto !== false,
    background_color: safeColor(source.background_color, DEFAULT_TEXT.background_color),
    background_opacity: clamp(source.background_opacity, 0, 100, DEFAULT_TEXT.background_opacity),
    background_thickness: clamp(source.background_thickness, 0, 40, DEFAULT_TEXT.background_thickness),
    background_blur: clamp(source.background_blur, 0, 50, DEFAULT_TEXT.background_blur),
    background_radius: clamp(source.background_radius, 0, 40, DEFAULT_TEXT.background_radius),
  }
}

export function normalizeAppearance(value: unknown): Appearance {
  const fallback = defaultAppearance()
  const source = (value && typeof value === 'object' ? value : {}) as Partial<Appearance> & Record<string, unknown>
  const hasProfiles = Boolean(source.glass_profiles && typeof source.glass_profiles === 'object')
  const profiles = cloneProfiles(DEFAULT_PROFILES)
  if (hasProfiles) {
    for (const target of GLASS_TARGETS) {
      profiles[target] = normalizeProfile((source.glass_profiles as Record<string, unknown>)[target], profiles[target])
    }
  } else {
    // 旧版本只有一组全局值：迁移到导航、卡片、弹窗，避免升级后突然失去用户设置。
    const legacyBlur = clamp(source.glass_blur, 0, 72, fallback.glass_blur)
    const legacyOpacity = clamp(source.glass_opacity, 0, 100, fallback.glass_opacity)
    for (const target of ['nav', 'card', 'modal'] as GlassTarget[]) {
      profiles[target] = { ...profiles[target], blur: Math.min(50, legacyBlur), opacity: legacyOpacity }
    }
  }
  return {
    background_url: typeof source.background_url === 'string' ? source.background_url.slice(0, 2000) : '',
    background_position: typeof source.background_position === 'string' ? source.background_position.slice(0, 40) : fallback.background_position,
    background_blur: clamp(source.background_blur, 0, 40, fallback.background_blur),
    background_opacity: clamp(source.background_opacity, 0, 100, fallback.background_opacity),
    glass_blur: clamp(source.glass_blur, 0, 72, fallback.glass_blur),
    glass_opacity: clamp(source.glass_opacity, 0, 100, fallback.glass_opacity),
    glow: clamp(source.glow, 0, 80, fallback.glow),
    glass_targets: safeList(source.glass_targets, GLASS_TARGETS, fallback.glass_targets),
    glass_profiles: profiles,
    text_scopes: safeList(source.text_scopes, TEXT_SCOPES, fallback.text_scopes),
    text: normalizeText(source.text),
    readability_guard: source.readability_guard !== false,
  }
}

export function loadAppearance(): Appearance {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultAppearance()
    return normalizeAppearance(JSON.parse(raw))
  } catch {
    return defaultAppearance()
  }
}

export function saveAppearance(appearance: Appearance): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeAppearance(appearance)))
  } catch { /* private mode */ }
}

export function appearancePageKey(product: string, page: string, worldId?: string | null): string {
  return `${product || 'global'}:${page || 'home'}:${worldId || 'root'}`
}

export function loadAppearanceForPage(pageKey: string): Appearance {
  try {
    const raw = localStorage.getItem(PAGE_STORAGE_PREFIX + pageKey)
    if (raw) return normalizeAppearance(JSON.parse(raw))
  } catch { /* private mode */ }
  return loadAppearance()
}

export function hasPageAppearance(pageKey: string): boolean {
  try {
    return Boolean(localStorage.getItem(PAGE_STORAGE_PREFIX + pageKey))
  } catch {
    return false
  }
}

export function savePageAppearance(pageKey: string, appearance: Appearance): void {
  try {
    localStorage.setItem(PAGE_STORAGE_PREFIX + pageKey, JSON.stringify(normalizeAppearance(appearance)))
  } catch { /* private mode */ }
}

export function clearPageAppearance(pageKey: string): void {
  try {
    localStorage.removeItem(PAGE_STORAGE_PREFIX + pageKey)
  } catch { /* private mode */ }
}

/**
 * 一键全局套用预设：把预设写入全站默认并立即生效。
 * 返回套用后的外观与需要同步的界面主题（null 表示不改动主题）。
 */
export function applyPresetGlobal(presetId: SystemPresetId): { appearance: Appearance; theme: AppearanceTheme | null } {
  const next = normalizeAppearance(PRESET_APPEARANCES[presetId])
  saveAppearance(next)
  applyAppearance(next)
  return { appearance: next, theme: PRESET_META[presetId].theme }
}

/**
 * 一键清除所有父子级自定义调节：移除全站默认与全部页面独立配置，
 * 恢复出厂默认并立即生效。
 */
export function clearAllAppearance(): Appearance {
  try {
    localStorage.removeItem(STORAGE_KEY)
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index)
      if (key && key.startsWith(PAGE_STORAGE_PREFIX)) localStorage.removeItem(key)
    }
  } catch { /* private mode */ }
  const next = defaultAppearance()
  applyAppearance(next)
  return next
}

let currentAppearance: Appearance = defaultAppearance()

export function getAppliedAppearance(): Appearance {
  return currentAppearance
}

/* ------------------------------------------------------------------ *
 * 统一材质：全局单一参数源
 * 用户只面对一套玻璃材质参数。调节一次即同步写入全部玻璃档位
 * （nav / card / modal / control / liquid），各组件再按自身渲染能力
 * 消费同一组设计令牌，从而做到“调整一次，全站同步”。
 * 底层仍保留各档位 profile，用于组件内部适配，但不再暴露给用户。
 * ------------------------------------------------------------------ */

export const GLASS_PROFILE_FIELDS: (keyof GlassProfile)[] = [
  'blur', 'opacity', 'border', 'refraction', 'dispersion', 'frost',
  'tint', 'gradient', 'thickness', 'radius', 'shadow',
]

/** 统一材质的展示基准档：以卡片档为准。 */
export const GLOBAL_MATERIAL_TARGET: GlassTarget = 'card'

/** 读取当前统一材质（以卡片档为基准，兼容历史分档数据）。 */
export function readMaterialGlobal(appearance: Appearance): GlassProfile {
  return { ...appearance.glass_profiles[GLOBAL_MATERIAL_TARGET] }
}

/** 把单个材质参数同步写入全部玻璃档位，返回新的 Appearance。 */
export function setMaterialGlobal(
  appearance: Appearance,
  field: keyof GlassProfile,
  value: number,
): Appearance {
  const profiles = cloneProfiles(appearance.glass_profiles)
  for (const target of GLASS_TARGETS) {
    profiles[target] = { ...profiles[target], [field]: value }
  }
  const next = { ...appearance, glass_profiles: profiles }
  // 兼容旧字段：全局模糊/透明同步，避免设计系统别名与分档数据打架。
  if (field === 'blur') next.glass_blur = value
  if (field === 'opacity') next.glass_opacity = value
  return next
}

/** 批量同步多个材质参数到全部玻璃档位。 */
export function setMaterialGlobalPatch(
  appearance: Appearance,
  patch: Partial<GlassProfile>,
): Appearance {
  let next = appearance
  for (const field of Object.keys(patch) as (keyof GlassProfile)[]) {
    const value = patch[field]
    if (typeof value === 'number') next = setMaterialGlobal(next, field, value)
  }
  return next
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
      root.style.setProperty('--ws-bg-luminance', luminance.toFixed(3))
    } catch {
      // 远程图片可能污染 canvas；无法采样时采用更保守的玻璃下限。
      root.dataset.bgTone = 'detail'
    }
  }
  image.onerror = () => {
    if (token === backgroundToneToken) {
      delete root.dataset.bgTone
      root.style.removeProperty('--ws-bg-luminance')
    }
  }
  image.src = url
}

/**
 * 解析当前生效的玻璃档位。
 * 优先取 <html> 上的 data-glass（由偏好路径 applyExperience 与外观工作台写入），
 * 兜底读取本地偏好，保证偏好尚未加载或离线时档位同样生效。
 * 返回 'medium' / 未识别值时视为「标准」，走外观自定义值。
 */
function resolveGlassTier(): string | undefined {
  const fromDom = document.documentElement.dataset.glass
  if (fromDom) return fromDom
  try {
    const stored = localStorage.getItem('ws.ui.glass')
    return stored || undefined
  } catch { /* private mode */ return undefined }
}

/** 解析当前生效的字号档位（服务端偏好，无本地兜底）。 */
function resolveFontSizeTier(): string | undefined {
  return document.documentElement.dataset.fontSize || undefined
}

/** 玻璃基础模糊 / 透明：仅在无档位时由外观自定义值驱动。 */
function setGlassBase(root: HTMLElement, appearance: Appearance): void {
  root.style.setProperty('--glass-blur', `${appearance.glass_blur}px`)
  root.style.setProperty('--glass-opacity', `${appearance.glass_opacity / 100}`)
}

/** 字号阶：由外观自定义的正文字号派生。 */
function setTypeScale(root: HTMLElement, appearance: Appearance): void {
  const { font_size } = appearance.text
  root.style.setProperty('--text-base', `${font_size}px`)
  root.style.setProperty('--text-sm', `${Math.max(9, font_size - 2)}px`)
  root.style.setProperty('--text-xs', `${Math.max(8, font_size - 4)}px`)
  root.style.setProperty('--text-lg', `${font_size + 3}px`)
  root.style.setProperty('--text-xl', `${font_size + 6}px`)
  root.style.setProperty('--text-2xl', `${font_size + 13}px`)
  root.style.setProperty('--text-3xl', `${font_size + 21}px`)
}

/**
 * 应用「偏好驱动」的令牌覆写：玻璃档位与字号档位。
 *
 * 这两个全局设置由 html[data-glass] / html[data-font-size] 的 CSS 规则驱动，
 * 而 applyAppearance 会用内联样式写入同名令牌——内联优先级高于样式表规则，
 * 会直接遮蔽档位，导致偏好路径下全局设置失效。
 *
 * 因此统一在写入外观内联值之后调用：先用外观值打底，再把当前生效档位所覆盖的
 * 令牌从行内样式中移除，交回 CSS 规则。由 applyAppearance 末尾与 applyExperience
 * 共同调用，保证首次加载、切换页面、改动偏好三条路径一致。
 */
export function applyPreferenceTokens(): void {
  const root = document.documentElement
  setGlassBase(root, currentAppearance)
  setTypeScale(root, currentAppearance)

  const glassTier = resolveGlassTier()
  if (glassTier === 'low' || glassTier === 'high' || glassTier === 'solid') {
    root.style.removeProperty('--glass-blur')
    root.style.removeProperty('--glass-opacity')
  }
  // 字号档位规则（design-system.css）只覆盖到 --text-lg，故仅移除这四个令牌，
  // xl 及以上仍由外观自定义值驱动。
  const fontTier = resolveFontSizeTier()
  if (fontTier === 'small' || fontTier === 'large') {
    for (const token of ['--text-xs', '--text-sm', '--text-base', '--text-lg']) {
      root.style.removeProperty(token)
    }
  }
}

export function applyAppearance(input: Appearance): void {
  const appearance = normalizeAppearance(input)
  currentAppearance = appearance
  const root = document.documentElement
  const image = resolveMediaUrl(appearance.background_url.trim())
  root.style.setProperty('--ws-bg-image', image ? `url(${JSON.stringify(image)})` : 'none')
  root.style.setProperty('--ws-bg-position', appearance.background_position || 'center')
  root.style.setProperty('--ws-bg-blur', `${appearance.background_blur}px`)
  root.style.setProperty('--ws-bg-opacity', `${appearance.background_opacity / 100}`)
  // 玻璃基础模糊 / 透明由外观自定义值驱动；若处于低 / 高 / 实色档位，
  // 稍后由 applyPreferenceTokens 移除内联值、交回 html[data-glass] 规则。
  setGlassBase(root, appearance)
  root.style.setProperty('--glass-glow', `${appearance.glow / 100}`)
  root.dataset.customBackground = image ? 'true' : 'false'

  root.dataset.glassTargets = appearance.glass_targets.join(' ')
  // 统一可读性下限：外观工作台与设计系统的玻璃都读取同一个值，
  // 自定义/高饱和背景由 design-system 的 --glass-readability-floor 决定。
  root.style.setProperty('--ws-readability-floor', appearance.readability_guard ? 'var(--glass-readability-floor)' : '0')
  for (const target of GLASS_TARGETS) {
    const profile = appearance.glass_profiles[target]
    root.style.setProperty(`--ws-g-${target}-blur`, `${profile.blur}px`)
    root.style.setProperty(`--ws-g-${target}-opacity`, `${profile.opacity}`)
    root.style.setProperty(`--ws-g-${target}-border`, `${profile.border}`)
    root.style.setProperty(`--ws-g-${target}-refraction`, `${profile.refraction}`)
    root.style.setProperty(`--ws-g-${target}-dispersion`, `${profile.dispersion}`)
    root.style.setProperty(`--ws-g-${target}-frost`, `${profile.frost}`)
    root.style.setProperty(`--ws-g-${target}-tint`, `${profile.tint}`)
    root.style.setProperty(`--ws-g-${target}-gradient`, `${profile.gradient}`)
    root.style.setProperty(`--ws-g-${target}-thickness`, `${profile.thickness}`)
    root.style.setProperty(`--ws-g-${target}-radius`, `${profile.radius}`)
    root.style.setProperty(`--ws-g-${target}-shadow`, `${profile.shadow}`)
  }

  const text = appearance.text
  root.dataset.textScopes = appearance.text_scopes.join(' ')
  root.dataset.textCustom = text.color_mode === 'custom' ? 'true' : 'false'
  root.dataset.textAuto = text.color_mode === 'auto' ? 'true' : 'false'
  root.dataset.textBackground = text.background_enabled ? 'true' : 'false'

  root.dataset.fontFamily = text.font_family
  root.style.setProperty('--ws-font-family', FONT_STACKS[text.font_family])
  root.style.setProperty('--ws-text-color', text.color)
  root.style.setProperty('--ws-text-opacity', `${text.opacity}`)
  root.style.setProperty('--ws-text-weight', `${text.weight}`)
  root.style.setProperty('--ws-text-italic', text.italic ? 'italic' : 'normal')
  root.style.setProperty('--ws-text-stroke', `${text.stroke}`)
  root.style.setProperty('--ws-text-shadow', `${text.shadow}`)
  root.style.setProperty('--ws-letter-spacing', `${text.letter_spacing}`)
  root.style.setProperty('--ws-text-offset', `${text.offset}`)
  root.style.setProperty('--ws-text-line-height', `${text.line_height}`)
  root.style.setProperty('--ws-text-size', `${text.font_size}px`)
  // 字号阶由外观自定义字号派生；若处于小 / 大字号档位，
  // 稍后由 applyPreferenceTokens 移除档位覆盖的令牌、交回 html[data-font-size] 规则。
  setTypeScale(root, appearance)
  root.style.setProperty('--ws-text-bg-color', text.background_auto ? 'var(--glass-frost-bg)' : text.background_color)
  root.style.setProperty('--ws-text-bg-opacity', `${text.background_opacity}`)
  root.style.setProperty('--ws-text-bg-thickness', `${text.background_thickness}`)
  root.style.setProperty('--ws-text-bg-blur', `${text.background_blur}px`)
  root.style.setProperty('--ws-text-bg-radius', `${text.background_radius}`)
  root.style.setProperty('--ws-text-shadow-color', 'rgba(0,0,0,.34)')

  if (image) analyzeBackgroundTone(image)
  else {
    backgroundToneToken += 1
    delete root.dataset.bgTone
    root.style.removeProperty('--ws-bg-luminance')
  }

  // 偏好驱动的档位（玻璃 / 字号）最后统一处理，确保其覆盖外观内联值。
  applyPreferenceTokens()

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<Appearance>('ws:appearance-change', { detail: appearance }))
  }
}
