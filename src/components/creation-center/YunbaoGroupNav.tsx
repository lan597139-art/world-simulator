import { YUNBAO_OVERVIEW_GROUPS, yunbaoNavTarget } from './yunbaoNavigation'

export default function YunbaoGroupNav({
  activePage,
  hidden = false,
  onNavigate,
}: {
  activePage: string
  hidden?: boolean
  onNavigate: (page: string) => void
}) {
  const group = YUNBAO_OVERVIEW_GROUPS.find((item) =>
    item.items.some((entry) => yunbaoNavTarget(entry.page) === activePage),
  )

  if (!group) return null

  return (
    <nav className={`yb-group-tabs${hidden ? ' is-auto-hidden' : ''}`} aria-label={`${group.title}导航`} aria-hidden={hidden ? true : undefined}>
      <span className="yb-group-tabs-label">{group.title}</span>
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
            {item.label}
          </button>
        )
      })}
    </nav>
  )
}
