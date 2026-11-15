import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, X, XCircle } from 'lucide-react'
import * as writingApi from '../../api/writing'

type ReviewTool = 'reader_sim' | 'release_check'

type Props = {
  toolId: ReviewTool
  storyId?: string
  worldId: string
  onClose: () => void
  onToast: (message: string) => void
}

function scoreTone(score: number) {
  if (score >= 8) return 'ok'
  if (score >= 6) return 'warn'
  return 'danger'
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'pass') return <CheckCircle2 size={13} />
  if (status === 'fail') return <XCircle size={13} />
  return <AlertTriangle size={13} />
}

export default function WritingReview({ toolId, storyId, worldId, onClose, onToast }: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [payload, setPayload] = useState<writingApi.WritingToolResponse | null>(null)

  const run = useCallback(async () => {
    setLoading(true)
    setError('')
    setPayload(null)
    try {
      const result = await writingApi.runWritingTool({
        tool_id: toolId,
        story_id: storyId,
        world_id: worldId,
      })
      setPayload(result)
    } catch (err: any) {
      setError(String(err?.message || err || '检查失败'))
    } finally {
      setLoading(false)
    }
  }, [toolId, storyId, worldId])

  useEffect(() => {
    void run()
  }, [run])

  const title = toolId === 'reader_sim' ? '读者模拟' : '发布检查'
  const result = payload?.result

  return (
    <div className="wr-overlay" onClick={onClose}>
      <div className="wr-modal" onClick={(event) => event.stopPropagation()}>
        <header className="wr-head">
          <div>
            <div className="wr-kicker">{toolId === 'reader_sim' ? 'READER SIMULATION' : 'RELEASE CHECK'}</div>
            <h2>{title}</h2>
            <p>{toolId === 'reader_sim' ? '三类读者同时读本章：爽点、逻辑、留存。' : '发布前八项自查，先修阻塞项。'}</p>
          </div>
          <button type="button" className="wr-close" onClick={onClose} aria-label="关闭"><X size={16} /></button>
        </header>

        <div className="wr-body">
          {loading && (
            <div className="wr-loading">
              <Loader2 size={18} className="wt-spin" />
              <div>
                <strong>正在读本章</strong>
                <p>会按固定角色/清单输出，不自动改稿。</p>
              </div>
            </div>
          )}

          {error && (
            <div className="wr-error">
              <XCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          {!loading && result && toolId === 'reader_sim' && (
            <div className="wr-personas">
              {(result.personas || []).map((persona: any, index: number) => (
                <article className={`wr-persona is-${scoreTone(Number(persona.score) || 0)}`} key={index}>
                  <div className="wr-persona-head">
                    <strong>{persona.name}</strong>
                    <span className="wr-score">{persona.score ?? '—'}<small>/10</small></span>
                  </div>
                  <div className="wr-score-bar"><span style={{ width: `${Math.max(0, Math.min(100, (Number(persona.score) || 0) * 10))}%` }} /></div>
                  <p className="wr-praise">{persona.praise || '—'}</p>
                  <p className="wr-roast">{persona.roast || '—'}</p>
                  <div className="wr-risk">弃书风险 · {persona.drop_risk || '—'}</div>
                </article>
              ))}
              {result.overall && <div className="wr-overall">{result.overall}</div>}
            </div>
          )}

          {!loading && result && toolId === 'release_check' && (
            <div className="wr-checklist">
              {(result.checklist || []).map((item: any) => (
                <div className={`wr-check is-${item.status || 'warn'}`} key={item.id || item.label}>
                  <div className="wr-check-icon"><StatusIcon status={item.status} /></div>
                  <div className="wr-check-copy">
                    <div className="wr-check-title">
                      <strong>{item.label}</strong>
                      <span>{item.status === 'pass' ? '通过' : item.status === 'fail' ? '阻塞' : '警告'}</span>
                    </div>
                    {item.evidence && <p className="wr-evidence">“{item.evidence}”</p>}
                    {item.fix && <p className="wr-fix">→ {item.fix}</p>}
                  </div>
                </div>
              ))}
              {(result.blockers || []).length > 0 && (
                <div className="wr-blockers">
                  <div>发布前必须处理</div>
                  <ol>{result.blockers!.map((item: string, index: number) => <li key={index}>{item}</li>)}</ol>
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="wr-foot">
          <span>{payload?.prompt_version || 'esa-writer-v1'}{payload?.meta?.latency_ms ? ` · ${(payload.meta.latency_ms / 1000).toFixed(1)}s` : ''}</span>
          <div>
            <button type="button" className="wr-btn" onClick={() => void run()} disabled={loading}>
              <RefreshCw size={12} /> 重新检查
            </button>
            <button
              type="button"
              className="wr-btn is-primary"
              onClick={() => {
                if (error) {
                  onToast(error)
                  return
                }
                onClose()
              }}
            >
              {error ? '知道了' : '关闭'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
