import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Eye, Layers, Monitor, Moon, MousePointer2, RotateCcw, Save, SlidersHorizontal, Sparkles, Sun, Trash2, Type, X } from 'lucide-react'
import { tr, type Lang } from '../../i18n'
import { updateSettings, type SettingsPreferences } from '../../api/settings'
import {
  FONT_STACKS,
  GLASS_TARGETS,
  PRESET_APPEARANCES,
  PRESET_IDS,
  PRESET_META,
  TEXT_SCOPES,
  applyAppearance,
  applyPresetGlobal,
  clearAllAppearance,
  clearPageAppearance,
  defaultAppearance,
  hasPageAppearance,
  loadAppearance,
  loadAppearanceForPage,
  normalizeAppearance,
  saveAppearance,
  savePageAppearance,
  type Appearance,
  type AppearancePresetId,
  type AppearanceTheme,
  type FontFamilyKey,
  type GlassProfile,
  type GlassTarget,
  type TextScope,
} from '../../utils/appearance'

type Props = {
  pageKey: string
  pageName: string
  lang: Lang
}

type Tab = 'glass' | 'liquid' | 'text'
type SaveScope = 'page' | 'global'
type ThemeMode = SettingsPreferences['theme']

function readThemeMode(): ThemeMode {
  const value = document.documentElement.dataset.theme
  return value === 'light' || value === 'dark' ? value : 'system'
}

const TARGET_META: Record<GlassTarget, { zh: string; en: string; short: string }> = {
  nav: { zh: '导航栏', en: 'Navigation', short: 'NAV' },
  card: { zh: '卡片', en: 'Cards', short: 'CARD' },
  modal: { zh: '弹窗 / 面板', en: 'Dialogs', short: 'MODAL' },
  control: { zh: '输入 / 按钮', en: 'Inputs', short: 'INPUT' },
  liquid: { zh: '液态场景卡', en: 'Liquid scenes', short: 'LIQUID' },
}

