/**
 * 地图：世界地图册。
 *
 * 一个世界可以有多张大大小小的地图（世界 / 区域 / 城市 / 街区 / 建筑等），
 * 以卡片形式浏览，支持新增、编辑与删除。
 */
import { useEffect, useState } from 'react'
import { Map as MapIcon, Plus, Trash2, Pencil } from 'lucide-react'
import * as api from '../api/worldCreation'
import type { MapScale, WorldMap } from '../api/worldCreation'
import { Btn, Card, Empty, Field, Select, TextArea, TextInput, WorldCreationPage } from '../components/world-creation/WorldCreationShell'
import '../styles/world-creation.css'

const SCALES: Array<{ value: MapScale; label: string }> = [
  { value: 'world', label: '世界总图' },
  { value: 'region', label: '区域' },
  { value: 'city', label: '城市' },
  { value: 'district', label: '街区' },
  { value: 'building', label: '建筑' },
  { value: 'other', label: '其他' },
]

const EMPTY_FORM = { name: '', map_scale: 'world' as MapScale, description: '', image_url: '' }

export default function WorldMapPage({ worldId }: { worldId: string }) {
  const [maps, setMaps] = useState<WorldMap[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<WorldMap | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      setMaps(await api.listWorldMaps(worldId))
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

  const startEdit = (map: WorldMap) => {
    setCreating(false)
    setEditing(map)
    setForm({ name: map.name, map_scale: map.map_scale as MapScale, description: map.description, image_url: map.image_url })
  }

  const cancel = () => {
    setCreating(false)
    setEditing(null)
    setForm(EMPTY_FORM)
  }

  const save = async () => {
    if (!form.name.trim()) {
      setError('地图名称不能为空')
      return
    }
    setSaving(true)
    setError('')
    try {
      if (editing) {
        await api.updateWorldMap(worldId, editing.id, form)
      } else {
        await api.createWorldMap(worldId, form)
      }
      cancel()
      await load()
    } catch (err) {
      setError(String((err as Error).message || err))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (map: WorldMap) => {
    if (!window.confirm(`确定删除地图「${map.name}」？`)) return
    try {
      await api.deleteWorldMap(worldId, map.id)
      await load()
    } catch (err) {
      setError(String((err as Error).message || err))
    }
  }

  const showEditor = creating || Boolean(editing)

  return (
    <WorldCreationPage
      title="地图"
      subtitle="世界地图册：大大小小的地图集中管理"
      icon={<MapIcon size={16} />}
      error={error}
      onRetry={load}
    >
      <Card
        title={editing ? `编辑地图：${editing.name}` : '新增地图'}
        aside={showEditor && <Btn onClick={cancel}>取消</Btn>}
      >
        {showEditor ? (
          <div className="wc-form-row">
            <Field label="地图名称">
              <TextInput value={form.name} onChange={(value) => setForm((prev) => ({ ...prev, name: value }))} />
            </Field>
            <Field label="地图尺度">
              <Select value={form.map_scale} onChange={(value) => setForm((prev) => ({ ...prev, map_scale: value as MapScale }))} options={SCALES} />
            </Field>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn kind="primary" onClick={startCreate}><Plus size={13} /> 新增地图</Btn>
          </div>
        )}
        {showEditor && (
          <>
            <Field label="图片地址" hint="可留空；填写后地图卡片展示缩略图">
              <TextInput value={form.image_url} onChange={(value) => setForm((prev) => ({ ...prev, image_url: value }))} placeholder="/uploads/..." />
            </Field>
            <Field label="地图说明">
              <TextArea rows={3} value={form.description} onChange={(value) => setForm((prev) => ({ ...prev, description: value }))} />
            </Field>
            <div style={{ display: 'flex', gap: 10 }}>
              <Btn kind="primary" onClick={save} disabled={saving}>{saving ? '保存中…' : '保存'}</Btn>
            </div>
          </>
        )}
      </Card>

      <Card title={`地图册（${maps.length}）`}>
        {loading ? (
          <Empty text="加载中…" />
        ) : maps.length === 0 ? (
          <Empty text="还没有地图，点击上方「新增地图」开始创建。" />
        ) : (
          <div className="wc-grid">
            {maps.map((map) => (
              <div className="wc-media-card" key={map.id}>
                {map.image_url
                  ? <img className="wc-media" src={map.image_url} alt={map.name} />
                  : <div className="wc-media-placeholder">暂无地图图片</div>}
                <div className="wc-media-title">{map.name}</div>
                <div className="wc-media-desc">{map.description || '暂无说明'}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span className="wc-tag is-accent">{SCALES.find((item) => item.value === map.map_scale)?.label || map.map_scale}</span>
                </div>
                <div className="wc-media-actions">
                  <Btn onClick={() => startEdit(map)}><Pencil size={12} /> 编辑</Btn>
                  <Btn kind="danger" onClick={() => void remove(map)}><Trash2 size={12} /> 删除</Btn>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </WorldCreationPage>
  )
}
