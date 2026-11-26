/**
 * 统一层级导航：用「< 上一级 / > 下一级」符号代替往返式层级文本。
 *
 * 背景：此前面包屑与侧栏都以文本层级（世界模拟器 / 创作与体验 / 创作中心）
 * 表达往返路径，占用导航且层级重复。现统一收敛为符号化层级导航：
 * 中间显示当前层级，左右两个符号在层级间移动，边界自动禁用。
 *
 * 面包屑与侧栏分组共用本组件，保证两套导航的交互与视觉完全一致。
 */
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Lang, PageKey } from '../../navigation/types'

export interface LevelOption {
  /** 稳定标识，用于 React key。 */
  key: string
  label: string
  /** 可跳转的目标页；缺省表示该层级不可跳转。 */
  page?: PageKey
}

interface LevelNavigatorProps {
  levels: LevelOption[]
  /** 当前所在层级的下标。 */
  currentIndex: number
  onNavigate: (page: PageKey) => void
  lang: Lang
  /** 紧凑模式：用于侧栏分组切换。 */
  compact?: boolean
}

export default function LevelNavigator({
  levels,
  currentIndex,
  onNavigate,
  lang,
  compact = false,
}: LevelNavigatorProps) {
  if (levels.length === 0) return null
  const safeIndex = Math.min(Math.max(currentIndex, 0), levels.length - 1)
  const current = levels[safeIndex]
  const previous = levels[safeIndex - 1]
  const next = levels[safeIndex + 1]

  const label = lang === 'zh' ? '上一级' : 'Previous level'
  const nextLabel = lang === 'zh' ? '下一级' : 'Next level'

  return (
    <div className={`ws-level-nav${compact ? ' is-compact' : ''}`}>
      <button
        type="button"
        className="ws-level-btn"
        disabled={!previous}
        onClick={() => { if (previous?.page) onNavigate(previous.page) }}
        aria-label={label}
        title={label}
      >
        <ChevronLeft size={compact ? 15 : 14} strokeWidth={1.9} aria-hidden="true" />
      </button>
      <span className="ws-level-label" title={current.label}>{current.label}</span>
      <button
        type="button"
        className="ws-level-btn"
        disabled={!next}
        onClick={() => { if (next?.page) onNavigate(next.page) }}
        aria-label={nextLabel}
        title={nextLabel}
      >
        <ChevronRight size={compact ? 15 : 14} strokeWidth={1.9} aria-hidden="true" />
      </button>
    </div>
  )
}
