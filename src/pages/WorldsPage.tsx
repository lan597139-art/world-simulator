import { useEffect, useState } from 'react'
import { getAllWorlds, deleteWorld } from '../services/worldService'
import type { World } from '../types/world'

export default function WorldsPage({
  onEnterWorld,
  onOpenWorldBuilding,
  lang,
  dict,
  product = 'game',
  readOnly = false,
}: {
  onEnterWorld: (id: string) => void,
  onOpenWorldBuilding: (id: string) => void,
  lang: string,
  dict: any,
  product?: string
  readOnly?: boolean
}) {
  const [worlds, setWorlds] = useState<World[]>([])
  const [loading, setLoading] = useState(true)

  const loadWorlds = async () => {
    try {
      const data = await getAllWorlds(true)
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
    const message = lang === 'zh' ? '把这个世界封存到归档库？\n\n归档后不会出现在世界列表，也不能继续推演，可随时恢复。' : 'Archive this world?\n\nIt will leave the world list and pause simulation, but can be restored anytime.'
    if (!window.confirm(message)) return
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
    const message = lang === 'zh'
      ? `重置官方演示世界「${name}」？\n\n会清空当前演示数据，恢复为内置初始状态。其他世界不受影响。`
      : `Reset the official demo world "${name}"?\n\nCurrent demo data will be replaced by the built-in initial state. Other worlds are unaffected.`
    if (!window.confirm(message)) return
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/worlds/${id}/reset-official`, { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.detail || `HTTP ${res.status}`)
      alert(lang === 'zh' ? '演示世界已重置。' : 'Official demo world reset.')
      loadWorlds()
    } catch (err: any) {
      alert(lang === 'zh' ? `重置失败：${err.message || err}` : `Reset failed: ${err.message || err}`)
    }
  }

  const sceneLabels: Record<string, string> = lang === 'zh'
    ? { game: '游戏创作', literature: '文学创作', companion: 'AI 伴侣', diary: '日记与传记', yunbao: '云宝工作台' }
    : { game: 'Game Creation', literature: 'Literature', companion: 'AI Companion', diary: 'Diary & Biography', yunbao: 'Yunbao Workspace' }
  const filteredWorlds = worlds.filter((w) => w.product_scene === product && (product === 'yunbao' || !w.is_product_workspace))

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-main)' }}>Loading...</div>

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      
      <div style={{ display: 'flex', gap: '7px', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ padding: '5px 10px', fontSize: '11px', borderRadius: '14px', background: 'var(--text-main)', color: 'var(--bg-color)' }}>
          {lang === 'zh' ? '当前产品：' : 'Current product: '}{sceneLabels[product]}
        </span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
          {lang === 'zh' ? '世界列表已按产品隔离，只显示本产品自己的世界；其他产品数据不会混入。' : 'Worlds are isolated by product; only this product’s worlds appear here.'}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
        
        {/* 👇 第一个空白卡片：新建世界 👇 */}
        {!readOnly && (
          <div
            className="glass-card"
            onClick={() => onOpenWorldBuilding('')}
            style={{
              padding: '24px', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: '12px',
              cursor: 'pointer', minHeight: '200px',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ fontSize: '36px', color: 'var(--text-main)', lineHeight: 1, fontWeight: 300 }}>+</div>
            <div style={{ fontSize: '15px', color: 'var(--text-main)', fontWeight: 500 }}>{lang === 'zh' ? '创建新世界' : 'Create new world'}</div>
          </div>
        )}

        {/* 👇 原本的世界列表 👇 */}
        {filteredWorlds.map(w => (
          <div 
            key={w.id} 
            className="glass-card" 
            onClick={() => onEnterWorld(w.id)}
            style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px', cursor: 'pointer' }}
          >

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: '20px', color: 'var(--text-main)', fontWeight: 600 }}>{w.name}</h3>
              {w.is_official && (
                <span style={{ padding: '3px 8px', borderRadius: '20px', background: 'rgba(128,128,128,0.14)', border: '1px solid var(--card-border)', color: 'var(--text-muted)', fontSize: '9px', fontWeight: 600 }}>
                  {lang === 'zh' ? '官方演示 · 锁定' : 'Official demo · Locked'}
                </span>
              )}
              {w.product_scene && (
                <span style={{ padding: '3px 8px', borderRadius: '20px', background: 'rgba(128,128,128,0.1)', border: '1px solid var(--card-border)', color: 'var(--text-muted)', fontSize: '9px' }}>
                  {sceneLabels[w.product_scene] || w.product_scene}
                </span>
              )}
            </div>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', flex: 1, lineHeight: 1.6 }}>{w.description || (lang === 'zh' ? '暂无世界简介。' : 'No world description yet.')}</p>
            {w.is_official && (
              <p style={{ margin: 0, fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                {lang === 'zh' ? '内置《凡人修仙传》演示世界，不可删除；可随时一键恢复初始状态。' : 'Built-in demo world. It cannot be deleted and can be reset to its initial state at any time.'}
              </p>
            )}

            <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '16px', flexWrap: 'wrap' }}>
              {!readOnly && (
              <button
                onClick={(e) => { e.stopPropagation(); onOpenWorldBuilding(w.id); }}
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
              )}

              {!readOnly && (
              <button
                onClick={(e) => { e.stopPropagation(); handleArchive(w.id); }}
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
              )}
              
              {!readOnly && (w.is_official ? (
                <button
                  onClick={(e) => { e.stopPropagation(); void handleResetOfficial(w.id, w.name); }}
                  style={{
                    flex: 1, padding: '10px',
                    background: 'rgba(128,128,128,0.08)', color: 'var(--text-main)',
                    border: '1px solid var(--card-border)', borderRadius: '8px', cursor: 'pointer'
                  }}
                >
                  {lang === 'zh' ? '重置演示' : 'Reset demo'}
                </button>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(w.id); }}
                  style={{
                    flex: 1, padding: '10px',
                    background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger-color)',
                    border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', cursor: 'pointer'
                  }}
                >
                  {lang === 'zh' ? '删除' : 'Delete'}
                </button>
              ))}
            </div>
          </div>
        ))}

        {filteredWorlds.length === 0 && readOnly && (
          <div className="glass-card" style={{ padding: '3rem', color: 'var(--text-muted)', gridColumn: '1 / -1', textAlign: 'center', borderStyle: 'dashed' }}>
            {lang === 'zh' ? '暂无可查看的世界。' : 'No worlds to view.'}
          </div>
        )}
      </div>
    </div>
  )
}