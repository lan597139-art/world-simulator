import { useEffect, useState } from 'react'
import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  Heart,
  MessageCircle,
  MessageSquare,
  Send,
  Share2,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react'
import {
  clickPublicWork,
  commentOnWork,
  favoriteWork,
  getExperienceInfo,
  grantExperience,
  likePublicWork,
  listComments,
  publicDetail,
  unlikePublicWork,
  type PublicationExperience,
  type PublicWork,
} from '../api/community'
import { giftSpiritFruit } from '../api/spiritEconomy'
import { quadCheer } from '../api/socialCore'
import type { StoryItem } from '../api/writing'
import '../styles/community-detail.css'

type Lang = 'zh' | 'en'

/** 作品集统一作品详情的入口目标：作品、本地创作、世界、OC 与剧情。 */
export type CommunityDetailTarget =
  | { kind: 'publication'; work: PublicWork }
  | { kind: 'story'; work: StoryItem }
  | { kind: 'world'; id: string; title: string; summary: string; meta: string }
  | { kind: 'character'; id: string; title: string; summary: string; meta: string; characterId: string; worldId: string }
  | { kind: 'storyline'; id: string; title: string; summary: string; meta: string }

type CommentRow = { id: string; body: string; created_at?: string | null }

async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value)
      return true
    }
  } catch {
    /* fall through */
  }
  try {
    const area = document.createElement('textarea')
    area.value = value
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    area.style.pointerEvents = 'none'
    document.body.appendChild(area)
    area.select()
    const copied = document.execCommand('copy')
    area.remove()
    return copied
  } catch {
    return false
  }
}

function formatDate(value: string | null | undefined, lang: Lang) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric' })
}

const COPY = {
  zh: {
    works: '作品',
    story: '创作',
    worlds: '世界',
    characters: 'OC',
    storylines: '剧情',
    by: '创作者',
    published: '已发布',
    draft: '草稿',
    intro: '简介',
    toc: '目录',
    free: '免费',
    locked: '灵果',
    unlockedShort: '已解锁',
    cost: '灵果消耗',
    fruit: '灵果',
    reads: '阅读',
    clicks: '点击',
    freeAll: '全部免费',
    pricePending: '定价尚未确认',
    afterFree: '后续需灵果',
    freeChapters: (n: number) => `前 ${n} 章免费`,
    confirm: '确认灵果体验',
    confirming: '正在确认…',
    unlocked: '已解锁后续深度内容',
    experienceOff: '作者未开放灵果体验',
    experienceNoPrice: '灵果体验定价尚未确认，暂不可体验。',
    deepEmpty: '该作品暂无后续深度内容。',
    like: '点赞',
    liked: '已点赞',
    favorite: '收藏',
    favorited: '已收藏',
    share: '分享',
    shared: '链接已复制',
    tip: '打赏',
    tipOpen: '打赏作者',
    tipAmount: '数量',
    tipConfirm: '确认打赏',
    tipSending: '发送中…',
    quad: '一键四连',
    quadDone: '已点赞、收藏、推荐并打赏（未消耗灵果）',
    quadTipExtra: '额外打赏',
    comment: '评论',
    commentPlaceholder: '写下你的评价…',
    commentSend: '发送',
    commentEmpty: '还没有评论',
    author: '作者',
    noPublicContent: '暂无公开内容',
    openWorkbench: '在写作页打开',
    aiTitle: 'AI 互动',
    aiChat: '开始对话',
    aiRelations: '关系网络',
    aiEvents: '互动事件',
    aiMemories: '互动记忆',
    aiSimulation: '进入模拟',
    openWorld: '进入世界',
    openCharacters: '查看人物',
    openStorylines: '查看剧情',
    errorLoad: '作品内容读取失败',
    errorExperience: '体验失败',
    errorLike: '操作失败',
    errorComment: '评论发送失败',
    errorTip: '打赏失败',
  },
  en: {
    works: 'Work',
    story: 'Writing',
    worlds: 'World',
    characters: 'OC',
    storylines: 'Storyline',
    by: 'Creator',
    published: 'Published',
    draft: 'Draft',
    intro: 'Intro',
    toc: 'Contents',
    free: 'Free',
    locked: 'Fruit',
    unlockedShort: 'Unlocked',
    cost: 'Spirit fruit',
    fruit: 'fruit',
    reads: 'Reads',
    clicks: 'Clicks',
    freeAll: 'All free',
    pricePending: 'Pricing not confirmed',
    afterFree: 'Rest needs fruit',
    freeChapters: (n: number) => `First ${n} chapters free`,
    confirm: 'Confirm spirit-fruit',
    confirming: 'Confirming…',
    unlocked: 'Deep content unlocked',
    experienceOff: 'Spirit-fruit experience is not open',
    experienceNoPrice: 'Spirit-fruit pricing is not confirmed yet.',
    deepEmpty: 'This work has no deep content.',
    like: 'Like',
    liked: 'Liked',
    favorite: 'Favorite',
    favorited: 'Favorited',
    share: 'Share',
    shared: 'Link copied',
    tip: 'Tip',
    tipOpen: 'Tip the author',
    tipAmount: 'Amount',
    tipConfirm: 'Confirm tip',
    tipSending: 'Sending…',
    quad: 'Quad',
    quadDone: 'Liked, saved, recommended and cheered (no fruit spent)',
    quadTipExtra: 'Tip more',
    comment: 'Comments',
    commentPlaceholder: 'Write your review…',
    commentSend: 'Send',
    commentEmpty: 'No comments yet',
    author: 'Author',
    noPublicContent: 'No public content',
    openWorkbench: 'Open in writing',
    aiTitle: 'AI interaction',
    aiChat: 'Start chat',
    aiRelations: 'Relationships',
    aiEvents: 'Events',
    aiMemories: 'Memories',
    aiSimulation: 'Open simulation',
    openWorld: 'Enter world',
    openCharacters: 'View characters',
    openStorylines: 'View storylines',
    errorLoad: 'Failed to load work content',
    errorExperience: 'Experience failed',
    errorLike: 'Action failed',
    errorComment: 'Failed to post comment',
    errorTip: 'Tip failed',
  },
}

