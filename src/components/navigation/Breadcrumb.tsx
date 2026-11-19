import { useEffect, useRef, useState } from 'react'
import type { BreadcrumbCrumb, Lang, PageKey } from '../../navigation/navRegistry'

interface BreadcrumbProps {
  crumbs: BreadcrumbCrumb[]
  onNavigate: (page: PageKey) => void
  lang: Lang
}

/**
 * 全站统一面包屑。
 *
 * - 所有上级层级可点击跳转，当前页作为最后一级突出显示且不可点击。
 * - 层级路径由真实路由/产品结构生成，不依赖浏览器历史。
 * - PC / 平板完整显示；移动端路径过长时折叠中间层级，点击“…”查看完整路径。
 * - 不产生横向溢出。
 */
export default function Breadcrumb({ crumbs, onNavigate, lang }: BreadcrumbProps) {
  const [expanded, setExpanded] = useState(false)
  const navRef = useRef<HTMLElement | null>(null)
  const middle = crumbs.slice(1, -1)
  const hasMiddle = middle.length > 0

  // 展开后点击路径或外部区域即收起，避免长期占用空间。
  useEffect(() => {
    if (!expanded) return
    const close = (event: MouseEvent) => {
      if (!navRef.current?.contains(event.target as Node)) setExpanded(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [expanded])

  if (crumbs.length === 0) return null

  const renderCrumb = (crumb: BreadcrumbCrumb, isCurrent: boolean) => {
    if (isCurrent || !crumb.page) {
      return (
        <span className={`ws-breadcrumb-crumb${isCurrent ? ' is-current' : ''}`} aria-current={isCurrent ? 'page' : undefined}>
          {crumb.label}
        </span>
      )
    }
    return (
      <button
        type="button"
        className="ws-breadcrumb-crumb"
        onClick={() => onNavigate(crumb.page as PageKey)}
        aria-current={false}
      >
        {crumb.label}
      </button>
    )
  }

  // 元素序列：首页层级 → [折叠按钮] → 中间层级 → 当前页
  const elements: Array<
    | { kind: 'crumb'; crumb: BreadcrumbCrumb; isMiddle: boolean }
    | { kind: 'fold' }
  > = []
  crumbs.forEach((crumb, index) => {
    if (index === 1 && hasMiddle) {
      elements.push({ kind: 'fold' })
    }
    elements.push({ kind: 'crumb', crumb, isMiddle: hasMiddle && index > 0 && index < crumbs.length - 1 })
  })

  return (
    <nav
      ref={navRef}
      className={`ws-breadcrumb${expanded ? ' is-expanded' : ''}`}
      aria-label={lang === 'zh' ? '面包屑导航' : 'Breadcrumb'}
    >
      <ol className="ws-breadcrumb-list">
        {elements.map((element, index) => {
          const isLast = index === elements.length - 1
          return (
            <li className={`ws-breadcrumb-item${element.kind === 'crumb' && element.isMiddle ? ' is-middle' : ''}`} key={element.kind === 'crumb' ? element.crumb.key : 'fold'}>
              {element.kind === 'fold' ? (
                <button
                  type="button"
                  className="ws-breadcrumb-fold"
                  aria-expanded={expanded}
                  aria-label={lang === 'zh' ? '展开完整路径' : 'Show full path'}
                  onClick={() => setExpanded((value) => !value)}
                >
                  …
                </button>
              ) : (
                renderCrumb(element.crumb, element.crumb.isCurrent === true)
              )}
              {!isLast && <span className="ws-breadcrumb-sep" aria-hidden="true">{lang === 'zh' ? '/' : '/'}</span>}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