const TEXT_SCOPE_META: Record<TextScope, { zh: string; en: string }> = {
  nav: { zh: '导航文字', en: 'Navigation text' },
  card: { zh: '卡片文字', en: 'Card text' },
  body: { zh: '页面正文', en: 'Page body' },
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

/** 预设缩略预览：直接用预设的卡片档渲染一小块玻璃，所见即所得。 */
function presetSwatchStyle(presetId: AppearancePresetId) {
  const card = PRESET_APPEARANCES[presetId].glass_profiles.card
  return {
    background: `color-mix(in srgb, var(--glass-frost-bg) ${card.opacity}%, transparent)`,
    backdropFilter: `blur(${card.blur}px)`,
    WebkitBackdropFilter: `blur(${card.blur}px)`,
    border: `1px solid color-mix(in srgb, #fff ${card.border}%, var(--glass-border))`,
    borderRadius: `${card.radius}px`,
    boxShadow: `0 ${card.shadow * 0.3}px ${card.shadow * 0.8}px rgba(0, 0, 0, .14)`,
  }
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

/** 点选模式：把点击到的元素归类到最接近的玻璃目标。 */
function pickTargetFor(element: HTMLElement): GlassTarget {
  if (element.closest('.cc-scene-card')) return 'liquid'
  if (element.closest('.cc-nav-item, .sidebar-nav-item, .app-sidebar, .cc-sidebar, .app-topbar, .cc-topbar, .yb-pinned-nav')) return 'nav'
  if (element.closest('[role="dialog"], .ws-modal, .modal')) return 'modal'
  if (element.closest('input, textarea, select, button')) return 'control'
  return 'card'
}

function Slider({
  labelText, value, min, max, step = 1, unit = '', onChange,
}: {
  labelText: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
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
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  )
}

export default function AppearanceStudio({ pageKey, pageName, lang }: Props) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('glass')
  const [scope, setScope] = useState<SaveScope>('page')
  const [themeMode, setThemeMode] = useState<ThemeMode>(readThemeMode)
  const [draft, setDraft] = useState<Appearance>(() => loadAppearanceForPage(pageKey))
  const [savedPage, setSavedPage] = useState(() => hasPageAppearance(pageKey))
  const [flash, setFlash] = useState('')
  const [pick, setPick] = useState(false)
  const [editTarget, setEditTarget] = useState<GlassTarget>('card')
  const [syncAll, setSyncAll] = useState(true)
  const pickedRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    setDraft(loadAppearanceForPage(pageKey))
    setSavedPage(hasPageAppearance(pageKey))
    setScope('page')
    setFlash('')
  }, [pageKey])

  useEffect(() => {
    const root = document.documentElement
    const sync = () => setThemeMode(readThemeMode())
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!pick) {
      if (pickedRef.current) pickedRef.current.classList.remove('ws-picked')
      pickedRef.current = null
      delete document.documentElement.dataset.wsPick
      return
    }
    const root = document.documentElement
    root.dataset.wsPick = '1'
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (!target || target.closest('.ws-studio-panel, .ws-studio-fab, .ws-studio-overlay')) return
      const candidate = target.closest(
        '.cc-scene-card, .cc-tool, .cc-asset, .cc-recent-work, .cc-card, .cw-card, .glass-card, .glass-frost, .glass-panel, .ws-glass-surface, .tlx-page, .tlx-item, .sim-page, .sim-panel, .sim-console, .slx-page, .slx-card, .slx-node, .events-page, .rel-page, .world-data-page, .world-data-shell, .rel-universe, .cc-nav-item, .sidebar-nav-item, .app-sidebar, .cc-sidebar, .app-topbar, .cc-topbar, h1, h2, h3, h4, h5, h6, p, li, strong, em, blockquote'
      ) as HTMLElement | null
      if (!candidate) return
      if (pickedRef.current) pickedRef.current.classList.remove('ws-picked')
      pickedRef.current = candidate
      candidate.classList.add('ws-picked')
      const pickedTarget = pickTargetFor(candidate)
      setDraft((current) =>
        current.glass_targets.includes(pickedTarget)
          ? current
          : { ...current, glass_targets: [...current.glass_targets, pickedTarget] },
      )
      setEditTarget(pickedTarget)
      setSyncAll(false)
      setFlash(label(
        lang,
        `已选中：${pickedTarget === 'liquid' ? '场景卡' : pickedTarget === 'nav' ? '导航' : pickedTarget === 'modal' ? '弹窗' : pickedTarget === 'control' ? '控件' : '卡片'}，正在单独微调该目标`,
        `Picked: ${pickedTarget === 'liquid' ? 'scene card' : pickedTarget === 'nav' ? 'navigation' : pickedTarget === 'modal' ? 'modal' : pickedTarget === 'control' ? 'control' : 'card'}. Tuning that target on its own now.`,
      ))
    }
    window.addEventListener('click', onClick)
    return () => {
      window.removeEventListener('click', onClick)
      if (pickedRef.current) pickedRef.current.classList.remove('ws-picked')
      pickedRef.current = null
      delete root.dataset.wsPick
    }
  }, [pick, lang])

  useEffect(() => {
    if (!open) return
    applyAppearance(draft)
  }, [draft, open])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closePanel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    const openPanel = () => {
      setDraft(loadAppearanceForPage(pageKey))
      setSavedPage(hasPageAppearance(pageKey))
      setScope('page')
      setOpen(true)
      setFlash('')
    }
    window.addEventListener('ws:open-appearance-studio', openPanel)
    return () => window.removeEventListener('ws:open-appearance-studio', openPanel)
  }, [pageKey])

  useEffect(() => {
    if (!flash) return
    const timer = window.setTimeout(() => setFlash(''), 2200)
    return () => window.clearTimeout(timer)
  }, [flash])

  const activeProfile = draft.glass_profiles[editTarget]
  const text = draft.text
  const textHue = hueOf(text.color)

  const previewStyle = useMemo(() => {
    const custom = text.color_mode === 'custom'
    return {
      fontFamily: FONT_STACKS[text.font_family],
      fontSize: `${Math.min(24, Math.max(12, text.font_size + 1))}px`,
      fontWeight: text.weight,
      fontStyle: text.italic ? 'italic' : 'normal',
      letterSpacing: `${text.letter_spacing * 0.01}em`,
      lineHeight: text.line_height,
      color: custom
        ? `color-mix(in srgb, ${text.color} ${text.opacity}%, transparent)`
        : 'var(--text-main)',
      WebkitTextStroke: `${text.stroke * 0.25}px currentColor`,
      textShadow: `0 ${text.shadow * 0.04}px ${text.shadow * 0.35}px rgba(0,0,0,.34)`,
      transform: `translateY(${text.offset}px)`,
      background: text.background_enabled
        ? `color-mix(in srgb, ${text.background_auto ? 'var(--glass-frost-bg)' : text.background_color} ${text.background_opacity}%, transparent)`
        : 'transparent',
      borderRadius: `${text.background_radius * 0.6}px`,
      padding: text.background_enabled
        ? `${text.background_thickness * 0.28}px ${text.background_thickness * 0.5}px`
        : 0,
      backdropFilter: text.background_enabled ? `blur(${text.background_blur}px)` : undefined,
    } as React.CSSProperties
  }, [text])

  const updateProfile = (field: keyof GlassProfile, value: number) => {
    setDraft((current) => {
      const profiles = { ...current.glass_profiles }
      if (syncAll) {
        // 同步模式：写入所有已选目标；未选时写入全部目标，保持旧行为。
        const targets = current.glass_targets.length ? current.glass_targets : [...GLASS_TARGETS]
        for (const target of targets) profiles[target] = { ...profiles[target], [field]: value }
        return { ...current, glass_targets: targets, glass_profiles: profiles }
      }
      // 单独模式：只改动当前编辑目标，便于对某个 UI 精准微调。
      profiles[editTarget] = { ...profiles[editTarget], [field]: value }
      return { ...current, glass_profiles: profiles }
    })
  }

  const updateText = (patch: Partial<Appearance['text']>) => {
    setDraft((current) => ({ ...current, text: { ...current.text, ...patch } }))
  }

  const toggleTarget = (target: GlassTarget) => {
    setDraft((current) => {
      const selected = current.glass_targets.includes(target)
        ? current.glass_targets.filter((item) => item !== target)
        : [...current.glass_targets, target]
      return { ...current, glass_targets: selected }
    })
  }

  const toggleTextScope = (target: TextScope) => {
    setDraft((current) => {
      const selected = current.text_scopes.includes(target)
        ? current.text_scopes.filter((item) => item !== target)
        : [...current.text_scopes, target]
      return { ...current, text_scopes: selected }
    })
  }

  const chooseTargets = (mode: 'all' | 'none' | 'nav' | 'card') => {
    setDraft((current) => ({
      ...current,
      glass_targets: mode === 'all'
        ? [...GLASS_TARGETS]
        : mode === 'none'
          ? []
          : mode === 'nav' ? ['nav'] : ['card'],
    }))
  }

  /** 一键全局套用预设：写入全站默认、清除本页独立配置并立即生效，必要时同步主题。 */
  const applyPresetGlobalAction = (presetId: AppearancePresetId) => {
    const { appearance: next, theme } = applyPresetGlobal(presetId)
    clearPageAppearance(pageKey)
    setSavedPage(false)
    setScope('global')
    setDraft(loadAppearanceForPage(pageKey))
    if (theme) chooseTheme(theme)
    void next
    setFlash(label(lang, '已一键套用预设并应用到全站', 'Preset applied across the whole site'))
  }

  const chooseTheme = (mode: ThemeMode) => {
    setThemeMode(mode)
    document.documentElement.dataset.theme = mode
    window.dispatchEvent(new CustomEvent('ws:theme-change', { detail: mode }))
    setFlash(label(
      lang,
      mode === 'dark' ? '已切换为深色主题' : mode === 'light' ? '已切换为浅色主题' : '已跟随系统主题',
      mode === 'dark' ? 'Dark theme applied' : mode === 'light' ? 'Light theme applied' : 'Following system theme',
    ))
    // 主题属于账号偏好，立即同步；网络失败也不阻塞当前页面切换。
    void updateSettings({ preferences: { theme: mode } }).catch(() => { /* offline */ })
  }

  const closePanel = () => {
    setOpen(false)
    const saved = loadAppearanceForPage(pageKey)
    setDraft(saved)
    setSavedPage(hasPageAppearance(pageKey))
    applyAppearance(saved)
  }

  const save = () => {
    const next = normalizeAppearance(draft)
    if (scope === 'page') {
      savePageAppearance(pageKey, next)
      setSavedPage(true)
      setFlash(label(lang, '已保存到当前页面', 'Saved for this page'))
    } else {
      saveAppearance(next)
      setFlash(label(lang, '已保存为全站默认', 'Saved as site default'))
    }
    applyAppearance(next)
  }

  const reset = () => {
    setDraft(defaultAppearance())
    setFlash(label(lang, '已恢复默认值，点击保存生效', 'Defaults restored; save to keep them'))
  }

  const clearPage = () => {
    clearPageAppearance(pageKey)
    setSavedPage(false)
    setDraft(loadAppearance())
    setFlash(label(lang, '已清除本页独立配置', 'Page override removed'))
  }

  /** 一键清除所有父子级自定义调节：全站默认 + 所有页面独立配置，恢复出厂默认。 */
  const clearAll = () => {
    clearAllAppearance()
    setSavedPage(false)
    setScope('global')
    setDraft(loadAppearance())
    setFlash(label(lang, '已清除全部自定义调节，恢复默认', 'All custom adjustments cleared; defaults restored'))
  }

  return (
    <>
      {!open && (
      <button
        type="button"
        className={`ws-studio-fab${open ? ' is-open' : ''}`}
        onClick={() => {
          setDraft(loadAppearanceForPage(pageKey))
          setSavedPage(hasPageAppearance(pageKey))
          setScope('page')
          setOpen((value) => !value)
        }}
        title={label(lang, '玻璃与文字调节', 'Glass & type studio')}
        aria-label={label(lang, '打开玻璃与文字调节', 'Open glass and type studio')}
        aria-haspopup="dialog"
      >
        <SlidersHorizontal size={19} strokeWidth={1.8} />
        {savedPage && <span className="ws-studio-fab-badge">1</span>}
      </button>
      )}

      {open && (
        <div
          className="ws-studio-overlay"
          onMouseDown={(event) => { if (event.target === event.currentTarget) closePanel() }}
        >
          <section
            className="ws-studio-panel"
            role="dialog"
            aria-modal="true"
            aria-label={label(lang, '玻璃质感调节', 'Glass material studio')}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="ws-studio-head">
              <div className="ws-studio-head-copy">
                <div className="ws-studio-eyebrow">MATERIAL & TYPE STUDIO</div>
                <h2 className="ws-studio-title">{label(lang, '玻璃与文字调节', 'Glass & type')}</h2>
                <p className="ws-studio-sub">
                  {label(lang, `当前页面：${pageName}`, `Current page: ${pageName}`)}
                  <span> · </span>
                  {label(lang, '拖动即时生效，可为每一页单独保存。', 'Edits apply live and can be saved per page.')}
                </p>
              </div>
              <button type="button" className="ws-studio-icon-btn" onClick={closePanel} aria-label={label(lang, '关闭', 'Close')}>
                <X size={15} />
              </button>
            </header>

            <div className="ws-studio-body">
              <div className="ws-studio-theme-row">
                <div className="ws-studio-theme-copy">
                  <span className="ws-studio-theme-label">{label(lang, '界面主题 · 全局父级', 'Theme · global parent')}</span>
                  <span className="ws-studio-theme-hint">{label(lang, '作为设置中心主题的子级联动，切换后全站即时同步并保存到账号', 'Child of the Settings theme center; syncs site-wide instantly and saves to your account')}</span>
                </div>
                <div className="ws-studio-theme-buttons" role="group" aria-label={label(lang, '界面主题', 'Theme')}>
                  {([
                    { key: 'light' as const, zh: '浅色', en: 'Light', icon: <Sun size={12} /> },
                    { key: 'dark' as const, zh: '深色', en: 'Dark', icon: <Moon size={12} /> },
                    { key: 'system' as const, zh: '跟随系统', en: 'System', icon: <Monitor size={12} /> },
                  ]).map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      className={themeMode === item.key ? 'is-active' : ''}
                      aria-pressed={themeMode === item.key}
                      title={label(lang, item.zh, item.en)}
                      onClick={() => chooseTheme(item.key)}
                    >
                      {item.icon}
                      <span>{label(lang, item.zh, item.en)}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className={`ws-studio-pick-row${pick ? ' is-on' : ''}`}>
                <MousePointer2 size={12} />
                <button type="button" className={pick ? 'is-active' : ''} onClick={() => setPick((value) => !value)} aria-pressed={pick}>
                  {label(lang, '点选元素', 'Pick elements')}
                </button>
                {pick && <span>{label(lang, '点击页面中的卡片或文字，进入精准微调', 'Click any card or text to fine-tune precisely')}</span>}
              </div>
              <div className="ws-studio-scope-row" role="group" aria-label={label(lang, '保存范围', 'Save scope')}>
                <button type="button" className={scope === 'page' ? 'is-active' : ''} onClick={() => setScope('page')}>
                  {label(lang, '仅当前页面', 'This page')}
                </button>
                <button type="button" className={scope === 'global' ? 'is-active' : ''} onClick={() => setScope('global')}>
                  {label(lang, '全站默认', 'Site default')}
                </button>
              </div>
              <div className="ws-studio-page-note">
                <Layers size={11} />
                {savedPage
                  ? label(lang, '本页已有独立配置；导航到其他页面不会受影响。', 'This page has its own settings; other pages stay unchanged.')
                  : label(lang, '本页暂未独立保存，当前显示全站默认。', 'No page override yet; showing the site default.')}
              </div>

              <div className="ws-studio-section-label">
                <span>{label(lang, '作用目标（可多选）', 'Targets (multi-select)')}</span>
                <span>{draft.glass_targets.length}/{GLASS_TARGETS.length}</span>
              </div>
              <div className="ws-studio-chip-row">
                {GLASS_TARGETS.map((target) => (
                  <button
                    key={target}
                    type="button"
                    className={`ws-studio-chip${draft.glass_targets.includes(target) ? ' is-on' : ''}`}
                    onClick={() => toggleTarget(target)}
                    aria-pressed={draft.glass_targets.includes(target)}
                  >
                    {label(lang, TARGET_META[target].zh, TARGET_META[target].en)}
                  </button>
                ))}
              </div>
              <div className="ws-studio-mini-actions">
                <button type="button" onClick={() => chooseTargets('all')}>{label(lang, '全选', 'Select all')}</button>
                <button type="button" onClick={() => chooseTargets('none')}>{label(lang, '清空', 'Clear')}</button>
                <button type="button" onClick={() => chooseTargets('nav')}>{label(lang, '仅导航', 'Nav only')}</button>
                <button type="button" onClick={() => chooseTargets('card')}>{label(lang, '仅卡片', 'Cards only')}</button>
              </div>

              <div className="ws-studio-section-label">
                <span>{label(lang, '预设（一键全局使用）', 'Presets (one-click global)')}</span>
                <span>{label(lang, '预览后一键套用到全站', 'Preview then apply site-wide')}</span>
              </div>
              <div className="ws-studio-presets">
                {PRESET_IDS.map((presetId) => (
                  <button
                    key={presetId}
                    type="button"
                    className="ws-studio-preset"
                    onClick={() => applyPresetGlobalAction(presetId)}
                    title={label(lang, PRESET_META[presetId].zh, PRESET_META[presetId].en)}
                  >
                    <span className="ws-studio-preset-swatch" style={presetSwatchStyle(presetId)} />
                    <span className="ws-studio-preset-label">{label(lang, PRESET_META[presetId].zh, PRESET_META[presetId].en)}</span>
                  </button>
                ))}
              </div>
              <div className="ws-studio-mini-actions">
                <button type="button" className="ws-studio-clear-all" onClick={clearAll}>
                  <Trash2 size={11} /> {label(lang, '一键清除全部自定义调节', 'Clear all custom adjustments')}
                </button>
              </div>

              <div className="ws-studio-tabs" role="tablist" aria-label={label(lang, '调节分类', 'Adjustment category')}>
                <button type="button" role="tab" aria-selected={tab === 'glass'} className={tab === 'glass' ? 'is-active' : ''} onClick={() => setTab('glass')}>
                  {label(lang, '毛玻璃', 'Frosted')}
                </button>
                <button type="button" role="tab" aria-selected={tab === 'liquid'} className={tab === 'liquid' ? 'is-active' : ''} onClick={() => setTab('liquid')}>
                  {label(lang, '液态玻璃', 'Liquid')}
                </button>
                <button type="button" role="tab" aria-selected={tab === 'text'} className={tab === 'text' ? 'is-active' : ''} onClick={() => setTab('text')}>
                  {label(lang, '字体文字', 'Typography')}
                </button>
              </div>

              <div className="ws-studio-tab-body">
                {draft.glass_targets.length === 0 && tab !== 'text' && (
                  <div className="ws-studio-note">
                    {label(lang, '还没有勾选作用目标。调整会默认写入全部目标，建议先选择导航或卡片。', 'No target selected. Changes fall back to all targets; pick a target first.')}
                  </div>
                )}

                {tab === 'glass' && (
                  <>
                    <div className="ws-studio-section-label">
                      <span>{label(lang, '编辑目标', 'Edit target')}</span>
                      <span style={{ fontWeight: 500, color: 'var(--text-faint)' }}>{label(lang, '单独微调', 'Per-target')}</span>
                    </div>
                    <div className="ws-studio-chip-row" style={{ marginBottom: 10 }}>
                      {GLASS_TARGETS.map((target) => (
                        <button
                          key={target}
                          type="button"
                          className={`ws-studio-chip${editTarget === target ? ' is-on' : ''}`}
                          onClick={() => setEditTarget(target)}
                          aria-pressed={editTarget === target}
                        >
                          {label(lang, TARGET_META[target].zh, TARGET_META[target].en)}
                        </button>
                      ))}
                    </div>
                    <div className="ws-studio-mini-actions" style={{ marginTop: 0, marginBottom: 10 }}>
                      <button
                        type="button"
                        className={syncAll ? 'is-active' : ''}
                        onClick={() => setSyncAll((value) => !value)}
                        aria-pressed={syncAll}
                      >
                        {label(
                          lang,
                          syncAll ? '同步到全部已选目标' : '仅调整当前目标',
                          syncAll ? 'Sync to all selected' : 'Adjust current target only',
                        )}
                      </button>
                    </div>
                    <div className="ws-studio-note">
                      <Eye size={11} style={{ verticalAlign: '-2px', marginRight: 4 }} />
                      {label(
                        lang,
                        syncAll
                          ? `正在调节：${draft.glass_targets.map((item) => TARGET_META[item].zh).join('、') || '全部'}。滑块会同步写入所有已选目标。`
                          : `正在单独调节：${TARGET_META[editTarget].zh}。滑块只写入该目标。`,
                        syncAll
                          ? `Editing: ${draft.glass_targets.map((item) => TARGET_META[item].en).join(', ') || 'all'}. Sliders sync to all selected targets.`
                          : `Editing ${TARGET_META[editTarget].en} on its own. Sliders write to this target only.`,
                      )}
                    </div>
                    <Slider labelText={label(lang, '模糊度 Blur', 'Blur')} value={activeProfile.blur} min={0} max={50} unit="px" onChange={(value) => updateProfile('blur', value)} />
                    <Slider labelText={label(lang, '底色透明度 Opacity', 'Tint opacity')} value={activeProfile.opacity} min={0} max={100} unit="%" onChange={(value) => updateProfile('opacity', value)} />
                    <Slider labelText={label(lang, '边框高光 Border', 'Border highlight')} value={activeProfile.border} min={0} max={100} unit="%" onChange={(value) => updateProfile('border', value)} />
                    <Slider labelText={label(lang, '着色层 Tint', 'Tint layer')} value={activeProfile.tint} min={0} max={100} unit="%" onChange={(value) => updateProfile('tint', value)} />
                    <Slider labelText={label(lang, '颜色渐变 Gradient', 'Color gradient')} value={activeProfile.gradient} min={0} max={100} unit="%" onChange={(value) => updateProfile('gradient', value)} />
                    <Slider labelText={label(lang, '玻璃厚度', 'Glass thickness')} value={activeProfile.thickness} min={0} max={80} unit="" onChange={(value) => updateProfile('thickness', value)} />
                    <Slider labelText={label(lang, '圆角 Radius', 'Corner radius')} value={activeProfile.radius} min={0} max={60} unit="px" onChange={(value) => updateProfile('radius', value)} />
                    <Slider labelText={label(lang, '外阴影 Shadow', 'Outer shadow')} value={activeProfile.shadow} min={0} max={100} unit="" onChange={(value) => updateProfile('shadow', value)} />
                    <button
                      type="button"
                      className={`ws-studio-chip${draft.readability_guard ? ' is-on' : ''}`}
                      onClick={() => setDraft((current) => ({ ...current, readability_guard: !current.readability_guard }))}
                      aria-pressed={draft.readability_guard}
                    >
                      {label(lang, '可读性保护（推荐）', 'Readability guard (recommended)')}
                    </button>
                    <p className="ws-studio-hint">
                      {label(
                        lang,
                        '开启后，即使把透明度拉得很低，文字所在容器仍保留最低底色，避免浅色或彩色背景下看不清。',
                        'Keeps a minimum tint under text even at low opacity, so light or colorful backgrounds cannot wash text out.',
                      )}
                    </p>
                  </>
                )}

                {tab === 'liquid' && (
                  <>
                    <div className="ws-studio-note">
                      {label(
                        lang,
                        '液态参数用于首页场景卡的 WebGL 折射；导航与普通卡片使用 CSS 边缘色散近似。',
                        'Liquid values drive WebGL refraction on scene cards; navigation and regular cards use a CSS edge-dispersion approximation.',
                      )}
                    </div>
                    <Slider labelText={label(lang, '折射强度 Refraction', 'Refraction')} value={activeProfile.refraction} min={0} max={100} unit="" onChange={(value) => updateProfile('refraction', value)} />
                    <Slider labelText={label(lang, '色散强度 Dispersion', 'Dispersion')} value={activeProfile.dispersion} min={0} max={100} unit="" onChange={(value) => updateProfile('dispersion', value)} />
                    <Slider labelText={label(lang, '磨砂质感 Frost', 'Frost')} value={activeProfile.frost} min={0} max={100} unit="" onChange={(value) => updateProfile('frost', value)} />
                    <p className="ws-studio-hint">
                      {label(
                        lang,
                        '调整液态场景卡时，首页的 6 张场景卡会立刻重绘 WebGL 参数。浏览器不支持 WebGL2 时自动退回 CSS 毛玻璃。',
                        'The six scene cards repaint their WebGL material immediately. Browsers without WebGL2 fall back to CSS frosted glass.',
                      )}
                    </p>
                  </>
                )}

                {tab === 'text' && (
                  <>
                    <div className="ws-studio-section-label">
                      <span>{label(lang, '文字作用范围', 'Text scope')}</span>
                      <span>{draft.text_scopes.length}/{TEXT_SCOPES.length}</span>
                    </div>
                    <div className="ws-studio-chip-row" style={{ marginBottom: 12 }}>
                      {TEXT_SCOPES.map((item) => (
                        <button
                          key={item}
                          type="button"
                          className={`ws-studio-chip${draft.text_scopes.includes(item) ? ' is-on' : ''}`}
                          onClick={() => toggleTextScope(item)}
                          aria-pressed={draft.text_scopes.includes(item)}
                        >
                          {label(lang, TEXT_SCOPE_META[item].zh, TEXT_SCOPE_META[item].en)}
                        </button>
                      ))}
                      <button type="button" className="ws-studio-chip" onClick={() => setDraft((current) => ({ ...current, text_scopes: [...TEXT_SCOPES] }))}>
                        {label(lang, '全选', 'All')}
                      </button>
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
                    <Slider labelText={label(lang, '字号大小', 'Font size')} value={text.font_size} min={11} max={26} unit="px" onChange={(value) => updateText({ font_size: value })} />
                    <Slider labelText={label(lang, '字重 / 粗体', 'Weight')} value={text.weight} min={300} max={850} step={10} unit="" onChange={(value) => updateText({ weight: value })} />
                    <div className="ws-studio-field">
                      <div className="ws-studio-field-head">
                        <label>{label(lang, '斜体', 'Italic')}</label>
                      </div>
                      <div className="ws-studio-segment">
                        <button type="button" className={!text.italic ? 'is-active' : ''} onClick={() => updateText({ italic: false })}>{label(lang, '正常', 'Normal')}</button>
                        <button type="button" className={text.italic ? 'is-active' : ''} onClick={() => updateText({ italic: true })}>{label(lang, '斜体', 'Italic')}</button>
                      </div>
                    </div>

                    <div className="ws-studio-section-label">
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
                    <Slider labelText={label(lang, '字色透明度', 'Text opacity')} value={text.opacity} min={25} max={100} unit="%" onChange={(value) => updateText({ opacity: value })} />
                    <Slider labelText={label(lang, '色相 / 字色滑动', 'Hue / color slider')} value={textHue} min={0} max={360} unit="°" onChange={(value) => updateText({ color: `hsl(${value} 72% 58%)`, color_mode: 'custom' })} />
                    <Slider labelText={label(lang, '文字描边', 'Text stroke')} value={text.stroke} min={0} max={4} step={0.2} unit="px" onChange={(value) => updateText({ stroke: value })} />
                    <Slider labelText={label(lang, '文字阴影', 'Text shadow')} value={text.shadow} min={0} max={32} unit="" onChange={(value) => updateText({ shadow: value })} />
                    <Slider labelText={label(lang, '字距 / 弯曲', 'Spacing / curve')} value={text.letter_spacing} min={-2} max={5} step={0.1} unit="" onChange={(value) => updateText({ letter_spacing: value })} />
                    <Slider labelText={label(lang, '垂直偏移', 'Offset')} value={text.offset} min={-8} max={8} step={0.5} unit="px" onChange={(value) => updateText({ offset: value })} />
                    <Slider labelText={label(lang, '行高', 'Line height')} value={text.line_height} min={1.15} max={2.4} step={0.05} unit="" onChange={(value) => updateText({ line_height: value })} />

                    <div className="ws-studio-section-label">
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
                    <Slider labelText={label(lang, '背景透明度', 'Backdrop opacity')} value={text.background_opacity} min={0} max={100} unit="%" onChange={(value) => updateText({ background_opacity: value })} />
                    <Slider labelText={label(lang, '背景厚度', 'Backdrop thickness')} value={text.background_thickness} min={0} max={40} unit="px" onChange={(value) => updateText({ background_thickness: value })} />
                    <Slider labelText={label(lang, '背景模糊', 'Backdrop blur')} value={text.background_blur} min={0} max={50} unit="px" onChange={(value) => updateText({ background_blur: value })} />
                    <Slider labelText={label(lang, '背景圆角', 'Backdrop radius')} value={text.background_radius} min={0} max={40} unit="px" onChange={(value) => updateText({ background_radius: value })} />
                    <p className="ws-studio-hint">
                      {label(
                        lang,
                        '文字背景只作用于选中的文字范围；关闭时不会改变卡片与导航的玻璃。',
                        'The text backdrop only affects selected text scopes; it does not change card or nav glass when off.',
                      )}
                    </p>
                  </>
                )}
              </div>

              <div className="ws-studio-preview">
                <span className="ws-studio-preview-label">LIVE PREVIEW</span>
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
              {savedPage && (
                <button type="button" className="ws-studio-btn" onClick={clearPage} title={label(lang, '删除本页独立配置', 'Remove page override')}>
                  <Trash2 size={12} /> {label(lang, '清除本页', 'Clear page')}
                </button>
              )}
              <button type="button" className="ws-studio-btn primary" onClick={save}>
                {flash ? <Check size={13} /> : <Save size={13} />}
                {flash || label(lang, '保存配置', 'Save settings')}
              </button>
            </footer>
          </section>
        </div>
      )}

      {/* 保持图标引用，避免某些打包器把仅用于 aria 的图标 tree-shake 掉。 */}
      <span hidden aria-hidden="true"><Type size={1} /><Sparkles size={1} /></span>
    </>
  )
}
