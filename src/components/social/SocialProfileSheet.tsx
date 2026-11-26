import { useEffect, useState } from 'react'
import {
  ArrowUpRight, Ban, Check, Heart, Loader2, MessageCircle, ShieldCheck, UserMinus, UserPlus, X,
} from 'lucide-react'
import {
  acceptFriendRequest,
  cancelFriendRequest,
  deleteFriend,
  followUser,
  sendFriendRequest,
  unfollowUser,
} from '../../api/communitySocial'
import {
  blockSocialUser, getSocialProfile, unblockSocialUser, type SocialProfile,
} from '../../api/socialCore'
import { resolveMediaUrl } from '../../api/media'
import '../../styles/social-core.css'

type Lang = 'zh' | 'en'

function fmt(value: string | null | undefined, lang: Lang): string {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { month: '2-digit', day: '2-digit' })
}

export default function SocialProfileSheet({
  userId, lang, onClose, onMessage,
}: {
  userId: string
  lang: Lang
  onClose: () => void
  onMessage: (userId: string) => void
}) {
  const [profile, setProfile] = useState<SocialProfile | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')

  const load = async () => {
    setBusy('load')
    try { setProfile(await getSocialProfile(userId)); setError('') }
    catch (reason) { setError(reason instanceof Error ? reason.message : '主页加载失败') }
    finally { setBusy('') }
  }
  useEffect(() => { void load() /* eslint-disable-line react-hooks/exhaustive-deps */ }, [userId])

  const act = async (key: string, action: () => Promise<unknown>) => {
    setBusy(key); setError('')
    try { await action(); await load() }
    catch (reason) { setError(reason instanceof Error ? reason.message : '操作失败') }
    finally { setBusy('') }
  }

  const user = profile?.user
  return (
    <div className="sc-sheet-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <aside className="sc-sheet" role="dialog" aria-modal="true" aria-label={lang === 'zh' ? '个人主页' : 'Profile'}>
        <button type="button" className="sc-sheet-close" onClick={onClose} aria-label={lang === 'zh' ? '关闭' : 'Close'}><X size={17} /></button>
        {busy === 'load' && !profile ? <div className="sc-sheet-loading"><Loader2 className="spin" size={20} /> {lang === 'zh' ? '加载主页…' : 'Loading…'}</div> : null}
        {error && <div className="sc-note is-error">{error}</div>}
        {profile && user && (
          <>
            <header className="sc-profile-head">
              <span className={`sc-avatar sc-avatar-lg${user.avatar ? ' has-image' : ''}`}>
                {user.avatar ? <img src={resolveMediaUrl(user.avatar)} alt="" /> : (user.display_name || user.username).slice(0, 1)}
              </span>
              <div>
                <h2>{user.display_name || user.username}</h2>
                <span>@{user.username}{user.is_owner ? (lang === 'zh' ? ' · 开发者' : ' · Owner') : ''}</span>
                {user.bio && <p>{user.bio}</p>}
              </div>
            </header>

            <div className="sc-profile-stats">
              <span><strong>{profile.stats.posts}</strong>{lang === 'zh' ? '动态' : 'Posts'}</span>
              <span><strong>{profile.stats.works}</strong>{lang === 'zh' ? '作品' : 'Works'}</span>
              <span><strong>{profile.following ? (lang === 'zh' ? '已关注' : 'Following') : '—'}</strong>{lang === 'zh' ? '关系' : 'Relation'}</span>
            </div>

            <section className="sc-levels" aria-label={lang === 'zh' ? '创作与粉丝等级' : 'Creator & follower levels'}>
              <div className="sc-level-card">
                <div className="sc-level-head">
                  <span>{lang === 'zh' ? '创作等级' : 'Creator level'}</span>
                  <strong>Lv.{profile.stats.creator_level.level} · {profile.stats.creator_level.label}</strong>
                </div>
                <div className="sc-level-bar">
                  <span style={{ width: `${Math.min(100, Math.round(profile.stats.creator_level.progress * 100))}%` }} />
                </div>
                <span className="sc-level-meta">
                  {profile.stats.creator_level.next_threshold
                    ? (lang === 'zh' ? `${profile.stats.creator_level.score} → ${profile.stats.creator_level.next_threshold} 解锁下一级` : `${profile.stats.creator_level.score} → ${profile.stats.creator_level.next_threshold} for next level`)
                    : (lang === 'zh' ? '已达最高等级' : 'Max level reached')}
                </span>
              </div>
              <div className="sc-level-card">
                <div className="sc-level-head">
                  <span>{lang === 'zh' ? '粉丝等级' : 'Follower level'}</span>
                  <strong>Lv.{profile.stats.follower_level.level} · {profile.stats.follower_level.label}</strong>
                </div>
                <div className="sc-level-bar">
                  <span style={{ width: `${Math.min(100, Math.round(profile.stats.follower_level.progress * 100))}%` }} />
                </div>
                <span className="sc-level-meta">
                  {profile.stats.follower_level.next_threshold
                    ? (lang === 'zh' ? `${profile.stats.follower_level.score} → ${profile.stats.follower_level.next_threshold} 解锁下一级` : `${profile.stats.follower_level.score} → ${profile.stats.follower_level.next_threshold} for next level`)
                    : (lang === 'zh' ? '已达最高等级' : 'Max level reached')}
                </span>
              </div>
            </section>

            {!profile.stats.stats_hidden ? (
              <section className="sc-profile-block sc-profile-analysis">
                <div className="sc-profile-block-head"><h3>{lang === 'zh' ? '用户画像分析' : 'Profile analytics'}</h3></div>
                <div className="sc-analytics-grid">
                <div><strong>{profile.stats.works}</strong><span>{lang === 'zh' ? '已发布作品' : 'Published'}</span></div>
                <div><strong>{profile.stats.drafts}</strong><span>{lang === 'zh' ? '草稿' : 'Drafts'}</span></div>
                <div><strong>{profile.stats.total_reads}</strong><span>{lang === 'zh' ? '总阅读量' : 'Total reads'}</span></div>
                <div><strong>{profile.stats.total_clicks}</strong><span>{lang === 'zh' ? '总点击量' : 'Total clicks'}</span></div>
                <div><strong>{profile.stats.total_likes}</strong><span>{lang === 'zh' ? '点赞' : 'Likes'}</span></div>
                <div><strong>{profile.stats.total_favorites}</strong><span>{lang === 'zh' ? '收藏' : 'Favorites'}</span></div>
                <div><strong>{profile.stats.total_comments}</strong><span>{lang === 'zh' ? '评论' : 'Comments'}</span></div>
                <div><strong>{profile.stats.followers}</strong><span>{lang === 'zh' ? '粉丝' : 'Followers'}</span></div>
                <div><strong>{profile.stats.following}</strong><span>{lang === 'zh' ? '关注' : 'Following'}</span></div>
              </div>
              </section>
            ) : (
              <div className="sc-note">{lang === 'zh' ? '该用户的画像统计未公开。' : 'This user has not shared profile analytics.'}</div>
            )}

            {profile.friend_status !== 'self' && (
              <div className="sc-profile-actions">
                {profile.blocked_by_me ? (
                  <button type="button" className="sc-btn" disabled={!!busy} onClick={() => void act('block', () => unblockSocialUser(user.id))}><Ban size={14} />{lang === 'zh' ? '解除拉黑' : 'Unblock'}</button>
                ) : (
                  <>
                    {profile.friend_status === 'none' && profile.allow_friend_requests && (
                      <button type="button" className="sc-btn is-primary" disabled={!!busy} onClick={() => void act('friend', () => sendFriendRequest(user.id))}><UserPlus size={14} />{lang === 'zh' ? '加好友' : 'Add friend'}</button>
                    )}
                    {profile.friend_status === 'incoming' && profile.friend_request_id && (
                      <button type="button" className="sc-btn is-primary" disabled={!!busy} onClick={() => void act('friend', () => acceptFriendRequest(profile.friend_request_id!))}><Check size={14} />{lang === 'zh' ? '接受好友申请' : 'Accept request'}</button>
                    )}
                    {profile.friend_status === 'outgoing' && profile.friend_request_id && (
                      <button type="button" className="sc-btn" disabled={!!busy} onClick={() => void act('friend', () => cancelFriendRequest(profile.friend_request_id!))}><X size={14} />{lang === 'zh' ? '撤回申请' : 'Cancel request'}</button>
                    )}
                    {profile.friend_status === 'friends' && (
                      <>
                        <button type="button" className="sc-btn is-primary" disabled={!!busy} onClick={() => { onMessage(user.id); onClose() }}><MessageCircle size={14} />{lang === 'zh' ? '发私信' : 'Message'}</button>
                        <button type="button" className="sc-btn" disabled={!!busy} onClick={() => void act('friend', () => deleteFriend(user.id))}><UserMinus size={14} />{lang === 'zh' ? '删除好友' : 'Remove friend'}</button>
                      </>
                    )}
                    {profile.allow_follow && (
                      <button type="button" className={`sc-btn${profile.following ? ' is-active' : ''}`} disabled={!!busy} onClick={() => void act('follow', () => profile.following ? unfollowUser(user.id) : followUser(user.id))}><Heart size={14} />{profile.following ? (lang === 'zh' ? '已关注' : 'Following') : (lang === 'zh' ? '关注' : 'Follow')}</button>
                    )}
                    <button type="button" className="sc-btn is-danger" disabled={!!busy} onClick={() => void act('block', () => blockSocialUser(user.id))}><Ban size={14} />{lang === 'zh' ? '拉黑' : 'Block'}</button>
                  </>
                )}
              </div>
            )}

            {!profile.can_view ? (
              <div className="sc-locked"><ShieldCheck size={22} /><strong>{lang === 'zh' ? '主页仅好友可见' : 'Friends only'}</strong><span>{lang === 'zh' ? '添加好友后可以查看动态与作品。' : 'Add this creator as a friend to see posts.'}</span></div>
            ) : (
              <>
                {profile.posts.length > 0 && (
                  <section className="sc-profile-block">
                    <div className="sc-profile-block-head"><h3>{lang === 'zh' ? '最新动态' : 'Recent posts'}</h3><span>{profile.posts.length}</span></div>
                    {profile.posts.map((post) => (
                      <article className="sc-profile-post" key={post.id}>
                        <p>{post.body}</p>
                        {post.media_urls.length > 0 && <div className="sc-profile-media">{post.media_urls.slice(0, 3).map((url) => <img key={url} src={resolveMediaUrl(url)} alt="" />)}</div>}
                        <time>{fmt(post.created_at, lang)}</time>
                      </article>
                    ))}
                  </section>
                )}
                {profile.works.length > 0 && (
                  <section className="sc-profile-block">
                    <div className="sc-profile-block-head"><h3>{lang === 'zh' ? '公开作品' : 'Works'}</h3><span>{profile.works.length}</span></div>
                    <div className="sc-profile-works">
                      {profile.works.map((work) => (
                        <a key={work.id} href="?page=community" className="sc-work">
                          <span className="sc-work-cover">{work.cover_url ? <img src={resolveMediaUrl(work.cover_url)} alt="" /> : <ArrowUpRight size={18} />}</span>
                          <strong>{work.title}</strong>
                          <span>{work.category || work.scene}</span>
                        </a>
                      ))}
                    </div>
                  </section>
                )}
                {profile.posts.length === 0 && profile.works.length === 0 && <div className="sc-locked"><Heart size={22} /><strong>{lang === 'zh' ? '还没有公开内容' : 'Nothing public yet'}</strong></div>}
              </>
            )}
          </>
        )}
      </aside>
    </div>
  )
}
