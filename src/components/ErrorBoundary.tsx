import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  onReset?: () => void
}

interface State {
  error: Error | null
}

/**
 * 页面级错误边界：单个页面崩溃时不应把整个应用变成白屏。
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('页面渲染失败', error, info)
  }

  reset = () => {
    this.setState({ error: null })
    this.props.onReset?.()
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div style={{ padding: '48px 32px', color: 'var(--text-main)', maxWidth: '720px', margin: '0 auto' }}>
        <div style={{ fontSize: '18px', marginBottom: '10px' }}>这个页面渲染出错了</div>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
          页面没有白屏，说明其他数据仍在。可以重试，或回到世界总览。
        </div>
        <pre
          style={{
            fontSize: '11px',
            color: 'var(--danger-color)',
            background: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
            borderRadius: '10px',
            padding: '12px',
            overflow: 'auto',
            maxHeight: '220px',
            whiteSpace: 'pre-wrap',
          }}
        >
          {this.state.error.message}
        </pre>
        <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
          <button
            onClick={this.reset}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid var(--primary-color)',
              background: 'var(--primary-color)',
              color: 'var(--primary-text)',
              cursor: 'pointer',
            }}
          >
            重试
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid var(--card-border)',
              background: 'transparent',
              color: 'var(--text-main)',
              cursor: 'pointer',
            }}
          >
            重新加载页面
          </button>
        </div>
      </div>
    )
  }
}
