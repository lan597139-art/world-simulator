import { useEffect, useState } from 'react'
import {
  authLogin,
  authRegister,
  authResendRegistration,
  authSetup,
  authStatus,
  authVerifyRegistration,
  type AuthStatus,
} from '../api/auth'
import { AUTH_USER_KEY, clearAuthToken } from '../api/authToken'
import { updateSettings } from '../api/settings'
import { loadLanguage, saveLanguage, applyDocumentLanguage, tr, type Lang } from '../i18n'

type Phase = 'loading' | 'login' | 'register' | 'verify' | 'setup' | 'ready'

const input: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '8px',
  border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)', fontSize: '13px',
}
const label: React.CSSProperties = {
  display: 'block', fontSize: '10.5px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '5px',
}
const primaryButton: React.CSSProperties = {
  padding: '10px', borderRadius: '8px', border: 'none', background: 'var(--text-main)',
  color: 'var(--bg-color)', fontWeight: 600, cursor: 'pointer', fontSize: '12px',
}
const linkButton: React.CSSProperties = {
  border: 0, background: 'transparent', color: 'var(--text-main)', cursor: 'pointer',
  fontSize: '11px', textDecoration: 'underline', textUnderlineOffset: '3px', padding: 0,
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [lang, setLang] = useState<Lang>(() => loadLanguage())
  const zh = lang === 'zh'
  const switchLang = () => {
    const next: Lang = zh ? 'en' : 'zh'
    setLang(next); saveLanguage(next); applyDocumentLanguage(next)
  }
  const copy = {
    connecting: tr(lang, '正在连接账号服务…', 'Connecting to account service…'),
    setupTitle: tr(lang, '首次使用：初始化开发者账号', 'First run: initialize the owner account'),
    setupSub: tr(lang, '这个账号将成为站点开发者，拥有邀请码与系统配置权限。', 'This account becomes the site owner with invite and system settings access.'),
    registerTitle: tr(lang, '使用邀请码注册', 'Register with an invite'),
    registerSub: tr(lang, '公开注册需要开发者邀请码；邀请码由服务端校验并在注册成功时消耗。', 'Public registration requires an owner invite; it is verified and consumed on success.'),
    verifyTitle: tr(lang, '验证邮箱', 'Verify email'),
    verifySub: tr(lang, '输入邮箱收到的 6 位验证码，完成注册。', 'Enter the 6-digit code sent to your email to finish registration.'),
    loginTitle: tr(lang, '登录世界模拟器', 'Sign in to World Simulator'),
    loginSub: tr(lang, '公开访问 · 使用用户名或邮箱登录', 'Public access · sign in with username or email'),
    login: tr(lang, '登录', 'Sign in'),
    register: tr(lang, '注册', 'Register'),
    ownerUsername: tr(lang, '开发者用户名', 'Owner username'),
    ownerUsernameHint: tr(lang, '例如：lan', 'e.g. lan'),
    displayName: tr(lang, '显示名称', 'Display name'),
    optional: tr(lang, '可选', 'Optional'),
    email: tr(lang, '邮箱', 'Email'),
    emailSuggested: tr(lang, '邮箱（建议填写）', 'Email (recommended)'),
    emailHint: tr(lang, '用于账号识别', 'Used to identify your account'),
    invite: tr(lang, '开发者邀请码', 'Owner invite code'),
    username: tr(lang, '用户名', 'Username'),
    usernameHint: tr(lang, '2–32 位，中英文/数字/下划线', '2–32 chars: letters, numbers, underscore'),
    displayHint: tr(lang, '可选', 'Optional'),
    usernameOrEmail: tr(lang, '用户名或邮箱', 'Username or email'),
    password: tr(lang, '密码', 'Password'),
    passwordHint: tr(lang, '至少 8 位', 'At least 8 characters'),
    confirmPassword: tr(lang, '确认密码', 'Confirm password'),
    confirmHint: tr(lang, '再次输入密码', 'Enter the password again'),
    setupToken: tr(lang, '部署初始化令牌', 'Deployment setup token'),
    verifyCode: tr(lang, '邮箱验证码', 'Email verification code'),
    codeHint: tr(lang, '6 位数字', '6-digit code'),
    devCode: tr(lang, '开发模式验证码：', 'Development code: '),
    resend: tr(lang, '重新发送验证码', 'Resend code'),
    editRegistration: tr(lang, '修改注册信息', 'Edit registration'),
    processing: tr(lang, '处理中…', 'Working…'),
    completeRegistration: tr(lang, '完成注册', 'Complete registration'),
    initialize: tr(lang, '初始化并进入', 'Initialize and enter'),
    submitRegistration: tr(lang, '提交注册', 'Submit registration'),
    registrationClosed: tr(lang, '{copy.registrationClosed}', 'Registration is currently closed. Contact the owner for access.'),
    footer: tr(lang, '公开访问 · 邀请码由服务端验证 · 会话 30 天', 'Public access · server-verified invites · 30-day session'),
    localAuth: tr(lang, '（当前后端已关闭鉴权，仅用于本地测试）', ' (authentication is disabled for local testing)'),
    language: tr(lang, '切换到英文', 'Switch to Chinese'),
  }
  useEffect(() => { applyDocumentLanguage(lang) }, [lang])

  const enter = async () => {
    try { await updateSettings({ preferences: { language: lang } }) } catch { /* 离线仍进入 */ }
    setPhase('ready')
  }
  const friendlyError = (reason: unknown): string => {
    const message = String((reason as { message?: string })?.message || reason)
    if (zh) return message
    const pairs: [string, string][] = [
      ['用户名或密码不正确', 'Incorrect username or password'],
      ['登录尝试过多', 'Too many attempts. Try again in 10 minutes.'],
      ['用户名或邮箱已被注册', 'Username or email is already registered'],
      ['用户名或邮箱已存在', 'Username or email already exists'],
      ['用户名 2–32 位', 'Username must be 2–32 valid characters'],
      ['请输入有效的邮箱地址', 'Enter a valid email address'],
      ['密码至少 8 个字符', 'Password must be at least 8 characters'],
      ['密码过长', 'Password is too long'],
      ['邀请码无效或已停用', 'Invite code is invalid or disabled'],
      ['邀请码已过期', 'Invite code has expired'],
      ['邀请码使用次数已用完', 'Invite code has no uses left'],
      ['请输入有效的邀请码', 'Enter a valid invite code'],
      ['验证码不正确', 'Incorrect verification code'],
      ['验证码已过期', 'Verification code expired. Request a new one.'],
      ['验证码尝试次数过多', 'Too many code attempts. Request a new code.'],
      ['当前站点暂未开放注册', 'Registration is currently closed'],
      ['邮箱已被使用', 'Email is already in use'],
      ['用户名已存在', 'Username already exists'],
      ['初始化令牌不正确', 'Incorrect setup token'],
      ['注册请求不存在或已完成', 'Registration request is missing or already complete'],
      ['请先登录', 'Please sign in first'],
    ]
    const hit = pairs.find(([zhText]) => message.includes(zhText))
    return hit ? hit[1] : message
  }
  const [status, setStatus] = useState<AuthStatus | null>(null)
  const [inviteCode, setInviteCode] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [setupToken, setSetupToken] = useState('')
  const [registrationId, setRegistrationId] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [devCode, setDevCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const resetSecrets = () => {
    setPassword('')
    setConfirm('')
    setVerificationCode('')
  }

  const check = async () => {
    try {
      const data = await authStatus()
      if (data.user) localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user))
      setStatus(data)
      if (data.auth_disabled || data.authenticated) setPhase('ready')
      else if (data.setup_required) setPhase('setup')
      else setPhase('login')
    } catch (err: any) {
      setError(`${tr(lang, '无法连接后端：', 'Cannot reach backend: ')}${err.message || err}`)
      setPhase('login')
    }
  }

  useEffect(() => { void check() }, [])

  useEffect(() => {
    const onAuthRequired = () => {
      clearAuthToken()
      setPhase('login')
      setError(tr(lang, '登录已失效，请重新登录', 'Session expired. Please sign in again.'))
    }
    window.addEventListener('ws-auth-required', onAuthRequired)
    return () => window.removeEventListener('ws-auth-required', onAuthRequired)
  }, [])

  const validatePasswords = () => {
    if (password.length < 8) { setError(tr(lang, '密码至少 8 个字符', 'Password must be at least 8 characters')); return false }
    if (password !== confirm) { setError(tr(lang, '两次输入的密码不一致', 'Passwords do not match')); return false }
    return true
  }

  const submitLogin = async () => {
    setError(''); setNotice('')
    if (!username.trim() || !password) return
    setBusy(true)
    try {
      await authLogin({ username: username.trim(), password })
      resetSecrets()
      await enter()
    } catch (err: any) {
      setError(friendlyError(err))
    } finally { setBusy(false) }
  }

  const submitSetup = async () => {
    setError(''); setNotice('')
    if (!username.trim()) { setError(tr(lang, '请输入用户名', 'Please enter a username')); return }
    if (!validatePasswords()) return
    setBusy(true)
    try {
      await authSetup({
        username: username.trim(),
        password,
        display_name: displayName.trim() || undefined,
        email: email.trim() || undefined,
        setup_token: setupToken.trim() || undefined,
      })
      resetSecrets()
      await enter()
    } catch (err: any) {
      setError(friendlyError(err))
    } finally { setBusy(false) }
  }

  const submitRegister = async () => {
    setError(''); setNotice('')
    if (!username.trim() || !email.trim()) { setError(tr(lang, '请填写用户名和邮箱', 'Please enter username and email')); return }
    if (!validatePasswords()) return
    if (status?.invite_required !== false && !inviteCode.trim()) { setError(tr(lang, '请输入开发者邀请码', 'Please enter the owner invite code')); return }
    setBusy(true)
    try {
      const result = await authRegister({
        invite_code: inviteCode.trim(),
        username: username.trim(),
        email: email.trim(),
        password,
        display_name: displayName.trim() || undefined,
      })
      if (result.verification_required) {
        setRegistrationId(result.registration_id)
        setDevCode(result.dev_code || '')
        setPhase('verify')
        setNotice(tr(lang, `验证码已发送至 ${result.email}`, `Verification code sent to ${result.email}`))
      } else {
        resetSecrets()
        await enter()
      }
    } catch (err: any) {
      setError(friendlyError(err))
    } finally { setBusy(false) }
  }

  const submitVerify = async () => {
    setError(''); setNotice('')
    if (!verificationCode.trim()) return
    setBusy(true)
    try {
      await authVerifyRegistration({ registration_id: registrationId, code: verificationCode.trim() })
      resetSecrets()
      await enter()
    } catch (err: any) {
      setError(friendlyError(err))
    } finally { setBusy(false) }
  }

  const resend = async () => {
    setError(''); setNotice('')
    setBusy(true)
    try {
      const result = await authResendRegistration(registrationId)
      setDevCode(result.dev_code || '')
      setNotice(tr(lang, '新的验证码已发送', 'A new verification code was sent'))
    } catch (err: any) {
      setError(friendlyError(err))
    } finally { setBusy(false) }
  }

  if (phase === 'ready') return <>{children}</>
  if (phase === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', color: 'var(--text-muted)' }}>
        {copy.connecting}
      </div>
    )
  }

  const isSetup = phase === 'setup'
  const isRegister = phase === 'register'
  const isVerify = phase === 'verify'
  const title = isSetup ? copy.setupTitle
    : isVerify ? copy.verifyTitle
      : isRegister ? copy.registerTitle : copy.loginTitle
  const subtitle = isSetup ? copy.setupSub
    : isVerify ? copy.verifySub
      : isRegister ? copy.registerSub
        : copy.loginSub

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', background: 'transparent' }}>
      <button
        type="button"
        onClick={switchLang}
        aria-label={copy.language}
        style={{ position: 'fixed', top: 18, right: 18, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-main)', fontSize: 11, cursor: 'pointer' }}
      >
        {zh ? 'EN' : '中文'}
      </button>
      <div className="glass-card" style={{ width: '420px', maxWidth: '100%', padding: '26px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '38px', height: '38px', borderRadius: '9px', background: 'var(--text-main)', color: 'var(--bg-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '20px' }}>W</div>
          <div>
            <div style={{ fontSize: '17px', fontWeight: 600, color: 'var(--text-main)' }}>{zh ? '世界模拟器' : 'World Simulator'}</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{title}</div>
          </div>
        </div>
        <p style={{ margin: 0, fontSize: '11.5px', lineHeight: 1.7, color: 'var(--text-muted)' }}>{subtitle}</p>

        {!isSetup && !isVerify && (
          <div style={{ display: 'flex', gap: '4px', padding: '3px', border: '1px solid var(--card-border)', borderRadius: '8px', background: 'rgba(128,128,128,0.06)' }}>
            <button type="button" onClick={() => { setPhase('login'); setError(''); setNotice('') }} style={{ flex: 1, padding: '7px', border: 0, borderRadius: '6px', background: phase === 'login' ? 'var(--text-main)' : 'transparent', color: phase === 'login' ? 'var(--bg-color)' : 'var(--text-muted)', fontSize: '11px', cursor: 'pointer' }}>{copy.login}</button>
            <button type="button" disabled={status?.registration_enabled === false} onClick={() => { setPhase('register'); setError(''); setNotice('') }} style={{ flex: 1, padding: '7px', border: 0, borderRadius: '6px', background: phase === 'register' ? 'var(--text-main)' : 'transparent', color: phase === 'register' ? 'var(--bg-color)' : 'var(--text-muted)', fontSize: '11px', cursor: status?.registration_enabled === false ? 'not-allowed' : 'pointer', opacity: status?.registration_enabled === false ? 0.45 : 1 }}>{copy.register}</button>
          </div>
        )}

        {isSetup && (
          <>
            <div><span style={label}>{copy.ownerUsername}</span><input value={username} onChange={(e) => setUsername(e.target.value)} placeholder={copy.ownerUsernameHint} autoComplete="username" style={input} /></div>
            <div><span style={label}>{copy.displayName}</span><input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={copy.optional} style={input} /></div>
            <div><span style={label}>{copy.emailSuggested}</span><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={copy.emailHint} autoComplete="email" style={input} /></div>
          </>
        )}

        {isRegister && (
          <>
            {status?.invite_required !== false && (
              <div><span style={label}>{copy.invite}</span><input value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} placeholder="WS-XXXX-XXXX-XXXX" autoComplete="off" style={input} /></div>
            )}
            <div><span style={label}>{copy.username}</span><input value={username} onChange={(e) => setUsername(e.target.value)} placeholder={copy.usernameHint} autoComplete="username" style={input} /></div>
            <div><span style={label}>{copy.email}</span><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" style={input} /></div>
            <div><span style={label}>{copy.displayName}</span><input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={copy.optional} style={input} /></div>
          </>
        )}

        {!isVerify && (
          <>
            {phase === 'login' && <div><span style={label}>{copy.usernameOrEmail}</span><input value={username} onChange={(e) => setUsername(e.target.value)} placeholder={copy.usernameOrEmail} autoComplete="username" style={input} onKeyDown={(e) => { if (e.key === 'Enter') void submitLogin() }} /></div>}
            <div><span style={label}>{copy.password}</span><input value={password} onChange={(e) => setPassword(e.target.value)} placeholder={isSetup || isRegister ? copy.passwordHint : copy.password} type="password" autoComplete={isSetup || isRegister ? 'new-password' : 'current-password'} style={input} onKeyDown={(e) => { if (e.key === 'Enter') void (isSetup ? submitSetup() : isRegister ? submitRegister() : submitLogin()) }} /></div>
            {(isSetup || isRegister) && <div><span style={label}>{copy.confirmPassword}</span><input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={copy.confirmHint} type="password" autoComplete="new-password" style={input} onKeyDown={(e) => { if (e.key === 'Enter') void (isSetup ? submitSetup() : submitRegister()) }} /></div>}
          </>
        )}

        {isSetup && status?.setup_token_required && (
          <div><span style={label}>{copy.setupToken}</span><input value={setupToken} onChange={(e) => setSetupToken(e.target.value)} placeholder="WS_SETUP_TOKEN" style={input} /></div>
        )}

        {isVerify && (
          <>
            <div><span style={label}>{copy.verifyCode}</span><input value={verificationCode} onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder={copy.codeHint} inputMode="numeric" autoComplete="one-time-code" style={{ ...input, letterSpacing: '0.24em', fontSize: '16px' }} onKeyDown={(e) => { if (e.key === 'Enter') void submitVerify() }} /></div>
            {devCode && <div style={{ fontSize: '11px', color: 'var(--text-main)', padding: '8px 10px', borderRadius: '7px', background: 'rgba(128,128,128,0.1)' }}>{copy.devCode}<strong>{devCode}</strong></div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
              <button type="button" style={linkButton} onClick={() => void resend()} disabled={busy}>{copy.resend}</button>
              <button type="button" style={linkButton} onClick={() => { setPhase('register'); setError(''); setNotice('') }}>{copy.editRegistration}</button>
            </div>
          </>
        )}

        {notice && <div style={{ fontSize: '11px', color: 'var(--text-main)', lineHeight: 1.6 }}>{notice}</div>}
        {error && <div style={{ fontSize: '11px', color: 'var(--danger-color)', lineHeight: 1.6 }}>{error}</div>}

        <button type="button" disabled={busy || (isVerify ? !verificationCode.trim() : isSetup || isRegister ? !username.trim() || !email.trim() && isRegister : !username.trim() || !password)}
          onClick={() => void (isVerify ? submitVerify() : isSetup ? submitSetup() : isRegister ? submitRegister() : submitLogin())}
          style={{ ...primaryButton, opacity: busy ? 0.6 : 1, cursor: busy ? 'wait' : 'pointer' }}>
          {busy ? copy.processing : isVerify ? copy.completeRegistration : isSetup ? copy.initialize : isRegister ? copy.submitRegistration : copy.login}
        </button>

        {!isSetup && !isVerify && status?.registration_enabled === false && (
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.6 }}>{copy.registrationClosed}</div>
        )}
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.6 }}>
          {copy.footer}
          {status?.auth_disabled ? copy.localAuth : ''}
        </div>
      </div>
    </div>
  )
}
