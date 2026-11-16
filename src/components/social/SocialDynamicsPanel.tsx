import { useEffect, useRef, useState } from 'react'
import {
  Flag, Heart, ImagePlus, Loader2, MessageCircle, Send, Sparkles, Trash2, X,
} from 'lucide-react'
import {
  createSocialComment, createSocialPost, deleteSocialComment, deleteSocialPost,
  likeSocialPost, listSocialComments, listSocialPosts,
  type SocialComment, type SocialPost,
} from '../../api/socialCore'
import { uploadMedia, resolveMediaUrl } from '../../api/media'
import { reportContent, type ReportReason } from '../../api/moderation'
import '../../styles/social-core.css'

type Lang = 'zh' | 'en'

function fmt(value: string | null, lang: Lang): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function channelLabel(channel: string, lang: Lang): string {
  if (channel === 'content') return lang === 'zh' ? '内容社区' : 'Content'
  return lang === 'zh' ? '社交社区' : 'Social'
}

export default function SocialDynamicsPanel({
  lang, currentUserId, onOpenProfile, onOpenMessages,
}: {
  lang: Lang
  currentUserId?: string
  onOpenProfile: (userId: string) => void
  onOpenMessages: (userId: string) => void
}) {
  const [posts, setPosts] = useState<SocialPost[]>([])
  const [channel, setChannel] = useState<'all' | 'content' | 'social'>('all')
  const [scope, setScope] = useState<'discover' | 'following' | 'mine'>('discover')
  const [body, setBody] = useState('')
  const [channels, setChannels] = useState<('content' | 'social')[]>(['content', 'social'])
  const [visibility, setVisibility] = useState<'public' | 'friends' | 'private'>('public')
  const [media, setMedia] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [commentsFor, setCommentsFor] = useState('')
  const [comments, setComments] = useState<Record<string, SocialComment[]>>({})
  const [commentBody, setCommentBody] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    setBusy('load')
    try { setPosts(await listSocialPosts(channel, scope)); setError('') }
    catch (reason) { setError(reason instanceof Error ? reason.message : '动态加载失败') }
    finally { setBusy('') }
  }
  useEffect(() => { void load() /* eslint-disable-line react-hooks/exhaustive-deps */ }, [channel, scope])

  const toggleChannel = (value: 'content' | 'social') => {
    setChannels((current) => current.includes(value)
      ? (current.length === 1 ? current : current.filter((item) => item !== value))
      : [...current, value])
  }

  const publish = async () => {
    if (!body.trim() && media.length === 0) { setError(lang === 'zh' ? '写点什么或添加图片' : 'Add text or an image'); return }
    setBusy('publish'); setError('')
    try {
      await createSocialPost({ body: body.trim(), media_urls: media, channels, visibility })
      setBody(''); setMedia([]); setVisibility('public'); setChannels(['content', 'social']); await load()
    } catch (reason) { setError(reason instanceof Error ? reason.message : '发布失败') }
    finally { setBusy('') }
  }

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true); setError('')
    try {
      const urls: string[] = []
      for (const file of Array.from(files).slice(0, 9 - media.length)) {
        if (!file.type.startsWith('image/')) continue
        const uploaded = await uploadMedia(file)
        urls.push(uploaded.file_url)
      }
      setMedia((current) => [...current, ...urls].slice(0, 9))
    } catch (reason) { setError(reason instanceof Error ? reason.message : '图片上传失败') }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = '' }
  }

  const toggleLike = async (post: SocialPost) => {
    setPosts((current) => current.map((item) => item.id === post.id
      ? { ...item, liked_by_me: !item.liked_by_me, like_count: item.like_count + (item.liked_by_me ? -1 : 1) }
      : item))
    try { const updated = await likeSocialPost(post.id, !post.liked_by_me); setPosts((current) => current.map((item) => item.id === post.id ? updated : item)) }
    catch (reason) { setError(reason instanceof Error ? reason.message : '点赞失败'); void load() }
  }

  const openComments = async (postId: string) => {
    if (commentsFor === postId) { setCommentsFor(''); return }
    setCommentsFor(postId)
    try { const rows = await listSocialComments(postId); setComments((current) => ({ ...current, [postId]: rows })) }
    catch (reason) { setError(reason instanceof Error ? reason.message : '评论加载失败') }
  }

  const addComment = async (postId: string) => {
    if (!commentBody.trim()) return
    setBusy(`comment:${postId}`)
    try {
      await createSocialComment(postId, commentBody.trim())
      setCommentBody('')
      const rows = await listSocialComments(postId)
      setComments((current) => ({ ...current, [postId]: rows }))
      setPosts((current) => current.map((item) => item.id === postId ? { ...item, comment_count: item.comment_count + 1 } : item))
    } catch (reason) { setError(reason instanceof Error ? reason.message : '评论失败') }
    finally { setBusy('') }
  }

  const reportPost = async (post: SocialPost) => {
    const labels: Record<ReportReason, string> = {
      spam: lang === 'zh' ? '垃圾广告' : 'Spam',
      harassment: lang === 'zh' ? '骚扰辱骂' : 'Harassment',
      illegal: lang === 'zh' ? '违法内容' : 'Illegal',
      adult: lang === 'zh' ? '成人内容' : 'Adult',
      misinformation: lang === 'zh' ? '虚假信息' : 'Misinformation',
      other: lang === 'zh' ? '其他' : 'Other',
    }
    const answer = window.prompt(
      lang === 'zh'
        ? '举报原因：spam / harassment / illegal / adult / misinformation / other'
        : 'Report reason: spam / harassment / illegal / adult / misinformation / other',
      'other',
    )
    if (answer === null) return
    const reason = (Object.keys(labels) as ReportReason[]).includes(answer.trim() as ReportReason)
      ? answer.trim() as ReportReason
      : 'other'
    const detail = window.prompt(lang === 'zh' ? '补充说明（可选）' : 'Additional detail (optional)', '') || ''
    setBusy(`report:${post.id}`)
    try {
      const result = await reportContent({ target_type: 'post', target_id: post.id, reason, detail })
      setError(result.duplicate
        ? (lang === 'zh' ? '你已举报过这条动态，管理员会尽快处理' : 'You already reported this post')
        : (lang === 'zh' ? `已提交举报：${labels[reason]}` : `Report submitted: ${labels[reason]}`))
    } catch (err) {
      setError(err instanceof Error ? err.message : (lang === 'zh' ? '举报失败' : 'Report failed'))
    } finally { setBusy('') }
  }

  const reportComment = async (comment: SocialComment) => {
    const answer = window.prompt(
      lang === 'zh'
        ? '举报评论原因：spam / harassment / illegal / adult / misinformation / other'
        : 'Report comment: spam / harassment / illegal / adult / misinformation / other',
      'other',
    )
    if (answer === null) return
    const reason = (['spam', 'harassment', 'illegal', 'adult', 'misinformation', 'other'] as ReportReason[]).includes(answer.trim() as ReportReason)
      ? answer.trim() as ReportReason
      : 'other'
    try {
      await reportContent({ target_type: 'comment', target_id: comment.id, reason })
      setError(lang === 'zh' ? '评论举报已提交' : 'Comment report submitted')
    } catch (err) {
      setError(err instanceof Error ? err.message : (lang === 'zh' ? '举报失败' : 'Report failed'))
    }
  }

  const removePost = async (post: SocialPost) => {
    if (!window.confirm(lang === 'zh' ? '删除这条动态？' : 'Delete this post?')) return
    setBusy(`delete:${post.id}`)
    try { await deleteSocialPost(post.id); setPosts((current) => current.filter((item) => item.id !== post.id)) }
    catch (reason) { setError(reason instanceof Error ? reason.message : '删除失败') }
    finally { setBusy('') }
  }

  return (
    <section className="sc-dynamics">
      <div className="sc-composer">
        <div className="sc-composer-head"><span className="sc-kicker">NEW POST</span><h2>{lang === 'zh' ? '分享此刻' : 'Share a moment'}</h2></div>
        <textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={2000} placeholder={lang === 'zh' ? '写一条动态，或把作品、角色、世界带进社区…' : 'Write a post, or bring a work, character or world into the community…'} />
        {media.length > 0 && (
          <div className="sc-composer-media">
            {media.map((url) => <span key={url}><img src={resolveMediaUrl(url)} alt="" /><button type="button" aria-label="移除图片" onClick={() => setMedia((current) => current.filter((item) => item !== url))}><X size={12} /></button></span>)}
          </div>
        )}
        <div className="sc-composer-options">
          <div className="sc-chip-group" aria-label={lang === 'zh' ? '投放位置' : 'Channels'}>
            {(['content', 'social'] as const).map((item) => (
              <button key={item} type="button" className={`sc-chip${channels.includes(item) ? ' is-on' : ''}`} onClick={() => toggleChannel(item)}>{channelLabel(item, lang)}</button>
            ))}
          </div>
          <select value={visibility} onChange={(event) => setVisibility(event.target.value as typeof visibility)} aria-label={lang === 'zh' ? '可见范围' : 'Visibility'}>
            <option value="public">{lang === 'zh' ? '公开' : 'Public'}</option>
            <option value="friends">{lang === 'zh' ? '仅好友' : 'Friends'}</option>
            <option value="private">{lang === 'zh' ? '仅自己' : 'Only me'}</option>
          </select>
        </div>
        <div className="sc-composer-foot">
          <button type="button" className="sc-btn" disabled={uploading || media.length >= 9} onClick={() => fileRef.current?.click()}><ImagePlus size={15} />{uploading ? (lang === 'zh' ? '上传中…' : 'Uploading…') : (lang === 'zh' ? '图片' : 'Image')}</button>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(event) => void addFiles(event.target.files)} />
          <span className="sc-composer-count">{body.length}/2000</span>
          <button type="button" className="sc-btn is-primary" disabled={busy === 'publish'} onClick={() => void publish()}>{busy === 'publish' ? <Loader2 className="spin" size={14} /> : <Send size={14} />}{lang === 'zh' ? '发布' : 'Publish'}</button>
        </div>
      </div>

      {error && <div className="sc-note is-error">{error}<button type="button" onClick={() => setError('')}><X size={13} /></button></div>}

      <div className="sc-feed-head">
        <div className="sc-segment">
          {(['all', 'content', 'social'] as const).map((item) => <button key={item} type="button" className={channel === item ? 'is-on' : ''} onClick={() => setChannel(item)}>{item === 'all' ? (lang === 'zh' ? '全部' : 'All') : channelLabel(item, lang)}</button>)}
        </div>
        <div className="sc-segment">
          {(['discover', 'following', 'mine'] as const).map((item) => <button key={item} type="button" className={scope === item ? 'is-on' : ''} onClick={() => setScope(item)}>{item === 'discover' ? (lang === 'zh' ? '发现' : 'Discover') : item === 'following' ? (lang === 'zh' ? '关注' : 'Following') : (lang === 'zh' ? '我的' : 'Mine')}</button>)}
        </div>
      </div>

      {busy === 'load' && posts.length === 0 ? <div className="sc-empty"><Loader2 className="spin" size={18} /> {lang === 'zh' ? '加载动态…' : 'Loading…'}</div> : null}
      {posts.length === 0 && busy !== 'load' ? <div className="sc-empty"><Sparkles size={20} /><strong>{lang === 'zh' ? '这里还没有动态' : 'No posts yet'}</strong><span>{lang === 'zh' ? '发布第一条，或切换发现范围。' : 'Publish the first one or switch scope.'}</span></div> : null}
      {posts.map((post) => (
        <article className="sc-post" key={post.id}>
          <header className="sc-post-head">
            <button type="button" className="sc-author" onClick={() => post.author && onOpenProfile(post.author.id)}>
              <span className={`sc-avatar${post.author?.avatar ? ' has-image' : ''}`}>{post.author?.avatar ? <img src={resolveMediaUrl(post.author.avatar)} alt="" /> : (post.author?.display_name || '?').slice(0, 1)}</span>
              <span><strong>{post.author?.display_name || post.author?.username}</strong><small>@{post.author?.username} · {fmt(post.created_at, lang)}</small></span>
            </button>
            <div className="sc-post-badges">
              {post.channels.map((item) => <span key={item}>{channelLabel(item, lang)}</span>)}
              <span>{post.visibility === 'public' ? (lang === 'zh' ? '公开' : 'Public') : post.visibility === 'friends' ? (lang === 'zh' ? '好友' : 'Friends') : (lang === 'zh' ? '自己' : 'Private')}</span>
              {post.is_mine && <button type="button" className="sc-icon-btn" disabled={busy === `delete:${post.id}`} onClick={() => void removePost(post)} aria-label={lang === 'zh' ? '删除动态' : 'Delete post'}><Trash2 size={13} /></button>}
            </div>
          </header>
          {post.body && <p className="sc-post-body">{post.body}</p>}
          {post.media_urls.length > 0 && <div className={`sc-post-media size-${Math.min(post.media_urls.length, 4)}`}>{post.media_urls.map((url) => <img key={url} src={resolveMediaUrl(url)} alt="" loading="lazy" />)}</div>}
          <footer className="sc-post-actions">
            <button type="button" className={post.liked_by_me ? 'is-liked' : ''} onClick={() => void toggleLike(post)}><Heart size={15} fill={post.liked_by_me ? 'currentColor' : 'none'} />{post.like_count || (lang === 'zh' ? '点赞' : 'Like')}</button>
            <button type="button" onClick={() => void openComments(post.id)}><MessageCircle size={15} />{post.comment_count || (lang === 'zh' ? '评论' : 'Comment')}</button>
            {post.is_mine && <button type="button" onClick={() => post.author && onOpenProfile(post.author.id)}><Send size={14} />{lang === 'zh' ? '主页' : 'Profile'}</button>}
            {!post.is_mine && <button type="button" disabled={busy === `report:${post.id}`} onClick={() => void reportPost(post)} aria-label={lang === 'zh' ? '举报动态' : 'Report post'}><Flag size={14} />{lang === 'zh' ? '举报' : 'Report'}</button>}
          </footer>
          {commentsFor === post.id && (
            <div className="sc-comments">
              {(comments[post.id] || []).map((comment) => (
                <div className="sc-comment" key={comment.id}>
                  <span className={`sc-avatar sc-avatar-sm${comment.author?.avatar ? ' has-image' : ''}`}>{comment.author?.avatar ? <img src={resolveMediaUrl(comment.author.avatar)} alt="" /> : (comment.author?.display_name || '?').slice(0, 1)}</span>
                  <div><strong>{comment.author?.display_name || comment.author?.username}</strong><p>{comment.body}</p></div>
                  {comment.author?.id === currentUserId ? (
                    <button type="button" className="sc-icon-btn" onClick={() => void deleteSocialComment(comment.id).then(() => listSocialComments(post.id)).then((rows) => setComments((current) => ({ ...current, [post.id]: rows }))).catch(() => undefined)} aria-label="删除评论"><Trash2 size={12} /></button>
                  ) : (
                    <button type="button" className="sc-icon-btn" onClick={() => void reportComment(comment)} aria-label={lang === 'zh' ? '举报评论' : 'Report comment'}><Flag size={12} /></button>
                  )}
                </div>
              ))}
              <div className="sc-comment-input">
                <input value={commentBody} onChange={(event) => setCommentBody(event.target.value)} placeholder={lang === 'zh' ? '写下评论…' : 'Write a comment…'} onKeyDown={(event) => { if (event.key === 'Enter') void addComment(post.id) }} />
                <button type="button" className="sc-btn is-primary" disabled={busy === `comment:${post.id}`} onClick={() => void addComment(post.id)}>{lang === 'zh' ? '发送' : 'Send'}</button>
              </div>
            </div>
          )}
        </article>
      ))}
    </section>
  )
}
