import { useState, useEffect } from 'react';
import { ReactFlow, Background, Controls } from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react'; // ✅ 加上 type 关键字
import '@xyflow/react/dist/style.css';
export default function RelationshipsPage() {
  const [nodes, setNodes] = useState<any[]>([]);
  const [edges, setEdges] = useState<any[]>([]);
  
  // 表单状态
  const [characters, setCharacters] = useState<any[]>([]);
  const [formData, setFormData] = useState({ source_id: '', target_id: '', relation_type: '', description: '' });

  const loadData = async () => {
    try {
      // 1. 拉取所有人物
      const charRes = await fetch("http://127.0.0.1:8000/api/characters");
      const charData = await charRes.json();
      setCharacters(charData);

      // 2. 拉取所有关系
      const relRes = await fetch("http://127.0.0.1:8000/api/relationships");
      const relData = await relRes.json();

      // 3. 把人物转成 React Flow 的 Node
      const newNodes = charData.map((char: any, index: number) => ({
        id: char.id,
        position: { x: 250 * (index % 3), y: 150 * Math.floor(index / 3) }, // 简单的网格排布
        data: { label: char.name || '未命名人物' },
        style: { background: 'var(--card-bg)', color: 'var(--text-main)', border: '1px solid var(--card-border)', borderRadius: '8px', padding: '10px' }
      }));
      setNodes(newNodes);

      // 4. 把关系转成 React Flow 的 Edge
      const newEdges = relData.map((rel: any) => ({
        id: rel.id,
        source: rel.source_id,
        target: rel.target_id,
        label: rel.relation_type,
        animated: true,
        style: { stroke: 'var(--primary-color)' },
        labelStyle: { fill: 'var(--text-main)', fontWeight: 600 }
      }));
      setEdges(newEdges);

    } catch (error) {
      console.error("加载数据失败", error);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateRelationship = async () => {
    if (!formData.source_id || !formData.target_id) return alert("请选择起点和终点人物");
    
    try {
      const res = await fetch("http://127.0.0.1:8000/api/relationships", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          world_id: "" // 暂时留空，后续接多世界
        })
      });
      if (res.ok) {
        setFormData({ source_id: '', target_id: '', relation_type: '', description: '' });
        loadData(); // 重新加载画布
      }
    } catch (error) {
      console.error("创建关系失败", error);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '800px', padding: '1rem', boxSizing: 'border-box' }}>
      
      {/* 测试是否渲染到了这里 */}
      <div style={{ padding: '16px', marginBottom: '16px', display: 'flex', gap: '12px', alignItems: 'center', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '8px', zIndex: 10 }}>
        <select 
          value={formData.source_id} 
          onChange={e => setFormData({...formData, source_id: e.target.value})}
          style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)' }}
        >
          <option value="">选择起点人物</option>
          {characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <input 
          type="text" 
          placeholder="关系类型（如：敌对、朋友）" 
          value={formData.relation_type}
          onChange={e => setFormData({...formData, relation_type: e.target.value})}
          style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)' }}
        />

        <select 
          value={formData.target_id} 
          onChange={e => setFormData({...formData, target_id: e.target.value})}
          style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)' }}
        >
          <option value="">选择终点人物</option>
          {characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <button 
          onClick={handleCreateRelationship}
          style={{ padding: '8px 16px', background: 'var(--primary-color)', color: 'var(--primary-text)', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
        >
          创建连线
        </button>
      </div>

      {/* React Flow 画布：强制给一个固定高度 */}
      <div style={{ flex: 1, minHeight: '600px', position: 'relative', border: '1px solid var(--card-border)', borderRadius: '8px', background: 'var(--bg-color)' }}>
        <ReactFlow nodes={nodes} edges={edges} fitView>
          <Background color="#888" gap={16} />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}