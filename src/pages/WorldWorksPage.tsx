/**
 * 作品：一个世界的主作品与副作品、同人文、人物传记。
 *
 * 聚合引用了当前世界的创意作品（CreativeWork.world_ids），后端按创建顺序
 * 判定主作品，其余归为副作品；分类含「同人」归为同人文，传记/日记归为传记。
 */
import { useEffect, useState } from 'react'
import { ArrowRight, BookOpen } from 'lucide-react'
import * as api from '../api/worldCreation'
import type { WorldWork, WorldWorkKind } from '../api/worldCreation'
import { Card, Empty, Tag, WorldCreationPage, formatDate } from '../components/world-creation/WorldCreationShell'
import '../styles/world-creation.css'

const GROUPS: Array<{ kind: WorldWorkKind; title: string }> = [
  { kind: 'main', title: '主作品' },
  { kind: 'side', title: '副作品' },
  { kind: 'fanfic', title: '同人文' },
  { kind: 'biography', title: '人物传记' },
]

const SCENE_LABELS: Record<string, string> = {
  game: '游戏',
  literature: '文学',
  comic: '漫画',
  companion: '虚拟角色',
  diary: '日记',
}

const STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  in_progress: '进行中',
  completed: '已完成',
  archived: '已归档',
}

export default function WorldWorksPage({ worldId, onSelectWork }: { worldId: string; onSelectWork: (work: WorldWork) => void }) {
  const [works, setWorks] = useState<WorldWork[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      setWorks(await api.listWorldWorks(worldId))
    } catch (err) {
      setError(String((err as Error).message || err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [worldId])

  return (
    <WorldCreationPage
      title="作品"
      subtitle="这个世界下的主作品、副作品、同人文与人物传记"
      icon={<BookOpen size={16} />}
      error={error}
      onRetry={load}
    >
      {loading ? (
        <Card><Empty text="加载中…" /></Card>
      ) : works.length === 0 ? (
        <Card><Empty text="这个世界还没有关联作品，可到「我的作品」中创建并关联本世界。" /></Card>
      ) : (
        GROUPS.map((group) => {
          const items = works.filter((work) => work.work_kind === group.kind)
          return (
            <Card key={group.kind} title={`${group.title}（${items.length}）`}>
              {items.length === 0 ? (
                <Empty text={`暂无${group.title}`} />
              ) : (
                <div className="wc-list">
                  {items.map((work) => (
                    <div className="wc-row" key={work.id}>
                      <div className="wc-row-copy">
                        <div className="wc-row-title">{work.title}</div>
                        <div className="wc-row-meta">
                          {work.summary || '暂无简介'}
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                          <Tag tone="accent">{SCENE_LABELS[work.scene] || work.scene}</Tag>
                          {work.category && <Tag>{work.category}</Tag>}
                          <Tag tone={work.status === 'completed' ? 'accent' : 'muted'}>{STATUS_LABELS[work.status] || work.status}</Tag>
                          <Tag>更新于 {formatDate(work.updated_at)}</Tag>
                        </div>
                      </div>
                      <span className="wc-row-actions">
                        <button type="button" className="wc-row-select" onClick={() => onSelectWork(work)}>
                          选择作品<ArrowRight size={13} aria-hidden="true" />
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )
        })
      )}
    </WorldCreationPage>
  )
}
