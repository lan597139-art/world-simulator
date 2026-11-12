import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import {
  AlertCircle,
  Bell,
  Check,
  Database,
  Download,
  Info,
  KeyRound,
  LockKeyhole,
  LogOut,
  MonitorSmartphone,
  RefreshCw,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UserRound,
} from 'lucide-react'
import type { AuthUser } from '../api/auth'
import {
  changePassword,
  exportSettingsData,
  getSettings,
  getSettingsAbout,
  listSettingsSessions,
  revokeSettingsSession,
  updateProfile,
  updateSettings,
  type AuthSessionRow,
  type SettingsData,
  type SettingsNotifications,
  type SettingsPreferences,
  type SettingsPrivacy,
} from '../api/settings'
import '../styles/settings.css'
import { applyExperience } from '../utils/experience'

type Lang = 'zh' | 'en'
type Section = 'profile' | 'account' | 'privacy' | 'notifications' | 'experience' | 'data' | 'about'

const SECTIONS: { key: Section; zh: string; en: string; descZh: string; icon: ReactNode }[] = [
  { key: 'profile', zh: '个人资料与偏好', en: 'Profile & preferences', descZh: '昵称、简介与公开形象', icon: <UserRound size={17} strokeWidth={1.6} /> },
  { key: 'account', zh: '账户与安全', en: 'Account & security', descZh: '密码、登录会话与开发者身份', icon: <LockKeyhole size={17} strokeWidth={1.6} /> },
  { key: 'privacy', zh: '隐私与权限', en: 'Privacy & permissions', descZh: '谁可以关注、加好友与查看动态', icon: <ShieldCheck size={17} strokeWidth={1.6} /> },
  { key: 'notifications', zh: '通知与提醒', en: 'Notifications', descZh: '社区回复、好友与系统提醒', icon: <Bell size={17} strokeWidth={1.6} /> },
  { key: 'experience', zh: '使用体验', en: 'Experience', descZh: '语言、主题、密度与动效', icon: <SlidersHorizontal size={17} strokeWidth={1.6} /> },
  { key: 'data', zh: '数据与存储', en: 'Data & storage', descZh: '统计、导出与本地缓存', icon: <Database size={17} strokeWidth={1.6} /> },
  { key: 'about', zh: '关于与帮助', en: 'About & help', descZh: '版本、后端状态与文档', icon: <Info size={17} strokeWidth={1.6} /> },
]

const card: CSSProperties = {
  border: '1px solid var(--card-border)', borderRadius: 14, background: 'var(--card-bg)',
  boxSizing: 'border-box',
}
const input: CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 8,
  border: '1px solid var(--card-border)', background: 'var(--bg-color)',
  color: 'var(--text-main)', fontSize: 12, lineHeight: 1.6,
}
const textarea: CSSProperties = { ...input, minHeight: 92, resize: 'vertical' }
const primary: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 13px', borderRadius: 8,
  border: '1px solid var(--primary-color)', background: 'var(--primary-color)',
  color: 'var(--primary-text)', fontSize: 11.5, fontWeight: 650, cursor: 'pointer',
}
const ghost: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 13px', borderRadius: 8,
  border: '1px solid var(--card-border)', background: 'transparent',
  color: 'var(--text-main)', fontSize: 11.5, cursor: 'pointer',
}
const dangerGhost: CSSProperties = { ...ghost, color: 'var(--danger-color)', borderColor: 'color-mix(in srgb, var(--danger-color) 40%, var(--card-border))' }

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: 13 }}>
      <span style={{ display: 'block', fontSize: 10.5, fontWeight: 650, color: 'var(--text-main)', marginBottom: 6 }}>{label}</span>
      {children}
      {hint && <span style={{ display: 'block', marginTop: 5, fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.6 }}>{hint}</span>}
    </label>
  )
}

function Toggle({ checked, onChange, title, desc }: { checked: boolean; onChange: (value: boolean) => void; title: string; desc: string }) {
  return (
    <div className="settings-toggle-row">
      <div style={{ minWidth: 0 }}>
        <strong style={{ display: 'block', fontSize: 11.5, color: 'var(--text-main)' }}>{title}</strong>
        <span style={{ display: 'block', marginTop: 3, fontSize: 10, lineHeight: 1.6, color: 'var(--text-muted)' }}>{desc}</span>
      </div>
      <button
        type="button"
        className={`settings-switch ${checked ? 'is-on' : ''}`}
        role="switch"
        aria-checked={checked}
        aria-label={title}
        onClick={() => onChange(!checked)}
      >
        <span />
      </button>
    </div>
  )
}

