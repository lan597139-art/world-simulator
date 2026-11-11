import { useEffect, useState } from 'react'
import { authLogin, authSetup, authStatus, type AuthStatus } from '../api/auth'
import { clearAuthToken } from '../api/authToken'

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<'loading' | 'login' | 'setup' | 'ready'>('loading')
  const [status, setStatus] = useState<AuthStatus | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [setupToken, setSetupToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const check = async () => {
    try {
      const data = await authStatus()
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

  const submit = async () => {
    setError('')
    if (!username.trim() || !password) return
    if (phase === 'setup' && password !== confirm) { setError('两次输入的密码不一致'); return }
    if (phase === 'setup' && password.length < 8) { setError('密码至少 8 个字符'); return }
    setBusy(true)
    try {
      if (phase === 'setup') await authSetup({ username: username.trim(), password, display_name: displayName.trim() || undefined, setup_token: setupToken.trim() || undefined })
      else await authLogin({ username: username.trim(), password })
      setPassword(''); setConfirm('')
      setPhase('ready')
    } catch (err: any) {
      setError(String(err.message || err))
    } finally {
      setBusy(false)
    }
  }

  if (phase === 'ready') return <>{children}</>
  if (phase === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-color)', color: 'var(--text-muted)' }}>
        正在检查本地账号…
      </div>
    )
  }

  const isSetup = phase === 'setup'
  const input: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '8px',
    border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)', fontSize: '13px',
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', background: 'var(--bg-color)' }}>
      <div className="glass-card" style={{ width: '380px', maxWidth: '100%', padding: '26px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '38px', height: '38px', borderRadius: '9px', background: 'var(--text-main)', color: 'var(--bg-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '20px' }}>W</div>
          <div>
            <div style={{ fontSize: '17px', fontWeight: 600, color: 'var(--text-main)' }}>世界模拟器</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{isSetup ? '首次使用：初始化本地账号' : '本地账号登录'}</div>
          </div>
        </div>
        <p style={{ margin: 0, fontSize: '11.5px', lineHeight: 1.7, color: 'var(--text-muted)' }}>
          {isSetup ? '账号只保存在这台设备的本地数据库中，用于保护世界与日记。请记住密码，目前不提供找回。' : '输入本地账号的用户名与密码。'}
        </p>
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="用户名" autoComplete="username" style={input} />
        {isSetup && <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="显示名称（可选）" style={input} />}
        {isSetup && status?.setup_token_required && <input value={setupToken} onChange={(e) => setSetupToken(e.target.value)} placeholder="部署初始化令牌" style={input} />}
        <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder={isSetup ? '密码（至少 8 位）' : '密码'} type="password" autoComplete={isSetup ? 'new-password' : 'current-password'} style={input} onKeyDown={(e) => { if (e.key === 'Enter') void submit() }} />
        {isSetup && <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="再次输入密码" type="password" autoComplete="new-password" style={input} onKeyDown={(e) => { if (e.key === 'Enter') void submit() }} />}
        {error && <div style={{ fontSize: '11px', color: 'var(--danger-color)', lineHeight: 1.6 }}>{error}</div>}
        <button type="button" disabled={busy || !username.trim() || !password} onClick={() => void submit()}
          style={{ padding: '10px', borderRadius: '8px', border: 'none', background: 'var(--text-main)', color: 'var(--bg-color)', fontWeight: 600, cursor: busy ? 'wait' : 'pointer' }}>
          {busy ? '处理中…' : isSetup ? '初始化并进入' : '登录'}
        </button>
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.6 }}>
          单用户本地锁 · 不是公网多租户系统
          {status?.auth_disabled ? '（当前后端已关闭鉴权）' : ''}
        </div>
      </div>
    </div>
  )
}
