import { useEffect, useState } from 'react'
import { getAllWorlds, deleteWorld } from '../services/worldService'
import type { World } from '../types/world'

export default function WorldsPage({
  onEnterWorld,
  onOpenWorldBuilding,
  lang,
  dict
}: {
  onEnterWorld: (id: string) => void,
  onOpenWorldBuilding: (id: string) => void,
  lang: string,
  dict: any
}) {
  const [worlds, setWorlds] = useState<World[]>([])
  const [loading, setLoading] = useState(true)
  const [sceneFilter, setSceneFilter] = useState(sessionStorage.getItem('ws.productScene') || 'all')

  const loadWorlds = async () => {
    try {
      const data = await getAllWorlds()
      setWorlds(data)
    } catch (error) {
      console.error("加载失败:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadWorlds()
  }, [])

  const handleDelete = async (id: string) => {
    const msg = lang === 'zh' ? '确定把这个世界移入回收站吗？\n\n世界内所有数据会保留，可在「全局回收站」恢复。' : 'Move this world to the recycle bin? All data can be restored.';
    if (!window.confirm(msg)) return;

    try {
      await deleteWorld(id)
      loadWorlds()
    } catch (err) {
      console.error(err)
      alert('❌ Delete failed')
    }
  }

  const handleArchive = async (id: string) => {
    if (!window.confirm('把这个世界封存到归档库？\n\n归档后不会出现在世界列表，也不能继续推演，可随时恢复。')) return
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/archive/world/${id}`, { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.detail || `HTTP ${res.status}`)
      loadWorlds()
    } catch (err: any) {
      alert(`归档失败：${err.message || err}`)
    }
  }

  const handleResetOfficial = async (id: string, name: string) => {
    if (!window.confirm(`重置官方演示世界「${name}」？\n\n会清空当前演示数据，恢复为内置初始状态。其他世界不受影响。`)) return
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/worlds/${id}/reset-official`, { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.detail || `HTTP ${res.status}`)
      alert('演示世界已重置。')
      loadWorlds()
    } catch (err: any) {
      alert(`重置失败：${err.message || err}`)
    }
  }

  const sceneLabels: Record<string, string> = { game: '游戏', literature: '文学', companion: '伴侣' }
  const filteredWorlds = sceneFilter === 'all'
    ? worlds
    : worlds.filter((w) => !w.product_scene || w.product_scene === sceneFilter)

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-main)' }}>Loading...</div>

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ margin: 0, color: 'var(--text-main)', fontSize: '24px', fontWeight: 500 }}>{dict?.worlds || '世界管理'}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '0.5rem' }}>
            {lang === 'zh' ? `共收录 ${filteredWorlds.length} 个世界` : `Total Worlds: ${filteredWorlds.length}`}
          </p>
        </div>

        <button
          onClick={() => onOpenWorldBuilding('')}
          style={{
            padding: '10px 20px', background: 'var(--primary-color)', color: 'var(--bg-color)',
            border: 'none', borderRadius: '8px', cursor: 'pointer', boxShadow: '0 4px 14px rgba(0, 0, 0, 0.1)',
            fontWeight: 600
          }}
        >
          {lang === 'zh' ? '+ 创建新世界' : '+ New World'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {['all', 'game', 'literature'].map((scene) => (
          <button
            key={scene}
            type="button"
            onClick={() => { setSceneFilter(scene); sessionStorage.setItem('ws.productScene', scene) }}
            style={{
              padding: '5px 10px', fontSize: '11px', borderRadius: '14px', cursor: 'pointer',
              background: sceneFilter === scene ? 'var(--text-main)' : 'transparent',
              color: sceneFilter === scene ? 'var(--bg-color)' : 'var(--text-muted)',
              border: '1px solid var(--card-border)',
            }}
          >
            {scene === 'all' ? '全部' : sceneLabels[scene]}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
        {worlds.length === 0 ? (
          <div className="glass-card" style={{ padding: '3rem', color: 'var(--text-muted)', gridColumn: '1 / -1', textAlign: 'center', borderStyle: 'dashed' }}>
            {lang === 'zh' ? '数据库空空如也，请点击右上角“创建新世界”。' : 'No worlds found. Click "New World" to start.'}
          </div>
        ) : (
          filteredWorlds.map(w => (
            <div key={w.id} className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: '20px', color: 'var(--text-main)', fontWeight: 600 }}>{w.name}</h3>
                {w.is_official && (
                  <span style={{ padding: '3px 8px', borderRadius: '20px', background: 'rgba(128,128,128,0.14)', border: '1px solid var(--card-border)', color: 'var(--text-muted)', fontSize: '9px', fontWeight: 600 }}>
                    官方演示 · 锁定
                  </span>
                )}
                {w.product_scene && (
                  <span style={{ padding: '3px 8px', borderRadius: '20px', background: 'rgba(128,128,128,0.1)', border: '1px solid var(--card-border)', color: 'var(--text-muted)', fontSize: '9px' }}>
                    {sceneLabels[w.product_scene] || w.product_scene}
                  </span>
                )}
              </div>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', flex: 1, lineHeight: 1.6 }}>{w.description || '暂无世界简介。'}</p>
              {w.is_official && (
                <p style={{ margin: 0, fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  内置《凡人修仙传》演示世界，不可删除；可随时一键恢复初始状态。
                </p>
              )}

              <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '16px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => onEnterWorld(w.id)}
                  style={{
                    flex: 2, padding: '10px',
                    background: 'var(--primary-color)', color: 'var(--bg-color)',
                    border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600
                  }}
                >
                  {lang === 'zh' ? '进入工作台' : 'Enter'}
                </button>

                {/* ✅ 新增：编辑世界按钮 */}
                <button
                  onClick={() => onOpenWorldBuilding(w.id)}
                  style={{
                    flex: 1, padding: '10px',
                    background: 'transparent', color: 'var(--text-main)',
                    border: '1px solid var(--card-border)', borderRadius: '8px', cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--primary-color)'}
                  onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--card-border)'}
                >
                  {lang === 'zh' ? '编辑' : 'Edit'}
                </button>

                <button
                  onClick={() => handleArchive(w.id)}
                  disabled={Boolean(w.is_official)}
                  style={{
                    flex: 1, padding: '10px',
                    background: 'transparent', color: 'var(--text-muted)',
                    border: '1px solid var(--card-border)', borderRadius: '8px', cursor: w.is_official ? 'not-allowed' : 'pointer',
                    opacity: w.is_official ? 0.45 : 1
                  }}
                >
                  {lang === 'zh' ? '归档' : 'Archive'}
                </button>
                {w.is_official ? (
                  <button
                    onClick={() => void handleResetOfficial(w.id, w.name)}
                    style={{
                      flex: 1, padding: '10px',
                      background: 'rgba(128,128,128,0.08)', color: 'var(--text-main)',
                      border: '1px solid var(--card-border)', borderRadius: '8px', cursor: 'pointer'
                    }}
                  >
                    重置演示
                  </button>
                ) : (
                  <button
                    onClick={() => handleDelete(w.id)}
                    style={{
                      flex: 1, padding: '10px',
                      background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger-color)',
                      border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', cursor: 'pointer'
                    }}
                  >
                    {lang === 'zh' ? '删除' : 'Delete'}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