function Panel({ title, subtitle, children, aside }: { title: string; subtitle: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section style={{ ...card, padding: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 17, letterSpacing: '-0.01em' }}>{title}</h2>
          <p style={{ margin: '5px 0 0', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.7 }}>{subtitle}</p>
        </div>
        {aside}
      </div>
      {children}
    </section>
  )
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  try { return new Date(value).toLocaleString() } catch { return value }
}

function formatBytes(bytes: number) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

export default function SettingsPage({
  lang,
  user,
  onUserUpdated,
  onLangChange,
  onOpenAiSettings,
  onLogout,
}: {
  lang: Lang
  user: AuthUser | null
  onUserUpdated: (user: AuthUser) => void
  onLangChange: (lang: Lang) => void
  onOpenAiSettings: () => void
  onLogout: () => void
}) {
  const [section, setSection] = useState<Section>('profile')
  const [data, setData] = useState<SettingsData | null>(null)
  const [sessions, setSessions] = useState<AuthSessionRow[]>([])
  const [about, setAbout] = useState<Awaited<ReturnType<typeof getSettingsAbout>> | null>(null)
  const [profileDraft, setProfileDraft] = useState({ display_name: '', bio: '', avatar: '' })
  const [passwords, setPasswords] = useState({ current_password: '', new_password: '', confirm: '' })
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [flash, setFlash] = useState('')

  const load = async () => {
    setError('')
    try {
      const [next, nextSessions, nextAbout] = await Promise.all([
        getSettings(), listSettingsSessions(), getSettingsAbout(),
      ])
      setData(next)
      setSessions(nextSessions)
      setAbout(nextAbout)
      setProfileDraft({
        display_name: next.profile.display_name || '',
        bio: next.profile.bio || '',
        avatar: next.profile.avatar || '',
      })
      applyExperience(next.preferences)
    } catch (err: any) {
      setError(String(err?.message || err))
    }
  }

  useEffect(() => { void load() }, [])

  useEffect(() => {
    if (!flash) return
    const timer = window.setTimeout(() => setFlash(''), 2800)
    return () => window.clearTimeout(timer)
  }, [flash])

  const preference = <K extends keyof SettingsPreferences>(key: K, value: SettingsPreferences[K]) => {
    setData((current) => current ? { ...current, preferences: { ...current.preferences, [key]: value } } : current)
    const next = data ? { ...data.preferences, [key]: value } : null
    if (next) applyExperience(next)
    if (key === 'language' && (value === 'zh' || value === 'en') && value !== lang) onLangChange(value)
  }
  const privacy = <K extends keyof SettingsPrivacy>(key: K, value: SettingsPrivacy[K]) => {
    setData((current) => current ? { ...current, privacy: { ...current.privacy, [key]: value } } : current)
  }
  const notification = <K extends keyof SettingsNotifications>(key: K, value: SettingsNotifications[K]) => {
    setData((current) => current ? { ...current, notifications: { ...current.notifications, [key]: value } } : current)
  }

  const saveSettings = async () => {
    if (!data) return
    setBusy('settings'); setError(''); setFlash('')
    try {
      const next = await updateSettings({
        preferences: data.preferences,
        privacy: data.privacy,
        notifications: data.notifications,
      })
      setData(next)
      applyExperience(next.preferences)
      setFlash('设置已保存')
    } catch (err: any) { setError(String(err?.message || err)) }
    finally { setBusy('') }
  }

  const saveProfile = async () => {
    setBusy('profile'); setError(''); setFlash('')
    try {
      const next = await updateProfile(profileDraft)
      setData((current) => current ? { ...current, profile: next } : current)
      onUserUpdated({ ...(user || { id: next.id, username: next.username }), ...next } as AuthUser)
      setFlash('个人资料已更新')
    } catch (err: any) { setError(String(err?.message || err)) }
    finally { setBusy('') }
  }

  const submitPassword = async () => {
    if (passwords.new_password !== passwords.confirm) { setError('两次输入的新密码不一致'); return }
    setBusy('password'); setError(''); setFlash('')
    try {
      const result = await changePassword({
        current_password: passwords.current_password,
        new_password: passwords.new_password,
      })
      setPasswords({ current_password: '', new_password: '', confirm: '' })
      setFlash(result.message || '密码已更新')
      setSessions(await listSettingsSessions())
    } catch (err: any) { setError(String(err?.message || err)) }
    finally { setBusy('') }
  }

  const revoke = async (id: string) => {
    setBusy(`session:${id}`); setError('')
    try {
      await revokeSettingsSession(id)
      setSessions(await listSettingsSessions())
      setFlash('该设备已退出登录')
    } catch (err: any) { setError(String(err?.message || err)) }
    finally { setBusy('') }
  }

  const download = async () => {
    setBusy('export'); setError('')
    try {
      const result = await exportSettingsData()
      const blob = new Blob([result.content], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = result.filename
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      setFlash('数据导出已开始下载')
    } catch (err: any) { setError(String(err?.message || err)) }
    finally { setBusy('') }
  }

  const clearCache = () => {
    if (!window.confirm('只清除浏览器中的页面选择、上次世界与面板状态，不会删除账户、世界、作品或聊天数据。继续吗？')) return
    const keep = new Set(['ws.authToken', 'ws.authUser'])
    const keys: string[] = []
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (key && key.startsWith('ws.') && !keep.has(key)) keys.push(key)
    }
    keys.forEach((key) => localStorage.removeItem(key))
    setFlash(`已清除 ${keys.length} 项本地界面缓存`)
  }

  const stats = useMemo(() => data ? [
    ['世界', data.stats.worlds], ['人物', data.stats.characters], ['事件', data.stats.events],
    ['作品', data.stats.stories], ['日记', data.stats.journal_entries], ['公开作品', data.stats.publications],
  ] : [], [data])

  if (error && !data) {
    return (
      <div className="settings-page">
        <div style={{ ...card, padding: 24, borderColor: 'var(--danger-color)' }}>
          <strong style={{ fontSize: 13 }}>无法读取设置中心</strong>
          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{error}</p>
          <button type="button" style={primary} onClick={() => void load()}><RefreshCw size={14} /> 重试</button>
        </div>
      </div>
    )
  }

  if (!data) return <div className="settings-page"><div className="settings-loading">正在读取设置…</div></div>

  return (
    <div className="settings-page">
      <header className="settings-hero">
        <div>
          <span className="settings-kicker">SETTINGS CENTER</span>
          <h1>设置中心</h1>
          <p>管理你的公开身份、账户安全、隐私边界与社区体验。设置只影响当前账号。</p>
        </div>
        <div className="settings-hero-user">
          <span className="settings-hero-avatar">{data.profile.avatar || (data.profile.display_name || data.profile.username).slice(0, 1)}</span>
          <div>
            <strong>{data.profile.display_name || data.profile.username}</strong>
            <span>@{data.profile.username}{data.profile.is_owner ? ' · 开发者' : ''}</span>
          </div>
        </div>
      </header>

      {error && <div className="settings-message is-error"><AlertCircle size={14} /> {error}</div>}
      {flash && <div className="settings-message is-ok"><Check size={14} /> {flash}</div>}

      <div className="settings-layout">
        <nav className="settings-nav" aria-label="设置分类">
          {SECTIONS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`settings-nav-item ${section === item.key ? 'is-active' : ''}`}
              onClick={() => { setSection(item.key); setError(''); setFlash('') }}
            >
              <span className="settings-nav-icon">{item.icon}</span>
              <span>
                <strong>{lang === 'zh' ? item.zh : item.en}</strong>
                <small>{item.descZh}</small>
              </span>
            </button>
          ))}
        </nav>

        <div className="settings-content">
          {section === 'profile' && (
            <Panel title="个人资料与偏好" subtitle="这些信息会显示在用户与身份中心、社区讨论和好友列表中。" aside={<button type="button" style={primary} disabled={busy === 'profile'} onClick={() => void saveProfile()}><Save size={14} /> {busy === 'profile' ? '保存中…' : '保存资料'}</button>}>
              <div className="settings-avatar-row">
                <span className="settings-avatar-preview">{profileDraft.avatar || (profileDraft.display_name || data.profile.username).slice(0, 1)}</span>
                <div style={{ flex: 1 }}>
                  <Field label="头像符号" hint="可用一个 emoji 或字符，例如 ☁、A、🌙。">
                    <input style={input} maxLength={16} value={profileDraft.avatar} onChange={(e) => setProfileDraft((p) => ({ ...p, avatar: e.target.value }))} />
                  </Field>
                </div>
              </div>
              <div className="settings-two-col">
                <Field label="显示名称">
                  <input style={input} maxLength={80} value={profileDraft.display_name} onChange={(e) => setProfileDraft((p) => ({ ...p, display_name: e.target.value }))} />
                </Field>
                <Field label="用户名（不可修改）">
                  <input style={{ ...input, opacity: .65 }} value={data.profile.username} readOnly />
                </Field>
              </div>
              <Field label="个人简介" hint="最多 500 字符，会出现在你的公开用户卡片上。">
                <textarea style={textarea} maxLength={500} value={profileDraft.bio} onChange={(e) => setProfileDraft((p) => ({ ...p, bio: e.target.value }))} />
              </Field>
              <div className="settings-inline-note"><Sparkles size={14} /> 开发者身份由系统所有者标记控制，不能通过此页自行切换。</div>
            </Panel>
          )}

          {section === 'account' && (
            <>
              <Panel title="账户与安全" subtitle="查看账号身份、管理登录会话，并修改本地密码。" aside={<span className={`settings-badge ${data.profile.is_owner ? 'is-owner' : ''}`}>{data.profile.is_owner ? '开发者账号' : '普通账号'}</span>}>
                <div className="settings-kv-grid">
                  <div><span>用户名</span><strong>@{data.profile.username}</strong></div>
                  <div><span>创建时间</span><strong>{formatDate(data.account.created_at)}</strong></div>
                  <div><span>当前会话</span><strong>{data.account.sessions} 个</strong></div>
                  <div><span>AI 接入</span><strong><button type="button" style={ghost} onClick={onOpenAiSettings}>打开 AI 接入设置</button></strong></div>
                </div>
              </Panel>

              <Panel title="修改密码" subtitle="修改后其他设备会被退出登录，当前浏览器保持登录。">
                <div className="settings-three-col">
                  <Field label="当前密码"><input style={input} type="password" value={passwords.current_password} onChange={(e) => setPasswords((p) => ({ ...p, current_password: e.target.value }))} /></Field>
                  <Field label="新密码"><input style={input} type="password" value={passwords.new_password} onChange={(e) => setPasswords((p) => ({ ...p, new_password: e.target.value }))} /></Field>
                  <Field label="确认新密码"><input style={input} type="password" value={passwords.confirm} onChange={(e) => setPasswords((p) => ({ ...p, confirm: e.target.value }))} /></Field>
                </div>
                <button type="button" style={primary} disabled={busy === 'password'} onClick={() => void submitPassword()}><KeyRound size={14} /> {busy === 'password' ? '更新中…' : '更新密码'}</button>
              </Panel>

              <Panel title="登录会话" subtitle="只显示当前账号的会话；撤销后该设备需要重新登录。" aside={<button type="button" style={ghost} onClick={() => void load()}><RefreshCw size={13} /> 刷新</button>}>
                <div className="settings-session-list">
                  {sessions.map((session) => (
                    <div className="settings-session-row" key={session.id}>
                      <MonitorSmartphone size={17} />
                      <div style={{ flex: 1 }}>
                        <strong>浏览器会话 {session.current ? '· 当前设备' : ''}</strong>
                        <span>建立于 {formatDate(session.created_at)} · 到期 {formatDate(session.expires_at)}</span>
                      </div>
                      {!session.current && (
                        <button type="button" style={dangerGhost} disabled={busy === `session:${session.id}`} onClick={() => void revoke(session.id)}>
                          {busy === `session:${session.id}` ? '撤销中…' : '退出此设备'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 14 }}>
                  <button type="button" style={dangerGhost} onClick={onLogout}><LogOut size={14} /> 退出当前账号</button>
                </div>
              </Panel>
            </>
          )}

          {section === 'privacy' && (
            <Panel title="隐私与权限" subtitle="控制其他用户能如何发现你、关注你并向你发起互动。" aside={<button type="button" style={primary} disabled={busy === 'settings'} onClick={() => void saveSettings()}><Save size={14} /> 保存隐私设置</button>}>
              <div className="settings-toggle-list">
                <Toggle checked={data.privacy.public_profile} onChange={(v) => privacy('public_profile', v)} title="公开个人资料" desc="允许其他用户在社区用户目录中看到昵称、头像与简介。" />
                <Toggle checked={data.privacy.show_activity} onChange={(v) => privacy('show_activity', v)} title="展示社区动态" desc="允许你的讨论、组内帖子与公开作品出现在他人动态中。" />
                <Toggle checked={data.privacy.allow_follow} onChange={(v) => privacy('allow_follow', v)} title="允许被关注" desc="关闭后，其他用户不能关注你；已有粉丝关系不受影响。" />
                <Toggle checked={data.privacy.allow_friend_requests} onChange={(v) => privacy('allow_friend_requests', v)} title="允许好友申请" desc="关闭后，新的好友申请会被后端拒绝。" />
                <Toggle checked={data.privacy.allow_group_invites} onChange={(v) => privacy('allow_group_invites', v)} title="允许小组邀请" desc="为后续邀请入组功能保留的权限开关。" />
                <Toggle checked={data.privacy.allow_ai_private_context} onChange={(v) => privacy('allow_ai_private_context', v)} title="允许 AI 使用私人背景" desc="默认关闭。开启后仍需在具体授权中确认，不会自动共享日记或记忆。" />
              </div>
              <div className="settings-inline-note"><ShieldCheck size={14} /> 隐私设置在服务端校验，不只依赖前端隐藏按钮。</div>
            </Panel>
          )}

          {section === 'notifications' && (
            <Panel title="通知与提醒" subtitle="选择希望接收的社区互动与系统提醒。" aside={<button type="button" style={primary} disabled={busy === 'settings'} onClick={() => void saveSettings()}><Save size={14} /> 保存通知设置</button>}>
              <div className="settings-toggle-list">
                <Toggle checked={data.notifications.community_reply} onChange={(v) => notification('community_reply', v)} title="讨论回复" desc="有人回复你的社区讨论时提醒。" />
                <Toggle checked={data.notifications.friend_request} onChange={(v) => notification('friend_request', v)} title="好友申请" desc="有人申请添加你为好友时提醒。" />
                <Toggle checked={data.notifications.follow} onChange={(v) => notification('follow', v)} title="新增粉丝" desc="有人关注你时提醒。" />
                <Toggle checked={data.notifications.group_activity} onChange={(v) => notification('group_activity', v)} title="小组动态" desc="小组新帖、成员申请与审批结果提醒。" />
                <Toggle checked={data.notifications.system} onChange={(v) => notification('system', v)} title="系统通知" desc="版本更新、权限变化与重要系统消息。" />
                <Toggle checked={data.notifications.weekly_digest} onChange={(v) => notification('weekly_digest', v)} title="每周摘要" desc="汇总本周的社区动态与创作更新。" />
              </div>
              <div className="settings-inline-note"><Bell size={14} /> 通知会保存在站内通知中心；当前版本不发送邮件或短信。</div>
            </Panel>
          )}

          {section === 'experience' && (
            <Panel title="使用体验" subtitle="调整语言、主题、信息密度与动效。设置会保存到当前账号。" aside={<button type="button" style={primary} disabled={busy === 'settings'} onClick={() => void saveSettings()}><Save size={14} /> 保存体验设置</button>}>
              <div className="settings-two-col">
                <Field label="界面语言" hint="切换后立即生效。">
                  <select style={input} value={data.preferences.language} onChange={(e) => preference('language', e.target.value as SettingsPreferences['language'])}>
                    <option value="zh">简体中文</option><option value="en">English</option>
                  </select>
                </Field>
                <Field label="主题">
                  <select style={input} value={data.preferences.theme} onChange={(e) => preference('theme', e.target.value as SettingsPreferences['theme'])}>
                    <option value="system">跟随系统</option><option value="light">浅色</option><option value="dark">深色</option>
                  </select>
                </Field>
                <Field label="信息密度">
                  <select style={input} value={data.preferences.density} onChange={(e) => preference('density', e.target.value as SettingsPreferences['density'])}>
                    <option value="compact">紧凑</option><option value="comfortable">舒适</option><option value="spacious">宽松</option>
                  </select>
                </Field>
                <Field label="正文大小">
                  <select style={input} value={data.preferences.font_size} onChange={(e) => preference('font_size', e.target.value as SettingsPreferences['font_size'])}>
                    <option value="small">小</option><option value="medium">中</option><option value="large">大</option>
                  </select>
                </Field>
              </div>
              <div className="settings-toggle-list">
                <Toggle checked={data.preferences.reduce_motion} onChange={(v) => preference('reduce_motion', v)} title="减少动效" desc="关闭大部分过渡与动画，适合对动态效果敏感的用户。" />
                <Toggle checked={data.preferences.show_tips} onChange={(v) => preference('show_tips', v)} title="显示操作提示" desc="在复杂编辑器中显示简短说明与引导。" />
                <Toggle checked={data.preferences.auto_save} onChange={(v) => preference('auto_save', v)} title="自动保存草稿" desc="在写作与编辑页面自动保存本地草稿。" />
              </div>
              <div className="settings-inline-note"><SlidersHorizontal size={14} /> 主题与密度会应用到整个工作区；正文大小主要影响阅读型页面。</div>
            </Panel>
          )}

          {section === 'data' && (
            <>
              <Panel title="数据与存储" subtitle="查看当前账号的数据规模。导出为 JSON 元数据，不包含密码或完整私人正文。" aside={<button type="button" style={primary} disabled={busy === 'export'} onClick={() => void download()}><Download size={14} /> {busy === 'export' ? '准备中…' : '导出数据'}</button>}>
                <div className="settings-stat-grid">
                  {stats.map(([label, value]) => (
                    <div key={String(label)}><strong>{String(value ?? 0)}</strong><span>{label}</span></div>
                  ))}
                </div>
                <div className="settings-kv-grid" style={{ marginTop: 16 }}>
                  <div><span>数据库大小</span><strong>{formatBytes(data.storage.database_bytes)}</strong></div>
                  <div><span>登录会话</span><strong>{data.stats.sessions || 0}</strong></div>
                  <div><span>人格记忆</span><strong>{data.stats.memories || 0}</strong></div>
                  <div><span>公开作品</span><strong>{data.stats.publications || 0}</strong></div>
                </div>
              </Panel>
              <Panel title="本地缓存" subtitle="页面选择、上次世界与面板状态保存在浏览器本地；清理不会删除后端数据。">
                <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                  <button type="button" style={dangerGhost} onClick={clearCache}><Trash2 size={14} /> 清除本地界面缓存</button>
                  <button type="button" style={ghost} onClick={() => window.location.reload()}><RefreshCw size={14} /> 重新载入工作区</button>
                </div>
              </Panel>
            </>
          )}

          {section === 'about' && (
            <>
              <Panel title="关于世界模拟器" subtitle="一个把世界、人物、叙事与云宝工作台放在同一处的本地创作系统。">
                <div className="settings-about-mark">W</div>
                <div className="settings-kv-grid">
                  <div><span>产品版本</span><strong>{about?.version || '1.0.0'}</strong></div>
                  <div><span>API 版本</span><strong>{about?.api_version || '1.1.0'}</strong></div>
                  <div><span>当前账号</span><strong>{data.profile.display_name} · {data.profile.is_owner ? '开发者' : '普通用户'}</strong></div>
                  <div><span>数据位置</span><strong>本机 SQLite</strong></div>
                </div>
                <p style={{ fontSize: 11, lineHeight: 1.9, color: 'var(--text-muted)', marginBottom: 0 }}>{about?.description || '游戏、文学、日记与云宝工作台一体化的世界创作系统。'}</p>
              </Panel>
              <Panel title="帮助与文档" subtitle="遇到权限、数据或 AI 接入问题时，先查看这些说明。">
                <div className="settings-link-list">
                  {(about?.docs || []).map((doc) => (
                    <button key={doc.href} type="button" style={ghost} onClick={() => window.open(doc.href, '_blank', 'noopener,noreferrer')}>{doc.title}<span style={{ color: 'var(--text-muted)' }}>↗</span></button>
                  ))}
                  <button type="button" style={ghost} onClick={onOpenAiSettings}>AI 接入与模型设置</button>
                </div>
                <div className="settings-inline-note"><Info size={14} /> {about?.support || '本地工作区由开发者维护；数据保存在本机 SQLite。'}</div>
              </Panel>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
