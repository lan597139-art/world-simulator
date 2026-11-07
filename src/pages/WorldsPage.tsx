import { useEffect, useState } from 'react'
import { getAllWorlds } from '../services/worldService'
import { db } from '../db/database'
import type { World } from '../types/world'

export default function WorldsPage({ 
  onOpenWorldBuilding, 
  onOpenCharacterList, 
  lang, 
  dict 
}: { 
  onOpenWorldBuilding: (id: string) => void, 
  onOpenCharacterList: (worldId: string, worldName: string) => void, 
  lang: string, 
  dict: any 
}) {
  const [worlds, setWorlds] = useState<World[]>([])
  const [loading, setLoading] = useState(true)
  const [totalCharacters, setTotalCharacters] = useState<number>(0)

  const loadWorlds = async () => {
    try {
      const data = await getAllWorlds()
      setWorlds(data)
      
      if ((db as any).characters) {
        const count = await (db as any).characters.count()
        setTotalCharacters(count)
      }
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
    const msg = lang === 'zh' ? '⚠️ 确定要删除这个世界及其所有设定吗？此操作不可恢复！' : '⚠️ Are you sure you want to delete this world? This cannot be undone!';
    if (!window.confirm(msg)) return;
    
    try {
      await db.worlds.delete(id)
      await db.worldBuildingConfigs.where('worldId').equals(id).delete()
      loadWorlds()
    } catch (err) {
      console.error(err)
      alert('❌ Delete failed')
    }
  }

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-main)' }}>Loading...</div>

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ margin: 0, color: 'var(--text-main)' }}>{dict?.worlds || '世界管理'}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
            {lang === 'zh' ? `当前共收录人物数量：${totalCharacters}` : `Total Characters: ${totalCharacters}`}
          </p>
        </div>
        <button 
          onClick={() => onOpenWorldBuilding('')} 
          style={{ 
            padding: '0.75rem 1.5rem', 
            background: 'var(--primary-color)', 
            color: '#fff', 
            border: 'none', 
            borderRadius: '8px', 
            cursor: 'pointer', 
            fontWeight: 'bold',
            boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)'
          }}
        >
          {lang === 'zh' ? '+ 创建新世界' : '+ New World'}
        </button>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {worlds.length === 0 ? (
          <div 
            className="glass-card" 
            style={{ padding: '3rem', color: 'var(--text-muted)', gridColumn: '1 / -1', textAlign: 'center', borderStyle: 'dashed' }}
          >
            {lang === 'zh' ? '数据库空空如也，请点击右上角“创建新世界”。' : 'No worlds found. Click "New World" to start.'}
          </div>
        ) : (
          worlds.map(w => (
            // 核心改动：使用 glass-card
            <div key={w.id} className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ marginTop: 0, color: 'var(--text-main)' }}>{w.name}</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0 0 0.5rem 0' }}>ID: {w.id}</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', flex: 1 }}>{w.description || '-'}</p>
              
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--card-border)' }}>
                <button 
                  onClick={() => onOpenWorldBuilding(w.id)} 
                  style={{ flex: 1, padding: '0.6rem', background: 'var(--primary-color)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}
                >
                  {lang === 'zh' ? '进入建设配置' : 'Configure'}
                </button>
                
                <button 
                  onClick={() => onOpenCharacterList(w.id, w.name)} 
                  style={{ flex: 1, padding: '0.6rem', background: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                >
                  {lang === 'zh' ? '人物管理' : 'Characters'}
                </button>

                <button 
                  onClick={() => handleDelete(w.id)} 
                  style={{ padding: '0.6rem 1rem', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger-color)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '6px', cursor: 'pointer' }}
                >
                  {lang === 'zh' ? '删除' : 'Delete'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}