import { useEffect, useRef, useState } from 'react'
import { getAllWorlds, deleteWorld } from '../services/worldService'
import { API_ORIGIN } from '../api/config'
import type { World } from '../types/world'
import WorldCollaborationDialog from '../components/collaboration/WorldCollaborationDialog'
import WorldInvitesPanel from '../components/collaboration/WorldInvitesPanel'

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
  const [collabWorld, setCollabWorld] = useState<{ id: string; name: string } | null>(null)
  const [importing, setImporting] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)

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

  const exportWorld = async (worldId: string, name: string) => {
    try {
      const token = localStorage.getItem('ws.authToken')
      const response = await fetch(`${API_ORIGIN}/api/worlds/${worldId}/export`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${name || 'world'}-export.json`
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      alert(lang === 'zh' ? `导出失败：${String(error)}` : `Export failed: ${String(error)}`)
    }
  }


  const importWorld = async (file: File) => {
    setImporting(true)
    try {
      const text = await file.text()
      const payload = JSON.parse(text)
      const token = localStorage.getItem('ws.authToken')
      const response = await fetch(`${API_ORIGIN}/api/worlds/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ ...payload, target_product: product }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.detail || `HTTP ${response.status}`)
      await loadWorlds()
      const counts = body.counts || {}
      alert(lang === 'zh'
        ? `导入完成：${body.name}\n人物 ${counts.characters || 0} · 事件 ${counts.events || 0} · 关系 ${counts.relationships || 0} · 地点 ${counts.locations || 0} · 组织 ${counts.organizations || 0} · 故事 ${counts.stories || 0} · 资源 ${counts.resources || 0}`
        : `Import complete: ${body.name}\nCharacters ${counts.characters || 0} · Events ${counts.events || 0} · Relationships ${counts.relationships || 0} · Locations ${counts.locations || 0} · Organizations ${counts.organizations || 0} · Stories ${counts.stories || 0} · Resources ${counts.resources || 0}`)
    } catch (error) {
      alert(lang === 'zh' ? `导入失败：${String(error)}` : `Import failed: ${String(error)}`)
    } finally {
      setImporting(false)
      if (importRef.current) importRef.current.value = ''
    }
  }

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-main)' }}>Loading...</div>

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      
      <WorldInvitesPanel lang={lang} onAccepted={() => void loadWorlds()} />

      <div style={{ display: 'flex', gap: '7px', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ padding: '5px 10px', fontSize: '11px', borderRadius: '14px', background: 'var(--text-main)', color: 'var(--bg-color)' }}>
          {lang === 'zh' ? '当前产品：' : 'Current product: '}{sceneLabels[product]}
        </span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.6, flex: '1 1 260px' }}>
          {lang === 'zh' ? '世界列表已按产品隔离，只显示本产品自己的世界；其他产品数据不会混入。' : 'Worlds are isolated by product; only this product’s worlds appear here.'}
        </span>
        {!readOnly && (
          <>
            <button
              type="button"
              onClick={() => importRef.current?.click()}
              disabled={importing}
              style={{ padding: '7px 13px', borderRadius: '9px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)', cursor: importing ? 'wait' : 'pointer', fontSize: '11px' }}
            >
              {importing ? (lang === 'zh' ? '导入中…' : 'Importing…') : (lang === 'zh' ? '导入世界包' : 'Import world')}
            </button>
            <input
              ref={importRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void importWorld(file)
              }}
            />
          </>
        )}
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
        {filteredWorlds.map(w => {
          const role = w.access_role || 'owner'
          const canEdit = role === 'owner' || role === 'editor'
          const isOwner = role === 'owner'
          return (
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
              {!readOnly && canEdit && (
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

              {!readOnly && isOwner && !w.is_official && (
                <button
                  onClick={(e) => { e.stopPropagation(); setCollabWorld({ id: w.id, name: w.name }); }}
                  style={{
                    flex: 1, padding: '10px',
                    background: 'transparent', color: 'var(--text-main)',
                    border: '1px solid var(--card-border)', borderRadius: '8px', cursor: 'pointer'
                  }}
                >
                  {lang === 'zh' ? '协作' : 'Collaborators'}
                </button>
              )}

              <button
                onClick={(e) => { e.stopPropagation(); void exportWorld(w.id, w.name); }}
                style={{
                  flex: 1, padding: '10px',
                  background: 'transparent', color: 'var(--text-main)',
                  border: '1px solid var(--card-border)', borderRadius: '8px', cursor: 'pointer'
                }}
              >
                {lang === 'zh' ? '导出' : 'Export'}
              </button>

              {!readOnly && isOwner && (
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
              
              {!readOnly && isOwner && (w.is_official ? (
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
          )
        })}

        {filteredWorlds.length === 0 && readOnly && (
          <div className="glass-card" style={{ padding: '3rem', color: 'var(--text-muted)', gridColumn: '1 / -1', textAlign: 'center', borderStyle: 'dashed' }}>
            {lang === 'zh' ? '暂无可查看的世界。' : 'No worlds to view.'}
          </div>
        )}
      </div>

      {collabWorld && (
        <WorldCollaborationDialog
          worldId={collabWorld.id}
          worldName={collabWorld.name}
          lang={lang}
          onClose={() => setCollabWorld(null)}
        />
      )}
    </div>
  )
}