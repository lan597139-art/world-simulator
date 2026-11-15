import { useMemo } from 'react'
import { X } from 'lucide-react'
import type { StoryItem } from '../../api/writing'
import type { WritingChapter, WritingVolume } from '../../api/writingVolumes'

type Props = {
  stories: StoryItem[]
  volumes: WritingVolume[]
  chapters: WritingChapter[]
  current?: StoryItem | null
  onClose: () => void
}

function readDaily(): Record<string, number> {
  try {
    const raw = localStorage.getItem('ws.write.daily')
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export default function WritingStats({ stories, volumes, chapters, current, onClose }: Props) {
  const total = stories.reduce((sum, story) => sum + (story.word_count || 0), 0)
  const today = new Date().toISOString().slice(0, 10)
  const daily = readDaily()
  const days = useMemo(() => {
    const result: Array<{ date: string; words: number }> = []
    for (let index = 6; index >= 0; index -= 1) {
      const date = new Date()
      date.setDate(date.getDate() - index)
      const key = date.toISOString().slice(0, 10)
      result.push({ date: key, words: Number(daily[key] || 0) })
    }
    return result
  }, [daily])
  const maxDaily = Math.max(1, ...days.map((day) => day.words))
  const target = volumes.reduce((sum, volume) => sum + (volume.target_words || 0), 0)
  const progress = target > 0 ? Math.min(100, Math.round((total / target) * 100)) : 0
  const ranked = [...stories].sort((a, b) => (b.word_count || 0) - (a.word_count || 0)).slice(0, 5)
  const readingMinutes = Math.max(1, Math.round(total / 400))

  return (
    <div className="ws-stats-overlay" role="dialog" aria-modal="true" aria-label="码字统计">
      <div className="ws-stats-modal">
        <header>
          <div>
            <div className="ws-stats-kicker">WRITING TELEMETRY</div>
            <h2>码字统计</h2>
            <p>只统计本地写作库，不上报，不参与 AI 训练。</p>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭"><X size={15} /></button>
        </header>

        <div className="ws-stats-metrics">
          <div><span>全稿</span><strong>{total.toLocaleString()}</strong><small>字</small></div>
          <div><span>章节</span><strong>{stories.length}</strong><small>章</small></div>
          <div><span>今日</span><strong>{(daily[today] || 0).toLocaleString()}</strong><small>字</small></div>
          <div><span>预计阅读</span><strong>{readingMinutes}</strong><small>分钟</small></div>
        </div>

        <section className="ws-stats-section">
          <div className="ws-stats-title"><strong>近 7 日字数</strong><span>按当天最高记录</span></div>
          <div className="ws-stats-bars">
            {days.map((day) => (
              <div key={day.date} className="ws-stats-bar">
                <span className="ws-stats-bar-fill" style={{ height: `${Math.max(2, (day.words / maxDaily) * 100)}%` }} title={`${day.words} 字`} />
                <small>{day.date.slice(5)}</small>
              </div>
            ))}
          </div>
        </section>

        {volumes.length > 0 && (
          <section className="ws-stats-section">
            <div className="ws-stats-title"><strong>卷进度</strong><span>{target > 0 ? `总目标 ${target.toLocaleString()} 字 · ${progress}%` : '未设总目标'}</span></div>
            <div className="ws-stats-volumes">
              {volumes.map((volume) => {
                const value = volume.target_words > 0 ? Math.min(100, Math.round((volume.word_count / volume.target_words) * 100)) : 0
                return (
                  <div key={volume.id} className="ws-stats-volume">
                    <div><span>{volume.title}</span><small>{volume.word_count}/{volume.target_words || '—'} 字</small></div>
                    <span className="ws-stats-track"><span style={{ width: `${value}%` }} /></span>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        <section className="ws-stats-section">
          <div className="ws-stats-title"><strong>章节排行</strong><span>按字数</span></div>
          <ol className="ws-stats-list">
            {ranked.map((story, index) => (
              <li key={story.id} className={current?.id === story.id ? 'is-current' : ''}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{story.title}</strong>
                <em>{story.word_count || 0} 字</em>
              </li>
            ))}
            {ranked.length === 0 && <li><strong>还没有章节</strong></li>}
          </ol>
        </section>

        <footer>
          <span>{chapters.length} 章已进入目录</span>
          <button type="button" onClick={onClose}>关闭</button>
        </footer>
      </div>
    </div>
  )
}
