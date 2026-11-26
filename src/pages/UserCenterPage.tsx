import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  ArrowUpRight,
  BookOpen,
  BarChart3,
  Boxes,
  CalendarCheck,
  Crown,
  FolderPlus,
  Gift,
  Globe2,
  Heart,
  History,
  LayoutTemplate,
  Lock,
  LockKeyhole,
  LogOut,
  Unlock,
  Pencil,
  Route,
  ShieldCheck,
  Sparkles,
  Sprout,
  ThumbsUp,
  UserRound,
} from 'lucide-react'
import type { AuthUser } from '../api/auth'
import { API_ORIGIN } from '../api/config'
import { resolveMediaUrl } from '../api/media'
import { listStories as listStoryProjects } from '../api/storyline'
import { listWorks, type CreativeWork } from '../api/creativeWorks'
import { updateUserDisplayName } from '../api/users'
import { getAllWorlds } from '../services/worldService'
import {
  createFavoriteFolder,
  deleteFavoriteFolder,
  doCheckin,
  getCheckinStatus,
  getRecommendations,
  getSocialProfile,
  listFavorites,
  listHistory,
  removeFavorite,
  type CheckinStatus,
  type FavoriteFolder,
  type FavoriteItem,
  type HistoryItem,
  type RecommendationItem,
  type SocialProfile,
} from '../api/socialCore'
import { getSpiritTransactions, type SpiritTransaction } from '../api/spiritEconomy'
import { updateSettings } from '../api/settings'
import { formatDate } from './centerShared'
import './../styles/user-center.css'

type Lang = 'zh' | 'en'

export type UserAssetTarget = 'worlds' | 'characters' | 'storylines' | 'works'

type CreatorIdentity = 'world' | 'character' | 'narrative' | 'companion' | 'chronicler'

type LocalProfile = {
  bio: string
  background: string
  creatorIdentity: CreatorIdentity
}

type Counts = {
  worlds: number | null
  characters: number | null
  storylines: number | null
  templates: number
  works: number | null
}

const CREATOR_IDENTITIES: CreatorIdentity[] = ['world', 'character', 'narrative', 'companion', 'chronicler']

type TabKey = 'works' | 'activity' | 'favorites' | 'likes' | 'recommend' | 'reward' | 'history' | 'content' | 'assets'

