import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import {
  AlertCircle,
  Bell,
  Check,
  Database,
  Download,
  ImagePlus,
  Info,
  KeyRound,
  Layers,
  LockKeyhole,
  LogOut,
  MonitorSmartphone,
  RefreshCw,
  RotateCcw,
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
import { uploadMedia, resolveMediaUrl } from '../api/media'
import InviteCodesPanel from '../components/settings/InviteCodesPanel'
import LocalWorkspacePanel from '../components/settings/LocalWorkspacePanel'
import '../styles/settings.css'
import { applyExperience } from '../utils/experience'
import { DEFAULT_APPEARANCE, applyAppearance, loadAppearance, saveAppearance, type Appearance } from '../utils/appearance'
import { tr } from '../i18n'

type Lang = 'zh' | 'en'
type Section = 'profile' | 'account' | 'privacy' | 'notifications' | 'experience' | 'data' | 'about'

const SECTIONS: { key: Section; zh: string; en: string; descZh: string; descEn: string; icon: ReactNode }[] = [
  { key: 'profile', zh: '个人资料与偏好', en: 'Profile & preferences', descZh: '昵称、简介与公开形象', descEn: 'Name, bio and public identity', icon: <UserRound size={17} strokeWidth={1.6} /> },
  { key: 'account', zh: '账户与安全', en: 'Account & security', descZh: '密码、登录会话与开发者身份', descEn: 'Password, sessions and owner status', icon: <LockKeyhole size={17} strokeWidth={1.6} /> },
  { key: 'privacy', zh: '隐私与权限', en: 'Privacy & permissions', descZh: '谁可以关注、加好友与查看动态', descEn: 'Who can follow, add and see posts', icon: <ShieldCheck size={17} strokeWidth={1.6} /> },
  { key: 'notifications', zh: '通知与提醒', en: 'Notifications', descZh: '社区回复、好友与系统提醒', descEn: 'Replies, friends and system alerts', icon: <Bell size={17} strokeWidth={1.6} /> },
  { key: 'experience', zh: '使用体验', en: 'Experience', descZh: '语言、主题、密度与动效', descEn: 'Language, theme, density and motion', icon: <SlidersHorizontal size={17} strokeWidth={1.6} /> },
  { key: 'data', zh: '数据与存储', en: 'Data & storage', descZh: '统计、导出与本地缓存', descEn: 'Stats, export and local cache', icon: <Database size={17} strokeWidth={1.6} /> },
  { key: 'about', zh: '关于与帮助', en: 'About & help', descZh: '版本、后端状态与文档', descEn: 'Version, backend status and docs', icon: <Info size={17} strokeWidth={1.6} /> },
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
  const [profileDraft, setProfileDraft] = useState({ display_name: '', bio: '', avatar: '', avatar_url: '' })
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [skin, setSkin] = useState(() => localStorage.getItem('ws.ui.skin') || 'default')
  const [glass, setGlass] = useState(() => localStorage.getItem('ws.ui.glass') || 'medium')
  const [appearance, setAppearance] = useState<Appearance>(() => loadAppearance())
  const backgroundUpload = useRef<HTMLInputElement>(null)
  const [backgroundBusy, setBackgroundBusy] = useState(false)
  const [passwords, setPasswords] = useState({ current_password: '', new_password: '', confirm: '' })
  
  // 密码可见性状态
  const [showCurrentPwd, setShowCurrentPwd] = useState(false)
  const [showNewPwd, setShowNewPwd] = useState(false)
  const [showConfirmPwd, setShowConfirmPwd] = useState(false)

  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [flash, setFlash] = useState('')

  useEffect(() => {
    document.documentElement.dataset.skin = skin
    localStorage.setItem('ws.ui.skin', skin)
  }, [skin])

  useEffect(() => {
    if (glass === 'medium') delete document.documentElement.dataset.glass
    else document.documentElement.dataset.glass = glass
    localStorage.setItem('ws.ui.glass', glass)
  }, [glass])

  useEffect(() => {
    applyAppearance(appearance)
    saveAppearance(appearance)
  }, [appearance])

  const updateAppearance = (patch: Partial<Appearance>) => {
    setAppearance((current) => ({ ...current, ...patch }))
  }

  const chooseGlass = (value: string) => {
    setGlass(value)
    const presets: Record<string, Pick<Appearance, 'glass_blur' | 'glass_opacity'>> = {
      low: { glass_blur: 14, glass_opacity: 100 },
      medium: { glass_blur: 40, glass_opacity: 100 },
      high: { glass_blur: 56, glass_opacity: 100 },
      solid: { glass_blur: 0, glass_opacity: 96 },
    }
    const preset = presets[value]
    if (preset) updateAppearance(preset)
  }

  const uploadBackground = async (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) { setError(tr(lang, '背景图需要图片文件', 'Background must be an image file')); return }
    if (file.size > 12 * 1024 * 1024) { setError(tr(lang, '背景图不能超过 12MB', 'Background image must be under 12MB')); return }
    setError('')
    setBackgroundBusy(true)
    try {
      const uploaded = await uploadMedia(file)
      updateAppearance({ background_url: uploaded.file_url })
      setFlash(tr(lang, '背景图已上传并应用', 'Background uploaded and applied'))
    } catch (err) {
      setError(err instanceof Error ? err.message : tr(lang, '背景图上传失败', 'Background upload failed'))
    } finally {
      setBackgroundBusy(false)
      if (backgroundUpload.current) backgroundUpload.current.value = ''
    }
  }

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
        avatar_url: next.profile.avatar_url || '',
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
      setFlash(tr(lang, '设置已保存', 'Settings saved'))
    } catch (err: any) { setError(String(err?.message || err)) }
    finally { setBusy('') }
  }

  const saveProfile = async () => {
    setBusy('profile'); setError(''); setFlash('')
    try {
      const next = await updateProfile(profileDraft)
      setData((current) => current ? { ...current, profile: next } : current)
      onUserUpdated({ ...(user || { id: next.id, username: next.username }), ...next } as AuthUser)
      setFlash(tr(lang, '个人资料已更新', 'Profile updated'))
    } catch (err: any) { setError(String(err?.message || err)) }
    finally { setBusy('') }
  }

  const uploadAvatar = async (file: File | null) => {
    if (!file) return
    setAvatarUploading(true); setError(''); setFlash('')
    try {
      const uploaded = await uploadMedia(file)
      setProfileDraft((current) => ({ ...current, avatar_url: uploaded.file_url }))
      setFlash(tr(lang, '头像已上传，点击“保存资料”后生效', 'Avatar uploaded. Save profile to apply.'))
    } catch (err: any) { setError(String(err?.message || err)) }
    finally { setAvatarUploading(false) }
  }

  const submitPassword = async () => {
    if (passwords.new_password !== passwords.confirm) { setError(tr(lang, '两次输入的新密码不一致', 'New passwords do not match')); return }
    setBusy('password'); setError(''); setFlash('')
    try {
      const result = await changePassword({
        current_password: passwords.current_password,
        new_password: passwords.new_password,
      })
      setPasswords({ current_password: '', new_password: '', confirm: '' })
      setFlash(result.message || tr(lang, '密码已更新', 'Password updated'))
      setSessions(await listSettingsSessions())
    } catch (err: any) { setError(String(err?.message || err)) }
    finally { setBusy('') }
  }

  const revoke = async (id: string) => {
    setBusy(`session:${id}`); setError('')
    try {
      await revokeSettingsSession(id)
      setSessions(await listSettingsSessions())
      setFlash(tr(lang, '该设备已退出登录', 'Device signed out'))
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
      setFlash(tr(lang, '数据导出已开始下载', 'Data export started'))
    } catch (err: any) { setError(String(err?.message || err)) }
    finally { setBusy('') }
  }

  const clearCache = () => {
    if (!window.confirm(tr(lang, '只清除浏览器中的页面选择、上次世界与面板状态，不会删除账户、世界、作品或聊天数据。继续吗？', 'Clear only local UI state (page selection, last world, panels)? Account, worlds, works and messages are kept.'))) return
    const keep = new Set(['ws.authToken', 'ws.authUser'])
    const keys: string[] = []
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (key && key.startsWith('ws.') && !keep.has(key)) keys.push(key)
    }
    keys.forEach((key) => localStorage.removeItem(key))
    setFlash(tr(lang, `已清除 ${keys.length} 项本地界面缓存`, `Cleared ${keys.length} local UI cache entries`))
  }

  const stats = useMemo(() => data ? [
    [tr(lang, '世界', 'Worlds'), data.stats.worlds], [tr(lang, '人物', 'Characters'), data.stats.characters], [tr(lang, '事件', 'Events'), data.stats.events],
    [tr(lang, '作品', 'Works'), data.stats.stories], [tr(lang, '日记', 'Journal'), data.stats.journal_entries], [tr(lang, '公开作品', 'Publications'), data.stats.publications],
  ] : [], [data])

  if (error && !data) {
    return (
      <div className="settings-page">
        <div style={{ ...card, padding: 24, borderColor: 'var(--danger-color)' }}>
          <strong style={{ fontSize: 13 }}>{tr(lang, '无法读取设置中心', 'Cannot load settings')}</strong>
          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{error}</p>
          <button type="button" style={primary} onClick={() => void load()}><RefreshCw size={14} /> {tr(lang, '重试', 'Retry')}</button>
        </div>
      </div>
    )
  }

  if (!data) return <div className="settings-page"><div className="settings-loading">{tr(lang, '正在读取设置…', 'Loading settings…')}</div></div>

  const zh = lang === 'zh'
  return (
    <div className="settings-page">
      <header className="settings-hero">
        <div>
          <span className="settings-kicker">SETTINGS CENTER</span>
          <h1>{tr(lang, '设置中心', 'Settings Center')}</h1>
          <p>{tr(lang, '管理你的公开身份、账户安全、隐私边界与社区体验。设置只影响当前账号。', 'Manage your public identity, account security, privacy boundaries and community experience. Settings apply to this account only.')}</p>
        </div>
        <div className="settings-hero-user">
          <span className="settings-hero-avatar">
            {data.profile.avatar_url
              ? <img src={resolveMediaUrl(data.profile.avatar_url)} alt="" />
              : data.profile.avatar || (data.profile.display_name || data.profile.username).slice(0, 1)}
          </span>
          <div>
            <strong>{data.profile.display_name || data.profile.username}</strong>
            <span>@{data.profile.username}{data.profile.is_owner ? tr(lang, ' · 开发者', ' · Owner') : ''}</span>
          </div>
        </div>
      </header>

      {error && <div className="settings-message is-error"><AlertCircle size={14} /> {error}</div>}
      {flash && <div className="settings-message is-ok"><Check size={14} /> {flash}</div>}

      <div className="settings-layout">
        <nav className="settings-nav" aria-label={tr(lang, "设置分类", "Settings sections")}>
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
                <small>{zh ? item.descZh : item.descEn}</small>
              </span>
            </button>
          ))}
        </nav>

        <div className="settings-content">
          {section === 'profile' && (
            <Panel title={tr(lang, '个人资料与偏好', 'Profile & preferences')} subtitle={tr(lang, '这些信息会显示在用户与身份中心、社区讨论和好友列表中。', 'This information appears in your identity center, community discussions and friend lists.')} aside={<button type="button" style={primary} disabled={busy === 'profile'} onClick={() => void saveProfile()}><Save size={14} /> {busy === 'profile' ? tr(lang, '保存中…', 'Saving…') : tr(lang, '保存资料', 'Save profile')}</button>}>
              <div className="settings-avatar-row">
                <span className="settings-avatar-preview">
                  {profileDraft.avatar_url
                    ? <img src={resolveMediaUrl(profileDraft.avatar_url)} alt="" />
                    : profileDraft.avatar || (profileDraft.display_name || data.profile.username).slice(0, 1)}
                </span>
                <div style={{ flex: 1 }}>
                  <Field label={tr(lang, '头像符号', 'Avatar symbol')} hint={tr(lang, '可用一个 emoji 或字符；也可以上传图片作为头像。', 'Use an emoji or character, or upload an image.')}>
                    <input style={input} maxLength={16} value={profileDraft.avatar} onChange={(e) => setProfileDraft((p) => ({ ...p, avatar: e.target.value }))} />
                  </Field>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                    <label style={{ ...ghost, cursor: avatarUploading ? 'wait' : 'pointer' }}>
                      {avatarUploading ? tr(lang, '上传中…', 'Uploading…') : tr(lang, '上传头像图片', 'Upload avatar')}
                      <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden disabled={avatarUploading} onChange={(e) => void uploadAvatar(e.target.files?.[0] || null)} />
                    </label>
                    {profileDraft.avatar_url && <button type="button" style={dangerGhost} onClick={() => setProfileDraft((p) => ({ ...p, avatar_url: '' }))}>{tr(lang, '移除图片', 'Remove image')}</button>}
                  </div>
                </div>
              </div>
              <div className="settings-two-col">
                <Field label={tr(lang, '显示名称', 'Display name')}>
                  <input style={input} maxLength={80} value={profileDraft.display_name} onChange={(e) => setProfileDraft((p) => ({ ...p, display_name: e.target.value }))} />
                </Field>
                <Field label={tr(lang, '用户名（不可修改）', 'Username (read-only)')}>
                  <input style={{ ...input, opacity: .65 }} value={data.profile.username} readOnly />
                </Field>
              </div>
              <Field label={tr(lang, '个人简介', 'Bio')} hint={tr(lang, '最多 500 字符，会出现在你的公开用户卡片上。', 'Up to 500 characters, shown on your public card.')}>
                <textarea style={textarea} maxLength={500} value={profileDraft.bio} onChange={(e) => setProfileDraft((p) => ({ ...p, bio: e.target.value }))} />
              </Field>
              <div className="settings-inline-note"><Sparkles size={14} /> {tr(lang, '开发者身份由系统所有者标记控制，不能通过此页自行切换。', 'Owner status is controlled by the system owner flag and cannot be changed here.')}</div>
            </Panel>
          )}

          {section === 'account' && (
            <>
              <Panel title={tr(lang, '账户与安全', 'Account & security')} subtitle={tr(lang, '查看账号身份、管理登录会话，并修改本地密码。', 'Review your identity, manage sessions and change your local password.')} aside={<span className={`settings-badge ${data.profile.is_owner ? 'is-owner' : ''}`}>{data.profile.is_owner ? tr(lang, '开发者账号', 'Owner account') : tr(lang, '普通账号', 'Member account')}</span>}>
                <div className="settings-kv-grid">
                  <div><span>{tr(lang, '用户名', 'Username')}</span><strong>@{data.profile.username}</strong></div>
                  <div><span>{tr(lang, '创建时间', 'Created')}</span><strong>{formatDate(data.account.created_at)}</strong></div>
                  <div><span>{tr(lang, '当前会话', 'Active sessions')}</span><strong>{data.account.sessions} {tr(lang, '个', 'active')}</strong></div>
                  <div><span>{tr(lang, 'AI 接入', 'AI access')}</span><strong><button type="button" style={ghost} onClick={onOpenAiSettings}>{tr(lang, '打开 AI 接入设置', 'Open AI access settings')}</button></strong></div>
                </div>
              </Panel>

              <Panel title={tr(lang, '修改密码', 'Change password')} subtitle={tr(lang, '修改后其他设备会被退出登录，当前浏览器保持登录。', 'Other devices will be signed out; this browser stays signed in.')}>
                <div className="settings-three-col">
                  <Field label={tr(lang, '当前密码', 'Current password')}>
                    <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
                      <input style={{ ...input, paddingRight: 36 }} type={showCurrentPwd ? 'text' : 'password'} value={passwords.current_password} onChange={(e) => setPasswords((p) => ({ ...p, current_password: e.target.value }))} />
                      <button 
                        type="button" 
                        onClick={(e) => { e.preventDefault(); setShowCurrentPwd(!showCurrentPwd); }} 
                        style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, zIndex: 10 }} 
                        title={showCurrentPwd ? tr(lang, "隐藏密码", "Hide password") : tr(lang, "显示密码", "Show password")}
                      >
                        {showCurrentPwd ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                        )}
                      </button>
                    </div>
                  </Field>
                  <Field label={tr(lang, '新密码', 'New password')}>
                    <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
                      <input style={{ ...input, paddingRight: 36 }} type={showNewPwd ? 'text' : 'password'} value={passwords.new_password} onChange={(e) => setPasswords((p) => ({ ...p, new_password: e.target.value }))} />
                      <button 
                        type="button" 
                        onClick={(e) => { e.preventDefault(); setShowNewPwd(!showNewPwd); }} 
                        style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, zIndex: 10 }} 
                        title={showNewPwd ? tr(lang, "隐藏密码", "Hide password") : tr(lang, "显示密码", "Show password")}
                      >
                        {showNewPwd ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                        )}
                      </button>
                    </div>
                  </Field>
                  <Field label={tr(lang, '确认新密码', 'Confirm new password')}>
                    <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
                      <input style={{ ...input, paddingRight: 36 }} type={showConfirmPwd ? 'text' : 'password'} value={passwords.confirm} onChange={(e) => setPasswords((p) => ({ ...p, confirm: e.target.value }))} />
                      <button 
                        type="button" 
                        onClick={(e) => { e.preventDefault(); setShowConfirmPwd(!showConfirmPwd); }} 
                        style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, zIndex: 10 }} 
                        title={showConfirmPwd ? tr(lang, "隐藏密码", "Hide password") : tr(lang, "显示密码", "Show password")}
                      >
                        {showConfirmPwd ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                        )}
                      </button>
                    </div>
                  </Field>
                </div>
                <button type="button" style={primary} disabled={busy === 'password'} onClick={() => void submitPassword()}><KeyRound size={14} /> {busy === 'password' ? tr(lang, '更新中…', 'Updating…') : tr(lang, '更新密码', 'Update password')}</button>
              </Panel>

              <LocalWorkspacePanel lang={lang} />

              {data.profile.is_owner && <InviteCodesPanel lang={lang} />}

              <Panel title={tr(lang, '登录会话', 'Sign-in sessions')} subtitle={tr(lang, '只显示当前账号的会话；撤销后该设备需要重新登录。', 'Only this account\'s sessions are listed; revoked devices must sign in again.')} aside={<button type="button" style={ghost} onClick={() => void load()}><RefreshCw size={13} /> {tr(lang, '刷新', 'Refresh')}</button>}>
                <div className="settings-session-list">
                  {sessions.map((session) => (
                    <div className="settings-session-row" key={session.id}>
                      <MonitorSmartphone size={17} />
                      <div style={{ flex: 1 }}>
                        <strong>{tr(lang, '浏览器会话', 'Browser session')} {session.current ? tr(lang, '· 当前设备', '· This device') : ''}</strong>
                        <span>{tr(lang, '建立于', 'Created')} {formatDate(session.created_at)} · {tr(lang, '到期', 'Expires')} {formatDate(session.expires_at)}</span>
                      </div>
                      {!session.current && (
                        <button type="button" style={dangerGhost} disabled={busy === `session:${session.id}`} onClick={() => void revoke(session.id)}>
                          {busy === `session:${session.id}` ? tr(lang, '撤销中…', 'Revoking…') : tr(lang, '退出此设备', 'Sign out this device')}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 14 }}>
                  <button type="button" style={dangerGhost} onClick={onLogout}><LogOut size={14} /> {tr(lang, '退出当前账号', 'Sign out')}</button>
                </div>
              </Panel>
            </>
          )}

          {section === 'privacy' && (
            <Panel title={tr(lang, '隐私与权限', 'Privacy & permissions')} subtitle={tr(lang, '控制其他用户能如何发现你、关注你并向你发起互动。', 'Control how others discover, follow and interact with you.')} aside={<button type="button" style={primary} disabled={busy === 'settings'} onClick={() => void saveSettings()}><Save size={14} /> {tr(lang, '保存隐私设置', 'Save privacy')}</button>}>
              <div className="settings-toggle-list">
                <Toggle checked={data.privacy.public_profile} onChange={(v) => privacy('public_profile', v)} title={tr(lang, '公开个人资料', 'Public profile')} desc={tr(lang, '允许其他用户在社区用户目录中看到昵称、头像与简介。', 'Let others see your name, avatar and bio in the community directory.')} />
                <Toggle checked={data.privacy.show_activity} onChange={(v) => privacy('show_activity', v)} title={tr(lang, '展示社区动态', 'Show community activity')} desc={tr(lang, '允许你的讨论、组内帖子与公开作品出现在他人动态中。', 'Allow your discussions, group posts and public works to appear in feeds.')} />
                <Toggle checked={data.privacy.allow_follow} onChange={(v) => privacy('allow_follow', v)} title={tr(lang, '允许被关注', 'Allow follows')} desc={tr(lang, '关闭后，其他用户不能关注你；已有粉丝关系不受影响。', 'When off, new users cannot follow you; existing follows remain.')} />
                <Toggle checked={data.privacy.allow_friend_requests} onChange={(v) => privacy('allow_friend_requests', v)} title={tr(lang, '允许好友申请', 'Allow friend requests')} desc={tr(lang, '关闭后，新的好友申请会被后端拒绝。', 'When off, new friend requests are rejected by the server.')} />
                <Toggle checked={data.privacy.allow_group_invites} onChange={(v) => privacy('allow_group_invites', v)} title={tr(lang, '允许小组邀请', 'Allow group invites')} desc={tr(lang, '为后续邀请入组功能保留的权限开关。', 'Permission reserved for group invitations.')} />
                <Toggle checked={data.privacy.allow_ai_private_context} onChange={(v) => privacy('allow_ai_private_context', v)} title={tr(lang, '允许 AI 使用私人背景', 'Allow AI private context')} desc={tr(lang, '默认关闭。开启后仍需在具体授权中确认，不会自动共享日记或记忆。', 'Off by default. Specific grants are still required; journals and memories are not shared automatically.')} />
              </div>
              <div className="settings-inline-note"><ShieldCheck size={14} /> {tr(lang, '隐私设置在服务端校验，不只依赖前端隐藏按钮。', 'Privacy is enforced server-side, not just by hiding buttons.')}</div>
            </Panel>
          )}

          {section === 'notifications' && (
            <Panel title={tr(lang, '通知与提醒', 'Notifications')} subtitle={tr(lang, '选择希望接收的社区互动与系统提醒。', 'Choose which community and system notifications you receive.')} aside={<button type="button" style={primary} disabled={busy === 'settings'} onClick={() => void saveSettings()}><Save size={14} /> {tr(lang, '保存通知设置', 'Save notifications')}</button>}>
              <div className="settings-toggle-list">
                <Toggle checked={data.notifications.community_reply} onChange={(v) => notification('community_reply', v)} title={tr(lang, '讨论回复', 'Discussion replies')} desc={tr(lang, '有人回复你的社区讨论时提醒。', 'Notify when someone replies to your discussion.')} />
                <Toggle checked={data.notifications.friend_request} onChange={(v) => notification('friend_request', v)} title={tr(lang, '好友申请', 'Friend requests')} desc={tr(lang, '有人申请添加你为好友时提醒。', 'Notify when someone sends a friend request.')} />
                <Toggle checked={data.notifications.follow} onChange={(v) => notification('follow', v)} title={tr(lang, '新增粉丝', 'New followers')} desc={tr(lang, '有人关注你时提醒。', 'Notify when someone follows you.')} />
                <Toggle checked={data.notifications.group_activity} onChange={(v) => notification('group_activity', v)} title={tr(lang, '小组动态', 'Group activity')} desc={tr(lang, '小组新帖、成员申请与审批结果提醒。', 'Group posts, join requests and approval results.')} />
                <Toggle checked={data.notifications.system} onChange={(v) => notification('system', v)} title={tr(lang, '系统通知', 'System notices')} desc={tr(lang, '版本更新、权限变化与重要系统消息。', 'Version updates, permission changes and important notices.')} />
                <Toggle checked={data.notifications.weekly_digest} onChange={(v) => notification('weekly_digest', v)} title={tr(lang, '每周摘要', 'Weekly digest')} desc={tr(lang, '汇总本周的社区动态与创作更新。', 'A weekly summary of community and creation updates.')} />
              </div>
              <div className="settings-inline-note"><Bell size={14} /> {tr(lang, '通知会保存在站内通知中心；当前版本不发送邮件或短信。', 'Notifications are stored in the in-app center; this version does not send email or SMS.')}</div>
            </Panel>
          )}

          {section === 'experience' && (
            <Panel title={tr(lang, '使用体验', 'Experience')} subtitle={tr(lang, '调整语言、主题、信息密度与动效。设置会保存到当前账号。', 'Adjust language, theme, density and motion. Settings are saved to this account.')} aside={<button type="button" style={primary} disabled={busy === 'settings'} onClick={() => void saveSettings()}><Save size={14} /> {tr(lang, '保存体验设置', 'Save experience')}</button>}>
              <div className="settings-two-col">
                <Field label={tr(lang, '界面语言', 'Language')} hint={tr(lang, '切换后立即生效。', 'Applies immediately.')}>
                  <select style={input} value={data.preferences.language} onChange={(e) => preference('language', e.target.value as SettingsPreferences['language'])}>
                    <option value="zh">简体中文</option><option value="en">English</option>
                  </select>
                </Field>
                <Field label={tr(lang, '主题', 'Theme')}>
                  <select style={input} value={data.preferences.theme} onChange={(e) => preference('theme', e.target.value as SettingsPreferences['theme'])}>
                    <option value="system">{tr(lang, '跟随系统', 'System')}</option><option value="light">{tr(lang, '浅色', 'Light')}</option><option value="dark">{tr(lang, '深色', 'Dark')}</option>
                  </select>
                </Field>
                <Field label={tr(lang, '信息密度', 'Density')}>
                  <select style={input} value={data.preferences.density} onChange={(e) => preference('density', e.target.value as SettingsPreferences['density'])}>
                    <option value="compact">{tr(lang, '紧凑', 'Compact')}</option><option value="comfortable">{tr(lang, '舒适', 'Comfortable')}</option><option value="spacious">{tr(lang, '宽松', 'Spacious')}</option>
                  </select>
                </Field>
                <Field label={tr(lang, '正文大小', 'Reading size')}>
                  <select style={input} value={data.preferences.font_size} onChange={(e) => preference('font_size', e.target.value as SettingsPreferences['font_size'])}>
                    <option value="small">{tr(lang, '小', 'Small')}</option><option value="medium">{tr(lang, '中', 'Medium')}</option><option value="large">{tr(lang, '大', 'Large')}</option>
                  </select>
                </Field>
              </div>
              <div className="settings-toggle-list">
                <Toggle checked={data.preferences.reduce_motion} onChange={(v) => preference('reduce_motion', v)} title={tr(lang, '减少动效', 'Reduce motion')} desc={tr(lang, '关闭大部分过渡与动画，适合对动态效果敏感的用户。', 'Disable most transitions and animations.')} />
                <Toggle checked={data.preferences.show_tips} onChange={(v) => preference('show_tips', v)} title={tr(lang, '显示操作提示', 'Show tips')} desc={tr(lang, '在复杂编辑器中显示简短说明与引导。', 'Show short guidance in complex editors.')} />
                <Toggle checked={data.preferences.auto_save} onChange={(v) => preference('auto_save', v)} title={tr(lang, '自动保存草稿', 'Auto-save drafts')} desc={tr(lang, '在写作与编辑页面自动保存本地草稿。', 'Save local drafts while writing and editing.')} />
              </div>
              <div className="settings-two-col" style={{ marginTop: 14 }}>
                <Field label={tr(lang, '视觉皮肤', 'Visual skin')} hint={tr(lang, '只改变环境光与玻璃折射，不改变内容结构。', 'Changes ambient light and glass only.')}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {[
                      ['default', tr(lang, '极简', 'Minimal')], ['aurora', tr(lang, '极光', 'Aurora')], ['sand', tr(lang, '暖砂', 'Sand')], ['mono', tr(lang, '单色', 'Mono')],
                    ].map(([value, label]) => (
                      <button key={value} type="button" onClick={() => setSkin(value)}
                        style={{ ...ghost, borderColor: skin === value ? 'var(--text-main)' : 'var(--card-border)', background: skin === value ? 'var(--text-main)' : 'transparent', color: skin === value ? 'var(--bg-color)' : 'var(--text-main)' }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label={tr(lang, '玻璃强度', 'Glass strength')} hint={tr(lang, '低性能设备建议使用“低”或“实色”。', 'Use Low or Solid on slower devices.')}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {[
                      ['low', tr(lang, '低', 'Low')], ['medium', tr(lang, '标准', 'Standard')], ['high', tr(lang, '高', 'High')], ['solid', tr(lang, '实色', 'Solid')],
                    ].map(([value, label]) => (
                      <button key={value} type="button" onClick={() => chooseGlass(value)}
                        style={{ ...ghost, borderColor: glass === value ? 'var(--text-main)' : 'var(--card-border)', background: glass === value ? 'var(--text-main)' : 'transparent', color: glass === value ? 'var(--bg-color)' : 'var(--text-main)' }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>
              <div className="settings-appearance-heading">
                <div>
                  <strong>{tr(lang, '背景与玻璃细节', 'Background & glass')}</strong>
                  <span>{tr(lang, '全部即时生效，只保存在当前浏览器；上传图片走创作者媒体库。', 'Applied immediately and stored in this browser. Uploads use the creator media library.')}</span>
                </div>
                <button type="button" style={ghost} onClick={() => setAppearance({ ...DEFAULT_APPEARANCE })}><RotateCcw size={13} /> {tr(lang, '恢复默认', 'Reset')}</button>
              </div>
              <div className="settings-appearance-grid">
                <Field label={tr(lang, '背景图', 'Background image')} hint={tr(lang, '支持图片 URL，或直接上传到当前账号的媒体库。', 'Use an image URL or upload to your media library.')}>
                  <div className="settings-background-row">
                    <input
                      style={input}
                      placeholder={tr(lang, "https://…（上传后自动填入）", "https://… (filled after upload)")}
                      value={appearance.background_url}
                      onChange={(e) => updateAppearance({ background_url: e.target.value })}
                    />
                    <button type="button" style={ghost} disabled={backgroundBusy} onClick={() => backgroundUpload.current?.click()}>
                      <ImagePlus size={14} /> {backgroundBusy ? tr(lang, '上传中…', 'Uploading…') : tr(lang, '上传', 'Upload')}
                    </button>
                    {appearance.background_url && (
                      <button type="button" style={ghost} onClick={() => updateAppearance({ background_url: '' })}>
                        <Trash2 size={14} /> {tr(lang, '清除', 'Clear')}
                      </button>
                    )}
                  </div>
                  <input ref={backgroundUpload} type="file" accept="image/*" hidden onChange={(e) => void uploadBackground(e.target.files?.[0])} />
                  {appearance.background_url && (
                    <div className="settings-background-preview" style={{ backgroundImage: `url(${JSON.stringify(resolveMediaUrl(appearance.background_url))})` }} />
                  )}
                </Field>
                <Field label={tr(lang, '背景图透明度', 'Background opacity')} hint={`${appearance.background_opacity}%`}>
                  <input className="settings-range" type="range" min={0} max={100} value={appearance.background_opacity} onChange={(e) => updateAppearance({ background_opacity: Number(e.target.value) })} />
                </Field>
                <Field label={tr(lang, '背景图模糊度', 'Background blur')} hint={`${appearance.background_blur}px`}>
                  <input className="settings-range" type="range" min={0} max={40} value={appearance.background_blur} onChange={(e) => updateAppearance({ background_blur: Number(e.target.value) })} />
                </Field>
                <Field label={tr(lang, '玻璃模糊度', 'Glass blur')} hint={`${appearance.glass_blur}px`}>
                  <input className="settings-range" type="range" min={0} max={72} value={appearance.glass_blur} onChange={(e) => updateAppearance({ glass_blur: Number(e.target.value) })} />
                </Field>
                <Field label={tr(lang, '玻璃透明度', 'Glass opacity')} hint={`${appearance.glass_opacity}%`}>
                  <input className="settings-range" type="range" min={25} max={100} value={appearance.glass_opacity} onChange={(e) => updateAppearance({ glass_opacity: Number(e.target.value) })} />
                </Field>
                <Field label={tr(lang, '辉光强度', 'Glow')} hint={`${appearance.glow}%`}>
                  <input className="settings-range" type="range" min={0} max={80} value={appearance.glow} onChange={(e) => updateAppearance({ glow: Number(e.target.value) })} />
                </Field>
              </div>
              <div className="settings-inline-note"><SlidersHorizontal size={14} /> {tr(lang, '主题、皮肤、背景与玻璃细节会应用到整个工作区；正文大小主要影响阅读型页面。', 'Theme, skin, background and glass apply across the workspace; reading size mainly affects reading pages.')}</div>
              <div className="settings-inline-note"><Layers size={14} /> {tr(lang, '毛玻璃用于导航、侧栏、普通卡片与弹窗；液态玻璃只用于首页场景卡和登录等重点入口。', 'Frosted glass is used for navigation, sidebars, regular cards and dialogs; liquid glass is reserved for scene cards and key entry points.')}</div>
            </Panel>
          )}

          {section === 'data' && (
            <>
              <Panel title={tr(lang, '数据与存储', 'Data & storage')} subtitle={tr(lang, '查看当前账号的数据规模。导出为 JSON 元数据，不包含密码或完整私人正文。', 'Review your data footprint. Export is JSON metadata without passwords or full private text.')} aside={<button type="button" style={primary} disabled={busy === 'export'} onClick={() => void download()}><Download size={14} /> {busy === 'export' ? tr(lang, '准备中…', 'Preparing…') : tr(lang, '导出数据', 'Export data')}</button>}>
                <div className="settings-stat-grid">
                  {stats.map(([label, value]) => (
                    <div key={String(label)}><strong>{String(value ?? 0)}</strong><span>{label}</span></div>
                  ))}
                </div>
                <div className="settings-kv-grid" style={{ marginTop: 16 }}>
                  <div><span>{tr(lang, '数据库大小', 'Database size')}</span><strong>{formatBytes(data.storage.database_bytes)}</strong></div>
                  <div><span>{tr(lang, '登录会话', 'Sessions')}</span><strong>{data.stats.sessions || 0}</strong></div>
                  <div><span>{tr(lang, '人格记忆', 'Persona memories')}</span><strong>{data.stats.memories || 0}</strong></div>
                  <div><span>{tr(lang, '公开作品', 'Publications')}</span><strong>{data.stats.publications || 0}</strong></div>
                </div>
              </Panel>
              <Panel title={tr(lang, '本地缓存', 'Local cache')} subtitle={tr(lang, '页面选择、上次世界与面板状态保存在浏览器本地；清理不会删除后端数据。', 'Page selection, last world and panel state are stored locally; clearing them does not delete backend data.')}>
                <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                  <button type="button" style={dangerGhost} onClick={clearCache}><Trash2 size={14} /> {tr(lang, '清除本地界面缓存', 'Clear local UI cache')}</button>
                  <button type="button" style={ghost} onClick={() => window.location.reload()}><RefreshCw size={14} /> {tr(lang, '重新载入工作区', 'Reload workspace')}</button>
                </div>
              </Panel>
            </>
          )}

          {section === 'about' && (
            <>
              <Panel title={tr(lang, '关于世界模拟器', 'About World Simulator')} subtitle={tr(lang, '一个把世界、人物、叙事与云宝工作台放在同一处的本地创作系统。', 'A local creation system bringing worlds, characters, narrative and Yunbao together.')}>
                <div className="settings-about-mark">W</div>
                <div className="settings-kv-grid">
                  <div><span>{tr(lang, '产品版本', 'Product version')}</span><strong>{about?.version || '1.0.0'}</strong></div>
                  <div><span>{tr(lang, 'API 版本', 'API version')}</span><strong>{about?.api_version || '1.1.0'}</strong></div>
                  <div><span>{tr(lang, '当前账号', 'Current account')}</span><strong>{data.profile.display_name} · {data.profile.is_owner ? tr(lang, '开发者', 'Owner') : tr(lang, '普通用户', 'Member')}</strong></div>
                  <div><span>{tr(lang, '数据位置', 'Data location')}</span><strong>{tr(lang, '本机 SQLite', 'Local SQLite')}</strong></div>
                </div>
                <p style={{ fontSize: 11, lineHeight: 1.9, color: 'var(--text-muted)', marginBottom: 0 }}>{lang === 'zh' ? (about?.description || '游戏、文学、日记与云宝工作台一体化的世界创作系统。') : 'A world creation system integrating games, literature, journals and Yunbao.'}</p>
              </Panel>
              <Panel title={tr(lang, '帮助与文档', 'Help & docs')} subtitle={tr(lang, '遇到权限、数据或 AI 接入问题时，先查看这些说明。', 'Start here for permission, data or AI access questions.')}>
                <div className="settings-link-list">
                  {(about?.docs || []).map((doc) => (
                    <button key={doc.href} type="button" style={ghost} onClick={() => window.open(doc.href, '_blank', 'noopener,noreferrer')}>{doc.title}<span style={{ color: 'var(--text-muted)' }}>↗</span></button>
                  ))}
                  <button type="button" style={ghost} onClick={onOpenAiSettings}>{tr(lang, 'AI 接入与模型设置', 'AI access & model settings')}</button>
                </div>
                <div className="settings-inline-note"><Info size={14} /> {lang === 'zh' ? (about?.support || '本地工作区由开发者维护；数据保存在本机 SQLite。') : 'The local workspace is maintained by the owner; data lives in local SQLite.'}</div>
              </Panel>
            </>
          )}
        </div>
      </div>
    </div>
  )
}