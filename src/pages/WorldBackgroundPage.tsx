/**
 * 背景：一个世界的创建背景。
 *
 * 复用世界本体字段（名称、描述、背景、世界尺度、状态），通过
 * /api/worlds/{id} 保存，不新增冗余数据模型。
 */
import { useEffect, useState } from 'react'
import { Map } from 'lucide-react'
import * as api from '../api/worldCreation'
import { Btn, Card, Field, Select, TextArea, TextInput, WorldCreationPage } from '../components/world-creation/WorldCreationShell'
import '../styles/world-creation.css'

const SCALES = [
  { value: 'city', label: '城市' },
  { value: 'province', label: '省份' },
  { value: 'nation', label: '国家' },
  { value: 'global', label: '全球' },
  { value: 'planet', label: '星球' },
  { value: 'galaxy', label: '星系' },
]

const STATUSES = [
  { value: 'draft', label: '草稿' },
  { value: 'running', label: '进行中' },
  { value: 'archived', label: '已归档' },
]

const TIME_STATUSES = [
  { value: 'paused', label: '时间暂停' },
  { value: 'running', label: '时间流动' },
]

export default function WorldBackgroundPage({ worldId }: { worldId: string }) {
  const [world, setWorld] = useState<api.WorldLite | null>(null)
  const [form, setForm] = useState({ name: '', description: '', background: '', world_scale: 'city', status: 'draft', time_status: 'paused' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api.getWorld(worldId)
      setWorld(data)
      setForm({
        name: data.name || '',
        description: data.description || '',
        background: data.background || '',
        world_scale: data.world_scale || 'city',
        status: data.status || 'draft',
        time_status: data.time_status || 'paused',
      })
    } catch (err) {
      setError(String((err as Error).message || err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [worldId])

  const save = async () => {
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const result = await api.updateWorld(worldId, form)
      if (result.status === 'ok') {
        setSaved(true)
        window.setTimeout(() => setSaved(false), 2200)
      }
    } catch (err) {
      setError(String((err as Error).message || err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <WorldCreationPage
      title="背景"
      subtitle={world ? `世界「${world.name}」的创建背景与基础设定` : '世界创建背景'}
      icon={<Map size={16} />}
      error={error}
      onRetry={load}
    >
      {loading && <Card><div className="wc-empty">加载中…</div></Card>}
      {!loading && (
        <>
          <Card title="世界背景">
            <Field label="世界名称">
              <TextInput value={form.name} onChange={(value) => setForm((prev) => ({ ...prev, name: value }))} />
            </Field>
            <Field label="世界描述">
              <TextArea
                rows={2}
                value={form.description}
                onChange={(value) => setForm((prev) => ({ ...prev, description: value }))}
                placeholder="一句话概述这个世界"
              />
            </Field>
            <Field label="创建背景" hint="世界的创世起源、历史脉络与整体基调">
              <TextArea
                rows={8}
                value={form.background}
                onChange={(value) => setForm((prev) => ({ ...prev, background: value }))}
                placeholder="这个世界是如何形成的，有哪些历史与基调…"
              />
            </Field>
          </Card>

          <Card title="基础设定">
            <div className="wc-form-row">
              <Field label="世界尺度">
                <Select value={form.world_scale} onChange={(value) => setForm((prev) => ({ ...prev, world_scale: value }))} options={SCALES} />
              </Field>
              <Field label="世界状态">
                <Select value={form.status} onChange={(value) => setForm((prev) => ({ ...prev, status: value }))} options={STATUSES} />
              </Field>
              <Field label="时间状态">
                <Select value={form.time_status} onChange={(value) => setForm((prev) => ({ ...prev, time_status: value }))} options={TIME_STATUSES} />
              </Field>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 16 }}>
              <Btn kind="primary" onClick={save} disabled={saving}>{saving ? '保存中…' : '保存背景'}</Btn>
              {saved && <span className="wc-tag is-accent">已保存</span>}
            </div>
          </Card>
        </>
      )}
    </WorldCreationPage>
  )
}
