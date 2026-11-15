import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  AlertTriangle,
  Check,
  Clapperboard,
  Loader2,
  Scissors,
  ShieldCheck,
  Stethoscope,
  X,
} from 'lucide-react'
import * as writingApi from '../../api/writing'
import type { WritingToolId, WritingToolPatch, WritingToolResponse } from '../../api/writing'

export type ToolSelection = { from: number; to: number; text: string }

type ToolDef = {
  id: WritingToolId
  label: string
  hint: string
  icon: typeof Stethoscope
}

const TOOLS: ToolDef[] = [
  { id: 'clinic', label: '剧情急诊室', hint: '判定 S1-S4 与核心病因', icon: Stethoscope },
  { id: 'surgery', label: '微创手术刀', hint: '最多 3 处精准替换', icon: Scissors },
  { id: 'crash_check', label: '防崩坏排雷仪', hint: '检查 OOC、吃书与注水', icon: ShieldCheck },
  { id: 'storyboard', label: '导演分镜台', hint: '输出纯物理动作分镜', icon: Clapperboard },
]

type Props = {
  worldId: string
  storyId?: string
  getSelection: () => ToolSelection | null
  applyPatch: (patch: WritingToolPatch, range: ToolSelection) => ToolSelection | null
  onToast: (message: string) => void
}

function Badge({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'ok' | 'warn' | 'danger' }) {
  return <span className={`wt-badge is-${tone}`}>{children}</span>
}

function StateBadge({ state }: { state?: string }) {
  const tone = state === 'S1' ? 'ok' : state === 'S2' ? 'warn' : state === 'S3' ? 'warn' : 'danger'
  return <Badge tone={tone}>{state || 'S3'} {state === 'S1' ? '顺畅' : state === 'S2' ? '高张力' : state === 'S3' ? '卡顿' : '崩塌'}</Badge>
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="wt-section">
      <div className="wt-section-title">{title}</div>
      {children}
    </section>
  )
}

function EmptyLine({ children }: { children: ReactNode }) {
  return <p className="wt-empty-line">{children}</p>
}

