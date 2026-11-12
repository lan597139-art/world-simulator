import { useEffect, useMemo, useState } from 'react'
import {
  ArrowUpRight,
  BookOpen,
  Boxes,
  Crown,
  Globe2,
  Heart,
  LayoutTemplate,
  LockKeyhole,
  LogOut,
  Pencil,
  ReceiptText,
  Route,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  Wallet,
} from 'lucide-react'
import type { AuthUser } from '../api/auth'
import { API_ORIGIN } from '../api/config'
import { listStories as listStoryProjects } from '../api/storyline'
import { listStories, type StoryItem } from '../api/writing'
import { updateUserDisplayName } from '../api/users'
import { getAllWorlds } from '../services/worldService'
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

function copy(lang: Lang) {
  return lang === 'zh'
    ? {
        eyebrow: 'USER & IDENTITY',
        title: '用户与身份中心',
        subtitle: '管理个人资料、创作者身份、数字资产与账户。',
        edit: '编辑资料',
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
        worksShowcase: '作品展示',
        achievements: '创作成就',
        allWorks: '查看全部作品',
        noWorks: '还没有作品，写作会出现在这里。',
        builtWorlds: '已建立世界',
        shapedCharacters: '塑造人物',
        finishedWorks: '完成作品',
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
        loading: '读取中',
        notConnected: '尚未接入',
      }
    : {
        eyebrow: 'USER & IDENTITY',
        title: 'User & Identity Center',
        subtitle: 'Manage your profile, creator identity, digital assets, and account.',
        edit: 'Edit profile',
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
        worksShowcase: 'Selected works',
        achievements: 'Achievements',
        allWorks: 'View all works',
        noWorks: 'No works yet. Writing will appear here.',
        builtWorlds: 'Worlds built',
        shapedCharacters: 'Characters shaped',
        finishedWorks: 'Works finished',
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
        loading: 'Loading',
        notConnected: 'Not connected',
      }
}

const localProfileKey = (userId: string) => `ws.user.profile.v1.${userId}`

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

function formatCount(value: number | null) {
  return value === null ? '—' : String(value)
}

