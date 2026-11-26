import {
  ArrowUpRight,
  Globe2,
  PenLine,
  Route,
  Send,
  UserRound,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import '../styles/community.css'

type Lang = 'zh' | 'en'

export type CommunityWorkCardType = 'works' | 'worlds' | 'characters' | 'storylines'

const CARD_COPY: Record<Lang, {
  free: string
  author: string
  quad: string
  openWork: string
  openWorld: string
  openCharacters: string
  openStoryline: string
}> = {
  zh: {
    free: '免费阅读',
    author: '创作者',
    quad: '一键四连',
    openWork: '阅读作品',
    openWorld: '进入世界',
    openCharacters: '查看人物',
    openStoryline: '查看剧情',
  },
  en: {
    free: 'Free to read',
    author: 'Creator',
    quad: 'Quad',
    openWork: 'Read work',
    openWorld: 'Enter world',
    openCharacters: 'View characters',
    openStoryline: 'View storyline',
  },
}

const TYPE_ICON: Record<CommunityWorkCardType, LucideIcon> = {
  works: PenLine,
  worlds: Globe2,
  characters: UserRound,
  storylines: Route,
}

/**
 * 作品集统一内容卡片模板。
 *
 * 世界、OC、剧情等所有内容类型共用同一套展示结构：类型标识 → 标题 →
 * 创作者 → 内容 → 进入/一键四连。阅读与体验免费，一键四连的打赏不消耗灵果。
 */
export default function CommunityWorkCard({
  lang,
  type,
  typeLabel,
  title,
  author,
  meta,
  content,
  viewCount,
  clickCount,
  entryLabel,
  onOpen,
  onQuad,
}: {
  lang: Lang
  type: CommunityWorkCardType
  typeLabel: string
  title: string
  author?: string
  meta?: string
  content: string
  /** 阅读量；为 undefined 时不展示计数。 */
  viewCount?: number
  /** 点击量；为 undefined 时不展示计数。 */
  clickCount?: number
  entryLabel: string
  onOpen: () => void
  onQuad: () => void
}) {
  const copy = CARD_COPY[lang]
  const Icon = TYPE_ICON[type]

  return (
    <article
      className={`cwc-card cwc-${type}`}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen()
        }
      }}
    >
      <header className="cwc-head">
        <span className={`cm-type ${type}`}>
          <Icon size={11} aria-hidden="true" />
          {typeLabel}
        </span>
        {meta ? <span className="cwc-meta">{meta}</span> : null}
      </header>

      <h3 className="cwc-title">{title}</h3>
      {author ? <p className="cwc-author">{copy.author} · {author}</p> : null}

      <p className="cwc-body">{content}</p>

      {typeof viewCount === 'number' || typeof clickCount === 'number' ? (
        <section className="cwc-stats">
          {typeof viewCount === 'number' ? <span>{`阅读 ${viewCount}`}</span> : null}
          {typeof clickCount === 'number' ? <span>{`点击 ${clickCount}`}</span> : null}
        </section>
      ) : null}

      <section className="cwc-cost">
        <span className="cwc-cost-value is-free">{copy.free}</span>
      </section>

      <footer className="cwc-foot">
        <button type="button" className="cwc-btn is-primary" onClick={(event) => { event.stopPropagation(); onOpen() }}>
          {entryLabel} <ArrowUpRight size={12} aria-hidden="true" />
        </button>
        <button type="button" className="cwc-btn" onClick={(event) => { event.stopPropagation(); onQuad() }}>
          <Send size={12} aria-hidden="true" />
          {copy.quad}
        </button>
      </footer>
    </article>
  )
}
