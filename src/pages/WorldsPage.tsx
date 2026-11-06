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
  onOpenCharacterList: (worldId: string, worldName: string) => void, // ✅ 加上 worldName
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

  if (loading) return <div style={{ padding: '2rem' }}>Loading...</div>

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>{dict?.worlds || '世界管理'}</h1>
          <p style={{ color: '#666', fontSize: '0.9rem', marginTop: '0.5rem' }}>
            {lang === 'zh' ? `当前共收录人物数量：${totalCharacters}` : `Total Characters: ${totalCharacters}`}
          </p>
        </div>
        <button onClick={() => onOpenWorldBuilding('')} style={{ padding: '0.75rem 1.5rem', background: '#3366ff', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
          {lang === 'zh' ? '+ 创建新世界' : '+ New World'}
        </button>
      </div>
      
      <div style={{ marginTop: '2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {worlds.length === 0 ? (
          <div style={{ padding: '2rem', background: '#f5f5f5', borderRadius: '8px', color: '#666', gridColumn: '1 / -1', textAlign: 'center' }}>
            {lang === 'zh' ? '数据库空空如也，请点击右上角“创建新世界”。' : 'No worlds found. Click "New World" to start.'}
          </div>
        ) : (
          worlds.map(w => (
            <div key={w.id} style={{ border: '1px solid #ddd', padding: '1.5rem', borderRadius: '8px', background: '#fff', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ marginTop: 0 }}>{w.name}</h3>
              <p style={{ color: '#666', fontSize: '0.85rem', margin: '0 0 0.5rem 0' }}>ID: {w.id}</p>
              <p style={{ color: '#666', fontSize: '0.9rem', flex: 1 }}>{w.description || '-'}</p>
              
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '1rem' }}>
                <button onClick={() => onOpenWorldBuilding(w.id)} style={{ flex: 1, padding: '0.5rem', background: '#3b5998', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                  {lang === 'zh' ? '进入建设配置' : 'Configure'}
                </button>
                
                {/* ✅ 传 w.id 和 w.name */}
                <button onClick={() => onOpenCharacterList(w.id, w.name)} style={{ flex: 1, padding: '0.5rem', background: '#f3e8ff', color: '#7c3aed', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                  {lang === 'zh' ? '人物管理' : 'Characters'}
                </button>

                <button onClick={() => handleDelete(w.id)} style={{ padding: '0.5rem 1rem', background: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
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