export default function UserCenterPage({
  lang,
  user,
  onUserUpdated,
  onOpenAsset,
  onOpenWorks,
  onLogout,
  onOpenSettings,
  onOpenBusiness,
}: {
  lang: Lang
  user: AuthUser | null
  onUserUpdated: (user: AuthUser) => void
  onOpenAsset: (target: UserAssetTarget) => void
  onOpenWorks: () => void
  onLogout: () => void
  onOpenSettings: () => void
  onOpenBusiness: () => void
}) {
  const text = copy(lang)
  const [counts, setCounts] = useState<Counts>({
    worlds: null, characters: null, storylines: null, templates: 0, works: null,
  })
  const [works, setWorks] = useState<StoryItem[] | null>(null)
  const [profile, setProfile] = useState<LocalProfile>(() => readLocalProfile(user?.id || 'local'))
  const [profileOpen, setProfileOpen] = useState(false)
  const [displayName, setDisplayName] = useState(user?.display_name || '')
  const [bioDraft, setBioDraft] = useState(profile.bio)
  const [backgroundDraft, setBackgroundDraft] = useState(profile.background)
  const [identityDraft, setIdentityDraft] = useState<CreatorIdentity>(profile.creatorIdentity)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

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

    void listStories()
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
    if (!profileOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) setProfileOpen(false)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [profileOpen, saving])

  const displayNameValue = user?.display_name || (lang === 'zh' ? '本地用户' : 'Local user')
  const initial = displayNameValue.trim().charAt(0).toUpperCase() || 'U'
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
          <p>{text.subtitle}</p>
        </div>
        <button type="button" className="uc-primary" onClick={openEditProfile}>
          <Pencil aria-hidden="true" strokeWidth={1.7} />
          {text.edit}
        </button>
      </section>

      <div className="uc-grid">
        <section className="uc-card uc-profile-card">
          <div className="uc-profile-cover">
            <span>MEMBER SINCE</span>
            <span>{joined}</span>
          </div>
          <div className="uc-profile-body">
            <div className="uc-avatar-large">{initial}</div>
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
          <div className="uc-profile-stats">
            <div><strong>{formatCount(counts.worlds)}</strong><span>{text.worlds}</span></div>
            <div><strong>{formatCount(counts.characters)}</strong><span>{text.characters}</span></div>
            <div><strong>{formatCount(counts.works)}</strong><span>{text.works}</span></div>
          </div>
        </section>

        <section className="uc-card uc-follows">
          <div className="uc-card-head">
            <div>
              <span className="uc-card-kicker">RELATIONSHIPS</span>
              <h2>{text.follows}</h2>
            </div>
            <Users aria-hidden="true" strokeWidth={1.5} />
          </div>
          <div className="uc-follow-counts">
            <div><strong>0</strong><span>{text.following}</span></div>
            <div><strong>0</strong><span>{text.followers}</span></div>
          </div>
          <div className="uc-follow-empty">
            <span>{text.activity}</span>
            <p>{text.followEmpty}</p>
          </div>
        </section>

        <section className="uc-card uc-creator-card">
          <div className="uc-card-head">
            <div>
              <span className="uc-card-kicker">CREATOR PROFILE</span>
              <h2>{text.creator}</h2>
            </div>
            <button type="button" className="uc-ghost-button" onClick={openEditProfile}>
              <Pencil aria-hidden="true" strokeWidth={1.7} />
              {text.editIdentity}
            </button>
          </div>

          <div className="uc-identity-row">
            <span className="uc-identity-icon"><Sparkles aria-hidden="true" strokeWidth={1.6} /></span>
            <div>
              <span>{text.creatorIdentity}</span>
              <strong>{text.creatorTitles[profile.creatorIdentity]}</strong>
            </div>
          </div>

          <div className="uc-creator-split">
            <div className="uc-works-block">
              <div className="uc-subhead">
                <h3>{text.worksShowcase}</h3>
                <button type="button" className="uc-link-button" onClick={onOpenWorks}>
                  {text.allWorks} <ArrowUpRight aria-hidden="true" strokeWidth={1.8} />
                </button>
              </div>
              {works === null ? (
                <div className="uc-inline-empty">{text.loading}…</div>
              ) : works.length === 0 ? (
                <div className="uc-inline-empty">{text.noWorks}</div>
              ) : (
                <div className="uc-work-list">
                  {works.slice(0, 3).map((work) => (
                    <button type="button" className="uc-work-row" key={work.id} onClick={onOpenWorks}>
                      <span className="uc-work-icon"><BookOpen aria-hidden="true" strokeWidth={1.6} /></span>
                      <span className="uc-work-copy">
                        <strong>{work.title}</strong>
                        <span>{work.status === 'published' ? text.workPublished : text.workDraft}</span>
                      </span>
                      <ArrowUpRight className="uc-row-arrow" aria-hidden="true" strokeWidth={1.8} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="uc-achievements">
              <h3>{text.achievements}</h3>
              <div className="uc-achievement-grid">
                {achievements.map(({ label, value, icon: Icon }) => (
                  <div className="uc-achievement" key={label}>
                    <Icon aria-hidden="true" strokeWidth={1.5} />
                    <strong>{value}</strong>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="uc-card uc-assets">
          <div className="uc-card-head">
            <div>
              <span className="uc-card-kicker">DIGITAL ASSETS</span>
              <h2>{text.assets}</h2>
            </div>
            <Boxes aria-hidden="true" strokeWidth={1.5} />
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
          <p className="uc-card-footnote">{text.assetsHint}</p>
        </section>

        <section className="uc-card uc-favorites">
          <div className="uc-card-head">
            <div>
              <span className="uc-card-kicker">SAVED</span>
              <h2>{text.favorites}</h2>
            </div>
            <Heart aria-hidden="true" strokeWidth={1.5} />
          </div>
          <div className="uc-favorite-counts">
            <div><strong>0</strong><span>{text.favoriteWorks}</span></div>
            <div><strong>0</strong><span>{text.favoriteCharacters}</span></div>
            <div><strong>0</strong><span>{text.favoriteWorlds}</span></div>
          </div>
          <div className="uc-inline-empty">{text.favoritesEmpty}</div>
          <p className="uc-card-footnote">{text.favoritesNote}</p>
        </section>

        <section className="uc-card uc-account">
          <div className="uc-card-head">
            <div>
              <span className="uc-card-kicker">ACCOUNT</span>
              <h2>{text.account}</h2>
            </div>
            <ShieldCheck aria-hidden="true" strokeWidth={1.5} />
          </div>
          <div className="uc-info-list">
            <div><span><LockKeyhole aria-hidden="true" strokeWidth={1.5} />{text.security}</span><strong>{text.securityValue}</strong></div>
            <div><span><UserRound aria-hidden="true" strokeWidth={1.5} />{text.loginMethod}</span><strong>{text.loginValue}</strong></div>
            <div><span><ShieldCheck aria-hidden="true" strokeWidth={1.5} />{text.privacy}</span><strong>{text.privacyValue}</strong></div>
            <div><span><Crown aria-hidden="true" strokeWidth={1.5} />{text.accountRole}</span><strong>{user?.is_owner ? text.roleOwner : text.roleLocal}</strong></div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="uc-signout" onClick={onOpenSettings} style={{ color: 'var(--text-main)' }}>
              <ShieldCheck aria-hidden="true" strokeWidth={1.6} />
              {lang === 'zh' ? '打开设置中心' : 'Open settings'}
            </button>
            <button type="button" className="uc-signout" onClick={onLogout}>
              <LogOut aria-hidden="true" strokeWidth={1.6} />
              {text.signOut}
            </button>
          </div>
        </section>

        <section className="uc-card uc-membership">
          <div className="uc-card-head">
            <div>
              <span className="uc-card-kicker">MEMBERSHIP</span>
              <h2>{text.membership}</h2>
            </div>
            <Crown aria-hidden="true" strokeWidth={1.5} />
          </div>
          <div className="uc-membership-status">
            <span className="uc-membership-dot" />
            <strong>{text.normalUser}</strong>
            <span>{text.notOpened}</span>
          </div>
          <div className="uc-info-list compact">
            <div><span>{text.memberLevel}</span><strong>{text.normalUser}</strong></div>
            <div><span>{text.memberBenefits}</span><strong>—</strong></div>
            <div><span>{text.memberValidity}</span><strong>—</strong></div>
          </div>
          <p className="uc-card-footnote">{text.membershipNote}</p>
          <button type="button" className="uc-signout" onClick={onOpenBusiness} style={{ color: 'var(--text-main)' }}>
            <Crown aria-hidden="true" strokeWidth={1.6} />
            {lang === 'zh' ? '进入商业与服务中心' : 'Open Business & Services'}
          </button>
        </section>

        <section className="uc-card uc-orders">
          <div className="uc-card-head">
            <div>
              <span className="uc-card-kicker">PURCHASES</span>
              <h2>{text.orders}</h2>
            </div>
            <ReceiptText aria-hidden="true" strokeWidth={1.5} />
          </div>
          <div className="uc-order-metrics">
            <div><strong>0</strong><span>{text.topups}</span></div>
            <div><strong>0</strong><span>{text.purchases}</span></div>
            <div><strong>0</strong><span>{text.orderItems}</span></div>
          </div>
          <div className="uc-inline-empty">{text.ordersEmpty}</div>
        </section>

        <section className="uc-card uc-earnings">
          <div className="uc-card-head">
            <div>
              <span className="uc-card-kicker">CREATOR FINANCE</span>
              <h2>{text.earnings}</h2>
            </div>
            <Wallet aria-hidden="true" strokeWidth={1.5} />
          </div>
          <div className="uc-earnings-body">
            <div className="uc-balance">
              <span>{text.balance}</span>
              <strong>¥0.00</strong>
            </div>
            <div className="uc-ledger">
              <div><strong>0</strong><span>{text.transactionCount}</span></div>
              <div><strong>0</strong><span>{text.withdrawCount}</span></div>
            </div>
            <p>{text.earningsEmpty}</p>
          </div>
        </section>
      </div>

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
                <span className="uc-avatar-large small">{displayName.trim().charAt(0).toUpperCase() || initial}</span>
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
