import { useEffect, useState } from 'react'
import {
  DEFAULT_AI_BASE_URL,
  DEFAULT_AI_MODEL,
  clearAiSettings,
  loadAiSettings,
  maskApiKey,
  saveAiSettings,
} from '../api/aiSettings'

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '9px',
  border: '1px solid var(--card-border)',
  background: 'rgba(128,128,128,0.08)',
  color: 'var(--text-main)',
  fontSize: '12px',
  outline: 'none',
} as const

const labelStyle = {
  display: 'block',
  marginBottom: '6px',
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--text-main)',
} as const

export default function AiAccessModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState(DEFAULT_AI_BASE_URL)
  const [model, setModel] = useState(DEFAULT_AI_MODEL)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    if (!open) return
    const settings = loadAiSettings()
    setApiKey(settings.apiKey)
    setBaseUrl(settings.baseUrl)
    setModel(settings.model)
    setResult(null)
  }, [open])

  if (!open) return null

  const saveAndTest = async () => {
    if (!apiKey.trim()) {
      setResult({ ok: false, text: '请先填写自己的 API Key。' })
      return
    }
    setBusy(true)
    setResult(null)
    saveAiSettings({ apiKey, baseUrl, model })
    onSaved()
    try {
      const res = await fetch('http://127.0.0.1:8000/api/ai/status?probe=true')
      const data = await res.json()
      if (data.probe_ok) {
        setResult({ ok: true, text: `连接正常：${data.model}（${maskApiKey(apiKey)}）` })
      } else {
        setResult({ ok: false, text: data.probe_error || data.message || '连接失败，请检查 Key、Base URL 和模型名。' })
      }
    } catch (error: any) {
      setResult({ ok: false, text: `无法连接后端：${String(error.message || error)}` })
    } finally {
      setBusy(false)
    }
  }

  const clear = () => {
    clearAiSettings()
    setApiKey('')
    setResult({ ok: true, text: '已清除本浏览器保存的 Key。若站长关闭了共享 Key，请重新填写后才能使用 AI。' })
    onSaved()
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(0,0,0,0.58)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '88vh',
          overflowY: 'auto',
          borderRadius: '16px',
          border: '1px solid var(--card-border)',
          background: 'var(--bg-color)',
          color: 'var(--text-main)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.28)',
        }}
      >
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px' }}>AI 接入设置</h2>
            <p style={{ margin: '5px 0 0', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.7 }}>
              填写你自己的 API Key，AI 推演与写作只消耗你的额度。
            </p>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', fontSize: '22px', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={labelStyle}>API Key</label>
            <input
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="sk-..."
              style={inputStyle}
            />
            <p style={{ margin: '6px 0 0', fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.7 }}>
              Key 只保存在当前浏览器的 localStorage，并随 AI 请求头发送；不会写入服务器数据库。
              不要在公共电脑保存。
            </p>
          </div>

          <div>
            <label style={labelStyle}>Base URL</label>
            <input
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder={DEFAULT_AI_BASE_URL}
              style={inputStyle}
            />
            <p style={{ margin: '6px 0 0', fontSize: '10px', color: 'var(--text-muted)' }}>
              硅基流动填 https://api.siliconflow.cn/v1；DeepSeek 填 https://api.deepseek.com。
            </p>
          </div>

          <div>
            <label style={labelStyle}>模型名</label>
            <input
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder={DEFAULT_AI_MODEL}
              style={inputStyle}
            />
          </div>

          <div style={{ padding: '10px 12px', borderRadius: '9px', border: '1px solid var(--card-border)', background: 'rgba(128,128,128,0.06)', fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.8 }}>
            如果站长开启了共享 Key，不填写也可以使用站长的额度；公开部署建议关闭共享 Key。
            保存后，本浏览器访问该网站时所有 AI 操作都会使用这份配置。
          </div>

          {result && (
            <div style={{ padding: '10px 12px', borderRadius: '9px', border: `1px solid ${result.ok ? 'var(--primary-color)' : 'var(--danger-color)'}`, color: result.ok ? 'var(--text-main)' : 'var(--danger-color)', fontSize: '11px', lineHeight: 1.7 }}>
              {result.text}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={clear}
              disabled={busy}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-muted)', fontSize: '11px', cursor: 'pointer' }}
            >
              清除本机 Key
            </button>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={onClose}
                disabled={busy}
                style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)', fontSize: '11px', cursor: 'pointer' }}
              >
                关闭
              </button>
              <button
                onClick={() => void saveAndTest()}
                disabled={busy}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--primary-color)', background: 'var(--primary-color)', color: 'var(--primary-text)', fontSize: '11px', fontWeight: 700, cursor: busy ? 'wait' : 'pointer' }}
              >
                {busy ? '测试中…' : '保存并测试'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
