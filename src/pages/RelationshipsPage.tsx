import { useState, useEffect } from 'react';
import { ReactFlow, Background, Controls, MarkerType } from '@xyflow/react';
import type { Edge } from '@xyflow/react';
import type { ReactNode } from 'react'; 
import '@xyflow/react/dist/style.css';

// 映射颜色、粗细和虚线
const getEdgeStyle = (quadrant: string, strength: string) => {
  let stroke = '#888888'; // 默认灰
  let strokeDasharray = 'none';
  let strokeWidth = 2;

  // 四象限颜色
  if (quadrant === '亲密') stroke = '#10b981'; // 绿
  if (quadrant === '认同') stroke = '#3b82f6'; // 蓝
  if (quadrant === '敌对') stroke = '#ef4444'; // 红
  if (quadrant === '漠视') {
    stroke = '#888888';
    strokeDasharray = '5,5'; // 虚线
  }

  // 强度粗细
  if (strength === '强') strokeWidth = 4;
  if (strength === '弱') strokeWidth = 1;

  return { stroke, strokeDasharray, strokeWidth };
};

const API = 'http://127.0.0.1:8000/api';

const EMPTY_FORM = {
  source_id: '', target_id: '', relation_type: '', description: '',
  is_bidirectional: false,
  source_quadrant: '漠视', source_strength: '中', source_power: '对等', source_value: '利己',
  target_quadrant: '漠视', target_strength: '中', target_power: '对等', target_value: '利己',
  status: 'active', valid_from: '', valid_until: '',
};

/** 后端时间列为 "YYYY-MM-DD HH:MM:SS"，datetime-local 需要 "YYYY-MM-DDTHH:MM" */
const toLocalInput = (value?: string | null) =>
  value ? String(value).replace(' ', 'T').slice(0, 16) : '';

const toBackendTime = (value?: string | null) =>
  value ? `${String(value).replace(' ', 'T').slice(0, 16).replace('T', ' ')}:00` : null;

