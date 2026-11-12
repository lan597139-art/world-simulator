import { useEffect, useRef, useState } from 'react'
import {
  ArrowUpRight,
  BookOpen,
  ChevronDown,
  Cloud,
  Gamepad2,
  Heart,
  MoreHorizontal,
  NotebookPen,
  Plus,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import type { ProductConfig, ProductKey } from '../../product/types'

type Lang = 'zh' | 'en'

const PRODUCT_ICONS: Record<string, LucideIcon> = {
  game: Gamepad2,
  literature: BookOpen,
  companion: Heart,
  diary: NotebookPen,
  yunbao: Cloud,
}

const PRODUCT_COPY: Record<string, { zh: string; en: string; eyebrow: string }> = {
  game: { zh: '游戏创作', en: 'Game Creation', eyebrow: 'GAME WORKSPACE' },
  literature: { zh: '文学创作', en: 'Literature Creation', eyebrow: 'LITERATURE WORKSPACE' },
  companion: { zh: 'AI 伴侣', en: 'AI Companion', eyebrow: 'COMPANION SPACE' },
  diary: { zh: '日记与传记', en: 'Diary & Biography', eyebrow: 'LIFE ARCHIVE' },
  yunbao: { zh: '云宝工作台', en: 'Yunbao Workspace', eyebrow: 'YUNBAO CORE' },
}

type NavItem = { page: string; label: string }

const SAFETY_PAGES = new Set(['time-machine', 'archive', 'trash'])

function cleanLabel(label: string) {
  return label.replace(/^\d+\s*/, '')
}

export default function ProductWorkspaceNav({
  lang,
  product,
  productConfig,
  activePage,
  currentWorldName,
  error,
  onNavigate,
  onNewWorld,
}: {
  lang: Lang
  product: ProductKey
  productConfig: ProductConfig
  activePage: string
  currentWorldName: string
  error?: string
  onNavigate: (page: string) => void
  onNewWorld: () => void
}) {
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)
  const Icon = PRODUCT_ICONS[product] || Gamepad2
  const copy = PRODUCT_COPY[product] || { zh: productConfig.label, en: productConfig.label, eyebrow: 'WORKSPACE' }
  const isWorldProduct = product === 'game' || product === 'literature'
  const spaceName = isWorldProduct
    ? currentWorldName || (lang === 'zh' ? '选择世界' : 'Choose a world')
    : productConfig.workspace_name || (lang === 'zh' ? '当前空间' : 'Current space')

  const primaryNav: NavItem[] = [{ page: 'workspace-home', label: lang === 'zh' ? '总览' : 'Overview' }]
  const safetyNav: NavItem[] = []
  for (const group of productConfig.nav_groups) {
    for (const item of group.items) {
      const page = item.page === 'overview' || (product === 'yunbao' && item.page === 'yunbao') ? 'workspace-home' : item.page
      if (page === 'workspace-home' || primaryNav.some((row) => row.page === page)) continue
      const target = SAFETY_PAGES.has(page) ? safetyNav : primaryNav
      target.push({ page, label: cleanLabel(item.label) })
    }
  }

  useEffect(() => {
    if (!moreOpen) return
    const close = (event: MouseEvent) => {
      if (!moreRef.current?.contains(event.target as Node)) setMoreOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMoreOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', escape)
    }
  }, [moreOpen])

  const primaryAction = isWorldProduct
    ? { label: lang === 'zh' ? '新建世界' : 'New world', icon: Plus, onClick: onNewWorld }
    : product === 'companion'
      ? { label: lang === 'zh' ? '创建伴侣' : 'New companion', icon: Plus, onClick: () => onNavigate('character-management') }
      : product === 'yunbao'
        ? { label: lang === 'zh' ? '人格编辑器' : 'Persona editor', icon: Sparkles, onClick: () => onNavigate('personas') }
        : { label: lang === 'zh' ? '写今天' : 'Write today', icon: Plus, onClick: () => onNavigate('diary') }
  const ActionIcon = primaryAction.icon

  return (
    <section className="pw-shell" aria-label={lang === 'zh' ? '产品工作区导航' : 'Workspace navigation'}>
      <header className="pw-head">
        <div className="pw-identity">
          <span className="pw-product-icon"><Icon size={21} strokeWidth={1.6} aria-hidden="true" /></span>
          <div>
            <span className="pw-eyebrow">{copy.eyebrow}</span>
            <h1>{lang === 'zh' ? copy.zh : copy.en}</h1>
          </div>
        </div>
        <div className="pw-head-spacer" />
        {isWorldProduct ? (
          <button
            type="button"
            className="pw-space"
            onClick={() => onNavigate('world-management')}
            title={lang === 'zh' ? '切换世界' : 'Switch world'}
          >
            <span className="pw-space-dot" />
            <span>{spaceName}</span>
            <ChevronDown size={12} strokeWidth={1.8} aria-hidden="true" />
          </button>
        ) : (
          <span className="pw-space is-static" title={spaceName}>
            <span className="pw-space-dot" />
            <span>{spaceName}</span>
          </span>
        )}
        <button type="button" className="pw-primary" onClick={primaryAction.onClick}>
          <ActionIcon size={14} strokeWidth={1.8} aria-hidden="true" />
          {primaryAction.label}
        </button>
      </header>

      <nav className="pw-tabs" aria-label={lang === 'zh' ? '产品模块' : 'Product modules'}>
        {primaryNav.map((item) => (
          <button
            key={item.page}
            type="button"
            className={`pw-tab${activePage === item.page ? ' active' : ''}`}
            onClick={() => onNavigate(item.page)}
            aria-current={activePage === item.page ? 'page' : undefined}
          >
            {item.label}
          </button>
        ))}
        {safetyNav.length > 0 && (
          <div className="pw-more" ref={moreRef}>
            <button
              type="button"
              className={`pw-tab pw-more-trigger${safetyNav.some((item) => item.page === activePage) ? ' active' : ''}`}
              onClick={() => setMoreOpen((value) => !value)}
              aria-expanded={moreOpen}
            >
              <MoreHorizontal size={14} strokeWidth={1.8} aria-hidden="true" />
              {lang === 'zh' ? '更多' : 'More'}
            </button>
            {moreOpen && (
              <div className="pw-more-menu" role="menu">
                {safetyNav.map((item) => (
                  <button
                    key={item.page}
                    type="button"
                    role="menuitem"
                    onClick={() => { setMoreOpen(false); onNavigate(item.page) }}
                  >
                    {item.label}
                    <ArrowUpRight size={12} strokeWidth={1.7} aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </nav>
      {error && <div className="pw-error" role="alert">{error}</div>}
    </section>
  )
}