function copy(lang: Lang) {
  return lang === 'zh'
    ? {
        eyebrow: 'PERSONAL CENTER',
        title: '个人中心',
        profile: '个人资料',
        memberSince: '加入时间',
        owner: '所有者',
        localAccount: '本地账号',
        bio: '个人简介',
        background: '个人背景',
        emptyBio: '尚未填写个人简介',
        emptyBackground: '尚未填写个人背景',
        worlds: '世界',
        characters: '人物',
        works: '作品',
        creator: '创作者主页',
        creatorIdentity: '创作身份',
        editIdentity: '编辑身份',
        tabWorks: '作品',
        achievements: '创作成就',
        allWorks: '查看全部作品',
        noWorks: '还没有作品，从创作中心创建第一部作品。',
        builtWorlds: '已建立世界',
        shapedCharacters: '塑造人物',
        finishedWorks: '作品',
        storyProjects: '故事项目',
        follows: '我的关注',
        following: '关注',
        followers: '粉丝',
        activity: '关注动态',
        followEmpty: '当前为单用户本地空间，暂无关注关系。',
        assets: '我的资产库',
        assetWorlds: '世界',
        assetCharacters: 'OC',
        assetStorylines: '剧情',
        assetTemplates: '模板',
        assetWorks: '作品',
        assetsHint: '点击进入对应列表',
        noTemplates: '暂无模板',
        favorites: '我的收藏',
        favoriteWorks: '作品',
        favoriteCharacters: '角色',
        favoriteWorlds: '世界',
        favoritesEmpty: '暂无收藏内容',
        favoritesNote: '收藏功能暂未开放，当前显示真实空状态。',
        friends: '好友',
        tabFavorites: '收藏',
        tabLikes: '点赞',
        tabRecommend: '推荐',
        tabReward: '打赏',
        tabHistory: '浏览历史',
        tabAssets: '账户与资产',
        createFolder: '新建收藏夹',
        folderOpenNote: '收藏夹功能暂未开放，开放后可在此分类管理收藏。',
        likes: '点赞',
        likesEmpty: '暂无点赞记录',
        recommend: '推荐',
        recommendEmpty: '暂无推荐内容',
        reward: '打赏',
        rewardGiven: '主动打赏',
        rewardReceived: '被打赏',
        rewardGivenEmpty: '暂无主动打赏记录。打赏与灵果明细统一在灵果资源中心管理。',
        rewardReceivedEmpty: '暂无被打赏记录。作品被打赏后，明细可在灵果资源中心查看。',
        history: '浏览历史',
        historyEmpty: '暂无浏览历史',
        statsLocked: '数据隐私保护中',
        statsLockedNote: '数据统计默认仅本人可见，开启后可对外展示。',
        unlockStats: '开启对外展示',
        statsUnlocked: '已开启，对外可见',
        statsUnlockNote: '数据详情已开启对外展示，其他用户可查看你的统计。',
        assetsAchievements: '创作成就与资产',
        tabContent: '数据分析',
        content: '数据分析',
        creatorLevel: '创作等级',
        followerLevel: '粉丝等级',
        activityLevel: '活跃等级',
        levelProgress: '解锁下一级',
        analytics: '详情',
        publishedWorks: '已发布作品',
        drafts: '草稿',
        totalReads: '总阅读量',
        totalClicks: '总点击量',
        totalComments: '评论',
        latestActivity: '动态',
        tabActivity: '动态',
        noActivity: '暂无动态',
        activityPreview: '动态内容摘要',
        account: '账户管理',
        security: '账号安全',
        securityValue: '本地密码保护',
        loginMethod: '登录方式',
        loginValue: '用户名 + 密码',
        privacy: '隐私设置',
        privacyValue: '可配置关注与好友边界',
        accountRole: '当前身份',
        roleOwner: '创建者 / 所有者',
        roleLocal: '本地用户',
        signOut: '退出登录',
        membership: '会员中心',
        memberLevel: '会员等级',
        memberBenefits: '权益',
        memberValidity: '有效期',
        normalUser: '普通用户',
        notOpened: '未开通',
        membershipNote: '会员方案、余额与订单已移到商业与服务中心统一管理。',
        orders: '消费记录',
        orderCount: '0 笔',
        topups: '充值',
        purchases: '购买',
        orderItems: '订单',
        ordersEmpty: '暂无充值、购买或订单记录。',
        earnings: '收益账户',
        balance: '可提现余额',
        transactionCount: '交易明细',
        withdrawCount: '提现记录',
        earningsEmpty: '暂无创作者收入与提现记录。',
        modalTitle: '编辑个人资料',
        nickname: '昵称',
        avatar: '头像',
        avatarNote: '头像由昵称首字生成。',
        identity: '创作身份',
        bioField: '个人简介',
        backgroundField: '个人背景',
        bioPlaceholder: '介绍一下你自己。',
        backgroundPlaceholder: '你的经历、关注领域或创作背景。',
        localNote: '昵称会同步到本地账号；简介、背景与创作身份暂时保存在本机。',
        save: '保存',
        saving: '保存中…',
        cancel: '取消',
        saveFailed: '保存失败',
        nicknameRequired: '昵称不能为空',
        creatorTitles: {
          world: '世界创作者',
          character: '人物创作者',
          narrative: '叙事作者',
          companion: 'AI 角色创作者',
          chronicler: '人生记录者',
        },
        workDraft: '草稿',
        workPublished: '已发布',
        tipLevelGiven: '打赏等级 · 主动',
        tipLevelReceived: '打赏等级 · 被动',
        checkin: '签到',
        checkinToday: '今日已签到',
        checkinStreak: '连续签到',
        checkinCount: '累计签到',
        checkinAction: '立即签到',
        checkinDone: '签到成功',
        statsPublic: '对外公开',
        statsPrivate: '仅本人可见',
        statsPublicNote: '已对外公开画像统计，其他用户可查看你的数据统计。',
        statsPrivateNote: '数据统计仅本人可见，其他用户查看你的主页时不会展示用户画像分析。',
        favoriteEmpty: '还没有收藏内容',
        removeFolder: '删除收藏夹',
        folderName: '收藏夹名称',
        loading: '读取中',
        notConnected: '尚未接入',
      }
    : {
        eyebrow: 'PERSONAL CENTER',
        title: 'Personal Center',
        profile: 'Profile',
        memberSince: 'Joined',
        owner: 'Owner',
        localAccount: 'Local account',
        bio: 'Bio',
        background: 'Background',
        emptyBio: 'No bio yet',
        emptyBackground: 'No background yet',
        worlds: 'Worlds',
        characters: 'Characters',
        works: 'Works',
        creator: 'Creator profile',
        creatorIdentity: 'Creator identity',
        editIdentity: 'Edit identity',
        tabWorks: 'Works',
        achievements: 'Achievements',
        allWorks: 'View all works',
        noWorks: 'No works yet. Create your first one in the creation center.',
        builtWorlds: 'Worlds built',
        shapedCharacters: 'Characters shaped',
        finishedWorks: 'Works',
        storyProjects: 'Story projects',
        follows: 'Following',
        following: 'Following',
        followers: 'Followers',
        activity: 'Activity',
        followEmpty: 'This is a single-user local space. No following relationships yet.',
        assets: 'Asset library',
        assetWorlds: 'Worlds',
        assetCharacters: 'OCs',
        assetStorylines: 'Storylines',
        assetTemplates: 'Templates',
        assetWorks: 'Works',
        assetsHint: 'Open a real list',
        noTemplates: 'No templates',
        favorites: 'Favorites',
        favoriteWorks: 'Works',
        favoriteCharacters: 'Characters',
        favoriteWorlds: 'Worlds',
        favoritesEmpty: 'No favorites yet',
        favoritesNote: 'Favorites are not available yet. This is a real empty state.',
        friends: 'Friends',
        tabFavorites: 'Favorites',
        tabLikes: 'Likes',
        tabRecommend: 'Recommended',
        tabReward: 'Rewards',
        tabHistory: 'History',
        tabAssets: 'Account & assets',
        createFolder: 'New folder',
        folderOpenNote: 'Collections are not available yet. Once open, you can manage favorites here.',
        likes: 'Likes',
        likesEmpty: 'No likes yet',
        recommend: 'Recommended',
        recommendEmpty: 'No recommendations yet',
        reward: 'Rewards',
        rewardGiven: 'Given',
        rewardReceived: 'Received',
        rewardGivenEmpty: 'No outgoing rewards yet. Rewards and spirit-fruit details are managed in Spirit Resources.',
        rewardReceivedEmpty: 'No rewards received yet. Incoming work rewards appear in Spirit Resources.',
        history: 'Browsing history',
        historyEmpty: 'No browsing history yet',
        statsLocked: 'Data privacy protected',
        statsLockedNote: 'Stats are visible only to you by default. Turn on to show them.',
        unlockStats: 'Show to others',
        statsUnlocked: 'On, visible to others',
        statsUnlockNote: 'Data details are shown publicly to other users.',
        assetsAchievements: 'Achievements & assets',
        tabContent: 'Data analytics',
        content: 'Data analytics',
        creatorLevel: 'Creator level',
        followerLevel: 'Follower level',
        activityLevel: 'Activity level',
        levelProgress: 'Unlock next level',
        analytics: 'Details',
        publishedWorks: 'Published works',
        drafts: 'Drafts',
        totalReads: 'Total reads',
        totalClicks: 'Total clicks',
        totalComments: 'Comments',
        latestActivity: 'Activity',
        tabActivity: 'Activity',
        noActivity: 'No activity yet',
        activityPreview: 'Activity preview',
        account: 'Account',
        security: 'Security',
        securityValue: 'Local password protection',
        loginMethod: 'Sign-in',
        loginValue: 'Username + password',
        privacy: 'Privacy',
        privacyValue: 'Follow and friend boundaries',
        accountRole: 'Role',
        roleOwner: 'Creator / Owner',
        roleLocal: 'Local user',
        signOut: 'Sign out',
        membership: 'Membership',
        memberLevel: 'Level',
        memberBenefits: 'Benefits',
        memberValidity: 'Validity',
        normalUser: 'Standard user',
        notOpened: 'Not active',
        membershipNote: 'Plans, balance, and orders are managed in the Business & Services Center.',
        orders: 'Purchases',
        orderCount: '0 orders',
        topups: 'Top-ups',
        purchases: 'Purchases',
        orderItems: 'Orders',
        ordersEmpty: 'No top-ups, purchases, or orders yet.',
        earnings: 'Earnings',
        balance: 'Available balance',
        transactionCount: 'Transactions',
        withdrawCount: 'Withdrawals',
        earningsEmpty: 'No creator income or withdrawals yet.',
        modalTitle: 'Edit profile',
        nickname: 'Display name',
        avatar: 'Avatar',
        avatarNote: 'Generated from the first character of your name.',
        identity: 'Creator identity',
        bioField: 'Bio',
        backgroundField: 'Background',
        bioPlaceholder: 'Introduce yourself.',
        backgroundPlaceholder: 'Your experience, interests, or creative background.',
        localNote: 'Display name syncs to the local account. Bio, background, and creator identity are stored on this device for now.',
        save: 'Save',
        saving: 'Saving…',
        cancel: 'Cancel',
        saveFailed: 'Save failed',
        nicknameRequired: 'Display name is required',
        creatorTitles: {
          world: 'World creator',
          character: 'Character creator',
          narrative: 'Narrative writer',
          companion: 'AI character creator',
          chronicler: 'Life chronicler',
        },
        workDraft: 'Draft',
        workPublished: 'Published',
        tipLevelGiven: 'Tip level · Outgoing',
        tipLevelReceived: 'Tip level · Incoming',
        checkin: 'Check-in',
        checkinToday: 'Checked in today',
        checkinStreak: 'Day streak',
        checkinCount: 'Total check-ins',
        checkinAction: 'Check in now',
        checkinDone: 'Checked in',
        statsPublic: 'Public',
        statsPrivate: 'Only me',
        statsPublicNote: 'Profile stats are public; other users can see your data.',
        statsPrivateNote: 'Profile stats are private; your analytics stay hidden from others.',
        favoriteEmpty: 'No favorites yet',
        removeFolder: 'Delete folder',
        folderName: 'Folder name',
        loading: 'Loading',
        notConnected: 'Not connected',
      }
}

