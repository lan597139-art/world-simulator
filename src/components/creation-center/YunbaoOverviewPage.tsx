import { ArrowRight, LayoutDashboard } from 'lucide-react'
import {
  YUNBAO_GROUP_COPY,
  YUNBAO_GROUP_ICONS,
  YUNBAO_OVERVIEW_GROUPS,
  yunbaoNavTarget,
} from './yunbaoNavigation'
import '../../styles/yunbao-workspace.css'

export default function YunbaoOverviewPage({
  onNavigate,
}: {
  onNavigate: (page: string) => void
}) {
  return (
    <div className="yb-overview">
      <header className="yb-overview-head">
        <span className="yb-overview-eyebrow">YUNBAO WORKSPACE</span>
        <h1>云宝领域</h1>
        <p>选择工作域，进入对应的世界、人物、历程与人格记忆。</p>
      </header>

      <section className="yb-overview-grid" aria-label="云宝工作域">
        {YUNBAO_OVERVIEW_GROUPS.map((group) => {
          const Icon = YUNBAO_GROUP_ICONS[group.title] || LayoutDashboard
          const firstPage = group.items[0]?.page
          return (
            <button
              key={group.title}
              type="button"
              className="yb-overview-card"
              onClick={() => {
                if (firstPage) onNavigate(yunbaoNavTarget(firstPage))
              }}
            >
              <span className="yb-overview-card-top">
                <span className="yb-overview-card-icon" aria-hidden="true">
                  <Icon size={20} strokeWidth={1.6} />
                </span>
                <span className="yb-overview-card-count">{group.items.length} 个入口</span>
              </span>
              <strong className="yb-overview-card-title">{group.title}</strong>
              <span className="yb-overview-card-copy">{YUNBAO_GROUP_COPY[group.title]}</span>
              <span className="yb-overview-card-cta">
                进入
                <ArrowRight size={14} strokeWidth={1.7} aria-hidden="true" />
              </span>
            </button>
          )
        })}
      </section>
    </div>
  )
}
