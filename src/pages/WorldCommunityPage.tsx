/**
 * 社区：该世界下的社区讨论区。
 *
 * 与全站公共社区隔离：只展示 world_id 属于当前世界的话题与群组，
 * 支持在本世界下发起讨论与创建群组。
 */
import { useEffect, useState } from 'react'
import { MessagesSquare, Plus, Users } from 'lucide-react'
import * as api from '../api/worldCreation'
import { Btn, Card, Empty, Field, TextArea, TextInput, WorldCreationPage, formatDate } from '../components/world-creation/WorldCreationShell'
import '../styles/world-creation.css'

export default function WorldCommunityPage({ worldId }: { worldId: string }) {
  const [data, setData] = useState<api.WorldCommunity>({ topics: [], groups: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [topicForm, setTopicForm] = useState({ title: '', body: '' })
  const [groupForm, setGroupForm] = useState({ name: '', description: '' })
  const [posting, setPosting] = useState(false)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      setData(await api.listWorldCommunity(worldId))
    } catch (err) {
      setError(String((err as Error).message || err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [worldId])

  const submitTopic = async () => {
    if (topicForm.title.trim().length < 2 || topicForm.body.trim().length < 2) {
      setError('标题与正文至少各 2 个字符')
      return
    }
    setPosting(true)
    setError('')
    try {
      await api.createWorldTopic(worldId, topicForm)
      setTopicForm({ title: '', body: '' })
      await load()
    } catch (err) {
      setError(String((err as Error).message || err))
    } finally {
      setPosting(false)
    }
  }

  const submitGroup = async () => {
    if (groupForm.name.trim().length < 2) {
      setError('群组名称至少 2 个字符')
      return
    }
    setPosting(true)
    setError('')
    try {
      await api.createWorldGroup(worldId, groupForm)
      setGroupForm({ name: '', description: '' })
      await load()
    } catch (err) {
      setError(String((err as Error).message || err))
    } finally {
      setPosting(false)
    }
  }

  return (
    <WorldCreationPage
      title="社区"
      subtitle="这个世界下的讨论区：话题与群组"
      icon={<MessagesSquare size={16} />}
      error={error}
      onRetry={load}
    >
      {loading && <Card><Empty text="加载中…" /></Card>}
      {!loading && (
        <>
          <Card title="发起讨论">
            <div className="wc-form-row">
              <Field label="标题">
                <TextInput value={topicForm.title} onChange={(value) => setTopicForm((prev) => ({ ...prev, title: value }))} placeholder="讨论主题" />
              </Field>
            </div>
            <Field label="正文">
              <TextArea rows={4} value={topicForm.body} onChange={(value) => setTopicForm((prev) => ({ ...prev, body: value }))} placeholder="展开你的讨论…" />
            </Field>
            <div style={{ display: 'flex', gap: 10 }}>
              <Btn kind="primary" onClick={submitTopic} disabled={posting}><Plus size={13} /> 发布讨论</Btn>
            </div>
          </Card>

          <Card title={`讨论话题（${data.topics.length}）`}>
            {data.topics.length === 0 ? (
              <Empty text="这个世界还没有讨论话题。" />
            ) : (
              <div className="wc-list">
                {data.topics.map((topic) => (
                  <div className="wc-row" key={topic.id}>
                    <div className="wc-row-copy">
                      <div className="wc-row-title">{topic.title}</div>
                      <div className="wc-row-meta">
                        {topic.body}
                        <br />
                        {topic.category} · 浏览 {topic.view_count} · {formatDate(topic.created_at)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card
            title={`世界群组（${data.groups.length}）`}
            aside={<span className="wc-tag is-accent"><Users size={11} /> 世界范围</span>}
          >
            <div className="wc-form-row">
              <Field label="群组名称">
                <TextInput value={groupForm.name} onChange={(value) => setGroupForm((prev) => ({ ...prev, name: value }))} placeholder="群组名称" />
              </Field>
              <Field label="群组说明">
                <TextInput value={groupForm.description} onChange={(value) => setGroupForm((prev) => ({ ...prev, description: value }))} placeholder="一句话说明" />
              </Field>
              <Field label=" ">
                <Btn kind="primary" onClick={submitGroup} disabled={posting}><Plus size={13} /> 创建群组</Btn>
              </Field>
            </div>
            {data.groups.length === 0 ? (
              <Empty text="这个世界还没有群组。" />
            ) : (
              <div className="wc-list" style={{ marginTop: 14 }}>
                {data.groups.map((group) => (
                  <div className="wc-row" key={group.id}>
                    <div className="wc-row-copy">
                      <div className="wc-row-title">{group.name}</div>
                      <div className="wc-row-meta">
                        {group.description || '暂无说明'} · {group.category} · {formatDate(group.created_at)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </WorldCreationPage>
  )
}
