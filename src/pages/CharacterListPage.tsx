import { useState, useEffect } from 'react';
import CharacterBuildingPage from './CharacterBuildingPage'; 
import { db } from '../db/database'; 

export default function CharacterListPage({ 
  worldId, 
  worldName = '', 
  onBack 
}: { 
  worldId?: string, 
  worldName?: string, 
  onBack: () => void 
}) {
  const [characters, setCharacters] = useState<any[]>([]);
  const [view, setView] = useState<'list' | 'edit'>('list');
  const [editingCharId, setEditingCharId] = useState<string | null>(null);

  const loadCharacters = async () => {
    try {
      if ((db as any).characters) {
        let data;
        if (worldId) {
          data = await (db as any).characters.where('worldId').equals(worldId).toArray();
        } else {
          data = await (db as any).characters.toArray();
        }
        setCharacters(data);
      }
    } catch (error) {
      console.error("加载人物失败", error);
    }
  };

  useEffect(() => {
    loadCharacters();
  }, [worldId]);

  const handleDelete = async (id: string) => {
    if (window.confirm('确定要删除这个人物档案吗？')) {
      try {
        await (db as any).characters.delete(id);
        loadCharacters(); 
      } catch (error) {
        console.error("删除失败", error);
      }
    }
  };

  if (view === 'edit') {
    return (
      <CharacterBuildingPage 
        characterId={editingCharId || ''} 
        worldId={worldId} 
        onBack={() => { setView('list'); loadCharacters(); }} 
      />
    );
  }

  return (
    <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <button 
            onClick={onBack} 
            style={{ 
              marginBottom: '16px', padding: '6px 12px', 
              border: '1px solid var(--card-border)', 
              background: 'var(--card-bg)', color: 'var(--text-main)', 
              borderRadius: '8px', cursor: 'pointer', backdropFilter: 'blur(8px)' 
            }}
          >
            ← 返回
          </button>
          <h1 style={{ margin: 0, fontSize: '24px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {worldName ? (
              <><span style={{ color: 'var(--primary-color)' }}>【{worldName}】</span> 人物管理</>
            ) : (
              '人物管理大厅'
            )}
          </h1>
          <p style={{ margin: '8px 0 0', color: 'var(--text-muted)' }}>
            当前共有 {characters.length} 个人物档案
          </p>
        </div>
        
        {/* ✅ 修复：去掉了写死的 #fff，换成了全局按钮文字变量，去掉了蓝紫色的发光 */}
        <button 
          onClick={() => { setEditingCharId(null); setView('edit'); }}
          style={{ 
            padding: '10px 20px', background: 'var(--primary-color)', color: 'var(--primary-text)', 
            border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600,
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.1)' 
          }}
        >
          + 创建新人物
        </button>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
        {characters.map(char => (
          <div key={char.id} className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--text-main)' }}>{char.name || '未命名人物'}</h3>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>ID: {char.id}</p>
            
            {/* ✅ 修复：“已绑定世界”标签的白块问题 */}
            {char.worldId && !worldId && (
              <span style={{ 
                fontSize: '12px', 
                background: 'rgba(128, 128, 128, 0.15)', // 半透明灰
                color: 'var(--text-main)', 
                border: '1px solid var(--card-border)',
                padding: '4px 10px', borderRadius: '20px', width: 'fit-content', 
              }}>
                已绑定世界
              </span>
            )}
            
            <div style={{ display: 'flex', gap: '10px', marginTop: 'auto', paddingTop: '16px' }}>
              {/* ✅ 修复：把原来扎眼的亮蓝色改成了高级的半透明灰底黑字 */}
              <button 
                onClick={() => { setEditingCharId(char.id); setView('edit'); }}
                style={{ 
                  flex: 1, padding: '8px', 
                  background: 'rgba(128, 128, 128, 0.1)', color: 'var(--text-main)', 
                  border: '1px solid var(--card-border)', borderRadius: '8px', cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                编辑
              </button>
              
              <button 
                onClick={() => handleDelete(char.id)}
                style={{ 
                  padding: '8px 16px', 
                  background: 'rgba(255, 69, 58, 0.1)', color: 'var(--danger-color)', 
                  border: '1px solid rgba(255, 69, 58, 0.2)', borderRadius: '8px', cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                删除
              </button>
            </div>
          </div>
        ))}
        
        {characters.length === 0 && (
          <div 
            className="glass-card" 
            style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px', color: 'var(--text-muted)', borderStyle: 'dashed' }}
          >
            暂无人物档案，点击右上角“创建新人物”开始。
          </div>
        )}
      </div>
    </div>
  );
}