function snapshotItems(snapshot: PublicWork['content']['snapshot']) {
  const items = snapshot?.items
  if (Array.isArray(items) && items.length > 0) return items
  if (snapshot && Object.keys(snapshot).length > 0) return [{ title: '', content: JSON.stringify(snapshot) }]
  return []
}

function renderItems(items: Array<{ title?: string; content?: string }>) {
  return items.map((item, index) => (
    <div key={index}>
      {item.title ? <p className="cwd-item-title">{item.title}</p> : null}
      <p className="cwd-prose">{item.content || ''}</p>
    </div>
  ))
}

export default function CommunityWorkDetail({
  lang,
  user,
  target,
  onClose,
  onOpenWorkbench,
  onOpenWorld,
  onOpenCharacters,
  onOpenStorylines,
  onOpenChat,
  onOpenRelationships,
  onOpenEvents,
  onOpenMemories,
  onOpenSimulation,
}: {
  lang: Lang
  user: { id: string; display_name: string } | null
  target: CommunityDetailTarget
  onClose: () => void
  onOpenWorkbench: () => void
  onOpenWorld: () => void
  onOpenCharacters: () => void
  onOpenStorylines: () => void
  onOpenChat?: (worldId: string, characterId?: string) => void
  onOpenRelationships?: () => void
  onOpenEvents?: () => void
  onOpenMemories?: () => void
  onOpenSimulation?: () => void
}) {
  const copy = COPY[lang]
  const isPublication = target.kind === 'publication'
  const publicId = isPublication ? target.work.public_id : ''

  const [detail, setDetail] = useState<PublicWork | null>(null)
  const [experience, setExperience] = useState<PublicationExperience | null>(null)
  const [deep, setDeep] = useState<PublicWork['content']['snapshot'] | null>(null)
  const [comments, setComments] = useState<CommentRow[]>([])
  const [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState<{ text: string; tone: 'ok' | 'error' | 'info' }>({ text: '', tone: 'info' })
  const [shareState, setShareState] = useState<'idle' | 'copied'>('idle')
  const [tipOpen, setTipOpen] = useState(false)
  const [tipAmount, setTipAmount] = useState('30')
  const [commentText, setCommentText] = useState('')

  const idempotencyKey = `experience:${publicId}`

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  useEffect(() => {
    let cancelled = false
    setDetail(null)
    setExperience(null)
    setDeep(null)
    setComments([])
    setLoadError('')
    setNotice({ text: '', tone: 'info' })
    setShareState('idle')
    setTipOpen(false)
    setCommentText('')
    if (!isPublication) return
    setBusy('load')
    publicDetail(publicId)
      .then((row) => {
        if (cancelled) return
        setDetail(row)
        setDeep(row.experience.granted ? row.experience.content ?? null : null)
      })
      .catch((error) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : copy.errorLoad)
      })
      .finally(() => {
        if (!cancelled) setBusy('')
      })
    getExperienceInfo(publicId)
      .then((info) => {
        if (!cancelled) setExperience(info)
      })
      .catch(() => {
        if (!cancelled) setExperience({ enabled: false, fruit: null, has_content: false, granted: false })
      })
    listComments(publicId)
      .then((rows) => {
        if (!cancelled) setComments(rows as CommentRow[])
      })
      .catch(() => undefined)
    clickPublicWork(publicId)
      .then((result) => {
        if (cancelled) return
        setDetail((prev) => (prev ? { ...prev, click_count: result.click_count } : prev))
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [isPublication, publicId, copy.errorLoad])

  const typeLabel = isPublication
    ? copy.works
    : target.kind === 'story'
      ? copy.story
      : target.kind === 'world'
        ? copy.worlds
        : target.kind === 'character'
          ? copy.characters
          : copy.storylines

  const title = isPublication
    ? target.work.title
    : target.kind === 'story'
      ? target.work.title
      : target.title

  const author = isPublication
    ? target.work.author_display
    : user?.display_name || (lang === 'zh' ? '本地创作者' : 'Local creator')

  const canTipTarget = isPublication && !!detail?.author_user_id

  const runExperience = async () => {
    if (!detail) return
    setBusy('experience')
    setNotice({ text: '', tone: 'info' })
    try {
      const result = await grantExperience(detail.public_id, idempotencyKey)
      const next: PublicationExperience = {
        enabled: true,
        fruit: detail.experience.fruit,
        has_content: true,
        granted: true,
      }
      setExperience(next)
      setDeep(result.experience ?? null)
      setNotice({
        text: `${copy.unlocked}${result.fruit_amount > 0 ? ` · ${copy.cost} ${result.fruit_amount} ${copy.fruit}` : ''}`,
        tone: 'ok',
      })
    } catch (error) {
      setNotice({
        text: error instanceof Error ? error.message : copy.errorExperience,
        tone: 'error',
      })
    } finally {
      setBusy('')
    }
  }

  const toggleLike = async () => {
    if (!detail || busy) return
    setBusy('like')
    try {
      const liked = detail.liked_by_me
      const result = liked ? await unlikePublicWork(detail.public_id) : await likePublicWork(detail.public_id)
      setDetail((current) =>
        current
          ? {
              ...current,
              liked_by_me: result.liked,
              like_count: Math.max(0, current.like_count + (result.liked ? 1 : -1)),
            }
          : current,
      )
      setNotice({ text: result.liked ? copy.liked : copy.like, tone: result.liked ? 'ok' : 'info' })
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : copy.errorLike, tone: 'error' })
    } finally {
      setBusy('')
    }
  }

  const toggleFavorite = async () => {
    if (!detail || busy) return
    setBusy('favorite')
    try {
      const result = await favoriteWork(detail.public_id)
      setDetail((current) =>
        current
          ? {
              ...current,
              favorited_by_me: result.favorited,
              favorite_count: Math.max(0, current.favorite_count + (result.favorited ? 1 : -1)),
            }
          : current,
      )
      setNotice({ text: result.favorited ? copy.favorited : copy.favorite, tone: result.favorited ? 'ok' : 'info' })
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : copy.errorLike, tone: 'error' })
    } finally {
      setBusy('')
    }
  }

  const share = async () => {
    const url = `${window.location.origin}${window.location.pathname}?page=community`
    const ok = await copyText(url)
    setShareState(ok ? 'copied' : 'idle')
  }

  const submitComment = async () => {
    if (!detail || !commentText.trim() || busy) return
    setBusy('comment')
    try {
      const row = await commentOnWork(detail.public_id, commentText.trim())
      setComments((current) => [...current, { id: row.id, body: row.body, created_at: undefined }])
      setCommentText('')
      setNotice({ text: copy.comment, tone: 'ok' })
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : copy.errorComment, tone: 'error' })
    } finally {
      setBusy('')
    }
  }

  const submitTip = async () => {
    if (!detail || !detail.author_user_id || busy) return
    const amount = Number(tipAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setNotice({ text: copy.errorTip, tone: 'error' })
      return
    }
    setBusy('tip')
    try {
      await giftSpiritFruit({
        to_user_id: detail.author_user_id,
        amount,
        kind: 'tip',
        note: `打赏《${detail.title}》`,
        ref_type: 'publication',
        ref_id: detail.public_id,
      })
      setTipOpen(false)
      setNotice({ text: copy.tip, tone: 'ok' })
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : copy.errorTip, tone: 'error' })
    } finally {
      setBusy('')
    }
  }

  const runQuad = async () => {
    setBusy('quad')
    setNotice({ text: '', tone: 'info' })
    try {
      const kind = isPublication ? 'work' : (target.kind === 'character' ? 'character' : target.kind === 'world' ? 'world' : 'storyline')
      const targetId = isPublication ? target.work.public_id : target.kind === 'story' ? target.work.id : target.id
      await quadCheer(kind, targetId)
      setNotice({ text: copy.quadDone, tone: 'ok' })
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : copy.errorTip, tone: 'error' })
    } finally {
      setBusy('')
    }
  }

  const publicItems = detail ? snapshotItems(detail.content.snapshot) : []
  const exp = detail?.experience || experience
  const deepItems = deep ? snapshotItems(deep) : []
  const fruitAmount = exp?.fruit && exp.fruit > 0 ? exp.fruit : 0
  const canExperience = Boolean(exp?.enabled && exp.fruit && exp.fruit > 0 && !exp.granted)
  const chargeHint = !exp?.enabled
    ? copy.freeAll
    : fruitAmount <= 0
      ? copy.pricePending
      : publicItems.length > 0
        ? `${copy.freeChapters(publicItems.length)} · ${copy.afterFree}`
        : copy.afterFree

  return (
    <div className="cwd-backdrop" onClick={onClose}>
      <article className="cwd-panel" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <header className="cwd-head">
          <div className="cwd-heading">
            <span className="cwd-badge">{typeLabel}</span>
            <h2 className="cwd-title">{title}</h2>
            <div className="cwd-meta">
              <span><UserRound size={13} aria-hidden="true" />{copy.by} · {author}</span>
              {isPublication && detail?.published_at ? (
                <span><CalendarDays size={13} aria-hidden="true" />{formatDate(detail.published_at, lang)}</span>
              ) : null}
              {isPublication && detail ? (
                <span><BookOpen size={13} aria-hidden="true" />{copy.reads} {detail.view_count}</span>
              ) : null}
              {isPublication && detail ? (
                <span><ArrowUpRight size={13} aria-hidden="true" />{copy.clicks} {detail.click_count}</span>
              ) : null}
              {target.kind === 'story' ? (
                <span>{target.work.status === 'published' ? copy.published : copy.draft}</span>
              ) : null}
            </div>
          </div>
          <button type="button" className="cwd-close" onClick={onClose} aria-label={lang === 'zh' ? '关闭' : 'Close'}>
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        <div className="cwd-body">
          {loadError ? <div className="cwd-notice is-error">{loadError}</div> : null}

          {/* 简介 */}
          <section className="cwd-block">
            <div className="cwd-block-head"><span className="cwd-block-title">{copy.intro}</span></div>
            {isPublication ? (
              detail?.summary?.trim() ? (
                <p className="cwd-prose">{detail.summary}</p>
              ) : publicItems[0]?.content ? (
                <p className="cwd-prose">{publicItems[0].content}</p>
              ) : (
                <div className="cwd-empty">{copy.noPublicContent}</div>
              )
            ) : target.kind === 'story' ? (
              target.work.plain_text?.trim() ? (
                <p className="cwd-prose">{target.work.plain_text}</p>
              ) : (
                <div className="cwd-empty">{copy.noPublicContent}</div>
              )
            ) : (
              <p className="cwd-prose">{target.summary || copy.noPublicContent}</p>
            )}
          </section>

          {/* 目录 */}
          {isPublication && (publicItems.length > 0 || deepItems.length > 0) ? (
            <section className="cwd-block">
              <div className="cwd-block-head">
                <span className="cwd-block-title">{copy.toc}</span>
                <span className="cwd-cost">{publicItems.length > 0 ? copy.freeChapters(publicItems.length) : copy.afterFree}</span>
              </div>
              <ul className="cwd-toc">
                {publicItems.map((item, index) => (
                  <li key={`free-${index}`} className="cwd-toc-item is-free">
                    <span className="cwd-toc-title">{item.title || `${index + 1}`}</span>
                    <span className="cwd-toc-tag">{copy.free}</span>
                  </li>
                ))}
                {deepItems.map((item, index) => (
                  <li key={`deep-${index}`} className={`cwd-toc-item ${exp?.granted ? 'is-unlocked' : 'is-locked'}`}>
                    <span className="cwd-toc-title">{item.title || `${publicItems.length + index + 1}`}</span>
                    <span className="cwd-toc-tag">{exp?.granted ? copy.unlockedShort : copy.locked}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* 灵果消耗 */}
          {isPublication ? (
            <section className="cwd-block">
              <div className="cwd-charge">
                <span className={`cwd-charge-value${fruitAmount === 0 ? ' is-free' : ''}`}>{copy.cost} {fruitAmount} {copy.fruit}</span>
                <span className="cwd-charge-hint">{chargeHint}</span>
              </div>
              {canExperience ? (
                <div className="cwd-actions">
                  <button type="button" className="cwd-btn is-primary" disabled={busy === 'experience'} onClick={() => void runExperience()}>
                    <Sparkles size={14} aria-hidden="true" />
                    {busy === 'experience' ? copy.confirming : `${copy.confirm}（${fruitAmount} ${copy.fruit}）`}
                  </button>
                </div>
              ) : null}
              {exp?.granted ? (
                <>
                  <div className="cwd-unlocked"><Check size={14} aria-hidden="true" />{copy.unlocked}</div>
                  {deepItems.length > 0 ? renderItems(deepItems) : <div className="cwd-empty">{copy.deepEmpty}</div>}
                </>
              ) : null}
            </section>
          ) : null}

          {notice.text ? (
            <p className={`cwd-notice ${notice.tone === 'ok' ? 'is-ok' : notice.tone === 'error' ? 'is-error' : ''}`}>{notice.text}</p>
          ) : null}

          {/* 互动 */}
          {isPublication && detail ? (
            <section className="cwd-interactions">
              <button type="button" className={`cwd-btn ${detail.liked_by_me ? 'is-active' : ''}`} disabled={busy === 'like'} onClick={() => void toggleLike()}>
                <Heart size={14} aria-hidden="true" />{copy.like} {detail.like_count}
              </button>
              <button type="button" className={`cwd-btn ${detail.favorited_by_me ? 'is-active' : ''}`} disabled={busy === 'favorite'} onClick={() => void toggleFavorite()}>
                <BookOpen size={14} aria-hidden="true" />{copy.favorite} {detail.favorite_count}
              </button>
              <button type="button" className="cwd-btn" onClick={() => void share()}>
                <Share2 size={14} aria-hidden="true" />{shareState === 'copied' ? copy.shared : copy.share}
              </button>
              <button type="button" className="cwd-btn cwd-btn--quad" disabled={busy === 'quad'} onClick={() => void runQuad()}>
                <Send size={14} aria-hidden="true" />{copy.quad}
              </button>
              {canTipTarget ? (
                tipOpen ? (
                  <span className="cwd-actions">
                    <input
                      className="cwd-input"
                      type="number"
                      min="1"
                      value={tipAmount}
                      onChange={(event) => setTipAmount(event.target.value)}
                      aria-label={copy.tipAmount}
                    />
                    <button type="button" className="cwd-btn is-primary" disabled={busy === 'tip'} onClick={() => void submitTip()}>
                      <Send size={13} aria-hidden="true" />{busy === 'tip' ? copy.tipSending : copy.tipConfirm}
                    </button>
                    <button type="button" className="cwd-btn" onClick={() => setTipOpen(false)}>{lang === 'zh' ? '取消' : 'Cancel'}</button>
                  </span>
                ) : (
                  <button type="button" className="cwd-btn" onClick={() => setTipOpen(true)}>
                    <Send size={14} aria-hidden="true" />{copy.quadTipExtra}
                  </button>
                )
              ) : null}
            </section>
          ) : null}

          {/* 评论 */}
          {isPublication && detail ? (
            <section className="cwd-comments">
              <div className="cwd-mode-head">
                <span className="cwd-mode-title"><MessageSquare size={15} aria-hidden="true" />{copy.comment} {detail.comment_count}</span>
              </div>
              {comments.length === 0 ? <div className="cwd-empty">{copy.commentEmpty}</div> : null}
              {comments.map((row) => (
                <div className="cwd-comment" key={row.id}>
                  <span className="cwd-comment-meta">{user?.display_name || copy.author} · {formatDate(row.created_at || null, lang)}</span>
                  {row.body}
                </div>
              ))}
              <div className="cwd-comment-input">
                <input
                  value={commentText}
                  onChange={(event) => setCommentText(event.target.value)}
                  placeholder={copy.commentPlaceholder}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void submitComment()
                  }}
                />
                <button type="button" className="cwd-btn is-primary" disabled={busy === 'comment' || !commentText.trim()} onClick={() => void submitComment()}>
                  {copy.commentSend}
                </button>
              </div>
            </section>
          ) : null}

          {/* OC 的 AI 互动：由作品集承载，不再单开 AI 互动中心 */}
          {target.kind === 'character' && (onOpenChat || onOpenRelationships || onOpenEvents || onOpenMemories || onOpenSimulation) ? (
            <section className="cwd-block">
              <div className="cwd-block-head"><span className="cwd-block-title">{copy.aiTitle}</span></div>
              <div className="cwd-actions">
                {onOpenChat ? (
                  <button type="button" className="cwd-btn is-primary" onClick={() => onOpenChat(target.worldId, target.characterId)}>
                    <MessageCircle size={14} aria-hidden="true" />{copy.aiChat}
                  </button>
                ) : null}
                {onOpenRelationships ? (
                  <button type="button" className="cwd-btn" onClick={onOpenRelationships}>{copy.aiRelations}</button>
                ) : null}
                {onOpenEvents ? (
                  <button type="button" className="cwd-btn" onClick={onOpenEvents}>{copy.aiEvents}</button>
                ) : null}
                {onOpenMemories ? (
                  <button type="button" className="cwd-btn" onClick={onOpenMemories}>{copy.aiMemories}</button>
                ) : null}
                {onOpenSimulation ? (
                  <button type="button" className="cwd-btn" onClick={onOpenSimulation}>{copy.aiSimulation}</button>
                ) : null}
              </div>
            </section>
          ) : null}

          {/* 世界 / OC / 剧情入口 */}
          {!isPublication && target.kind !== 'story' ? (
            <section className="cwd-actions">
              {target.kind === 'world' ? (
                <button type="button" className="cwd-btn is-primary" onClick={onOpenWorld}>
                  {copy.openWorld} <ArrowUpRight size={13} aria-hidden="true" />
                </button>
              ) : null}
              {target.kind === 'character' ? (
                <button type="button" className="cwd-btn is-primary" onClick={onOpenCharacters}>
                  {copy.openCharacters} <ArrowUpRight size={13} aria-hidden="true" />
                </button>
              ) : null}
              {target.kind === 'storyline' ? (
                <button type="button" className="cwd-btn is-primary" onClick={onOpenStorylines}>
                  {copy.openStorylines} <ArrowUpRight size={13} aria-hidden="true" />
                </button>
              ) : null}
              <button type="button" className="cwd-btn cwd-btn--quad" disabled={busy === 'quad'} onClick={() => void runQuad()}>
                <Send size={14} aria-hidden="true" />{copy.quad}
              </button>
            </section>
          ) : null}

          {target.kind === 'story' ? (
            <section className="cwd-actions">
              <button type="button" className="cwd-btn cwd-btn--quad" disabled={busy === 'quad'} onClick={() => void runQuad()}>
                <Send size={14} aria-hidden="true" />{copy.quad}
              </button>
              <button type="button" className="cwd-btn" onClick={() => void share()}>
                <Share2 size={14} aria-hidden="true" />{shareState === 'copied' ? copy.shared : copy.share}
              </button>
              <button type="button" className="cwd-btn is-primary" onClick={onOpenWorkbench}>
                {copy.openWorkbench} <ArrowUpRight size={13} aria-hidden="true" />
              </button>
            </section>
          ) : null}
        </div>

        <footer className="cwd-foot">
          <button type="button" className="cwd-btn" onClick={onClose}>{lang === 'zh' ? '关闭' : 'Close'}</button>
        </footer>
      </article>
    </div>
  )
}
