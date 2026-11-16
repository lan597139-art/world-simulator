import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, MoreHorizontal } from 'lucide-react'
import type { ProductConfig, ProductKey } from '../../product/types'
import { PAGE_LABELS_EN } from '../../product/labels'

type Lang = 'zh' | 'en'

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
  error,
  onNavigate,
}: {
  lang: Lang
  product: ProductKey
  productConfig: ProductConfig
  activePage: string
  error?: string
  onNavigate: (page: string) => void
}) {
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)

  const primaryNav: NavItem[] = [{ page: 'workspace-home', label: lang === 'zh' ? '总览' : 'Overview' }]
  const safetyNav: NavItem[] = []
  for (const group of productConfig.nav_groups) {
    for (const item of group.items) {
      const page = item.page === 'overview' || (product === 'yunbao' && item.page === 'yunbao') ? 'workspace-home' : item.page
      if (page === 'workspace-home' || primaryNav.some((row) => row.page === page)) continue
      const target = SAFETY_PAGES.has(page) ? safetyNav : primaryNav
      const fallback = cleanLabel(item.label)
      target.push({ page, label: lang === 'zh' ? fallback : (PAGE_LABELS_EN[page as keyof typeof PAGE_LABELS_EN] || fallback) })
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

  return (
    <>
      <div className="pw-tabs-wrap">
      <nav className="pw-tabs" aria-label={lang === 'zh' ? '产品模块' : 'Product modules'}>
        {primaryNav.map((item) => (
          <button
            key={item.page}
            type="button"
            className={`pw-tab${activePage === item.page || (item.page === 'simulation' && activePage === 'writing') ? ' active' : ''}`}
            onClick={() => onNavigate(item.page)}
            aria-current={activePage === item.page || (item.page === 'simulation' && activePage === 'writing') ? 'page' : undefined}
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
      </div>
      {error && <div className="pw-error" role="alert">{error}</div>}
    </>
  )
}
