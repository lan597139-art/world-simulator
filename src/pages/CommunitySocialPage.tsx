import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import {
  ArrowLeft,
  ArrowUpRight,
  Bell,
  Check,
  ChevronRight,
  CircleHelp,
  Compass,
  HeartHandshake,
  Lightbulb,
  MessageCircle,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import {
  acceptFriendRequest,
  approveGroupMember,
  cancelFriendRequest,
  createGroup,
  createGroupPost,
  createTopic,
  deleteFriend,
  followUser,
  getFollowing,
  getFollowers,
  getGroup,
  getSocialOverview,
  getSocialUser,
  getTopic,
  joinGroup,
  leaveGroup,
  listFriendRequests,
  listFriends,
  listGroups,
  listNotifications,
  listTopics,
  markNotificationsRead,
  rejectFriendRequest,
  replyGroupPost,
  replyTopic,
  searchSocialUsers,
  sendFriendRequest,
  socialSearch,
  unfollowUser,
  type CommunityGroup,
  type CommunityNotification,
  type CommunityTopic,
  type FeedItem,
  type Friend,
  type FriendRequest,
  type GroupDetail,
  type SocialOverview,
  type SocialSearch,
  type SocialUser,
  type TopicDetail,
} from '../api/communitySocial'
import '../styles/community-social.css'

type Lang = 'zh' | 'en'
type Tab = 'feed' | 'topics' | 'groups' | 'people' | 'friends'

const input: CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 8,
  border: '1px solid var(--card-border)', background: 'var(--bg-color)',
  color: 'var(--text-main)', fontSize: 12, lineHeight: 1.6,
}
const textarea: CSSProperties = { ...input, minHeight: 86, resize: 'vertical' }
const primary: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 8,
  border: '1px solid var(--primary-color)', background: 'var(--primary-color)',
  color: 'var(--primary-text)', fontSize: 11, fontWeight: 650, cursor: 'pointer',
}
const ghost: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 11px', borderRadius: 8,
  border: '1px solid var(--card-border)', background: 'transparent',
  color: 'var(--text-main)', fontSize: 10.5, cursor: 'pointer',
}
const tiny: CSSProperties = { ...ghost, padding: '5px 8px', fontSize: 9.5 }
const danger: CSSProperties = { ...tiny, color: 'var(--danger-color)' }

const TOPIC_CATEGORIES = [
  { key: 'all', zh: '全部', en: 'All', icon: <Compass size={14} /> },
  { key: 'discussion', zh: '话题讨论', en: 'Discussion', icon: <MessageCircle size={14} /> },
  { key: 'experience', zh: '经验交流', en: 'Experience', icon: <Lightbulb size={14} /> },
  { key: 'help', zh: '问题求助', en: 'Help', icon: <CircleHelp size={14} /> },
  { key: 'opinion', zh: '观点交流', en: 'Opinion', icon: <Sparkles size={14} /> },
]
const GROUP_CATEGORIES = [
  { key: 'interest', zh: '兴趣', en: 'Interest' },
  { key: 'creation', zh: '创作', en: 'Creation' },
  { key: 'world', zh: '世界', en: 'World' },
  { key: 'learning', zh: '学习', en: 'Learning' },
  { key: 'life', zh: '生活', en: 'Life' },
  { key: 'other', zh: '其他', en: 'Other' },
]

function formatDate(value: string | null | undefined) {
  if (!value) return ''
  try { return new Date(value).toLocaleString() } catch { return value }
}

function Avatar({ user, size = 30 }: { user: SocialUser | null; size?: number }) {
  return <span className="cs-avatar" style={{ width: size, height: size, fontSize: size * .43 }}>{user?.avatar || (user?.display_name || user?.username || '?').slice(0, 1)}</span>
}

function Modal({ title, subtitle, onClose, children, wide = false }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="cs-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="cs-modal" style={{ maxWidth: wide ? 880 : 640 }} role="dialog" aria-modal="true" aria-label={title}>
        <header>
          <div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
          <button type="button" style={ghost} onClick={onClose} aria-label="关闭"><X size={15} /></button>
        </header>
        <div className="cs-modal-body">{children}</div>
      </section>
    </div>
  )
}

function UserLine({ user, children }: { user: SocialUser | null; children?: ReactNode }) {
  return (
    <div className="cs-user-line">
      <Avatar user={user} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong>{user?.display_name || user?.username || '未知用户'}</strong>
        <span>@{user?.username || '—'}{user?.bio ? ` · ${user.bio}` : ''}</span>
      </div>
      {children}
    </div>
  )
}

function Empty({ title, hint }: { title: string; hint?: string }) {
  return <div className="cs-empty"><Sparkles size={18} /><strong>{title}</strong>{hint && <span>{hint}</span>}</div>
}

