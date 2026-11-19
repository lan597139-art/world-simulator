import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Check,
  ImagePlus,
  Layers,
  Moon,
  Palette,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Trash2,
  Type,
  X,
} from 'lucide-react'
import { tr, type Lang } from '../../i18n'
import {
  getSettings,
  updateSettings,
  type SettingsPreferences,
} from '../../api/settings'
import { applyExperience } from '../../utils/experience'
import { OFFICIAL_BACKGROUNDS, isOfficialBackground } from '../../data/officialBackgrounds'
import OfficialAssetPicker from '../../components/media/OfficialAssetPicker'
import { uploadMedia, resolveMediaUrl } from '../../api/media'
import {
  FONT_STACKS,
  applyAppearance,
  applyPresetGlobal,
  clearAllAppearance,
  defaultAppearance,
  loadAppearance,
  normalizeAppearance,
  saveAppearance,
  saveUserPreset,
  readMaterialGlobal,
  setMaterialGlobal,
  type Appearance,
  type FontFamilyKey,
  type GlassProfile,
  type SystemPresetId,
  type UserPreset,
} from '../../utils/appearance'
import PresetPicker from './AppearancePresetPicker'

type Props = {
  lang: Lang
  onLangChange: (next: Lang) => void
}

/** 控制台五大模块。 */
type UiTab = 'appearance' | 'material' | 'typography' | 'background' | 'presets'

type ThemeMode = SettingsPreferences['theme']
type DensityMode = SettingsPreferences['density']
type ReadingSize = SettingsPreferences['font_size']

const TAB_META: Record<UiTab, { zh: string; en: string; icon: LucideIcon }> = {
  appearance: { zh: '外观', en: 'Appearance', icon: Sparkles },
  material: { zh: '材质', en: 'Material', icon: Layers },
  typography: { zh: '字体', en: 'Typography', icon: Type },
  background: { zh: '背景', en: 'Background', icon: ImagePlus },
  presets: { zh: '预设', en: 'Presets', icon: Palette },
}

const FONT_META: Record<FontFamilyKey, { zh: string; en: string; sample: string }> = {
  auto: { zh: '系统默认', en: 'System', sample: '永 Aa' },
  fangsong: { zh: '仿宋', en: 'FangSong', sample: '永 Aa' },
  heiti: { zh: '黑体', en: 'Hei', sample: '永 Aa' },
  kaiti: { zh: '楷体', en: 'Kai', sample: '永 Aa' },
  xingkai: { zh: '行楷', en: 'Xingkai', sample: '永 Aa' },
  songti: { zh: '宋体', en: 'Song', sample: '永 Aa' },
  mono: { zh: '等宽', en: 'Mono', sample: 'Aa 01' },
}

const SKIN_META: Record<string, { zh: string; en: string }> = {
  default: { zh: '极简', en: 'Minimal' },
  aurora: { zh: '极光', en: 'Aurora' },
  sand: { zh: '暖砂', en: 'Sand' },
  mono: { zh: '单色', en: 'Mono' },
}

/** 性能模式：低/标准/高/实色 → 统一的玻璃模糊/透明参数。 */
const PERFORMANCE_PRESETS: Record<string, { glass_blur: number; glass_opacity: number }> = {
  low: { glass_blur: 14, glass_opacity: 100 },
  medium: { glass_blur: 40, glass_opacity: 100 },
  high: { glass_blur: 56, glass_opacity: 100 },
  solid: { glass_blur: 0, glass_opacity: 96 },
}

const PERFORMANCE_META: Record<string, { zh: string; en: string }> = {
  low: { zh: '低', en: 'Low' },
  medium: { zh: '标准', en: 'Standard' },
  high: { zh: '高', en: 'High' },
  solid: { zh: '实色', en: 'Solid' },
}

