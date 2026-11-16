import { YUNBAO_OVERVIEW_GROUPS, yunbaoNavTarget } from './yunbaoNavigation'
import { NAV_GROUP_EN, PAGE_LABELS_EN } from '../../product/labels'

export default function YunbaoGroupNav({
  lang = 'zh',
  activePage,
  hidden = false,
  onNavigate,
}: {
  lang?: 'zh' | 'en'
  activePage: string
  hidden?: boolean
  onNavigate: (page: string) => void
}) {
  const group = YUNBAO_OVERVIEW_GROUPS.find((item) =>
    item.items.some((entry) => yunbaoNavTarget(entry.page) === activePage),
  )

  if (!group) return null

  return (
    <nav className={`yb-group-tabs${hidden ? ' is-auto-hidden' : ''}`} aria-label={lang === 'zh' ? `${group.title}导航` : `${NAV_GROUP_EN[group.title] || group.title} navigation`} aria-hidden={hidden ? true : undefined}>
      <span className="yb-group-tabs-label">{lang === 'zh' ? group.title : (NAV_GROUP_EN[group.title] || group.title)}</span>
      {group.items.map((item) => {
        const target = yunbaoNavTarget(item.page)
        const isActive = activePage === target
        return (
          <button
            key={item.page}
            type="button"
            className={`yb-group-tab${isActive ? ' is-active' : ''}`}
            onClick={() => onNavigate(target)}
            aria-current={isActive ? 'page' : undefined}
          >
            {lang === 'zh' ? item.label : (PAGE_LABELS_EN[target as keyof typeof PAGE_LABELS_EN] || item.label)}
          </button>
        )
      })}
    </nav>
  )
}