export default function CommunitySocialPage({
  lang,
  currentUserId,
  onBack,
}: {
  lang: Lang
  currentUserId?: string
  onBack: () => void
}) {
  const [tab, setTab] = useState<Tab>('feed')
  const [overview, setOverview] = useState<SocialOverview | null>(null)
  const [feedScope, setFeedScope] = useState<'following' | 'friends' | 'all'>('following')
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [topics, setTopics] = useState<CommunityTopic[]>([])
  const [topicCategory, setTopicCategory] = useState('all')
  const [topicQuery, setTopicQuery] = useState('')
  const [groups, setGroups] = useState<CommunityGroup[]>([])
  const [groupScope, setGroupScope] = useState<'all' | 'joined' | 'owned'>('all')
  const [peopleQuery, setPeopleQuery] = useState('')
  const [people, setPeople] = useState<SocialUser[]>([])
  const [searchResults, setSearchResults] = useState<SocialSearch | null>(null)
  const [friends, setFriends] = useState<Friend[]>([])
  const [incoming, setIncoming] = useState<FriendRequest[]>([])
  const [outgoing, setOutgoing] = useState<FriendRequest[]>([])
  const [notifications, setNotifications] = useState<CommunityNotification[]>([])
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [relationModal, setRelationModal] = useState<{ title: string; users: SocialUser[] } | null>(null)
  const [topicDetail, setTopicDetail] = useState<TopicDetail | null>(null)
  const [groupDetail, setGroupDetail] = useState<GroupDetail | null>(null)
  const [topicForm, setTopicForm] = useState({ open: false, category: 'discussion', title: '', body: '', tags: '' })
  const [groupForm, setGroupForm] = useState({ open: false, name: '', description: '', category: 'interest', visibility: 'public' as 'public' | 'private' })
  const [reply, setReply] = useState('')
  const [groupPostForm, setGroupPostForm] = useState({ title: '', body: '' })
  const [groupReply, setGroupReply] = useState({ postId: '', body: '' })
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [flash, setFlash] = useState('')

  const notify = (message: string) => { setFlash(message); setError('') }
  const fail = (err: unknown) => setError(String((err as any)?.message || err))

  const loadOverview = async () => {
    try {
      const data = await getSocialOverview(feedScope)
      setOverview(data)
      setFeed(data.feed)
      setNotifications(data.notifications)
      if (!people.length) setPeople(data.suggestions)
    } catch (err) { fail(err) }
  }

  const loadTopics = async () => {
    try { setTopics(await listTopics(topicCategory, topicQuery)) } catch (err) { fail(err) }
  }
  const loadGroups = async () => {
    try { setGroups(await listGroups(groupScope)) } catch (err) { fail(err) }
  }
  const loadPeople = async () => {
    try { setPeople(await searchSocialUsers(peopleQuery)) } catch (err) { fail(err) }
  }
  const loadFriends = async () => {
    try {
      const [nextFriends, nextIncoming, nextOutgoing] = await Promise.all([
        listFriends(), listFriendRequests('incoming'), listFriendRequests('outgoing'),
      ])
      setFriends(nextFriends); setIncoming(nextIncoming); setOutgoing(nextOutgoing)
    } catch (err) { fail(err) }
  }

  useEffect(() => { void loadOverview() }, [feedScope])
  useEffect(() => { if (tab === 'topics') void loadTopics() }, [tab, topicCategory])
  useEffect(() => { if (tab === 'groups') void loadGroups() }, [tab, groupScope])
  useEffect(() => { if (tab === 'people') void loadPeople() }, [tab])
  useEffect(() => { if (tab === 'friends') void loadFriends() }, [tab])
  useEffect(() => { if (!flash) return; const timer = window.setTimeout(() => setFlash(''), 2600); return () => window.clearTimeout(timer) }, [flash])

  const openNotifications = async () => {
    setNotificationsOpen(true)
    try { setNotifications(await listNotifications()) } catch (err) { fail(err) }
  }
  const readAll = async () => {
    setBusy('notifications')
    try {
      await markNotificationsRead()
      setNotifications(await listNotifications())
      await loadOverview()
      notify('通知已全部标记为已读')
    } catch (err) { fail(err) } finally { setBusy('') }
  }

  const openRelations = async (kind: 'followers' | 'following') => {
    if (!currentUserId) return
    setBusy(`relations:${kind}`)
    try {
      const users = kind === 'followers' ? await getFollowers(currentUserId) : await getFollowing(currentUserId)
      setRelationModal({ title: kind === 'followers' ? '我的粉丝' : '我的关注', users })
    } catch (err) { fail(err) } finally { setBusy('') }
  }

  const openTopic = async (id: string) => {
    setBusy(`topic:${id}`)
    try { setTopicDetail(await getTopic(id)); setReply('') } catch (err) { fail(err) } finally { setBusy('') }
  }
  const sendTopicReply = async () => {
    if (!topicDetail || !reply.trim()) return
    setBusy('reply')
    try {
      await replyTopic(topicDetail.id, reply.trim())
      setTopicDetail(await getTopic(topicDetail.id))
      setReply('')
      notify('回复已发送')
    } catch (err) { fail(err) } finally { setBusy('') }
  }
  const submitTopic = async () => {
    if (!topicForm.title.trim() || !topicForm.body.trim()) { setError('请填写标题与正文'); return }
    setBusy('topic-form')
    try {
      await createTopic({
        category: topicForm.category,
        title: topicForm.title.trim(),
        body: topicForm.body.trim(),
        tags: topicForm.tags.split(/[，,、]/).map((item) => item.trim()).filter(Boolean),
      })
      setTopicForm({ open: false, category: 'discussion', title: '', body: '', tags: '' })
      setTopicCategory(topicForm.category)
      await loadTopics()
      await loadOverview()
      notify('讨论已发布')
    } catch (err) { fail(err) } finally { setBusy('') }
  }

  const openGroup = async (id: string) => {
    setBusy(`group:${id}`)
    try { setGroupDetail(await getGroup(id)); setGroupPostForm({ title: '', body: '' }) } catch (err) { fail(err) } finally { setBusy('') }
  }
  const toggleGroup = async (group: CommunityGroup) => {
    setBusy(`group-action:${group.id}`)
    try {
      if (group.joined) await leaveGroup(group.id)
      else await joinGroup(group.id)
      await loadGroups()
      if (groupDetail?.id === group.id) {
        if (group.joined || group.visibility === 'private') setGroupDetail(null)
        else setGroupDetail(await getGroup(group.id))
      }
      await loadOverview()
      notify(group.joined ? '已退出小组' : group.visibility === 'private' ? '入组申请已提交' : '已加入小组')
    } catch (err) { fail(err) } finally { setBusy('') }
  }
  const submitGroup = async () => {
    if (!groupForm.name.trim()) { setError('请填写小组名称'); return }
    setBusy('group-form')
    try {
      await createGroup({ name: groupForm.name.trim(), description: groupForm.description.trim(), category: groupForm.category, visibility: groupForm.visibility })
      setGroupForm({ open: false, name: '', description: '', category: 'interest', visibility: 'public' })
      await loadGroups()
      await loadOverview()
      notify('小组已创建')
    } catch (err) { fail(err) } finally { setBusy('') }
  }
  const submitGroupPost = async () => {
    if (!groupDetail || !groupPostForm.title.trim() || !groupPostForm.body.trim()) { setError('请填写组内帖子标题与正文'); return }
    setBusy('group-post')
    try {
      await createGroupPost(groupDetail.id, { title: groupPostForm.title.trim(), body: groupPostForm.body.trim() })
      setGroupDetail(await getGroup(groupDetail.id))
      setGroupPostForm({ title: '', body: '' })
      notify('组内帖子已发布')
    } catch (err) { fail(err) } finally { setBusy('') }
  }
  const sendGroupReply = async (postId: string) => {
    if (!groupDetail || !groupReply.body.trim() || groupReply.postId !== postId) return
    setBusy(`group-reply:${postId}`)
    try {
      await replyGroupPost(groupDetail.id, postId, groupReply.body.trim())
      setGroupDetail(await getGroup(groupDetail.id))
      setGroupReply({ postId: '', body: '' })
      notify('组内回复已发送')
    } catch (err) { fail(err) } finally { setBusy('') }
  }

  const doFollow = async (user: SocialUser) => {
    setBusy(`follow:${user.id}`)
    try {
      if (user.is_following) await unfollowUser(user.id)
      else await followUser(user.id)
      setPeople((rows) => rows.map((row) => row.id === user.id ? { ...row, is_following: !row.is_following } : row))
      await loadOverview()
      notify(user.is_following ? '已取消关注' : '已关注')
    } catch (err) { fail(err) } finally { setBusy('') }
  }
  const doFriend = async (user: SocialUser) => {
    setBusy(`friend:${user.id}`)
    try {
      await sendFriendRequest(user.id)
      setPeople((rows) => rows.map((row) => row.id === user.id ? { ...row, friend_request: 'outgoing' } : row))
      notify('好友申请已发送')
    } catch (err) { fail(err) } finally { setBusy('') }
  }
  const answerRequest = async (request: FriendRequest, action: 'accept' | 'reject' | 'cancel') => {
    setBusy(`request:${request.id}`)
    try {
      if (action === 'accept') await acceptFriendRequest(request.id)
      else if (action === 'reject') await rejectFriendRequest(request.id)
      else await cancelFriendRequest(request.id)
      await loadFriends()
      await loadOverview()
      notify(action === 'accept' ? '已接受好友申请' : action === 'reject' ? '已拒绝好友申请' : '已撤回好友申请')
    } catch (err) { fail(err) } finally { setBusy('') }
  }
  const removeFriend = async (friend: Friend) => {
    if (!window.confirm(`确定删除好友「${friend.display_name || friend.username}」吗？`)) return
    setBusy(`remove:${friend.id}`)
    try { await deleteFriend(friend.id); await loadFriends(); await loadOverview(); notify('好友已删除') } catch (err) { fail(err) } finally { setBusy('') }
  }
  const runSearch = async () => {
    if (!peopleQuery.trim()) return
    setBusy('search')
    try { setSearchResults(await socialSearch(peopleQuery.trim())) } catch (err) { fail(err) } finally { setBusy('') }
  }
  const openUser = async (user: SocialUser) => {
    setBusy(`user:${user.id}`)
    try {
      const detail = await getSocialUser(user.id)
      setPeople((rows) => rows.some((row) => row.id === detail.id) ? rows.map((row) => row.id === detail.id ? detail : row) : [detail, ...rows])
      notify(`@${detail.username}：${detail.follower_count} 粉丝 · ${detail.following_count} 关注`)
    } catch (err) { fail(err) } finally { setBusy('') }
  }

  const unread = notifications.filter((item) => !item.read).length || overview?.counts.unread_notifications || 0
  const tabs: { key: Tab; zh: string; en: string; icon: ReactNode }[] = [
    { key: 'feed', zh: '社区动态', en: 'Feed', icon: <Compass size={14} /> },
    { key: 'topics', zh: '讨论交流', en: 'Discussions', icon: <MessageCircle size={14} /> },
    { key: 'groups', zh: '兴趣小组', en: 'Groups', icon: <Users size={14} /> },
    { key: 'people', zh: '关注与发现', en: 'People', icon: <HeartHandshake size={14} /> },
    { key: 'friends', zh: '好友', en: 'Friends', icon: <UserPlus size={14} /> },
  ]

  const peopleRows = useMemo(() => searchResults ? searchResults.users : people, [people, searchResults])

  return (
    <div className="cs-page">
      <header className="cs-hero">
        <div>
          <button type="button" style={ghost} onClick={onBack}><ArrowLeft size={14} /> 返回创作中心</button>
          <span className="cs-kicker">COMMUNITY SOCIAL</span>
          <h1>社区社交</h1>
          <p>讨论、兴趣小组、关注、好友与动态，让创作者之间的交流真正发生。</p>
        </div>
        <div className="cs-hero-side">
          <div className="cs-stat-row">
            <button type="button" onClick={() => void openRelations('following')}><strong>{overview?.counts.following ?? '—'}</strong><span>关注</span></button>
            <button type="button" onClick={() => void openRelations('followers')}><strong>{overview?.counts.followers ?? '—'}</strong><span>粉丝</span></button>
            <button type="button" onClick={() => setTab('friends')}><strong>{overview?.counts.friends ?? '—'}</strong><span>好友</span></button>
          </div>
          <button type="button" style={ghost} onClick={() => void openNotifications()} className="cs-bell">
            <Bell size={15} /> 通知{unread > 0 ? ` · ${unread}` : ''}
          </button>
        </div>
      </header>

      {error && <div className="cs-message is-error">{error}<button type="button" style={tiny} onClick={() => setError('')}>关闭</button></div>}
      {flash && <div className="cs-message is-ok"><Check size={14} /> {flash}</div>}

      <nav className="cs-tabs" aria-label="社区社交分类">
        {tabs.map((item) => (
          <button key={item.key} type="button" className={`cs-tab ${tab === item.key ? 'is-active' : ''}`} onClick={() => { setTab(item.key); setSearchResults(null); setError('') }}>
            {item.icon}<span>{lang === 'zh' ? item.zh : item.en}</span>
          </button>
        ))}
      </nav>

      {tab === 'feed' && (
        <section className="cs-layout">
          <div className="cs-main">
            <div className="cs-section-head">
              <div><span className="cs-kicker">ACTIVITY</span><h2>社区动态</h2></div>
              <select style={{ ...input, width: 132 }} value={feedScope} onChange={(e) => setFeedScope(e.target.value as typeof feedScope)}>
                <option value="following">关注动态</option><option value="friends">好友动态</option><option value="all">全社区</option>
              </select>
            </div>
            {feed.length === 0 ? <Empty title="还没有动态" hint="关注创作者、加入小组或发布讨论后，这里会出现真实更新。" /> : (
              <div className="cs-feed-list">
                {feed.map((item) => (
                  <article className="cs-feed-card" key={item.id}>
                    <div className="cs-feed-top"><Avatar user={item.author} size={28} /><span>{item.author?.display_name || item.author?.username || '创作者'}</span><time>{formatDate(item.created_at)}</time></div>
                    <h3>{item.title}</h3>
                    <p>{item.summary}</p>
                    <div className="cs-feed-foot">
                      <span>{item.type === 'topic' ? '讨论' : item.type === 'group_post' ? `小组 · ${item.group?.name || ''}` : '公开作品'}</span>
                      {item.type === 'topic' && <button type="button" style={tiny} onClick={() => void openTopic(item.target.id)}>查看讨论 <ChevronRight size={12} /></button>}
                      {item.type === 'group_post' && item.target.group_id && <button type="button" style={tiny} onClick={() => void openGroup(item.target.group_id!)}>进入小组 <ChevronRight size={12} /></button>}
                      {item.type === 'publication' && <button type="button" style={tiny} onClick={() => window.location.assign('/?page=community#community-public-works')}>查看公开作品 <ArrowUpRight size={12} /></button>}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
          <aside className="cs-side">
            <div className="cs-side-card">
              <div className="cs-section-head"><div><span className="cs-kicker">PEOPLE</span><h2>推荐关注</h2></div></div>
              {(overview?.suggestions || []).length === 0 ? <Empty title="暂无其他用户" /> : overview?.suggestions.map((user) => (
                <UserLine key={user.id} user={user}>
                  {user.id !== currentUserId && <button type="button" style={tiny} onClick={() => void doFollow(user)} disabled={busy === `follow:${user.id}`}>{user.is_following ? '已关注' : '关注'}</button>}
                </UserLine>
              ))}
            </div>
            <div className="cs-side-card">
              <div className="cs-section-head"><div><span className="cs-kicker">GROUPS</span><h2>推荐小组</h2></div><button type="button" style={tiny} onClick={() => setTab('groups')}>全部</button></div>
              {(overview?.groups || []).length === 0 ? <Empty title="还没有小组" /> : overview?.groups.slice(0, 4).map((group) => (
                <button type="button" className="cs-mini-group" key={group.id} onClick={() => void openGroup(group.id)}><strong>{group.name}</strong><span>{group.member_count} 成员 · {group.category_label}</span></button>
              ))}
            </div>
          </aside>
        </section>
      )}

      {tab === 'topics' && (
        <section>
          <div className="cs-section-head">
            <div><span className="cs-kicker">DISCUSSIONS</span><h2>讨论交流区</h2></div>
            <button type="button" style={primary} onClick={() => setTopicForm((form) => ({ ...form, open: true }))}><Plus size={14} /> 发起讨论</button>
          </div>
          <div className="cs-filter-row">
            {TOPIC_CATEGORIES.map((item) => <button key={item.key} type="button" style={topicCategory === item.key ? primary : ghost} onClick={() => setTopicCategory(item.key)}>{item.icon}{lang === 'zh' ? item.zh : item.en}</button>)}
            <div className="cs-inline-search"><Search size={14} /><input value={topicQuery} placeholder="搜索讨论…" onChange={(e) => setTopicQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void loadTopics() }} /><button type="button" style={tiny} onClick={() => void loadTopics()}>搜索</button></div>
          </div>
          {topics.length === 0 ? <Empty title="还没有讨论" hint="发起第一个话题：经验、问题或一个值得讨论的观点。" /> : (
            <div className="cs-topic-grid">
              {topics.map((topic) => (
                <article className="cs-topic-card" key={topic.id} onClick={() => void openTopic(topic.id)}>
                  <div className="cs-topic-meta"><span>{topic.category_label}</span><time>{formatDate(topic.created_at)}</time></div>
                  <h3>{topic.title}</h3>
                  <p>{topic.body.slice(0, 180)}</p>
                  <div className="cs-topic-foot"><span>{topic.author?.display_name || topic.author?.username || '创作者'}</span><span>{topic.reply_count} 回复 · {topic.view_count} 浏览</span></div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'groups' && (
        <section>
          <div className="cs-section-head">
            <div><span className="cs-kicker">GROUPS</span><h2>兴趣小组</h2></div>
            <button type="button" style={primary} onClick={() => setGroupForm((form) => ({ ...form, open: true }))}><Plus size={14} /> 创建小组</button>
          </div>
          <div className="cs-filter-row">
            {(['all', 'joined', 'owned'] as const).map((scope) => <button key={scope} type="button" style={groupScope === scope ? primary : ghost} onClick={() => setGroupScope(scope)}>{scope === 'all' ? '全部小组' : scope === 'joined' ? '我加入的' : '我创建的'}</button>)}
          </div>
          {groups.length === 0 ? <Empty title="还没有小组" hint="创建一个围绕世界、创作、学习或生活的兴趣小组。" /> : (
            <div className="cs-group-grid">
              {groups.map((group) => (
                <article className="cs-group-card" key={group.id}>
                  <div className="cs-topic-meta"><span>{group.category_label}</span><span>{group.visibility === 'private' ? '私密' : '公开'} · {group.member_count} 成员</span></div>
                  <h3>{group.name}</h3>
                  <p>{group.description || '暂无小组简介。'}</p>
                  <div className="cs-group-foot">
                    <button type="button" style={tiny} onClick={() => void openGroup(group.id)}>查看小组</button>
                    {!group.is_owner && <button type="button" style={group.joined ? ghost : primary} disabled={busy === `group-action:${group.id}`} onClick={() => void toggleGroup(group)}>{group.joined ? '退出' : group.membership_status === 'pending' ? '审批中' : '加入'}</button>}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'people' && (
        <section>
          <div className="cs-section-head"><div><span className="cs-kicker">FOLLOW & DISCOVER</span><h2>关注与发现</h2></div></div>
          <div className="cs-search-bar"><Search size={15} /><input value={peopleQuery} placeholder="搜索昵称、用户名或简介…" onChange={(e) => setPeopleQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void runSearch() }} /><button type="button" style={primary} onClick={() => void runSearch()} disabled={busy === 'search'}>搜索</button><button type="button" style={ghost} onClick={() => { setSearchResults(null); setPeopleQuery(''); void loadOverview() }}>清除</button></div>
          {searchResults && (searchResults.topics.length > 0 || searchResults.groups.length > 0) && (
            <div className="cs-search-extra">
              {searchResults.topics.slice(0, 5).map((topic) => <button type="button" key={topic.id} style={ghost} onClick={() => void openTopic(topic.id)}>讨论 · {topic.title}</button>)}
              {searchResults.groups.slice(0, 5).map((group) => <button type="button" key={group.id} style={ghost} onClick={() => void openGroup(group.id)}>小组 · {group.name}</button>)}
            </div>
          )}
          {peopleRows.length === 0 ? <Empty title="没有找到用户" hint="换一个关键词，或确认对方已开启公开资料。" /> : (
            <div className="cs-people-list">
              {peopleRows.map((user) => (
                <div className="cs-person-card" key={user.id}>
                  <Avatar user={user} size={40} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <button type="button" className="cs-person-name" onClick={() => void openUser(user)}>{user.display_name || user.username}{user.is_owner ? <small>开发者</small> : null}</button>
                    <span>@{user.username} · {user.follower_count} 粉丝{user.bio ? ` · ${user.bio}` : ''}</span>
                  </div>
                  {user.id !== currentUserId && (
                    <div className="cs-person-actions">
                      <button type="button" style={user.is_following ? ghost : primary} disabled={busy === `follow:${user.id}`} onClick={() => void doFollow(user)}>{user.is_following ? '已关注' : '关注'}</button>
                      {user.is_friend ? <span style={tiny}>好友</span> : user.friend_request === 'outgoing' ? <span style={tiny}>申请中</span> : user.friend_request === 'incoming' ? <span style={tiny}>待处理</span> : <button type="button" style={tiny} disabled={busy === `friend:${user.id}`} onClick={() => void doFriend(user)}>加好友</button>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="cs-inline-note"><ShieldCheck size={14} /> 关注与好友申请会遵守对方的隐私设置；被拒绝或关闭时，后端会返回明确提示。</div>
        </section>
      )}

      {tab === 'friends' && (
        <div className="cs-friends-layout">
          <section className="cs-main">
            <div className="cs-section-head"><div><span className="cs-kicker">FRIENDS</span><h2>我的好友</h2></div><button type="button" style={ghost} onClick={() => void loadFriends()}>刷新</button></div>
            {friends.length === 0 ? <Empty title="还没有好友" hint="在「关注与发现」里找到创作者，发送好友申请。" /> : (
              <div className="cs-people-list">
                {friends.map((friend) => (
                  <div className="cs-person-card" key={friend.id}>
                    <Avatar user={friend} size={38} />
                    <div style={{ flex: 1 }}><strong className="cs-person-name">{friend.display_name || friend.username}</strong><span>@{friend.username} · 好友于 {formatDate(friend.friends_since)}</span></div>
                    <button type="button" style={danger} disabled={busy === `remove:${friend.id}`} onClick={() => void removeFriend(friend)}>删除好友</button>
                  </div>
                ))}
              </div>
            )}
          </section>
          <aside className="cs-side">
            <div className="cs-side-card">
              <div className="cs-section-head"><div><span className="cs-kicker">REQUESTS</span><h2>收到的申请</h2></div></div>
              {incoming.length === 0 ? <Empty title="暂无好友申请" /> : incoming.map((request) => (
                <div className="cs-request" key={request.id}>
                  <UserLine user={request.user} />
                  {request.message && <p>{request.message}</p>}
                  <div style={{ display: 'flex', gap: 6 }}><button type="button" style={primary} disabled={busy === `request:${request.id}`} onClick={() => void answerRequest(request, 'accept')}>接受</button><button type="button" style={danger} disabled={busy === `request:${request.id}`} onClick={() => void answerRequest(request, 'reject')}>拒绝</button></div>
                </div>
              ))}
            </div>
            <div className="cs-side-card">
              <div className="cs-section-head"><div><span className="cs-kicker">SENT</span><h2>我发出的申请</h2></div></div>
              {outgoing.length === 0 ? <Empty title="暂无待处理申请" /> : outgoing.map((request) => (
                <div className="cs-request" key={request.id}><UserLine user={request.user} /><button type="button" style={tiny} onClick={() => void answerRequest(request, 'cancel')}>撤回申请</button></div>
              ))}
            </div>
          </aside>
        </div>
      )}

      {notificationsOpen && (
        <Modal title="社区通知" subtitle={`${unread} 条未读`} onClose={() => setNotificationsOpen(false)}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}><button type="button" style={ghost} disabled={busy === 'notifications' || unread === 0} onClick={() => void readAll()}>全部标为已读</button></div>
          {notifications.length === 0 ? <Empty title="暂无通知" hint="好友申请、回复与关注会出现在这里。" /> : (
            <div className="cs-notification-list">
              {notifications.map((item) => (
                <div className={`cs-notification ${item.read ? '' : 'is-unread'}`} key={item.id}>
                  <Avatar user={item.actor} size={26} />
                  <div style={{ flex: 1 }}><strong>{item.title}</strong>{item.body && <span>{item.body}</span>}<time>{formatDate(item.created_at)}</time></div>
                  {!item.read && <span className="cs-unread-dot" />}
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {relationModal && (
        <Modal title={relationModal.title} subtitle={`${relationModal.users.length} 位用户`} onClose={() => setRelationModal(null)}>
          {relationModal.users.length === 0 ? <Empty title="这里还是空的" hint="关注创作者或参与讨论，关系会逐步建立。" /> : (
            <div className="cs-people-list">
              {relationModal.users.map((user) => (
                <UserLine key={user.id} user={user}>
                  {user.id !== currentUserId && <button type="button" style={user.is_following ? ghost : primary} disabled={busy === `follow:${user.id}`} onClick={() => void doFollow(user)}>{user.is_following ? '已关注' : '关注'}</button>}
                </UserLine>
              ))}
            </div>
          )}
        </Modal>
      )}

      {topicDetail && (
        <Modal wide title={topicDetail.title} subtitle={`${topicDetail.category_label} · ${topicDetail.author?.display_name || '创作者'} · ${formatDate(topicDetail.created_at)}`} onClose={() => setTopicDetail(null)}>
          <p className="cs-detail-body">{topicDetail.body}</p>
          <div className="cs-detail-meta">{topicDetail.reply_count} 条回复 · {topicDetail.view_count} 次浏览 {topicDetail.tags.length > 0 && `· ${topicDetail.tags.join(' · ')}`}</div>
          <div className="cs-reply-list">
            {topicDetail.replies.length === 0 ? <Empty title="还没有回复" hint="写下你的经验或观点。" /> : topicDetail.replies.map((item) => (
              <div className="cs-reply" key={item.id}><Avatar user={item.author} size={26} /><div><strong>{item.author?.display_name || item.author?.username || '用户'}</strong><p>{item.body}</p><time>{formatDate(item.created_at)}</time></div></div>
            ))}
          </div>
          <div className="cs-reply-form"><textarea style={textarea} placeholder="写下你的回复…" value={reply} onChange={(e) => setReply(e.target.value)} /><button type="button" style={primary} disabled={busy === 'reply'} onClick={() => void sendTopicReply()}><Send size={13} /> 发送回复</button></div>
        </Modal>
      )}

      {groupDetail && (
        <Modal wide title={groupDetail.name} subtitle={`${groupDetail.category_label} · ${groupDetail.visibility === 'private' ? '私密小组' : '公开小组'} · ${groupDetail.member_count} 位成员`} onClose={() => setGroupDetail(null)}>
          <p className="cs-detail-body">{groupDetail.description || '暂无小组简介。'}</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {!groupDetail.is_owner && <button type="button" style={groupDetail.joined ? ghost : primary} disabled={busy === `group-action:${groupDetail.id}`} onClick={() => void toggleGroup(groupDetail)}>{groupDetail.joined ? '退出小组' : groupDetail.membership_status === 'pending' ? '审批中' : '加入小组'}</button>}
            <span style={tiny}>组长：{groupDetail.owner?.display_name || groupDetail.owner?.username || '—'}</span>
          </div>
          {groupDetail.is_owner && groupDetail.pending_members.length > 0 && (
            <div className="cs-pending-members">
              <strong>待审批成员</strong>
              {groupDetail.pending_members.map((member) => <div key={member.id}><UserLine user={member} /><button type="button" style={primary} onClick={async () => { try { await approveGroupMember(groupDetail.id, member.id); setGroupDetail(await getGroup(groupDetail.id)); notify('已通过入组申请') } catch (err) { fail(err) } }}>通过</button></div>)}
            </div>
          )}
          <div className="cs-detail-section-title">组内讨论</div>
          {groupDetail.joined || groupDetail.is_owner ? (
            <div className="cs-group-compose">
              <input style={input} placeholder="帖子标题" value={groupPostForm.title} onChange={(e) => setGroupPostForm((form) => ({ ...form, title: e.target.value }))} />
              <textarea style={textarea} placeholder="和组员分享你的想法…" value={groupPostForm.body} onChange={(e) => setGroupPostForm((form) => ({ ...form, body: e.target.value }))} />
              <button type="button" style={primary} disabled={busy === 'group-post'} onClick={() => void submitGroupPost()}><Send size={13} /> 发布组内帖子</button>
            </div>
          ) : <div className="cs-inline-note">加入小组后即可发帖和回复。</div>}
          {groupDetail.posts.length === 0 ? <Empty title="还没有组内帖子" /> : groupDetail.posts.map((post) => (
            <article className="cs-group-post" key={post.id}>
              <div className="cs-feed-top"><Avatar user={post.author} size={26} /><span>{post.author?.display_name || post.author?.username || '组员'}</span><time>{formatDate(post.created_at)}</time></div>
              <h3>{post.title}</h3>
              <p>{post.body}</p>
              <div className="cs-reply-form" style={{ marginTop: 10 }}>
                <textarea style={{ ...textarea, minHeight: 54 }} placeholder="回复这个帖子…" value={groupReply.postId === post.id ? groupReply.body : ''} onChange={(e) => setGroupReply({ postId: post.id, body: e.target.value })} />
                <button type="button" style={ghost} disabled={busy === `group-reply:${post.id}`} onClick={() => void sendGroupReply(post.id)}><Send size={12} /> 回复</button>
              </div>
            </article>
          ))}
        </Modal>
      )}

      {topicForm.open && (
        <Modal title="发起讨论" subtitle="讨论会公开在内容社区，任何登录用户都可以回复。" onClose={() => setTopicForm((form) => ({ ...form, open: false }))}>
          <label className="cs-field"><span>分类</span><select style={input} value={topicForm.category} onChange={(e) => setTopicForm((form) => ({ ...form, category: e.target.value }))}>{TOPIC_CATEGORIES.filter((item) => item.key !== 'all').map((item) => <option key={item.key} value={item.key}>{item.zh}</option>)}</select></label>
          <label className="cs-field"><span>标题</span><input style={input} maxLength={120} value={topicForm.title} onChange={(e) => setTopicForm((form) => ({ ...form, title: e.target.value }))} placeholder="例如：如何让世界观规则更可信？" /></label>
          <label className="cs-field"><span>正文</span><textarea style={textarea} maxLength={20000} value={topicForm.body} onChange={(e) => setTopicForm((form) => ({ ...form, body: e.target.value }))} placeholder="分享经验、提出问题或说明你的观点…" /></label>
          <label className="cs-field"><span>标签（可选，逗号分隔）</span><input style={input} value={topicForm.tags} onChange={(e) => setTopicForm((form) => ({ ...form, tags: e.target.value }))} placeholder="世界观、人物、写作" /></label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button type="button" style={ghost} onClick={() => setTopicForm((form) => ({ ...form, open: false }))}>取消</button><button type="button" style={primary} disabled={busy === 'topic-form'} onClick={() => void submitTopic()}>发布讨论</button></div>
        </Modal>
      )}

      {groupForm.open && (
        <Modal title="创建兴趣小组" subtitle="公开小组可直接加入；私密小组加入后需要组长审批。" onClose={() => setGroupForm((form) => ({ ...form, open: false }))}>
          <label className="cs-field"><span>小组名称</span><input style={input} maxLength={80} value={groupForm.name} onChange={(e) => setGroupForm((form) => ({ ...form, name: e.target.value }))} placeholder="例如：世界观研究社" /></label>
          <label className="cs-field"><span>小组简介</span><textarea style={textarea} maxLength={2000} value={groupForm.description} onChange={(e) => setGroupForm((form) => ({ ...form, description: e.target.value }))} placeholder="这个小组会讨论什么？" /></label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label className="cs-field"><span>分类</span><select style={input} value={groupForm.category} onChange={(e) => setGroupForm((form) => ({ ...form, category: e.target.value }))}>{GROUP_CATEGORIES.map((item) => <option key={item.key} value={item.key}>{item.zh}</option>)}</select></label>
            <label className="cs-field"><span>可见性</span><select style={input} value={groupForm.visibility} onChange={(e) => setGroupForm((form) => ({ ...form, visibility: e.target.value as 'public' | 'private' }))}><option value="public">公开小组</option><option value="private">私密小组</option></select></label>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button type="button" style={ghost} onClick={() => setGroupForm((form) => ({ ...form, open: false }))}>取消</button><button type="button" style={primary} disabled={busy === 'group-form'} onClick={() => void submitGroup()}>创建小组</button></div>
        </Modal>
      )}
    </div>
  )
}
