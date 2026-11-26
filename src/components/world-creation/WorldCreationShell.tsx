/**
 * 世界创作导航页面的共享外壳与基础控件。
 *
 * 创作导航的 7 个条目（背景 / 设定 / 地图 / 作品 / 插画集 / 共创 / 社区）
 * 都是世界级页面，统一使用本外壳，保证页头、卡片、表单与空态一致。
 */
import type { CSSProperties, ReactNode } from 'react'

export function WorldCreationPage({
  title,
  subtitle,
  icon,
  error,
  onRetry,
  children,
}: {
  title: string
  subtitle?: string
  icon?: ReactNode
  error?: string
  onRetry?: () => void
  children: ReactNode
}) {
  return (
    <div className="wc-page">
      <div className="wc-head">
        <div className="wc-head-copy">
          <h1 className="wc-title">
            {icon && <span className="wc-title-icon">{icon}</span>}
            {title}
          </h1>
          {subtitle && <p className="wc-sub">{subtitle}</p>}
        </div>
      </div>
      {error && (
        <div className="wc-error" role="alert">
          <span>{error}</span>
          {onRetry && (
            <button type="button" className="wc-btn" onClick={onRetry}>
              { '重试' }
            </button>
          )}
        </div>
      )}
      {children}
    </div>
  )
}

export function Card({ title, aside, children, padded = true }: {
  title?: ReactNode
  aside?: ReactNode
  children: ReactNode
  padded?: boolean
}) {
  return (
    <section className="wc-card">
      {(title || aside) && (
        <div className="wc-card-head">
          <div className="wc-card-title">{title}</div>
          {aside}
        </div>
      )}
      <div className={padded ? 'wc-card-body' : ''}>{children}</div>
    </section>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="wc-field">
      <span className="wc-field-label">{label}</span>
      {children}
      {hint && <span className="wc-field-hint">{hint}</span>}
    </label>
  )
}

export function TextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <input
      className="wc-input"
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

export function TextArea({
  value,
  onChange,
  placeholder,
  rows = 5,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <textarea
      className="wc-textarea"
      rows={rows}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

export function Select({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <select className="wc-select" value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  )
}

export function Btn({
  children,
  onClick,
  kind = 'ghost',
  disabled,
  type = 'button',
}: {
  children: ReactNode
  onClick?: () => void
  kind?: 'ghost' | 'primary' | 'danger'
  disabled?: boolean
  type?: 'button' | 'submit'
}) {
  return (
    <button
      type={type}
      className={`wc-btn is-${kind}`}
      disabled={disabled}
      onClick={onClick}
      style={disabled ? ({ opacity: 0.5, cursor: 'not-allowed' } as CSSProperties) : undefined}
    >
      {children}
    </button>
  )
}

export function Empty({ text }: { text: string }) {
  return <div className="wc-empty">{text}</div>
}

export function Tag({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'accent' | 'warn' }) {
  return <span className={`wc-tag is-${tone}`}>{children}</span>
}

export function formatDate(value?: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' })
}
