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
    const msg = lang === 'zh' ? '⚠️ 确定要删除这个世界及其所有设定吗？此操作不可恢复！' : '⚠️ Are you sure you want to delete this world? This cannot be undone!';
    if (!window.confirm(msg)) return;
    
    try {
      await deleteWorld(id)
      loadWorlds() 
    } catch (err) {
      console.error(err)
      alert('❌ Delete failed')
    }
  }

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-main)' }}>Loading...</div>

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ margin: 0, color: 'var(--text-main)', fontSize: '24px', fontWeight: 500 }}>{dict?.worlds || '世界管理'}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '0.5rem' }}>
            {lang === 'zh' ? `共收录 ${worlds.length} 个世界` : `Total Worlds: ${worlds.length}`}
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
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
        {worlds.length === 0 ? (
          <div className="glass-card" style={{ padding: '3rem', color: 'var(--text-muted)', gridColumn: '1 / -1', textAlign: 'center', borderStyle: 'dashed' }}>
            {lang === 'zh' ? '数据库空空如也，请点击右上角“创建新世界”。' : 'No worlds found. Click "New World" to start.'}
          </div>
        ) : (
          worlds.map(w => (
            <div key={w.id} className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              <h3 style={{ margin: 0, fontSize: '20px', color: 'var(--text-main)', fontWeight: 600 }}>{w.name}</h3>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', flex: 1, lineHeight: 1.6 }}>{w.description || '暂无世界简介。'}</p>
              
              <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '16px' }}>
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
                  onClick={() => handleDelete(w.id)} 
                  style={{ 
                    flex: 1, padding: '10px', 
                    background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger-color)', 
                    border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', cursor: 'pointer'
                  }}
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