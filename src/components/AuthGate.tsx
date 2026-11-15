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
      setError(`无法连接后端：${err.message || err}`)
      setPhase('login')
    }
  }

  useEffect(() => { void check() }, [])

  useEffect(() => {
    const onAuthRequired = () => {
      clearAuthToken()
      setPhase('login')
      setError('登录已失效，请重新登录')
    }
    window.addEventListener('ws-auth-required', onAuthRequired)
    return () => window.removeEventListener('ws-auth-required', onAuthRequired)
  }, [])

  const validatePasswords = () => {
    if (password.length < 8) { setError('密码至少 8 个字符'); return false }
    if (password !== confirm) { setError('两次输入的密码不一致'); return false }
    return true
  }

  const submitLogin = async () => {
    setError(''); setNotice('')
    if (!username.trim() || !password) return
    setBusy(true)
    try {
      await authLogin({ username: username.trim(), password })
      resetSecrets()
      setPhase('ready')
    } catch (err: any) {
      setError(String(err.message || err))
    } finally { setBusy(false) }
  }

  const submitSetup = async () => {
    setError(''); setNotice('')
    if (!username.trim()) { setError('请输入用户名'); return }
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
      setPhase('ready')
    } catch (err: any) {
      setError(String(err.message || err))
    } finally { setBusy(false) }
  }

  const submitRegister = async () => {
    setError(''); setNotice('')
    if (!username.trim() || !email.trim()) { setError('请填写用户名和邮箱'); return }
    if (!validatePasswords()) return
    if (status?.invite_required !== false && !inviteCode.trim()) { setError('请输入开发者邀请码'); return }
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
        setNotice(`验证码已发送至 ${result.email}`)
      } else {
        resetSecrets()
        setPhase('ready')
      }
    } catch (err: any) {
      setError(String(err.message || err))
    } finally { setBusy(false) }
  }

  const submitVerify = async () => {
    setError(''); setNotice('')
    if (!verificationCode.trim()) return
    setBusy(true)
    try {
      await authVerifyRegistration({ registration_id: registrationId, code: verificationCode.trim() })
      resetSecrets()
      setPhase('ready')
    } catch (err: any) {
      setError(String(err.message || err))
    } finally { setBusy(false) }
  }

  const resend = async () => {
    setError(''); setNotice('')
    setBusy(true)
    try {
      const result = await authResendRegistration(registrationId)
      setDevCode(result.dev_code || '')
      setNotice('新的验证码已发送')
    } catch (err: any) {
      setError(String(err.message || err))
    } finally { setBusy(false) }
  }

  if (phase === 'ready') return <>{children}</>
  if (phase === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-color)', color: 'var(--text-muted)' }}>
        正在连接账号服务…
      </div>
    )
  }

  const isSetup = phase === 'setup'
  const isRegister = phase === 'register'
  const isVerify = phase === 'verify'
  const title = isSetup ? '首次使用：初始化开发者账号'
    : isVerify ? '验证邮箱'
      : isRegister ? '使用邀请码注册' : '登录世界模拟器'
  const subtitle = isSetup ? '这个账号将成为站点开发者，拥有邀请码与系统配置权限。'
    : isVerify ? '输入邮箱收到的 6 位验证码，完成注册。'
      : isRegister ? '公开注册需要开发者邀请码；邀请码由服务端校验并在注册成功时消耗。'
        : '公开访问 · 使用用户名或邮箱登录'

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', background: 'var(--bg-color)' }}>
      <div className="glass-card" style={{ width: '420px', maxWidth: '100%', padding: '26px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '38px', height: '38px', borderRadius: '9px', background: 'var(--text-main)', color: 'var(--bg-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '20px' }}>W</div>
          <div>
            <div style={{ fontSize: '17px', fontWeight: 600, color: 'var(--text-main)' }}>世界模拟器</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{title}</div>
          </div>
        </div>
        <p style={{ margin: 0, fontSize: '11.5px', lineHeight: 1.7, color: 'var(--text-muted)' }}>{subtitle}</p>

        {!isSetup && !isVerify && (
          <div style={{ display: 'flex', gap: '4px', padding: '3px', border: '1px solid var(--card-border)', borderRadius: '8px', background: 'rgba(128,128,128,0.06)' }}>
            <button type="button" onClick={() => { setPhase('login'); setError(''); setNotice('') }} style={{ flex: 1, padding: '7px', border: 0, borderRadius: '6px', background: phase === 'login' ? 'var(--text-main)' : 'transparent', color: phase === 'login' ? 'var(--bg-color)' : 'var(--text-muted)', fontSize: '11px', cursor: 'pointer' }}>登录</button>
            <button type="button" disabled={status?.registration_enabled === false} onClick={() => { setPhase('register'); setError(''); setNotice('') }} style={{ flex: 1, padding: '7px', border: 0, borderRadius: '6px', background: phase === 'register' ? 'var(--text-main)' : 'transparent', color: phase === 'register' ? 'var(--bg-color)' : 'var(--text-muted)', fontSize: '11px', cursor: status?.registration_enabled === false ? 'not-allowed' : 'pointer', opacity: status?.registration_enabled === false ? 0.45 : 1 }}>注册</button>
          </div>
        )}

        {isSetup && (
          <>
            <div><span style={label}>开发者用户名</span><input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="例如：lan" autoComplete="username" style={input} /></div>
            <div><span style={label}>显示名称</span><input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="可选" style={input} /></div>
            <div><span style={label}>邮箱（建议填写）</span><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="用于账号识别" autoComplete="email" style={input} /></div>
          </>
        )}

        {isRegister && (
          <>
            {status?.invite_required !== false && (
              <div><span style={label}>开发者邀请码</span><input value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} placeholder="WS-XXXX-XXXX-XXXX" autoComplete="off" style={input} /></div>
            )}
            <div><span style={label}>用户名</span><input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="2–32 位，中英文/数字/下划线" autoComplete="username" style={input} /></div>
            <div><span style={label}>邮箱</span><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" style={input} /></div>
            <div><span style={label}>显示名称</span><input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="可选" style={input} /></div>
          </>
        )}

        {!isVerify && (
          <>
            {phase === 'login' && <div><span style={label}>用户名或邮箱</span><input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="用户名或邮箱" autoComplete="username" style={input} onKeyDown={(e) => { if (e.key === 'Enter') void submitLogin() }} /></div>}
            <div><span style={label}>密码</span><input value={password} onChange={(e) => setPassword(e.target.value)} placeholder={isSetup || isRegister ? '至少 8 位' : '密码'} type="password" autoComplete={isSetup || isRegister ? 'new-password' : 'current-password'} style={input} onKeyDown={(e) => { if (e.key === 'Enter') void (isSetup ? submitSetup() : isRegister ? submitRegister() : submitLogin()) }} /></div>
            {(isSetup || isRegister) && <div><span style={label}>确认密码</span><input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="再次输入密码" type="password" autoComplete="new-password" style={input} onKeyDown={(e) => { if (e.key === 'Enter') void (isSetup ? submitSetup() : submitRegister()) }} /></div>}
          </>
        )}

        {isSetup && status?.setup_token_required && (
          <div><span style={label}>部署初始化令牌</span><input value={setupToken} onChange={(e) => setSetupToken(e.target.value)} placeholder="WS_SETUP_TOKEN" style={input} /></div>
        )}

        {isVerify && (
          <>
            <div><span style={label}>邮箱验证码</span><input value={verificationCode} onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6 位数字" inputMode="numeric" autoComplete="one-time-code" style={{ ...input, letterSpacing: '0.24em', fontSize: '16px' }} onKeyDown={(e) => { if (e.key === 'Enter') void submitVerify() }} /></div>
            {devCode && <div style={{ fontSize: '11px', color: 'var(--text-main)', padding: '8px 10px', borderRadius: '7px', background: 'rgba(128,128,128,0.1)' }}>开发模式验证码：<strong>{devCode}</strong></div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
              <button type="button" style={linkButton} onClick={() => void resend()} disabled={busy}>重新发送验证码</button>
              <button type="button" style={linkButton} onClick={() => { setPhase('register'); setError(''); setNotice('') }}>修改注册信息</button>
            </div>
          </>
        )}

        {notice && <div style={{ fontSize: '11px', color: 'var(--text-main)', lineHeight: 1.6 }}>{notice}</div>}
        {error && <div style={{ fontSize: '11px', color: 'var(--danger-color)', lineHeight: 1.6 }}>{error}</div>}

        <button type="button" disabled={busy || (isVerify ? !verificationCode.trim() : isSetup || isRegister ? !username.trim() || !email.trim() && isRegister : !username.trim() || !password)}
          onClick={() => void (isVerify ? submitVerify() : isSetup ? submitSetup() : isRegister ? submitRegister() : submitLogin())}
          style={{ ...primaryButton, opacity: busy ? 0.6 : 1, cursor: busy ? 'wait' : 'pointer' }}>
          {busy ? '处理中…' : isVerify ? '完成注册' : isSetup ? '初始化并进入' : isRegister ? '提交注册' : '登录'}
        </button>

        {!isSetup && !isVerify && status?.registration_enabled === false && (
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.6 }}>当前站点暂未开放注册。请联系开发者获取开放时间。</div>
        )}
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.6 }}>
          公开访问 · 邀请码由服务端验证 · 会话 30 天
          {status?.auth_disabled ? '（当前后端已关闭鉴权，仅用于本地测试）' : ''}
        </div>
      </div>
    </div>
  )
}
