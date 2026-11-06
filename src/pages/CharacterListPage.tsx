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
          // 有 worldId 就查特定世界的
          data = await (db as any).characters.where('worldId').equals(worldId).toArray();
        } else {
          // ✅ 没有 worldId 就查全部（人物大厅模式）
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
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <button onClick={onBack} style={{ marginBottom: '16px', padding: '6px 12px', border: '1px solid #dce2eb', background: '#fff', borderRadius: '4px', cursor: 'pointer' }}>
            ← 返回世界管理
          </button>
          <h1 style={{ margin: 0, fontSize: '24px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {worldName ? (
              <><span style={{ color: '#8b5cf6' }}>【{worldName}】</span> 人物管理</>
            ) : (
              '人物管理大厅'
            )}
          </h1>
          <p style={{ margin: '8px 0 0', color: '#64748b' }}>
            当前共有 {characters.length} 个人物档案
          </p>
        </div>
        <button 
          onClick={() => { setEditingCharId(null); setView('edit'); }}
          style={{ padding: '10px 20px', background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
        >
          + 创建新人物
        </button>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
        {characters.map(char => (
          <div key={char.id} style={{ background: '#fff', border: '1px solid #e5e9ef', borderRadius: '8px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', color: '#1e293b' }}>{char.name || '未命名人物'}</h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>ID: {char.id}</p>
            {/* 可以显示人物属于哪个世界 */}
            {char.worldId && !worldId && <span style={{ fontSize: '12px', background: '#f3e8ff', color: '#7c3aed', padding: '2px 8px', borderRadius: '4px', width: 'fit-content' }}>已绑定世界</span>}
            
            <div style={{ display: 'flex', gap: '10px', marginTop: 'auto' }}>
              <button 
                onClick={() => { setEditingCharId(char.id); setView('edit'); }}
                style={{ flex: 1, padding: '8px', background: '#eff6ff', color: '#3b82f6', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                编辑
              </button>
              <button 
                onClick={() => handleDelete(char.id)}
                style={{ padding: '8px 16px', background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                删除
              </button>
            </div>
          </div>
        ))}
        {characters.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px', color: '#94a3b8', background: '#fff', borderRadius: '8px', border: '1px dashed #e2e8f0' }}>
            暂无人物档案，点击右上角“创建新人物”开始。
          </div>
        )}
      </div>
    </div>
  );
}