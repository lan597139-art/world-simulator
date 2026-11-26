import { useEffect, useState } from 'react'
import { publicFeed, type PublicWork } from '../api/community'

export default function CommunityPublicWorks({
  onOpen,
}: {
  /** 打开统一作品详情页。 */
  onOpen?: (work: PublicWork) => void
}) {
  const [rows, setRows] = useState<PublicWork[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    publicFeed().then(setRows).catch((err) => setError(err instanceof Error ? err.message : String(err)))
  }, [])

  if (error) return <div style={{ padding: 12, fontSize: 12, color: 'var(--danger-color)' }}>公开作品读取失败：{error}</div>
  if (rows.length === 0) return null

  return (
    <section id="community-public-works" style={{ margin: '0 0 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 16, color: 'var(--text-main)' }}>公开作品</h2>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>来自 Journal / 传记的不可变公开快照</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
        {rows.slice(0, 6).map((row) => (
          <article
            key={row.public_id}
            className="glass-card"
            role="button"
            tabIndex={0}
            style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6, cursor: 'pointer' }}
            onClick={() => onOpen?.(row)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onOpen?.(row)
              }
            }}
          >
            <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--primary-color)', textTransform: 'uppercase' }}>{row.work_type}</span>
            <strong style={{ fontSize: 13, color: 'var(--text-main)' }}>{row.title}</strong>
            <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', maxHeight: 54, overflow: 'hidden' }}>{row.summary || '公开作品'}</p>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{row.author_display} · 阅读 {row.view_count} · 点击 {row.click_count} · 评论 {row.comment_count} · 收藏 {row.favorite_count}</span>
          </article>
        ))}
      </div>
    </section>
  )
}