const isColor = (value: string) => /^(#(?:[0-9a-f]{3,8})|rgba?\([^)]*\)|hsla?\([^)]*\)|oklch\([^)]*\))$/i.test(value.trim())

function hueOf(color: string): number {
  const hsl = color.trim().match(/^hsla?\(\s*([\d.]+)/i)
  if (hsl) return Math.round(Number(hsl[1]) % 360)
  const hex = color.trim().match(/^#([0-9a-f]{6})$/i)?.[1]
  if (!hex) return 0
  const r = parseInt(hex.slice(0, 2), 16) / 255
  const g = parseInt(hex.slice(2, 4), 16) / 255
  const b = parseInt(hex.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  if (delta === 0) return 0
  let hue = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4
  hue *= 60
  return hue < 0 ? hue + 360 : hue
}

function label(lang: Lang, zh: string, en: string) {
  return tr(lang, zh, en)
}

/** 从已应用的 DOM 令牌读取账号偏好，保证控制台显示与实际渲染一致。 */
function readPreferences(): SettingsPreferences {
  const root = document.documentElement
  const theme = (['light', 'dark', 'system'].includes(root.dataset.theme || '') ? root.dataset.theme : 'system') as ThemeMode
  const density = (['compact', 'comfortable', 'spacious'].includes(root.dataset.density || '') ? root.dataset.density : 'comfortable') as DensityMode
  const font_size = (['small', 'medium', 'large'].includes(root.dataset.fontSize || '') ? root.dataset.fontSize : 'medium') as ReadingSize
  return {
    theme,
    density,
    font_size,
    reduce_motion: root.dataset.reduceMotion === 'true',
    language: lang0(),
    show_tips: localStorage.getItem('ws.ui.pref.show_tips') !== 'false',
    auto_save: localStorage.getItem('ws.ui.pref.auto_save') !== 'false',
  }
}

function lang0(): 'zh' | 'en' {
  return (document.documentElement.dataset.lang === 'en' || document.documentElement.lang === 'en') ? 'en' : 'zh'
}

function Slider({
  labelText, value, min, max, step = 1, unit = '', field, onChange,
}: {
  labelText: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  field?: string
  onChange: (value: number) => void
}) {
  return (
    <div className="ws-studio-field">
      <div className="ws-studio-field-head">
        <label>{labelText}</label>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
          <input
            className="ws-studio-num"
            type="number"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(event) => {
              const raw = event.target.value
              if (raw === '') return
              const num = Number(raw)
              if (Number.isFinite(num)) onChange(Math.min(max, Math.max(min, num)))
            }}
            aria-label={labelText}
          />
          {unit && <span className="ws-studio-unit">{unit}</span>}
        </span>
      </div>
      <input
        className="ws-studio-range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        data-field={field}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  )
}

export default function UnifiedDesignStudio({ lang, onLangChange }: Props) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<UiTab>('appearance')
  const [draft, setDraft] = useState<Appearance>(() => loadAppearance())
  const [flash, setFlash] = useState('')
  const [prefs, setPrefs] = useState<SettingsPreferences>(() => readPreferences())
  const [skin, setSkin] = useState(() => localStorage.getItem('ws.ui.skin') || 'default')
  const [glass, setGlass] = useState(() => localStorage.getItem('ws.ui.glass') || 'medium')
  const [officialOpen, setOfficialOpen] = useState(false)
  const [backgroundBusy, setBackgroundBusy] = useState(false)
  const backgroundUpload = useRef<HTMLInputElement | null>(null)
  /** 正在编辑的用户自定义预设 id；null 表示未载入用户预设。 */
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null)

  /* ---- 唯一配置源：外观令牌随草稿即时生效，保存后落盘 ---- */
  useEffect(() => {
    applyAppearance(draft)
  }, [draft])

  /* ---- 账号偏好：加载服务端配置，并以 DOM 令牌为离线兜底 ---- */
  useEffect(() => {
    let alive = true
    void getSettings()
      .then((settings) => { if (alive) setPrefs(settings.preferences) })
      .catch(() => { /* 离线时沿用 DOM 中已应用的偏好 */ })
    return () => { alive = false }
  }, [])

  /* ---- 皮肤 / 性能模式（本地外观偏好，随偏好一起持久化） ---- */
  useEffect(() => {
    document.documentElement.dataset.skin = skin
    localStorage.setItem('ws.ui.skin', skin)
  }, [skin])

  useEffect(() => {
    if (glass === 'medium') delete document.documentElement.dataset.glass
    else document.documentElement.dataset.glass = glass
    localStorage.setItem('ws.ui.glass', glass)
  }, [glass])

  useEffect(() => {
    if (!flash) return
    const timer = window.setTimeout(() => setFlash(''), 2200)
    return () => window.clearTimeout(timer)
  }, [flash])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    const openPanel = () => { setOpen(true) }
    window.addEventListener('ws:open-appearance-studio', openPanel)
    return () => window.removeEventListener('ws:open-appearance-studio', openPanel)
  }, [])

  /* ---------------------------------------------------------------- *
   * 01 APPEARANCE — 主题 / 语言 / 密度 / 正文 / 动效 / 皮肤 / 性能
   * ---------------------------------------------------------------- */
  const patchPrefs = (patch: Partial<SettingsPreferences>) => {
    setPrefs((current) => {
      const next = { ...current, ...patch }
      applyExperience(next)
      void updateSettings({ preferences: patch }).catch(() => { /* 离线保留本地 */ })
      return next
    })
  }

  const chooseTheme = (mode: ThemeMode) => {
    document.documentElement.dataset.theme = mode
    window.dispatchEvent(new CustomEvent('ws:theme-change', { detail: mode }))
    patchPrefs({ theme: mode })
    setFlash(label(
      lang,
      mode === 'dark' ? '已切换为深色主题' : mode === 'light' ? '已切换为浅色主题' : '已跟随系统主题',
      mode === 'dark' ? 'Dark theme applied' : mode === 'light' ? 'Light theme applied' : 'Following system theme',
    ))
  }

  const chooseLanguage = (next: Lang) => {
    onLangChange(next)
    patchPrefs({ language: next })
  }

  /** 性能模式：同时改写统一玻璃模糊/透明，与 MATERIAL 模块保持同一来源。 */
  const choosePerformance = (value: string) => {
    setGlass(value)
    const preset = PERFORMANCE_PRESETS[value]
    if (preset) {
      setDraft((current) => ({
        ...current,
        glass_blur: preset.glass_blur,
        glass_opacity: preset.glass_opacity,
        glass_profiles: Object.fromEntries(
          (['nav', 'card', 'modal', 'control', 'liquid'] as const).map((target) => [
            target,
            { ...current.glass_profiles[target], blur: preset.glass_blur, opacity: preset.glass_opacity },
          ]),
        ) as Appearance['glass_profiles'],
      }))
    }
  }

  /* ---------------------------------------------------------------- *
   * 02 MATERIAL — 单一全局材质，写入全部玻璃档位
   * ---------------------------------------------------------------- */
  const material = useMemo(() => readMaterialGlobal(draft), [draft])
  const setMaterial = (field: keyof GlassProfile, value: number) => {
    setDraft((current) => setMaterialGlobal(current, field, value))
  }

  /* ---------------------------------------------------------------- *
   * 03 TYPOGRAPHY
   * ---------------------------------------------------------------- */
  const text = draft.text
  const textHue = hueOf(text.color)
  const updateText = (patch: Partial<Appearance['text']>) => {
    setDraft((current) => ({ ...current, text: { ...current.text, ...patch } }))
  }

  /* ---------------------------------------------------------------- *
   * 04 BACKGROUND
   * ---------------------------------------------------------------- */
  const setBackground = (patch: Partial<Appearance>) => {
    setDraft((current) => ({ ...current, ...patch }))
  }

  const uploadBackground = async (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) { setFlash(label(lang, '背景图需要图片文件', 'Background must be an image file')); return }
    if (file.size > 12 * 1024 * 1024) { setFlash(label(lang, '背景图不能超过 12MB', 'Background image must be under 12MB')); return }
    setBackgroundBusy(true)
    try {
      const uploaded = await uploadMedia(file)
      setBackground({ background_url: uploaded.file_url })
      setFlash(label(lang, '背景图已上传并应用', 'Background uploaded and applied'))
    } catch {
      setFlash(label(lang, '背景图上传失败', 'Background upload failed'))
    } finally {
      setBackgroundBusy(false)
    }
  }

  /* ---------------------------------------------------------------- *
   * 05 PRESETS
   * ---------------------------------------------------------------- */
  /** 系统预设 1/2：一键全局套用，清除历史页面独立配置并同步主题。 */
  const applySystemPreset = (presetId: SystemPresetId) => {
    const { appearance: next, theme } = applyPresetGlobal(presetId)
    setDraft(next)
    if (theme) chooseTheme(theme)
    setEditingPresetId(null)
    setFlash(label(lang, '已套用预设并应用到全站', 'Preset applied across the whole site'))
  }

  const handleSelectUserPreset = (preset: UserPreset) => {
    setEditingPresetId(preset.id)
    setDraft({ ...preset.appearance })
    setFlash(label(lang, `已载入 ${preset.name}，调节后点击“保存预设”`, `Loaded ${preset.name}; tune it and save the preset`))
  }

  const handleSaveUserPreset = (id: string, name: string, appearance: Appearance) => {
    saveUserPreset({ id, name, appearance })
    setFlash(label(lang, `已保存预设 ${name}`, `Preset ${name} saved`))
  }

  const handleDeleteUserPreset = (id: string) => {
    setEditingPresetId((current) => (current === id ? null : current))
    setFlash(label(lang, '已删除自定义预设', 'Custom preset deleted'))
  }

  const handleCancelUserPreset = () => {
    setEditingPresetId(null)
    setDraft(loadAppearance())
  }

  /* ---------------------------------------------------------------- *
   * 保存 / 恢复默认 / 一键清除
   * ---------------------------------------------------------------- */
  const save = () => {
    const next = normalizeAppearance(draft)
    saveAppearance(next)
    applyAppearance(next)
    setFlash(label(lang, '已保存，全站即时生效', 'Saved and live across the site'))
  }

  const reset = () => {
    setDraft(defaultAppearance())
    setFlash(label(lang, '已恢复默认值，点击保存生效', 'Defaults restored; save to keep them'))
  }

  const clearAll = () => {
    const next = clearAllAppearance()
    setDraft(next)
    setFlash(label(lang, '已清除全部自定义调节，恢复默认', 'All custom adjustments cleared; defaults restored'))
  }

  const previewStyle = useMemo(() => {
    const custom = text.color_mode === 'custom'
    return {
      fontFamily: FONT_STACKS[text.font_family],
      fontSize: `${Math.min(24, Math.max(12, text.font_size + 1))}px`,
      fontWeight: text.weight,
      fontStyle: text.italic ? 'italic' : 'normal',
      letterSpacing: `${text.letter_spacing * 0.01}em`,
      lineHeight: text.line_height,
      color: custom ? text.color : undefined,
      opacity: custom ? text.opacity / 100 : undefined,
      textShadow: text.shadow
        ? `0 0 ${text.shadow}px rgba(0,0,0,.42), 0 ${text.offset}px 0 rgba(0,0,0,.18)`
        : undefined,
      padding: text.background_enabled
        ? `${text.background_thickness * 0.28}px ${text.background_thickness * 0.5}px`
        : 0,
      borderRadius: text.background_radius,
      backdropFilter: text.background_enabled ? `blur(${text.background_blur}px)` : undefined,
    } as CSSProperties
  }, [text])

  const TabIcon = TAB_META[tab].icon

  return (
    <>
      {!open && (
        <button
          type="button"
          className="ws-studio-fab"
          onClick={() => setOpen((value) => !value)}
          title={label(lang, '统一 UI 设计工作室', 'Unified UI design studio')}
          aria-label={label(lang, '打开统一 UI 设计工作室', 'Open unified UI design studio')}
          aria-haspopup="dialog"
        >
          <SlidersHorizontal size={20} />
          {tab !== 'appearance' && (
            <span className="ws-studio-fab-badge">5</span>
          )}
        </button>
      )}

      {open && (
        <>
          <div className="ws-studio-overlay" onClick={() => setOpen(false)} />
          <section className="ws-studio-panel" role="dialog" aria-modal="false" aria-label={label(lang, '统一 UI 设计工作室', 'Unified UI design studio')}>
            <header className="ws-studio-head">
              <div className="ws-studio-head-copy">
                <div className="ws-studio-eyebrow">UNIFIED UI DESIGN STUDIO</div>
                <h2 className="ws-studio-title">{label(lang, '统一 UI 设计工作室', 'Unified UI design studio')}</h2>
                <p className="ws-studio-sub">
                  {label(lang, '一次调整，全站同步。无需理解组件层级与目标分类。', 'One change syncs the whole site. No component hierarchy to understand.')}
                </p>
              </div>
              <button type="button" className="ws-studio-icon-btn" onClick={() => setOpen(false)} aria-label={label(lang, '关闭', 'Close')}>
                <X size={14} />
              </button>
            </header>

            <div className="ws-studio-tabs" role="tablist" aria-label={label(lang, '设计模块', 'Design modules')}>
              {(Object.keys(TAB_META) as UiTab[]).map((key) => {
                const Icon = TAB_META[key].icon
                return (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={tab === key}
                    className={tab === key ? 'is-active' : ''}
                    onClick={() => setTab(key)}
                  >
                    <Icon size={12} />
                    {label(lang, TAB_META[key].zh, TAB_META[key].en)}
                  </button>
                )
              })}
            </div>

            <div className="ws-studio-tab-body">
              {/* 01 APPEARANCE */}
              {tab === 'appearance' && (
                <>
                  <div className="ws-studio-section-label">
                    <span>{label(lang, '界面主题', 'Theme')}</span>
                  </div>
                  <div className="ws-studio-segment">
                    <button type="button" className={prefs.theme === 'system' ? 'is-active' : ''} onClick={() => chooseTheme('system')}>
                      {label(lang, '跟随系统', 'System')}
                    </button>
                    <button type="button" className={prefs.theme === 'light' ? 'is-active' : ''} onClick={() => chooseTheme('light')}>
                      <Sun size={12} /> {label(lang, '浅色', 'Light')}
                    </button>
                    <button type="button" className={prefs.theme === 'dark' ? 'is-active' : ''} onClick={() => chooseTheme('dark')}>
                      <Moon size={12} /> {label(lang, '深色', 'Dark')}
                    </button>
                  </div>

                  <div className="ws-studio-section-label" style={{ marginTop: 14 }}>
                    <span>{label(lang, '界面与偏好', 'Interface')}</span>
                  </div>
                  <div className="ws-studio-select-grid">
                    <label className="ws-studio-select">
                      <span>{label(lang, '界面语言', 'Language')}</span>
                      <select value={lang} onChange={(e) => chooseLanguage(e.target.value as Lang)}>
                        <option value="zh">简体中文</option>
                        <option value="en">English</option>
                      </select>
                    </label>
                    <label className="ws-studio-select">
                      <span>{label(lang, '信息密度', 'Density')}</span>
                      <select value={prefs.density} onChange={(e) => patchPrefs({ density: e.target.value as DensityMode })}>
                        <option value="compact">{label(lang, '紧凑', 'Compact')}</option>
                        <option value="comfortable">{label(lang, '舒适', 'Comfortable')}</option>
                        <option value="spacious">{label(lang, '宽松', 'Spacious')}</option>
                      </select>
                    </label>
                    <label className="ws-studio-select">
                      <span>{label(lang, '正文大小', 'Reading size')}</span>
                      <select value={prefs.font_size} onChange={(e) => patchPrefs({ font_size: e.target.value as ReadingSize })}>
                        <option value="small">{label(lang, '小', 'Small')}</option>
                        <option value="medium">{label(lang, '中', 'Medium')}</option>
                        <option value="large">{label(lang, '大', 'Large')}</option>
                      </select>
                    </label>
                  </div>

                  <div className="ws-studio-toggle-list">
                    <button
                      type="button"
                      className={`ws-studio-toggle${prefs.reduce_motion ? ' is-on' : ''}`}
                      onClick={() => patchPrefs({ reduce_motion: !prefs.reduce_motion })}
                    >
                      <span className="ws-studio-toggle-dot" />
                      <span>
                        <strong>{label(lang, '减少动效', 'Reduce motion')}</strong>
                        <small>{label(lang, '关闭大部分过渡与动画。', 'Disables most transitions and animations.')}</small>
                      </span>
                    </button>
                    <button
                      type="button"
                      className={`ws-studio-toggle${prefs.show_tips ? ' is-on' : ''}`}
                      onClick={() => {
                        const next = !prefs.show_tips
                        localStorage.setItem('ws.ui.pref.show_tips', next ? 'true' : 'false')
                        patchPrefs({ show_tips: next })
                      }}
                    >
                      <span className="ws-studio-toggle-dot" />
                      <span>
                        <strong>{label(lang, '操作提示', 'Show tips')}</strong>
                        <small>{label(lang, '在复杂编辑器中显示引导。', 'Shows guidance in complex editors.')}</small>
                      </span>
                    </button>
                    <button
                      type="button"
                      className={`ws-studio-toggle${prefs.auto_save ? ' is-on' : ''}`}
                      onClick={() => {
                        const next = !prefs.auto_save
                        localStorage.setItem('ws.ui.pref.auto_save', next ? 'true' : 'false')
                        patchPrefs({ auto_save: next })
                      }}
                    >
                      <span className="ws-studio-toggle-dot" />
                      <span>
                        <strong>{label(lang, '自动保存草稿', 'Auto-save drafts')}</strong>
                        <small>{label(lang, '写作与编辑时自动保存本地草稿。', 'Saves local drafts while writing and editing.')}</small>
                      </span>
                    </button>
                  </div>

                  <div className="ws-studio-section-label" style={{ marginTop: 14 }}>
                    <span>{label(lang, '视觉皮肤', 'Visual skin')}</span>
                  </div>
                  <div className="ws-studio-chip-row">
                    {(Object.keys(SKIN_META) as string[]).map((value) => (
                      <button
                        key={value}
                        type="button"
                        className={`ws-studio-chip${skin === value ? ' is-on' : ''}`}
                        onClick={() => setSkin(value)}
                        aria-pressed={skin === value}
                      >
                        {label(lang, SKIN_META[value].zh, SKIN_META[value].en)}
                      </button>
                    ))}
                  </div>

                  <div className="ws-studio-section-label" style={{ marginTop: 14 }}>
                    <span>{label(lang, '性能模式', 'Performance mode')}</span>
                  </div>
                  <div className="ws-studio-chip-row">
                    {(Object.keys(PERFORMANCE_META) as string[]).map((value) => (
                      <button
                        key={value}
                        type="button"
                        className={`ws-studio-chip${glass === value ? ' is-on' : ''}`}
                        onClick={() => choosePerformance(value)}
                        aria-pressed={glass === value}
                      >
                        {label(lang, PERFORMANCE_META[value].zh, PERFORMANCE_META[value].en)}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* 02 MATERIAL */}
              {tab === 'material' && (
                <>
                  <div className="ws-studio-note">
                    {label(
                      lang,
                      '这里的每一项都是全局参数。调节后，导航、侧栏、卡片、弹窗、输入、按钮与液态场景卡会同步更新。',
                      'Every value here is global. Adjusting it updates navigation, sidebars, cards, dialogs, inputs, buttons and liquid scene cards together.',
                    )}
                  </div>
                  <Slider labelText={label(lang, '模糊度 Blur', 'Blur')} value={material.blur} min={0} max={50} unit="px" field="material-blur" onChange={(value) => setMaterial('blur', value)} />
                  <Slider labelText={label(lang, '底色透明度 Opacity', 'Opacity')} value={material.opacity} min={25} max={100} unit="%" field="material-opacity" onChange={(value) => setMaterial('opacity', value)} />
                  <Slider labelText={label(lang, '边框高光 Border', 'Border highlight')} value={material.border} min={0} max={100} unit="%" field="material-border" onChange={(value) => setMaterial('border', value)} />
                  <Slider labelText={label(lang, '着色层 Tint', 'Tint layer')} value={material.tint} min={0} max={100} unit="%" field="material-tint" onChange={(value) => setMaterial('tint', value)} />
                  <Slider labelText={label(lang, '颜色渐变 Gradient', 'Color gradient')} value={material.gradient} min={0} max={100} unit="%" field="material-gradient" onChange={(value) => setMaterial('gradient', value)} />
                  <Slider labelText={label(lang, '磨砂质感 Frost', 'Frost')} value={material.frost} min={0} max={100} unit="%" field="material-frost" onChange={(value) => setMaterial('frost', value)} />
                  <Slider labelText={label(lang, '圆角 Radius', 'Corner radius')} value={material.radius} min={0} max={60} unit="px" field="material-radius" onChange={(value) => setMaterial('radius', value)} />
                  <Slider labelText={label(lang, '外阴影 Shadow', 'Outer shadow')} value={material.shadow} min={0} max={100} unit="" field="material-shadow" onChange={(value) => setMaterial('shadow', value)} />
                  <Slider labelText={label(lang, '玻璃厚度 Glass thickness', 'Glass thickness')} value={material.thickness} min={0} max={80} unit="" field="material-thickness" onChange={(value) => setMaterial('thickness', value)} />

                  <div className="ws-studio-section-label" style={{ marginTop: 12 }}>
                    <span>{label(lang, '折射与高级效果', 'Refraction & advanced')}</span>
                  </div>
                  <Slider labelText={label(lang, '折射强度 Refraction', 'Refraction')} value={material.refraction} min={0} max={100} unit="" field="material-refraction" onChange={(value) => setMaterial('refraction', value)} />
                  <Slider labelText={label(lang, '色散强度 Dispersion', 'Dispersion')} value={material.dispersion} min={0} max={100} unit="" field="material-dispersion" onChange={(value) => setMaterial('dispersion', value)} />
                  <Slider labelText={label(lang, '辉光强度 Glow', 'Glow')} value={draft.glow} min={0} max={80} unit="%" field="material-glow" onChange={(value) => setDraft((current) => ({ ...current, glow: value }))} />

                  <button
                    type="button"
                    className={`ws-studio-chip${draft.readability_guard ? ' is-on' : ''}`}
                    onClick={() => setDraft((current) => ({ ...current, readability_guard: !current.readability_guard }))}
                    aria-pressed={draft.readability_guard}
                    style={{ marginTop: 12 }}
                  >
                    {label(lang, '可读性保护（推荐）', 'Readability guard (recommended)')}
                  </button>
                  <p className="ws-studio-hint">
                    {label(
                      lang,
                      '毛玻璃与液态玻璃底层渲染方式不同，但共用这一组参数。开启保护后，低透明度下文字仍保留最低底色。',
                      'Frosted and liquid glass render differently underneath but share these values. The guard keeps a minimum tint under text at low opacity.',
                    )}
                  </p>
                </>
              )}

              {/* 03 TYPOGRAPHY */}
              {tab === 'typography' && (
                <>
                  <div className="ws-studio-note">
                    {label(
                      lang,
                      '字体参数为全局唯一来源：导航、卡片、按钮、正文与弹窗文字同步响应。',
                      'Typography values are the single global source: navigation, cards, buttons, body and dialog text respond together.',
                    )}
                  </div>
                  <div className="ws-studio-section-label">
                    <span>{label(lang, '字体', 'Font family')}</span>
                  </div>
                  <div className="ws-studio-font-grid">
                    {(Object.keys(FONT_META) as FontFamilyKey[]).map((font) => (
                      <button
                        key={font}
                        type="button"
                        className={text.font_family === font ? 'is-active' : ''}
                        onClick={() => updateText({ font_family: font })}
                        style={{ fontFamily: FONT_STACKS[font] }}
                      >
                        <strong>{FONT_META[font].sample}</strong>
                        <span>{label(lang, FONT_META[font].zh, FONT_META[font].en)}</span>
                      </button>
                    ))}
                  </div>

                  <div style={{ height: 12 }} />
                  <Slider labelText={label(lang, '字号大小', 'Font size')} value={text.font_size} min={11} max={26} unit="px" field="text-size" onChange={(value) => updateText({ font_size: value })} />
                  <Slider labelText={label(lang, '字重 / 粗体', 'Weight')} value={text.weight} min={300} max={850} step={10} unit="" field="text-weight" onChange={(value) => updateText({ weight: value })} />
                  <div className="ws-studio-field">
                    <div className="ws-studio-field-head">
                      <label>{label(lang, '斜体', 'Italic')}</label>
                    </div>
                    <div className="ws-studio-segment">
                      <button type="button" className={!text.italic ? 'is-active' : ''} onClick={() => updateText({ italic: false })}>{label(lang, '正常', 'Normal')}</button>
                      <button type="button" className={text.italic ? 'is-active' : ''} onClick={() => updateText({ italic: true })}>{label(lang, '斜体', 'Italic')}</button>
                    </div>
                  </div>

                  <div className="ws-studio-section-label" style={{ marginTop: 12 }}>
                    <span>{label(lang, '字色', 'Text color')}</span>
                  </div>
                  <div className="ws-studio-segment" style={{ marginBottom: 8 }}>
                    <button type="button" className={text.color_mode === 'auto' ? 'is-active' : ''} onClick={() => updateText({ color_mode: 'auto' })}>
                      {label(lang, '自动对比', 'Auto contrast')}
                    </button>
                    <button type="button" className={text.color_mode === 'custom' ? 'is-active' : ''} onClick={() => updateText({ color_mode: 'custom' })}>
                      {label(lang, '自定义', 'Custom')}
                    </button>
                  </div>
                  <div className="ws-studio-color-row" style={{ marginBottom: 8 }}>
                    <input
                      type="color"
                      value={isColor(text.color) && text.color.startsWith('#') ? text.color.slice(0, 7) : '#ffffff'}
                      onChange={(event) => updateText({ color: event.target.value, color_mode: 'custom' })}
                      aria-label={label(lang, '选择字色', 'Choose text color')}
                    />
                    <input
                      type="text"
                      value={text.color}
                      onChange={(event) => { if (isColor(event.target.value)) updateText({ color: event.target.value, color_mode: 'custom' }) }}
                      aria-label={label(lang, '字色值', 'Text color value')}
                    />
                    <button type="button" className="ws-studio-btn" onClick={() => updateText({ color: '#111111', color_mode: 'custom' })}>{label(lang, '黑字', 'Black')}</button>
                    <button type="button" className="ws-studio-btn" onClick={() => updateText({ color: '#ffffff', color_mode: 'custom' })}>{label(lang, '白字', 'White')}</button>
                  </div>
                  <Slider labelText={label(lang, '字色透明度', 'Text opacity')} value={text.opacity} min={25} max={100} unit="%" field="text-opacity" onChange={(value) => updateText({ opacity: value })} />
                  <Slider labelText={label(lang, '色相 / 字色滑动', 'Hue / color slider')} value={textHue} min={0} max={360} unit="°" onChange={(value) => updateText({ color: `hsl(${value} 72% 58%)`, color_mode: 'custom' })} />
                  <Slider labelText={label(lang, '文字描边', 'Text stroke')} value={text.stroke} min={0} max={4} step={0.2} unit="px" field="text-stroke" onChange={(value) => updateText({ stroke: value })} />
                  <Slider labelText={label(lang, '文字阴影', 'Text shadow')} value={text.shadow} min={0} max={32} unit="" field="text-shadow" onChange={(value) => updateText({ shadow: value })} />
                  <Slider labelText={label(lang, '字距 / 弯曲', 'Spacing / curve')} value={text.letter_spacing} min={-2} max={5} step={0.1} unit="" field="text-letter-spacing" onChange={(value) => updateText({ letter_spacing: value })} />
                  <Slider labelText={label(lang, '垂直偏移', 'Offset')} value={text.offset} min={-8} max={8} step={0.5} unit="px" field="text-offset" onChange={(value) => updateText({ offset: value })} />
                  <Slider labelText={label(lang, '行高', 'Line height')} value={text.line_height} min={1.15} max={2.4} step={0.05} unit="" field="text-line-height" onChange={(value) => updateText({ line_height: value })} />

                  <div className="ws-studio-section-label" style={{ marginTop: 12 }}>
                    <span>{label(lang, '字体背景 / 文字底玻璃', 'Text backdrop')}</span>
                    <button type="button" className={`ws-studio-chip${text.background_enabled ? ' is-on' : ''}`} onClick={() => updateText({ background_enabled: !text.background_enabled })} aria-pressed={text.background_enabled}>
                      {text.background_enabled ? label(lang, '已开启', 'On') : label(lang, '关闭', 'Off')}
                    </button>
                  </div>
                  <div className="ws-studio-color-row" style={{ marginBottom: 8 }}>
                    <input
                      type="color"
                      value={isColor(text.background_color) && text.background_color.startsWith('#') ? text.background_color.slice(0, 7) : '#ffffff'}
                      onChange={(event) => updateText({ background_color: event.target.value, background_auto: false })}
                      disabled={text.background_auto}
                      aria-label={label(lang, '文字背景色', 'Text backdrop color')}
                    />
                    <button type="button" className={`ws-studio-chip${text.background_auto ? ' is-on' : ''}`} onClick={() => updateText({ background_auto: !text.background_auto })}>
                      {label(lang, '跟随主题底色', 'Follow theme surface')}
                    </button>
                  </div>
                  <Slider labelText={label(lang, '背景透明度', 'Backdrop opacity')} value={text.background_opacity} min={0} max={100} unit="%" field="text-bg-opacity" onChange={(value) => updateText({ background_opacity: value })} />
                  <Slider labelText={label(lang, '背景厚度', 'Backdrop thickness')} value={text.background_thickness} min={0} max={40} unit="px" field="text-bg-thickness" onChange={(value) => updateText({ background_thickness: value })} />
                  <Slider labelText={label(lang, '背景模糊', 'Backdrop blur')} value={text.background_blur} min={0} max={50} unit="px" field="text-bg-blur" onChange={(value) => updateText({ background_blur: value })} />
                  <Slider labelText={label(lang, '背景圆角', 'Backdrop radius')} value={text.background_radius} min={0} max={40} unit="px" field="text-bg-radius" onChange={(value) => updateText({ background_radius: value })} />
                  <p className="ws-studio-hint">
                    {label(
                      lang,
                      '文字背景只作用于文字本身，不会改变卡片与导航的玻璃材质。',
                      'The text backdrop only affects the text itself and does not change card or navigation glass.',
                    )}
                  </p>
                </>
              )}

              {/* 04 BACKGROUND */}
              {tab === 'background' && (
                <>
                  <div className="ws-studio-section-label">
                    <span>{label(lang, '背景图片', 'Background image')}</span>
                  </div>
                  <div className="ws-studio-background-row">
                    <input
                      className="ws-studio-input"
                      placeholder={label(lang, "https://…（上传后自动填入）", "https://… (filled after upload)")}
                      value={draft.background_url}
                      onChange={(event) => setBackground({ background_url: event.target.value })}
                    />
                    <button type="button" className="ws-studio-btn" disabled={backgroundBusy} onClick={() => backgroundUpload.current?.click()}>
                      <ImagePlus size={13} /> {backgroundBusy ? label(lang, '上传中…', 'Uploading…') : label(lang, '上传', 'Upload')}
                    </button>
                    {draft.background_url && (
                      <button type="button" className="ws-studio-btn" onClick={() => setBackground({ background_url: '' })}>
                        <Trash2 size={13} /> {label(lang, '清除', 'Clear')}
                      </button>
                    )}
                  </div>
                  <input ref={backgroundUpload} type="file" accept="image/*" hidden onChange={(event) => void uploadBackground(event.target.files?.[0])} />
                  {draft.background_url && (
                    <div className="ws-studio-background-preview" style={{ backgroundImage: `url(${JSON.stringify(resolveMediaUrl(draft.background_url))})` }} />
                  )}

                  <div className="ws-studio-section-label" style={{ marginTop: 12 }}>
                    <span>{label(lang, '官方素材库', 'Official library')}</span>
                  </div>
                  <button type="button" className="ws-studio-btn" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => setOfficialOpen(true)}>
                    <ImagePlus size={14} />
                    {label(lang, `${OFFICIAL_BACKGROUNDS.length} 张照片 / 插画`, `${OFFICIAL_BACKGROUNDS.length} photos / illustrations`)}
                  </button>
                  <div className="ws-studio-official-current">
                    {isOfficialBackground(draft.background_url)
                      ? (() => {
                          const current = OFFICIAL_BACKGROUNDS.find((item) => item.url === draft.background_url)
                          return current ? <><strong>{lang === 'zh' ? current.nameZh : current.nameEn}</strong><span>{current.kind === 'photo' ? label(lang, '官方照片', 'Official photo') : label(lang, '官方插画', 'Official illustration')} · {current.credit || label(lang, '站内素材', 'Built-in')}</span></> : null
                        })()
                      : <span>{label(lang, '当前使用自定义图片或未设置官方素材。', 'Using a custom image or no official asset.')}</span>}
                  </div>

                  <div className="ws-studio-section-label" style={{ marginTop: 12 }}>
                    <span>{label(lang, '环境光与融合', 'Ambient & blend')}</span>
                  </div>
                  <Slider labelText={label(lang, '图片透明度', 'Background opacity')} value={draft.background_opacity} min={0} max={100} unit="%" field="bg-opacity" onChange={(value) => setBackground({ background_opacity: value })} />
                  <Slider labelText={label(lang, '图片模糊度', 'Background blur')} value={draft.background_blur} min={0} max={40} unit="px" field="bg-blur" onChange={(value) => setBackground({ background_blur: value })} />
                  <Slider labelText={label(lang, '辉光强度', 'Glow')} value={draft.glow} min={0} max={80} unit="%" onChange={(value) => setDraft((current) => ({ ...current, glow: value }))} />
                  <div className="ws-studio-section-label" style={{ marginTop: 12 }}>
                    <span>{label(lang, '焦点 / 裁切', 'Focal point / crop')}</span>
                  </div>
                  <div className="ws-studio-focus-grid">
                    {([
                      ['left top', '↖'], ['center top', '↑'], ['right top', '↗'],
                      ['left center', '←'], ['center', '•'], ['right center', '→'],
                      ['left bottom', '↙'], ['center bottom', '↓'], ['right bottom', '↘'],
                    ] as [string, string][]).map(([value, icon]) => (
                      <button key={value} type="button" className={draft.background_position === value ? 'is-active' : ''} onClick={() => setBackground({ background_position: value })} aria-label={value}>{icon}</button>
                    ))}
                  </div>
                </>
              )}

              {/* 05 PRESETS */}
              {tab === 'presets' && (
                <>
                  <div className="ws-studio-section-label">
                    <span>{label(lang, '统一预设', 'Unified presets')}</span>
                  </div>
                  <div className="ws-studio-note">
                    {label(
                      lang,
                      '预设 1/2 为系统经典主题，其余为自定义。应用预设会同步主题、材质、字体与背景。',
                      'Presets 1/2 are system classics; the rest are custom. Applying a preset syncs theme, material, typography and background.',
                    )}
                  </div>
                  <PresetPicker
                    lang={lang}
                    editingId={editingPresetId}
                    currentAppearance={draft}
                    onSystemApply={applySystemPreset}
                    onUserSelect={handleSelectUserPreset}
                    onSaveUser={handleSaveUserPreset}
                    onUserDelete={handleDeleteUserPreset}
                    onUserCancel={handleCancelUserPreset}
                  />
                  <button type="button" className="ws-clear-all-btn" onClick={clearAll}>
                    <Trash2 size={11} /> {label(lang, '一键清除全部自定义调节', 'Clear all custom adjustments')}
                  </button>
                </>
              )}

              <div className="ws-studio-preview">
                <span className="ws-studio-preview-label">{label(lang, '实时预览', 'LIVE PREVIEW')}</span>
                <p className="ws-studio-preview-text" style={previewStyle}>
                  {label(lang, '夜色沉入山海，故事从这一行开始。', 'Night settles over the mountains; the story begins here.')}
                </p>
                <p className="ws-studio-preview-sub" style={{ fontFamily: FONT_STACKS[text.font_family] }}>
                  {label(lang, '导航 · 卡片 · 正文会同步显示当前设置。', 'Navigation, cards and body text update with these settings.')}
                </p>
              </div>
            </div>

            <footer className="ws-studio-foot">
              <button type="button" className="ws-studio-btn" onClick={reset} title={label(lang, '恢复默认值', 'Restore defaults')}>
                <RotateCcw size={12} /> {label(lang, '恢复默认', 'Reset')}
              </button>
              <button type="button" className="ws-studio-btn primary" onClick={save}>
                {flash ? <Check size={13} /> : <Save size={13} />}
                {flash || label(lang, '保存配置', 'Save settings')}
              </button>
            </footer>
          </section>

          {officialOpen && (
            <OfficialAssetPicker
              open={officialOpen}
              lang={lang}
              onClose={() => setOfficialOpen(false)}
              onSelect={(url) => { setBackground({ background_url: url }); setOfficialOpen(false) }}
              selectedUrl={draft.background_url}
            />
          )}
        </>
      )}

      {/* 保持图标引用，避免某些打包器把仅用于 aria 的图标 tree-shake 掉。 */}
      <span hidden aria-hidden="true"><Type size={1} /><Sparkles size={1} /><TabIcon size={1} /></span>
    </>
  )
}