function ToolResult({ payload, applied, onApply }: {
  payload: WritingToolResponse
  applied: number[]
  onApply: (index: number, patch: WritingToolPatch) => void
}) {
  const { tool_id: toolId, result } = payload

  if (toolId === 'clinic') {
    return (
      <div className="wt-result">
        <div className="wt-result-head">
          <StateBadge state={result.state} />
          <Badge>{result.cause || '待判断'}</Badge>
        </div>
        <Section title="判据">
          <p className="wt-text">{result.state_reason || 'AI 未给出判据。'}</p>
        </Section>
        <Section title="表面症状">
          {(result.symptoms || []).length > 0 ? (
            <ul className="wt-list">{result.symptoms!.map((item, index) => <li key={index}>{item}</li>)}</ul>
          ) : <EmptyLine>没有发现明显症状。</EmptyLine>}
        </Section>
        <Section title="根本原因">
          <p className="wt-text">{result.root_cause || '无法判断。'}</p>
        </Section>
        <Section title="破局方向">
          <p className="wt-quote">{result.direction || 'AI 未给出方向。'}</p>
        </Section>
        <Section title="下一步行动">
          {(result.next_actions || []).length > 0 ? (
            <ol className="wt-steps">{result.next_actions!.map((item, index) => <li key={index}>{item}</li>)}</ol>
          ) : <EmptyLine>没有可执行建议。</EmptyLine>}
        </Section>
      </div>
    )
  }

  if (toolId === 'surgery') {
    return (
      <div className="wt-result">
        <div className="wt-result-head">
          <StateBadge state={result.state} />
          <Badge>{result.cause || '待判断'}</Badge>
        </div>
        {(result.risks || []).length > 0 && (
          <Section title="潜在风险">
            <ul className="wt-list is-warn">{result.risks!.map((item, index) => <li key={index}>{item}</li>)}</ul>
          </Section>
        )}
        <Section title={`修改方案 · ${(result.patches || []).length}/3`}>
          {(result.patches || []).length === 0 ? (
            <EmptyLine>AI 没有给出可安全定位的补丁。</EmptyLine>
          ) : (
            <div className="wt-patches">
              {result.patches!.map((patch, index) => {
                const done = applied.includes(index)
                return (
                  <article className={`wt-patch${done ? ' is-applied' : ''}`} key={index}>
                    <div className="wt-patch-head">
                      <span>{patch.location || `第 ${index + 1} 处`}</span>
                      <Badge>{patch.operation}</Badge>
                    </div>
                    {patch.before && <div className="wt-patch-before">{patch.before}</div>}
                    {patch.after && <div className="wt-patch-after">{patch.after}</div>}
                    <button
                      type="button"
                      className="wt-patch-apply"
                      disabled={done}
                      onClick={() => onApply(index, patch)}
                    >
                      {done ? <><Check size={12} /> 已应用</> : '应用到正文'}
                    </button>
                  </article>
                )
              })}
            </div>
          )}
        </Section>
        {result.new_shot && (
          <Section title="新增分镜">
            <p className="wt-text">{result.new_shot}</p>
          </Section>
        )}
        {result.style_guard && (
          <Section title="文风保护">
            <p className="wt-text">{result.style_guard}</p>
          </Section>
        )}
      </div>
    )
  }

  if (toolId === 'crash_check') {
    const groups: Array<[string, Array<Record<string, any>> | undefined]> = [
      ['人物 OOC', result.ooc],
      ['前后吃书', result.continuity],
      ['节奏失衡', result.pacing],
      ['无效注水', result.water],
    ]
    return (
      <div className="wt-result">
        <div className="wt-result-head">
          <StateBadge state={result.state} />
          <Badge>{result.cause || '待判断'}</Badge>
        </div>
        {groups.map(([label, items]) => (
          <Section key={label} title={label}>
            {(items || []).length === 0 ? (
              <EmptyLine>未发现明显问题。</EmptyLine>
            ) : (
              <div className="wt-checks">
                {items!.map((item, index) => (
                  <div className="wt-check" key={index}>
                    <div className="wt-check-head">
                      <AlertTriangle size={12} />
                      <span>{item.character || item.problem || '需要检查'}</span>
                    </div>
                    {item.problem && item.character && <p className="wt-text">{item.problem}</p>}
                    {item.evidence && <p className="wt-evidence">“{item.evidence}”</p>}
                    {item.fix && <p className="wt-fix">→ {item.fix}</p>}
                  </div>
                ))}
              </div>
            )}
          </Section>
        ))}
        {(result.must_fix || []).length > 0 && (
          <Section title="必须优先修">
            <ol className="wt-steps is-danger">{result.must_fix!.slice(0, 3).map((item, index) => <li key={index}>{item}</li>)}</ol>
          </Section>
        )}
      </div>
    )
  }

  if (toolId === 'storyboard') {
    return (
      <div className="wt-result">
        {result.goal && <Section title="本场唯一目标"><p className="wt-quote">{result.goal}</p></Section>}
        <Section title="动作分镜">
          {(result.shots || []).length === 0 ? <EmptyLine>AI 没有给出分镜。</EmptyLine> : (
            <div className="wt-shots">
              {result.shots!.map((shot, index) => (
                <div className="wt-shot" key={index}>
                  <span className="wt-shot-index">{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <div className="wt-shot-action">{shot.action}</div>
                    <div className="wt-shot-meta">{shot.camera} · {shot.purpose || '推进剧情'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
        <Section title="关键台词">
          {(result.lines || []).length === 0 ? <EmptyLine>AI 没有给出台词。</EmptyLine> : (
            <div className="wt-lines">
              {result.lines!.map((line, index) => (
                <div className="wt-line" key={index}>
                  <Badge tone={line.force === '重' ? 'danger' : line.force === '中' ? 'warn' : 'muted'}>{line.force || '中'}</Badge>
                  <div>
                    <div className="wt-line-speaker">{line.speaker || '—'}</div>
                    <div className="wt-line-text">{line.line}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
        {result.hook && (
          <Section title={`章末悬念 · ${result.hook_type || '危机'}`}>
            <p className="wt-quote">{result.hook}</p>
          </Section>
        )}
      </div>
    )
  }

  return <EmptyLine>该工具暂未在写作面板开放。</EmptyLine>
}

export default function WritingToolbox({ worldId, storyId, getSelection, applyPatch, onToast }: Props) {
  const [running, setRunning] = useState<WritingToolId | null>(null)
  const [activeTool, setActiveTool] = useState<WritingToolId | null>(null)
  const [payload, setPayload] = useState<WritingToolResponse | null>(null)
  const [error, setError] = useState('')
  const [range, setRange] = useState<ToolSelection | null>(null)
  const [applied, setApplied] = useState<number[]>([])

  const run = async (tool: ToolDef) => {
    const selection = getSelection()
    if (!selection || !selection.text.trim()) {
      onToast('先在正文中选中一段文字')
      return
    }
    setRange(selection)
    setApplied([])
    setError('')
    setPayload(null)
    setActiveTool(tool.id)
    setRunning(tool.id)
    try {
      const result = await writingApi.runWritingTool({
        tool_id: tool.id,
        world_id: worldId,
        story_id: storyId,
        text: selection.text,
      })
      setPayload(result)
    } catch (err: any) {
      setError(String(err?.message || err || '工具调用失败'))
    } finally {
      setRunning(null)
    }
  }

  const handleApply = (index: number, patch: WritingToolPatch) => {
    if (!range) {
      onToast('选区已失效，请重新选中文字后再诊断')
      return
    }
    const next = applyPatch(patch, range)
    if (!next) return
    setRange(next)
    setApplied((prev) => (prev.includes(index) ? prev : [...prev, index]))
  }

  const active = TOOLS.find((tool) => tool.id === activeTool)

  return (
    <div className="wt-panel">
      <div className="wt-intro">
        <div className="wt-intro-title">写作工具箱</div>
        <p>选中正文后调用。AI 只给结构化建议，不会自动改稿。</p>
      </div>

      <div className="wt-tools">
        {TOOLS.map((tool) => {
          const Icon = tool.icon
          const isRunning = running === tool.id
          return (
            <button
              key={tool.id}
              type="button"
              className={`wt-tool${activeTool === tool.id ? ' is-active' : ''}`}
              disabled={Boolean(running)}
              onClick={() => void run(tool)}
            >
              <span className="wt-tool-icon">{isRunning ? <Loader2 size={15} className="wt-spin" /> : <Icon size={15} />}</span>
              <span className="wt-tool-copy">
                <strong>{tool.label}</strong>
                <small>{isRunning ? '正在阅读文本…' : tool.hint}</small>
              </span>
            </button>
          )
        })}
      </div>

      {range && (
        <div className="wt-selection">
          本次分析 {range.text.length} 字
          {payload?.meta?.latency_ms ? ` · ${(payload.meta.latency_ms / 1000).toFixed(1)}s` : ''}
        </div>
      )}

      {error && (
        <div className="wt-error">
          <X size={13} />
          <span>{error}</span>
        </div>
      )}

      {running && (
        <div className="wt-loading">
          <Loader2 size={16} className="wt-spin" />
          <div>
            <strong>{active?.label || 'AI'} 正在分析</strong>
            <p>会先诊断，再给可执行的局部建议。</p>
          </div>
        </div>
      )}

      {payload && !running && (
        <ToolResult payload={payload} applied={applied} onApply={handleApply} />
      )}

      {payload && !running && (
        <div className="wt-foot">
          <span>{payload.prompt_version}</span>
          <button type="button" onClick={() => active && void run(active)}>重新分析</button>
        </div>
      )}

      {!payload && !running && !error && (
        <div className="wt-idle">
          <p>建议先做一次「剧情急诊室」，确认是 S3 卡顿还是 S4 崩塌，再决定是否动刀。</p>
          <p>手术刀只允许 3 处，且每一条都要你手动确认后才会写进正文。</p>
        </div>
      )}
    </div>
  )
}
