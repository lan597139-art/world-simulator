/**
 * 插画集：世界相关插画与概念图。
 *
 * 以网格形式浏览，支持新增、编辑与删除；图片地址可留空。
 */
import { useEffect, useState } from 'react'
import { ImagePlus, Pencil, Plus, Trash2 } from 'lucide-react'
import * as api from '../api/worldCreation'
import type { WorldIllustration } from '../api/worldCreation'
import { Btn, Card, Empty, Field, TextArea, TextInput, WorldCreationPage } from '../components/world-creation/WorldCreationShell'
import '../styles/world-creation.css'

const EMPTY_FORM = { title: '', description: '', image_url: '' }

export default function WorldIllustrationPage({ worldId }: { worldId: string }) {
  const [items, setItems] = useState<WorldIllustration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<WorldIllustration | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      setItems(await api.listWorldIllustrations(worldId))
    } catch (err) {
      setError(String((err as Error).message || err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [worldId])

  const startCreate = () => {
    setCreating(true)
    setEditing(null)
    setForm(EMPTY_FORM)
  }

  const startEdit = (item: WorldIllustration) => {
    setCreating(false)
    setEditing(item)
    setForm({ title: item.title, description: item.description, image_url: item.image_url })
  }

  const cancel = () => {
    setCreating(false)
    setEditing(null)
    setForm(EMPTY_FORM)
  }

  const save = async () => {
    if (!form.title.trim()) {
      setError('插画标题不能为空')
      return
    }
    setSaving(true)
    setError('')
    try {
      if (editing) {
        await api.updateWorldIllustration(worldId, editing.id, form)
      } else {
        await api.createWorldIllustration(worldId, form)
      }
      cancel()
      await load()
    } catch (err) {
      setError(String((err as Error).message || err))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (item: WorldIllustration) => {
    if (!window.confirm(`确定删除插画「${item.title}」？`)) return
    try {
      await api.deleteWorldIllustration(worldId, item.id)
      await load()
    } catch (err) {
      setError(String((err as Error).message || err))
    }
  }

  const showEditor = creating || Boolean(editing)

  return (
    <WorldCreationPage
      title="插画集"
      subtitle="世界相关的插画与概念图"
      icon={<ImagePlus size={16} />}
      error={error}
      onRetry={load}
    >
      <Card
        title={editing ? `编辑插画：${editing.title}` : '新增插画'}
        aside={showEditor && <Btn onClick={cancel}>取消</Btn>}
      >
        {showEditor ? (
          <>
            <Field label="标题">
              <TextInput value={form.title} onChange={(value) => setForm((prev) => ({ ...prev, title: value }))} />
            </Field>
            <Field label="图片地址" hint="可留空；填写后插画卡片展示缩略图">
              <TextInput value={form.image_url} onChange={(value) => setForm((prev) => ({ ...prev, image_url: value }))} placeholder="/uploads/..." />
            </Field>
            <Field label="说明">
              <TextArea rows={3} value={form.description} onChange={(value) => setForm((prev) => ({ ...prev, description: value }))} />
            </Field>
            <div style={{ display: 'flex', gap: 10 }}>
              <Btn kind="primary" onClick={save} disabled={saving}>{saving ? '保存中…' : '保存'}</Btn>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn kind="primary" onClick={startCreate}><Plus size={13} /> 新增插画</Btn>
          </div>
        )}
      </Card>

      <Card title={`插画集（${items.length}）`}>
        {loading ? (
          <Empty text="加载中…" />
        ) : items.length === 0 ? (
          <Empty text="还没有插画，点击上方「新增插画」开始上传。" />
        ) : (
          <div className="wc-grid">
            {items.map((item) => (
              <div className="wc-media-card" key={item.id}>
                {item.image_url
                  ? <img className="wc-media" src={item.image_url} alt={item.title} />
                  : <div className="wc-media-placeholder">暂无图片</div>}
                <div className="wc-media-title">{item.title}</div>
                <div className="wc-media-desc">{item.description || '暂无说明'}</div>
                <div className="wc-media-actions">
                  <Btn onClick={() => startEdit(item)}><Pencil size={12} /> 编辑</Btn>
                  <Btn kind="danger" onClick={() => void remove(item)}><Trash2 size={12} /> 删除</Btn>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </WorldCreationPage>
  )
}