const localProfileKey = (userId: string) => `ws.user.profile.v1.${userId}`
const statsUnlockKey = (userId: string) => `ws.user.statsUnlock.v1.${userId}`

function readLocalProfile(userId: string): LocalProfile {
  try {
    const raw = localStorage.getItem(localProfileKey(userId))
    const parsed = raw ? JSON.parse(raw) : null
    return {
      bio: String(parsed?.bio || ''),
      background: String(parsed?.background || ''),
      creatorIdentity: CREATOR_IDENTITIES.includes(parsed?.creatorIdentity) ? parsed.creatorIdentity : 'world',
    }
  } catch {
    return { bio: '', background: '', creatorIdentity: 'world' }
  }
}

function formatCount(value: number | null | undefined) {
  return value === null || value === undefined ? '—' : String(value)
}

export default function UserCenterPage({
  lang,
  user,
  onUserUpdated,
  onOpenAsset,
  onOpenWorks,
  onLogout,
  onOpenSettings,
  onOpenSpirit,
}: {
  lang: Lang
  user: AuthUser | null
  onUserUpdated: (user: AuthUser) => void
  onOpenAsset: (target: UserAssetTarget) => void
  onOpenWorks: () => void
  onLogout: () => void
  onOpenSettings: () => void
  onOpenSpirit: () => void
}) {
  const text = copy(lang)
  const [counts, setCounts] = useState<Counts>({
    worlds: null, characters: null, storylines: null, templates: 0, works: null,
  })
  const [works, setWorks] = useState<CreativeWork[] | null>(null)
  const [profile, setProfile] = useState<LocalProfile>(() => readLocalProfile(user?.id || 'local'))
  const [profileOpen, setProfileOpen] = useState(false)
  const [displayName, setDisplayName] = useState(user?.display_name || '')
  const [bioDraft, setBioDraft] = useState(profile.bio)
  const [backgroundDraft, setBackgroundDraft] = useState(profile.background)
  const [identityDraft, setIdentityDraft] = useState<CreatorIdentity>(profile.creatorIdentity)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [activeTab, setActiveTab] = useState<TabKey>('works')
  const [socialProfile, setSocialProfile] = useState<SocialProfile | null>(null)
  const [statsUnlocked, setStatsUnlocked] = useState(() => localStorage.getItem(statsUnlockKey(user?.id || 'local')) === '1')
  const [spiritTx, setSpiritTx] = useState<SpiritTransaction[] | null>(null)
  const [favorites, setFavorites] = useState<{ items: FavoriteItem[]; total: number; folders: FavoriteFolder[] } | null>(null)
  const [historyRows, setHistoryRows] = useState<HistoryItem[] | null>(null)
  const [recommendations, setRecommendations] = useState<RecommendationItem[] | null>(null)
  const [checkin, setCheckin] = useState<CheckinStatus | null>(null)
  const [checkinNote, setCheckinNote] = useState('')
  const [newFolder, setNewFolder] = useState('')

  useEffect(() => {
    let cancelled = false
    void getAllWorlds(false)
      .then(async (worlds) => {
        if (cancelled) return
        setCounts((current) => ({ ...current, worlds: worlds.length }))
        const projectCounts = await Promise.all(
          worlds.map((world) =>
            listStoryProjects(world.id).then((rows) => rows.length).catch(() => 0),
          ),
        )
        if (!cancelled) {
          setCounts((current) => ({
            ...current,
            storylines: projectCounts.reduce((sum, count) => sum + count, 0),
          }))
        }
      })
      .catch(() => undefined)

    void fetch(`${API_ORIGIN}/api/characters`)
      .then((response) => (response.ok ? response.json() : []))
      .then((rows) => {
        if (!cancelled && Array.isArray(rows)) {
          setCounts((current) => ({ ...current, characters: rows.length }))
        }
      })
      .catch(() => undefined)

    void listWorks()
      .then((rows) => {
        if (cancelled || !Array.isArray(rows)) return
        const sorted = [...rows].sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')))
        setWorks(sorted)
        setCounts((current) => ({ ...current, works: rows.length }))
      })
      .catch(() => undefined)

    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    void getSocialProfile(user.id)
      .then((profile) => { if (!cancelled) setSocialProfile(profile) })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [user?.id])

  useEffect(() => {
    let cancelled = false
    void getSpiritTransactions(200)
      .then((rows) => { if (!cancelled) setSpiritTx(Array.isArray(rows) ? rows : []) })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      listFavorites(),
      listHistory(),
      getRecommendations(),
      getCheckinStatus(),
    ])
      .then(([fav, hist, rec, cin]) => {
        if (cancelled) return
        setFavorites(fav)
        setHistoryRows(hist.items)
        setRecommendations(rec.items)
        setCheckin(cin)
      })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [])

  const toggleStatsUnlock = async () => {
    const next = !statsUnlocked
    setStatsUnlocked(next)
    localStorage.setItem(statsUnlockKey(user?.id || 'local'), next ? '1' : '0')
    if (user?.id) {
      try {
        await updateSettings({ privacy: { show_stats: next } })
      } catch {
        // 本地开关与设置中心同步失败时保留本地状态，不阻塞展示。
      }
    }
  }

  const doCheckinNow = async () => {
    if (!checkin) return
    setCheckinNote('')
    try {
      const next = await doCheckin(checkin.today)
      setCheckin(next)
      setCheckinNote(text.checkinDone)
    } catch {
      // 签到失败不阻塞个人中心其他能力。
    }
  }

  const submitFolder = async () => {
    const name = newFolder.trim()
    if (!name) return
    try {
      await createFavoriteFolder(name)
      const fav = await listFavorites()
      setFavorites(fav)
      setNewFolder('')
    } catch {
      // 创建失败时保持输入，用户可重试。
    }
  }

  // 主动打赏：本人作为赠送方、金额为负的打赏/赠送流水；被打赏：本人作为接收方、金额为正的流水。
  const rewardGiven = useMemo(
    () => (spiritTx || []).filter((row) => (row.kind === 'tip' || row.kind === 'gift') && row.fruit_amount < 0).length,
    [spiritTx],
  )
  const rewardReceived = useMemo(
    () => (spiritTx || []).filter((row) => (row.kind === 'tip' || row.kind === 'gift') && row.fruit_amount > 0).length,
    [spiritTx],
  )

  useEffect(() => {
    if (!profileOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) setProfileOpen(false)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [profileOpen, saving])

  const displayNameValue = user?.display_name || (lang === 'zh' ? '本地用户' : 'Local user')
  const initial = displayNameValue.trim().charAt(0).toUpperCase() || 'U'
  const avatarUrl = user?.avatar_url ? resolveMediaUrl(user.avatar_url) : ''
  const joined = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : '—'

  const achievements = useMemo(() => [
    { label: text.builtWorlds, value: formatCount(counts.worlds), icon: Globe2 },
    { label: text.shapedCharacters, value: formatCount(counts.characters), icon: UserRound },
    { label: text.finishedWorks, value: formatCount(counts.works), icon: BookOpen },
    { label: text.storyProjects, value: formatCount(counts.storylines), icon: Route },
  ], [counts, text])

  const openEditProfile = () => {
    setDisplayName(user?.display_name || '')
    setBioDraft(profile.bio)
    setBackgroundDraft(profile.background)
    setIdentityDraft(profile.creatorIdentity)
    setSaveError('')
    setProfileOpen(true)
  }

  const saveProfile = async () => {
    const nextName = displayName.trim()
    if (!nextName) {
      setSaveError(text.nicknameRequired)
      return
    }
    setSaving(true)
    setSaveError('')
    try {
      let nextUser = user
      if (user && nextName !== user.display_name) {
        nextUser = await updateUserDisplayName(nextName)
      }
      const nextProfile: LocalProfile = {
        bio: bioDraft.trim(),
        background: backgroundDraft.trim(),
        creatorIdentity: identityDraft,
      }
      localStorage.setItem(localProfileKey(user?.id || 'local'), JSON.stringify(nextProfile))
      setProfile(nextProfile)
      if (nextUser) onUserUpdated(nextUser)
      setProfileOpen(false)
    } catch (error: any) {
      setSaveError(`${text.saveFailed}: ${error?.message || error}`)
    } finally {
      setSaving(false)
    }
  }

  const assetRows: Array<{
    key: keyof Counts
    label: string
    icon: typeof Globe2
    target?: UserAssetTarget
    note?: string
  }> = [
    { key: 'worlds', label: text.assetWorlds, icon: Globe2, target: 'worlds' },
    { key: 'characters', label: text.assetCharacters, icon: UserRound, target: 'characters' },
    { key: 'storylines', label: text.assetStorylines, icon: Route, target: 'storylines' },
    { key: 'templates', label: text.assetTemplates, icon: LayoutTemplate, note: text.noTemplates },
    { key: 'works', label: text.assetWorks, icon: BookOpen, target: 'works' },
  ]

  return (
    <div className="uc-content">
      <section className="uc-hero">
        <div>
          <div className="uc-eyebrow">{text.eyebrow}</div>
          <h1>{text.title}</h1>
        </div>
      </section>

      {/* 身份卡片：资料、创作身份与社交计数合并为一张卡片 */}
      <section className="uc-identity-card">
        <div className="uc-profile-body">
          <div className={`uc-avatar-large${avatarUrl ? ' has-image' : ''}`}>{avatarUrl ? <img src={avatarUrl} alt="" /> : initial}</div>
          <div className="uc-profile-heading">
            <div className="uc-name-row">
              <h2>{displayNameValue}</h2>
              <span className="uc-badge">{user?.is_owner ? text.owner : text.localAccount}</span>
            </div>
            <p>@{user?.username || 'local'} · {text.memberSince} {joined}</p>
          </div>
        </div>
        <div className="uc-profile-copy">
          <div>
            <span>{text.bio}</span>
            <p className={profile.bio ? '' : 'muted'}>{profile.bio || text.emptyBio}</p>
          </div>
          <div>
            <span>{text.background}</span>
            <p className={profile.background ? '' : 'muted'}>{profile.background || text.emptyBackground}</p>
          </div>
        </div>
        <div className="uc-identity-row">
          <span className="uc-identity-icon"><Sparkles aria-hidden="true" strokeWidth={1.6} /></span>
          <div>
            <span>{text.creatorIdentity}</span>
            <strong>{text.creatorTitles[profile.creatorIdentity]}</strong>
          </div>
          <button type="button" className="uc-ghost-button" onClick={openEditProfile}>
            <Pencil aria-hidden="true" strokeWidth={1.7} />
            {text.editIdentity}
          </button>
        </div>
        <div className="uc-identity-stats">
          <div><strong>{formatCount(counts.worlds)}</strong><span>{text.worlds}</span></div>
          <div><strong>{formatCount(counts.characters)}</strong><span>{text.characters}</span></div>
          <div><strong>{formatCount(counts.works)}</strong><span>{text.works}</span></div>
          <div><strong>{formatCount(socialProfile?.stats?.following)}</strong><span>{text.following}</span></div>
          <div><strong>{formatCount(socialProfile?.stats?.followers)}</strong><span>{text.followers}</span></div>
          <div><strong>{formatCount(socialProfile?.stats?.friends)}</strong><span>{text.friends}</span></div>
        </div>

      </section>

      {/* 操作按钮区：收藏 / 点赞 / 推荐 / 打赏 / 浏览历史 / 账户与资产 */}
      <div className="uc-action-bar" role="tablist" aria-label={lang === 'zh' ? '个人中心操作' : 'Personal center actions'}>
        {([
          ['works', text.tabWorks, BookOpen],
          ['activity', text.tabActivity, Activity],
          ['favorites', text.tabFavorites, Heart],
          ['likes', text.tabLikes, ThumbsUp],
          ['recommend', text.tabRecommend, Sparkles],
          ['reward', text.tabReward, Gift],
          ['history', text.tabHistory, History],
          ['content', text.tabContent, BarChart3],
          ['assets', text.tabAssets, Boxes],
        ] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={activeTab === key}
            className={`uc-action-button${activeTab === key ? ' is-active' : ''}`}
            onClick={() => setActiveTab(key)}
          >
            <Icon aria-hidden="true" strokeWidth={1.6} />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'content' && (
        <section className="uc-panel" role="tabpanel">
          <div className="uc-panel-head">
            <div>
              <span className="uc-card-kicker">DATA</span>
              <h2>{text.content}</h2>
            </div>
          </div>
          <div className="uc-level-row">
            <div className="uc-level-card">
              <span className="uc-card-kicker">CREATOR</span>
              <div className="uc-level-head">
                <strong>{text.creatorLevel}</strong>
                <span>Lv.{socialProfile?.stats?.creator_level.level} · {socialProfile?.stats?.creator_level.label}</span>
              </div>
              <div className="uc-level-bar">
                <span style={{ width: `${Math.round((socialProfile?.stats?.creator_level.progress || 0) * 100)}%` }} />
              </div>
              <p className="uc-card-footnote">{socialProfile?.stats?.creator_level.score} → {socialProfile?.stats?.creator_level.next_threshold} {text.levelProgress}</p>
            </div>
            <div className="uc-level-card">
              <span className="uc-card-kicker">FOLLOWER</span>
              <div className="uc-level-head">
                <strong>{text.followerLevel}</strong>
                <span>Lv.{socialProfile?.stats?.follower_level.level} · {socialProfile?.stats?.follower_level.label}</span>
              </div>
              <div className="uc-level-bar">
                <span style={{ width: `${Math.round((socialProfile?.stats?.follower_level.progress || 0) * 100)}%` }} />
              </div>
              <p className="uc-card-footnote">{socialProfile?.stats?.follower_level.score} → {socialProfile?.stats?.follower_level.next_threshold} {text.levelProgress}</p>
            </div>
            <div className="uc-level-card">
              <span className="uc-card-kicker">ACTIVITY</span>
              <div className="uc-level-head">
                <strong>{text.activityLevel}</strong>
                <span>Lv.{socialProfile?.stats?.activity_level.level} · {socialProfile?.stats?.activity_level.label}</span>
              </div>
              <div className="uc-level-bar">
                <span style={{ width: `${Math.round((socialProfile?.stats?.activity_level.progress || 0) * 100)}%` }} />
              </div>
              <p className="uc-card-footnote">{socialProfile?.stats?.activity_level.score} → {socialProfile?.stats?.activity_level.next_threshold} {text.levelProgress}</p>
            </div>
            <div className="uc-level-card">
              <span className="uc-card-kicker">TIP · OUT</span>
              <div className="uc-level-head">
                <strong>{text.tipLevelGiven}</strong>
                <span>Lv.{socialProfile?.stats?.tip_level_given?.level ?? 1} · {socialProfile?.stats?.tip_level_given?.label ?? text.tipLevelGiven}</span>
              </div>
              <div className="uc-level-bar">
                <span style={{ width: `${Math.round((socialProfile?.stats?.tip_level_given?.progress ?? 0) * 100)}%` }} />
              </div>
              <p className="uc-card-footnote">{socialProfile?.stats?.tip_given ?? 0} {lang === 'zh' ? '灵果' : 'fruit'}</p>
            </div>
            <div className="uc-level-card">
              <span className="uc-card-kicker">TIP · IN</span>
              <div className="uc-level-head">
                <strong>{text.tipLevelReceived}</strong>
                <span>Lv.{socialProfile?.stats?.tip_level_received?.level ?? 1} · {socialProfile?.stats?.tip_level_received?.label ?? text.tipLevelReceived}</span>
              </div>
              <div className="uc-level-bar">
                <span style={{ width: `${Math.round((socialProfile?.stats?.tip_level_received?.progress ?? 0) * 100)}%` }} />
              </div>
              <p className="uc-card-footnote">{socialProfile?.stats?.tip_received ?? 0} {lang === 'zh' ? '灵果' : 'fruit'}</p>
            </div>
          </div>
          <div className="uc-analytics-title">
            <span>{text.analytics}</span>
            <button
              type="button"
              className={`uc-privacy-toggle${statsUnlocked ? ' is-unlocked' : ''}`}
              onClick={toggleStatsUnlock}
            >
              {statsUnlocked ? <Unlock aria-hidden="true" strokeWidth={1.6} /> : <Lock aria-hidden="true" strokeWidth={1.6} />}
              {statsUnlocked ? text.statsPublic : text.statsPrivate}
            </button>
          </div>
          {statsUnlocked ? (
            <div className="uc-analytics-grid">
              <div><strong>{formatCount(socialProfile?.stats?.works)}</strong><span>{text.publishedWorks}</span></div>
              <div><strong>{formatCount(socialProfile?.stats?.drafts)}</strong><span>{text.drafts}</span></div>
              <div><strong>{formatCount(socialProfile?.stats?.total_reads)}</strong><span>{text.totalReads}</span></div>
              <div><strong>{formatCount(socialProfile?.stats?.total_clicks)}</strong><span>{text.totalClicks}</span></div>
              <div><strong>{formatCount(socialProfile?.stats?.total_likes)}</strong><span>{text.likes}</span></div>
              <div><strong>{formatCount(socialProfile?.stats?.total_favorites)}</strong><span>{text.favorites}</span></div>
              <div><strong>{formatCount(socialProfile?.stats?.total_comments)}</strong><span>{text.totalComments}</span></div>
              <div><strong>{formatCount(socialProfile?.stats?.followers)}</strong><span>{text.followers}</span></div>
              <div><strong>{formatCount(socialProfile?.stats?.following)}</strong><span>{text.following}</span></div>
            </div>
          ) : (
            <>
              <div className="uc-inline-empty uc-inline-empty--lock">
                <LockKeyhole aria-hidden="true" strokeWidth={1.5} />
                <span>{text.statsLocked}</span>
              </div>
              <p className="uc-card-footnote">{text.statsPrivateNote}</p>
            </>
          )}
        </section>
      )}

      {activeTab === 'works' && (
        <section className="uc-panel" role="tabpanel">
          <div className="uc-panel-head">
            <div>
              <span className="uc-card-kicker">WORKS</span>
              <h2>{text.tabWorks}</h2>
            </div>
            <button type="button" className="uc-ghost-button" onClick={onOpenWorks}>
              {text.allWorks}
              <ArrowUpRight aria-hidden="true" strokeWidth={1.7} />
            </button>
          </div>
          {works === null ? (
            <div className="uc-inline-empty">{text.loading}…</div>
          ) : works.length === 0 ? (
            <div className="uc-inline-empty">{text.noWorks}</div>
          ) : (
            <div className="uc-work-list">
              {works.map((work) => (
                <button type="button" className="uc-work-row" key={work.id} onClick={onOpenWorks}>
                  <span className={`uc-work-cover${work.cover_url ? '' : ' is-empty'}`}>
                    {work.cover_url ? <img src={resolveMediaUrl(work.cover_url)} alt="" loading="lazy" /> : <BookOpen aria-hidden="true" strokeWidth={1.5} />}
                  </span>
                  <span className="uc-work-copy">
                    <strong>{work.title}</strong>
                    <span>{work.status === 'completed' ? (lang === 'zh' ? '已完成' : 'Completed') : work.status === 'in_progress' ? (lang === 'zh' ? '创作中' : 'In progress') : work.status === 'archived' ? (lang === 'zh' ? '已归档' : 'Archived') : text.workDraft}</span>
                  </span>
                  <ArrowUpRight className="uc-row-arrow" aria-hidden="true" strokeWidth={1.8} />
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === 'activity' && (
        <section className="uc-panel" role="tabpanel">
          <div className="uc-panel-head">
            <div>
              <span className="uc-card-kicker">ACTIVITY</span>
              <h2>{text.tabActivity}</h2>
            </div>
          </div>
          <div className="uc-action-stat">
            <strong>{formatCount(socialProfile?.stats?.posts)}</strong>
            <span>{text.tabActivity}</span>
          </div>
          <div className="uc-checkin-card">
            <div className="uc-checkin-info">
              <CalendarCheck aria-hidden="true" strokeWidth={1.6} />
              <div>
                <strong>{text.checkin}</strong>
                <span>
                  {checkin ? `${checkin.streak} ${text.checkinStreak} · ${checkin.checkin_count} ${text.checkinCount}` : text.loading}
                </span>
              </div>
            </div>
            <button
              type="button"
              className="uc-ghost-button"
              disabled={!!checkin?.checked_in_today}
              onClick={() => void doCheckinNow()}
            >
              {checkin?.checked_in_today ? text.checkinToday : text.checkinAction}
            </button>
          </div>
          {checkinNote ? <p className="uc-card-footnote">{checkinNote}</p> : null}
          {socialProfile && socialProfile.posts.length > 0 ? (
            <div className="uc-activity-list">
              {socialProfile.posts.map((post) => (
                <div className="uc-activity-row" key={post.id}>
                  <div className="uc-activity-main">
                    {post.body && <span className="uc-activity-body">{post.body}</span>}
                    {(post.media_urls?.length ?? 0) > 0 && (
                      <div className={`uc-activity-media size-${Math.min(post.media_urls.length, 3)}`}>
                        {post.media_urls.slice(0, 3).map((url) => (
                          <img key={url} src={resolveMediaUrl(url)} alt="" loading="lazy" />
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="uc-activity-meta">
                    <span>{formatCount(post.like_count)} {text.likes}</span>
                    <span>{formatCount(post.comment_count)} {text.totalComments}</span>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="uc-inline-empty">{text.noActivity}</div>
          )}
        </section>
      )}

      {activeTab === 'favorites' && (
        <section className="uc-panel" role="tabpanel">
          <div className="uc-panel-head">
            <div>
              <span className="uc-card-kicker">FAVORITES</span>
              <h2>{text.favorites}</h2>
            </div>
            <div className="uc-folder-create">
              <input
                aria-label={text.folderName}
                placeholder={text.folderName}
                value={newFolder}
                onChange={(event) => setNewFolder(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') void submitFolder() }}
              />
              <button type="button" className="uc-ghost-button" onClick={() => void submitFolder()}>
                <FolderPlus aria-hidden="true" strokeWidth={1.6} />
                {text.createFolder}
              </button>
            </div>
          </div>
          <div className="uc-action-stat">
            <strong>{favorites ? favorites.total : 0}</strong>
            <span>{text.favorites}</span>
          </div>
          {favorites && favorites.folders.length > 0 ? (
            <div className="uc-folder-row">
              {favorites.folders.map((folder) => (
                <span className="uc-folder-chip" key={folder.id}>
                  {folder.name}
                  <button
                    type="button"
                    aria-label={text.removeFolder}
                    onClick={async () => {
                      await deleteFavoriteFolder(folder.id).catch(() => undefined)
                      const fav = await listFavorites().catch(() => null)
                      if (fav) setFavorites(fav)
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          ) : null}
          {favorites === null ? (
            <div className="uc-inline-empty">{text.loading}…</div>
          ) : favorites.items.length === 0 ? (
            <div className="uc-inline-empty">{text.favoriteEmpty}</div>
          ) : (
            <div className="uc-fav-list">
              {favorites.items.map((item) => (
                <div className="uc-fav-row" key={item.id}>
                  <span className={`uc-fav-type uc-fav-type--${item.target_type}`}>
                    {item.target_type === 'work' ? (lang === 'zh' ? '作品' : 'Work') : item.target_type === 'character' ? (lang === 'zh' ? '角色' : 'Character') : item.target_type === 'world' ? (lang === 'zh' ? '世界' : 'World') : (lang === 'zh' ? '动态' : 'Post')}
                  </span>
                  <span className="uc-fav-title">{item.title}</span>
                  <button
                    type="button"
                    className="uc-ghost-button uc-fav-remove"
                    onClick={async () => {
                      await removeFavorite(item.target_type, item.target_id).catch(() => undefined)
                      const fav = await listFavorites().catch(() => null)
                      if (fav) setFavorites(fav)
                    }}
                  >
                    {lang === 'zh' ? '取消收藏' : 'Remove'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === 'likes' && (
        <section className="uc-panel" role="tabpanel">
          <div className="uc-panel-head">
            <div>
              <span className="uc-card-kicker">LIKES</span>
              <h2>{text.likes}</h2>
            </div>
          </div>
          <div className="uc-action-stat">
            <strong>{formatCount(socialProfile?.stats?.total_likes)}</strong>
            <span>{text.likes}</span>
          </div>
          <div className="uc-inline-empty">{text.likesEmpty}</div>
        </section>
      )}

      {activeTab === 'recommend' && (
        <section className="uc-panel" role="tabpanel">
          <div className="uc-panel-head">
            <div>
              <span className="uc-card-kicker">RECOMMEND</span>
              <h2>{text.recommend}</h2>
            </div>
          </div>
          {recommendations === null ? (
            <div className="uc-inline-empty">{text.loading}…</div>
          ) : recommendations.length === 0 ? (
            <div className="uc-inline-empty">{text.recommendEmpty}</div>
          ) : (
            <div className="uc-fav-list">
              {recommendations.map((item) => (
                <div className="uc-fav-row" key={item.id}>
                  <span className="uc-fav-type uc-fav-type--work">{lang === 'zh' ? '作品' : 'Work'}</span>
                  <span className="uc-fav-title">{item.title}</span>
                  <span className="uc-fav-meta">{item.like_count} {text.likes}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === 'reward' && (
        <section className="uc-panel" role="tabpanel">
          <div className="uc-panel-head">
            <div>
              <span className="uc-card-kicker">REWARD</span>
              <h2>{text.reward}</h2>
            </div>
          </div>
          <div className="uc-reward-grid">
            <div className="uc-reward-card">
              <div className="uc-reward-head">
                <span className="uc-card-kicker">OUTGOING</span>
                <strong>{text.rewardGiven}</strong>
              </div>
              <div className="uc-action-stat">
                <strong>{rewardGiven}</strong>
                <span>{text.rewardGiven}</span>
              </div>
              <p className="uc-card-footnote">{text.rewardGivenEmpty}</p>
            </div>
            <div className="uc-reward-card">
              <div className="uc-reward-head">
                <span className="uc-card-kicker">INCOMING</span>
                <strong>{text.rewardReceived}</strong>
              </div>
              <div className="uc-action-stat">
                <strong>{rewardReceived}</strong>
                <span>{text.rewardReceived}</span>
              </div>
              <p className="uc-card-footnote">{text.rewardReceivedEmpty}</p>
            </div>
          </div>
          <button type="button" className="uc-ghost-button" onClick={onOpenSpirit}>
            <Sprout aria-hidden="true" strokeWidth={1.6} />
            {lang === 'zh' ? '打开灵果资源中心' : 'Open Spirit Resources'}
          </button>
        </section>
      )}

      {activeTab === 'history' && (
        <section className="uc-panel" role="tabpanel">
          <div className="uc-panel-head">
            <div>
              <span className="uc-card-kicker">HISTORY</span>
              <h2>{text.history}</h2>
            </div>
          </div>
          {historyRows === null ? (
            <div className="uc-inline-empty">{text.loading}…</div>
          ) : historyRows.length === 0 ? (
            <div className="uc-inline-empty">{text.historyEmpty}</div>
          ) : (
            <div className="uc-fav-list">
              {historyRows.map((item) => (
                <div className="uc-fav-row" key={item.id}>
                  <span className={`uc-fav-type uc-fav-type--${item.target_type}`}>
                    {item.target_type === 'work' ? (lang === 'zh' ? '作品' : 'Work') : item.target_type === 'character' ? (lang === 'zh' ? '角色' : 'Character') : (lang === 'zh' ? '世界' : 'World')}
                  </span>
                  <span className="uc-fav-title">{item.title}</span>
                  <span className="uc-fav-meta">{formatDate(item.created_at, lang)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === 'assets' && (
        <section className="uc-panel" role="tabpanel">
          <div className="uc-panel-head">
            <div>
              <span className="uc-card-kicker">ACCOUNT</span>
              <h2>{text.assetsAchievements}</h2>
            </div>
            <button type="button" className="uc-ghost-button" onClick={onOpenSettings} style={{ color: 'var(--text-main)' }}>
              <ShieldCheck aria-hidden="true" strokeWidth={1.6} />
              {lang === 'zh' ? '打开设置中心' : 'Open settings'}
            </button>
          </div>
          <div className="uc-achievement-grid">
            {achievements.map(({ label, value, icon: Icon }) => (
              <div className="uc-achievement" key={label}>
                <Icon aria-hidden="true" strokeWidth={1.5} />
                <strong>{value}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
          <div className="uc-asset-list">
            {assetRows.map(({ key, label, icon: Icon, target, note }) => {
              const content = (
                <>
                  <span className="uc-asset-icon"><Icon aria-hidden="true" strokeWidth={1.6} /></span>
                  <span className="uc-asset-name">{label}</span>
                  <span className="uc-asset-count">{formatCount(counts[key])}</span>
                  {target && <ArrowUpRight className="uc-row-arrow" aria-hidden="true" strokeWidth={1.8} />}
                  {note && <span className="uc-asset-note">{note}</span>}
                </>
              )
              return target ? (
                <button type="button" className="uc-asset-row" key={key} onClick={() => onOpenAsset(target)}>
                  {content}
                </button>
              ) : (
                <div className="uc-asset-row static" key={key}>{content}</div>
              )
            })}
          </div>
          <div className="uc-info-list">
            <div><span><LockKeyhole aria-hidden="true" strokeWidth={1.5} />{text.security}</span><strong>{text.securityValue}</strong></div>
            <div><span><UserRound aria-hidden="true" strokeWidth={1.5} />{text.loginMethod}</span><strong>{text.loginValue}</strong></div>
            <div><span><ShieldCheck aria-hidden="true" strokeWidth={1.5} />{text.privacy}</span><strong>{text.privacyValue}</strong></div>
            <div><span><Crown aria-hidden="true" strokeWidth={1.5} />{text.accountRole}</span><strong>{user?.is_owner ? text.roleOwner : text.roleLocal}</strong></div>
          </div>
          <button type="button" className="uc-signout" onClick={onLogout}>
            <LogOut aria-hidden="true" strokeWidth={1.6} />
            {text.signOut}
          </button>
        </section>
      )}
      {/* 账户服务已统一在灵果资源中心，不再在本页重复展示现金商业入口。 */}
      

      {profileOpen && (
        <div className="uc-modal-backdrop" onClick={() => { if (!saving) setProfileOpen(false) }}>
          <div className="uc-modal" role="dialog" aria-modal="true" aria-label={text.modalTitle} onClick={(event) => event.stopPropagation()}>
            <div className="uc-modal-head">
              <div>
                <span className="uc-card-kicker">PROFILE</span>
                <h2>{text.modalTitle}</h2>
              </div>
              <button type="button" className="uc-modal-close" onClick={() => setProfileOpen(false)} aria-label={text.cancel}>×</button>
            </div>
            <div className="uc-form">
              <div className="uc-avatar-edit">
                <span className={`uc-avatar-large small${avatarUrl ? ' has-image' : ''}`}>{avatarUrl ? <img src={avatarUrl} alt="" /> : displayName.trim().charAt(0).toUpperCase() || initial}</span>
                <span>{text.avatar}<small>{text.avatarNote}</small></span>
              </div>
              <label>
                <span>{text.nickname}</span>
                <input value={displayName} maxLength={80} onChange={(event) => setDisplayName(event.target.value)} />
              </label>
              <label>
                <span>{text.identity}</span>
                <select value={identityDraft} onChange={(event) => setIdentityDraft(event.target.value as CreatorIdentity)}>
                  {CREATOR_IDENTITIES.map((identity) => (
                    <option key={identity} value={identity}>{text.creatorTitles[identity]}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>{text.bioField}</span>
                <textarea value={bioDraft} maxLength={160} rows={3} placeholder={text.bioPlaceholder} onChange={(event) => setBioDraft(event.target.value)} />
              </label>
              <label>
                <span>{text.backgroundField}</span>
                <textarea value={backgroundDraft} maxLength={240} rows={4} placeholder={text.backgroundPlaceholder} onChange={(event) => setBackgroundDraft(event.target.value)} />
              </label>
              <p className="uc-form-note">{text.localNote}</p>
              {saveError && <p className="uc-form-error">{saveError}</p>}
            </div>
            <div className="uc-modal-actions">
              <button type="button" className="uc-ghost-button" onClick={() => setProfileOpen(false)} disabled={saving}>{text.cancel}</button>
              <button type="button" className="uc-primary" onClick={() => void saveProfile()} disabled={saving}>
                {saving ? text.saving : text.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