export default function RelationshipsPage({
  worldId,
  onOpenCharacter,
  onNavigate,
}: {
  worldId?: string;
  onOpenCharacter?: (characterId: string) => void;
  onNavigate?: (page: string) => void;
}) {
  const [nodes, setNodes] = useState<any[]>([]);
  const [edges, setEdges] = useState<any[]>([]);
  const [characters, setCharacters] = useState<any[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [allEntities, setAllEntities] = useState<any[]>([]);
  const [allRelationships, setAllRelationships] = useState<any[]>([]);
  const [filters, setFilters] = useState({ scope: 'all', status: 'active', relationType: 'all', category: 'all' });
  const [typeCategories, setTypeCategories] = useState<{ key: string; label: string; names: string[] }[]>([]);

  // 弹窗控制
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // ✅ 新增：变迁史状态
  const [editingHistory, setEditingHistory] = useState<any[]>([]);

  // 极其复杂的表单状态
  const [formData, setFormData] = useState({ ...EMPTY_FORM });

  const loadData = async () => {
    try {
      const qs = worldId ? `?world_id=${worldId}` : '';
      const typesRes = worldId
        ? await fetch(`http://127.0.0.1:8000/api/worlds/${worldId}/relationship-types`)
        : null;
      const [charRes, orgRes, locRes, relRes, resRes] = await Promise.all([
        fetch(`http://127.0.0.1:8000/api/characters${qs}`),
        fetch(`http://127.0.0.1:8000/api/organizations${qs}`),
        fetch(`http://127.0.0.1:8000/api/locations${qs}`),
        fetch(`http://127.0.0.1:8000/api/relationships${qs}`),
        worldId ? fetch(`http://127.0.0.1:8000/api/worlds/${worldId}/resources`) : Promise.resolve(null),
      ]);
      const [charData, orgData, locData, relData, resDataRaw] = await Promise.all([
        charRes.json(), orgRes.json(), locRes.json(), relRes.json(), resRes ? resRes.json() : [],
      ]);
      const resData = resDataRaw || [];
      setCharacters(charData);
      setOrganizations(orgData);
      setLocations(locData);
      setResources(resData);

      // 四类节点：人物 / 组织 / 地点 / 资源
      const allEntities = [
        ...charData.map((c: any) => ({ id: c.id, name: c.name, type: 'character' })),
        ...orgData.map((o: any) => ({ id: o.id, name: o.name, type: 'organization' })),
        ...locData.map((l: any) => ({ id: l.id, name: l.name, type: 'location' })),
        ...resData.map((r: any) => ({ id: r.id, name: r.name, type: 'resource' })),
      ];
      setAllEntities(allEntities);
      const newNodes = allEntities.map((entity: any, index: number) => {
        const isOrganization = entity.type === 'organization';
        const isLocation = entity.type === 'location';
        const isResource = entity.type === 'resource';
        return {
          id: entity.id,
          position: { x: 260 * (index % 4), y: 150 * Math.floor(index / 4) },
          data: {
            label: `${isOrganization ? '▤ ' : isLocation ? '◈ ' : isResource ? '◆ ' : ''}${entity.name || '未命名'}`,
            entityType: entity.type,
          },
          style: {
            background: 'var(--card-bg)',
            color: 'var(--text-main)',
            border: isOrganization
              ? '1px solid var(--primary-color)'
              : isLocation
                ? '1px dashed var(--text-muted)'
                : isResource
                  ? '1px solid #d97706'
                  : '1px solid var(--card-border)',
            borderRadius: isOrganization ? '4px' : isLocation ? '0px' : isResource ? '2px' : '8px',
            padding: '10px',
            fontSize: '12px',
          },
        };
      });
      setNodes(newNodes);
      setAllRelationships(relData);

      if (typesRes) {
        const typeData = await typesRes.json();
        setTypeCategories(
          (typeData.categories || []).map((category: any) => ({
            key: category.key,
            label: category.label,
            names: (category.types || []).map((item: any) => item.name),
          })),
        );
      }
    } catch (error) {
      console.error("加载数据失败", error);
    }
  };

  // 按端点类型 / 状态 / 关系类型筛选连线；节点保持全量，避免布局跳动
  useEffect(() => {
    const known = new Set(allEntities.map((entity: any) => entity.id));
    const typeOf = (id: string) => allEntities.find((entity: any) => entity.id === id)?.type;

    const visible = allRelationships.filter((rel: any) => {
      if (!known.has(rel.source_id) || !known.has(rel.target_id)) return false;
      if (filters.status === 'active' && rel.status === 'ended') return false;
      if (filters.status === 'ended' && rel.status !== 'ended') return false;
      if (filters.relationType !== 'all' && rel.relation_type !== filters.relationType) return false;
      if (filters.category !== 'all') {
        const category = typeCategories.find((item) => item.key === filters.category);
        if (category && !category.names.includes(rel.relation_type)) return false;
      }

      if (filters.scope === 'all') return true;
      const sourceType = rel.source_type || typeOf(rel.source_id);
      const targetType = rel.target_type || typeOf(rel.target_id);
      const types = [sourceType, targetType];
      if (filters.scope === 'character') return types.every((t) => t === 'character');
      return types.includes(filters.scope);
    });

    setEdges(
      visible.map((rel: any) => {
        const style = getEdgeStyle(rel.source_quadrant, rel.source_strength);
        const ended = rel.status === 'ended';
        return {
          id: rel.id,
          source: rel.source_id,
          target: rel.target_id,
          label: ended ? `${rel.relation_type}（已结束）` : rel.relation_type,
          animated: !ended,
          style: ended ? { ...style, stroke: '#999999', strokeDasharray: '2,4', opacity: 0.45 } : style,
          markerEnd: { type: MarkerType.ArrowClosed, color: ended ? '#999999' : style.stroke },
          markerStart: rel.is_bidirectional
            ? { type: MarkerType.ArrowClosed, color: ended ? '#999999' : style.stroke }
            : undefined,
          data: rel,
        };
      }),
    );
  }, [allRelationships, allEntities, filters, typeCategories]);

  useEffect(() => {
    loadData();
    setFormData({ ...EMPTY_FORM });
    setEditingHistory([]); // ✅ 切换世界时清空历史
    setIsModalOpen(false);
    setEditingId(null);
  }, [worldId]);

  const entityType = (id: string) =>
    characters.some((c) => c.id === id)
      ? 'character'
      : organizations.some((o) => o.id === id)
        ? 'organization'
        : locations.some((l) => l.id === id)
          ? 'location'
          : resources.some((r) => r.id === id)
            ? 'resource'
            : 'character';

  const handleSave = async () => {
    if (!formData.source_id || !formData.target_id) return alert("请选择起点和终点人物");

    try {
      const url = editingId ? `${API}/relationships/${editingId}` : `${API}/relationships`;
      const method = editingId ? 'PUT' : 'POST';

      const payload: Record<string, unknown> = {
        ...formData,
        world_id: worldId || "",
        source_type: entityType(formData.source_id),
        target_type: entityType(formData.target_id),
        valid_from: toBackendTime(formData.valid_from),
        valid_until: toBackendTime(formData.valid_until),
      };
      // 创建时留空由后端写入当前时间；更新时留空表示不修改
      if (!payload.valid_from) delete payload.valid_from;

      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        setIsModalOpen(false);
        setEditingId(null);
        setEditingHistory([]);
        loadData(); 
      } else {
        const errData = await res.json();
        alert(`保存失败！错误信息：${JSON.stringify(errData.detail || errData)}`);
        console.error("后端报错详情:", errData);
      }
    } catch (error) {
      console.error("保存失败", error);
      alert("网络请求失败，请检查后端是否启动");
    }
  };

  /** 结束关系：逻辑失效，保留历史（开发2 §4.2 / §3.5） */
  const endRelationship = async () => {
    if (!editingId) return;
    if (!confirm('结束这条关系？关系记录会保留，可随时查看变迁史。')) return;
    try {
      const res = await fetch(`${API}/relationships/${editingId}`, { method: 'DELETE' });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || '结束关系失败');
      }
      setIsModalOpen(false);
      setEditingId(null);
      setEditingHistory([]);
      loadData();
    } catch (error: any) {
      alert(String(error.message || error));
    }
  };
  
  // 点击节点跳转到对应管理页面
  const handleNodeClick = (_event: React.MouseEvent, node: { id: string; data?: any }) => {
    const kind = node.data?.entityType;
    if (kind === 'character') {
      onOpenCharacter?.(node.id);
    } else if (kind === 'organization') {
      onNavigate?.('world-structure');
    } else if (kind === 'location' || kind === 'resource') {
      onNavigate?.('world-data');
    }
  };

  // 点击连线打开弹窗
  const handleEdgeClick = (_event: React.MouseEvent, edge: Edge) => {
    const rel = edge.data as any;
    setFormData({
      source_id: rel.source_id,
      target_id: rel.target_id,
      relation_type: rel.relation_type || '',
      description: rel.description || '',
      is_bidirectional: rel.is_bidirectional || false,
      source_quadrant: rel.source_quadrant || '漠视',
      source_strength: rel.source_strength || '中',
      source_power: rel.source_power || '对等',
      source_value: rel.source_value || '利己',
      target_quadrant: rel.target_quadrant || '漠视',
      target_strength: rel.target_strength || '中',
      target_power: rel.target_power || '对等',
      target_value: rel.target_value || '利己',
      status: rel.status || 'active',
      valid_from: toLocalInput(rel.valid_from),
      valid_until: toLocalInput(rel.valid_until),
    });
    // ✅ 核心：接收变迁史
    setEditingHistory(rel.history || []); 
    setEditingId(rel.id);
    setIsModalOpen(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '800px', padding: '1rem', boxSizing: 'border-box' }}>
      
      {/* 顶部控制栏 */}
      <div style={{ padding: '16px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '8px' }}>
        <span style={{ fontSize: '14px', color: 'var(--text-main)', fontWeight: 600 }}>04 关系与组织（点击线条可编辑关系本质）</span>
        <button 
          onClick={() => { 
            setEditingId(null); 
            setEditingHistory([]); // ✅ 新建时清空历史
            setFormData({ ...EMPTY_FORM }); 
            setIsModalOpen(true); 
          }}
          style={{ padding: '8px 16px', background: 'var(--primary-color)', color: 'var(--primary-text)', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>
          + 创建关系线
        </button>
      </div>

      {/* 筛选栏：端点类型 / 状态 / 关系类型 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '18px', alignItems: 'center', padding: '10px 14px', marginBottom: '12px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-main)' }}>
        <FilterGroup
          label="类别"
          value={filters.category}
          onChange={(value) => setFilters({ ...filters, category: value })}
          options={[{ value: 'all', label: '全部' }, ...typeCategories.map((category) => ({ value: category.key, label: category.label }))]}
        />
        <FilterGroup
          label="范围"
          value={filters.scope}
          onChange={(value) => setFilters({ ...filters, scope: value })}
          options={[
            { value: 'all', label: '全部' },
            { value: 'character', label: '人物之间' },
            { value: 'organization', label: '涉及组织' },
            { value: 'location', label: '涉及地点' },
            { value: 'resource', label: '涉及资源' },
          ]}
        />
        <FilterGroup
          label="状态"
          value={filters.status}
          onChange={(value) => setFilters({ ...filters, status: value })}
          options={[
            { value: 'active', label: '进行中' },
            { value: 'ended', label: '已结束' },
            { value: 'all', label: '全部' },
          ]}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text-muted)' }}>类型</span>
          <FilterChip active={filters.relationType === 'all'} onClick={() => setFilters({ ...filters, relationType: 'all' })}>
            全部
          </FilterChip>
          {Array.from(new Set(allRelationships.map((rel: any) => rel.relation_type).filter(Boolean))).map((type: any) => (
            <FilterChip
              key={type}
              active={filters.relationType === type}
              onClick={() => setFilters({ ...filters, relationType: type })}
            >
              {type}
            </FilterChip>
          ))}
        </div>
        <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>
          {edges.length} / {allRelationships.length} 条关系
        </span>
      </div>

      {/* 画布 */}
      <div style={{ flex: 1, minHeight: '600px', position: 'relative', border: '1px solid var(--card-border)', borderRadius: '8px', background: 'var(--bg-color)' }}>
        <ReactFlow nodes={nodes} edges={edges} fitView onEdgeClick={handleEdgeClick} onNodeClick={handleNodeClick}>
          <Background color="#888" gap={16} />
          <Controls />
        </ReactFlow>
      </div>

      {/* ✅ 弹窗面板：极致复杂的关系设定 */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '700px', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-color)', padding: '24px' }}>
            <h2 style={{ margin: '0 0 20px 0', color: 'var(--text-main)' }}>{editingId ? '编辑关系线' : '创建关系线'}</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>起点对象 (A)</label>
                <select value={formData.source_id} onChange={e => setFormData({...formData, source_id: e.target.value})} disabled={!!editingId} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)' }}>
                  <option value="">选择对象</option>
                  <optgroup label="人物">
                    {characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </optgroup>
                  <optgroup label="组织">
                    {organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </optgroup>
                  <optgroup label="地点">
                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </optgroup>
                  <optgroup label="资源">
                    {resources.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </optgroup>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>终点对象 (B)</label>
                <select value={formData.target_id} onChange={e => setFormData({...formData, target_id: e.target.value})} disabled={!!editingId} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)' }}>
                  <option value="">选择对象</option>
                  <optgroup label="人物">
                    {characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </optgroup>
                  <optgroup label="组织">
                    {organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </optgroup>
                  <optgroup label="地点">
                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </optgroup>
                  <optgroup label="资源">
                    {resources.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </optgroup>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>关系类型</label>
                <input type="text" value={formData.relation_type} onChange={e => setFormData({...formData, relation_type: e.target.value})} placeholder="如：恋人、主仆、前同事" style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>方向性</label>
                <select value={String(formData.is_bidirectional)} onChange={e => setFormData({...formData, is_bidirectional: e.target.value === 'true'})} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)' }}>
                  <option value="false">单向 (A → B)</option>
                  <option value="true">双向 (A ⇄ B)</option>
                </select>
              </div>
            </div>

            {/* A 的认知 */}
            <div style={{ borderTop: '1px dashed var(--card-border)', paddingTop: '16px', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '14px', color: 'var(--text-main)', marginBottom: '12px' }}>A 对 B 的认知</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
                <select value={formData.source_quadrant} onChange={e => setFormData({...formData, source_quadrant: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)' }}>
                  {['亲密', '认同', '敌对', '漠视'].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <select value={formData.source_strength} onChange={e => setFormData({...formData, source_strength: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)' }}>
                  {['强', '中', '弱'].map(o => <option key={o} value={o}>强度: {o}</option>)}
                </select>
                <select value={formData.source_power} onChange={e => setFormData({...formData, source_power: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)' }}>
                  {['对等', '不对等'].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <select value={formData.source_value} onChange={e => setFormData({...formData, source_value: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)' }}>
                  {['利他', '利己'].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>

            {/* B 的认知（双向时显示） */}
            {formData.is_bidirectional && (
              <div style={{ borderTop: '1px dashed var(--card-border)', paddingTop: '16px', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '14px', color: 'var(--text-main)', marginBottom: '12px' }}>B 对 A 的认知</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
                  <select value={formData.target_quadrant} onChange={e => setFormData({...formData, target_quadrant: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)' }}>
                    {['亲密', '认同', '敌对', '漠视'].map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <select value={formData.target_strength} onChange={e => setFormData({...formData, target_strength: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)' }}>
                    {['强', '中', '弱'].map(o => <option key={o} value={o}>强度: {o}</option>)}
                  </select>
                  <select value={formData.target_power} onChange={e => setFormData({...formData, target_power: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)' }}>
                    {['对等', '不对等'].map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <select value={formData.target_value} onChange={e => setFormData({...formData, target_value: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)' }}>
                    {['利他', '利己'].map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>
            )}

            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>关系描述</label>
              <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} rows={3} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)' }} placeholder="补充背景，如：表面合作，暗地提防..." />
            </div>

            {/* 关系状态与有效期：结束关系不删历史，只让关系失效 */}
            <div style={{ marginBottom: '24px', borderTop: '1px dashed var(--card-border)', paddingTop: '16px' }}>
              <h3 style={{ fontSize: '14px', color: 'var(--text-main)', marginBottom: '12px' }}>关系状态与有效期</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>当前状态</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)' }}
                  >
                    {[
                      { value: 'active', label: '进行中' },
                      { value: 'strained', label: '紧张' },
                      { value: 'interrupted', label: '中断' },
                      { value: 'ended', label: '已结束' },
                    ].map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>生效时间</label>
                  <input
                    type="datetime-local"
                    value={formData.valid_from}
                    onChange={e => setFormData({ ...formData, valid_from: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>结束时间</label>
                  <input
                    type="datetime-local"
                    value={formData.valid_until}
                    onChange={e => setFormData({ ...formData, valid_until: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)' }}
                  />
                </div>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                结束关系只是让关系失效并写入变迁史，不会删除记录；世界时间与系统时间分开保存。
              </div>
            </div>

            {/* ✅ 新增：关系变迁史展示 */}
            {editingId && editingHistory.length > 0 && (
              <div style={{ marginBottom: '24px', background: 'rgba(128,128,128,0.05)', padding: '16px', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
                <h3 style={{ fontSize: '14px', color: 'var(--primary-color)', marginBottom: '12px' }}>📜 关系变迁史</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {editingHistory.map((h, idx) => (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderLeft: '2px solid var(--primary-color)', paddingLeft: '12px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)' }}>
                        [{h.time}] 从「{h.old_status}」变为「{h.new_status}」
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>原因：{h.reason}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
              <div>
                {editingId && formData.status !== 'ended' && (
                  <button
                    onClick={endRelationship}
                    style={{ padding: '10px 20px', background: 'transparent', border: '1px solid var(--danger-color, #ef4444)', borderRadius: '6px', color: 'var(--danger-color, #ef4444)', cursor: 'pointer' }}
                  >
                    结束关系（保留历史）
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => setIsModalOpen(false)} style={{ padding: '10px 20px', background: 'transparent', border: '1px solid var(--card-border)', borderRadius: '6px', color: 'var(--text-main)', cursor: 'pointer' }}>取消</button>
                <button onClick={handleSave} style={{ padding: '10px 24px', background: 'var(--primary-color)', border: 'none', borderRadius: '6px', color: 'var(--primary-text)', cursor: 'pointer', fontWeight: 600 }}>保存关系线</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '3px 10px',
        borderRadius: '999px',
        border: active ? '1px solid var(--text-main)' : '1px solid var(--card-border)',
        background: active ? 'var(--text-main)' : 'transparent',
        color: active ? 'var(--bg-color)' : 'var(--text-main)',
        fontSize: '11px',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function FilterGroup({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      {options.map((option) => (
        <FilterChip key={option.value} active={value === option.value} onClick={() => onChange(option.value)}>
          {option.label}
        </FilterChip>
      ))}
    </div>
  );
}
