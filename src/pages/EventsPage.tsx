import { useState, useEffect } from 'react';
import EventCausalityPanel from '../components/EventCausalityPanel';
import EventChoicePanel from '../components/EventChoicePanel';
import EventSandboxModal from '../components/EventSandboxModal';

export default function EventsPage({ worldId, onOpenSandbox, onNavigate, mode = 'narrative' }: {
  worldId?: string; onOpenSandbox?: () => void; onNavigate?: (page: string) => void
  mode?: 'narrative' | 'interaction' | 'life'
}) {
  const narrative = mode === 'narrative'
  const modeTitle = mode === 'interaction' ? '互动事件' : mode === 'life' ? '人生经历' : '事件'
  const [events, setEvents] = useState<any[]>([]);
  const [characters, setCharacters] = useState<any[]>([]);
  
  // ✅ 地点和组织状态
  const [locations, setLocations] = useState<any[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);
  
  // ✅ 表单状态，新增 storyline, scale 和 caused_by
  const [formData, setFormData] = useState({
    name: '',
    domain: [] as string[],
    polarity: '威胁',
    intensity: '中',
    description: '',
    participants: [] as string[],
    story_time: '',
    location_id: '',
    organization_id: '',
    storyline: '主线', 
    scale: '中观',
    caused_by: [] as string[] // ✅ 新增：因果关联
  });
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sandboxEvent, setSandboxEvent] = useState<any | null>(null);

  const loadData = async () => {
    try {
      const [eventRes, charRes, locRes, orgRes] = await Promise.all([
        fetch(`http://127.0.0.1:8000/api/events${worldId ? `?world_id=${worldId}` : ''}`),
        fetch(`http://127.0.0.1:8000/api/characters${worldId ? `?world_id=${worldId}` : ''}`),
        fetch(`http://127.0.0.1:8000/api/locations${worldId ? `?world_id=${worldId}` : ''}`),
        fetch(`http://127.0.0.1:8000/api/organizations${worldId ? `?world_id=${worldId}` : ''}`)
      ]);
      setEvents(await eventRes.json());
      setCharacters(await charRes.json());
      setLocations(await locRes.json());
      setOrganizations(await orgRes.json());
    } catch (error) {
      console.error("加载数据失败", error);
    }
  };

  useEffect(() => {
    loadData();
    setEditingId(null);
    // ✅ 重置表单时加上 caused_by: []
    setFormData({ name: '', domain: [], polarity: '威胁', intensity: '中', description: '', participants: [], story_time: '', location_id: '', organization_id: '', storyline: '主线', scale: '中观', caused_by: [] });
  }, [worldId]);

  const handleSave = async () => {
    if (!formData.name.trim()) return alert("请输入事件名称");
    
    try {
      const url = editingId 
        ? `http://127.0.0.1:8000/api/events/${editingId}`
        : "http://127.0.0.1:8000/api/events";
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, world_id: worldId || "" })
      });
      
      if (res.ok) {
        const saved = await res.json().catch(() => null);
        if (!editingId && saved?.id) {
          setEditingId(saved.id);
          await loadData();
          alert('事件已创建。可在下方「事件发展与选择」中添加选择、结果与后续事件。');
        } else {
          await loadData();
        }
      }
    } catch (error) {
      console.error("保存事件失败", error);
    }
  };

  const handleEdit = (ev: any) => {
    setEditingId(ev.id);
    setFormData({
      name: ev.name,
      domain: ev.domain || [],
      polarity: ev.polarity,
      intensity: ev.intensity,
      description: ev.description || '',
      participants: ev.participants || [],
      story_time: ev.story_time || '',
      location_id: ev.location_id || '',
      organization_id: ev.organization_id || '',
      storyline: ev.storyline || '主线', 
      scale: ev.scale || '中观', 
      caused_by: ev.caused_by || [] // ✅ 回填因果关联
    });
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("确定要删除这个事件吗？此操作不可恢复。")) return;
    try {
      await fetch(`http://127.0.0.1:8000/api/events/${id}`, { method: 'DELETE' });
      loadData();
    } catch (error) {
      console.error("删除失败", error);
    }
  };

  // ✅ toggleArrayItem 支持 caused_by
  const toggleArrayItem = (field: 'domain' | 'participants' | 'caused_by', value: string) => {
    setFormData(prev => {
      const arr = prev[field];
      return {
        ...prev,
        [field]: arr.includes(value) ? arr.filter(i => i !== value) : [...arr, value]
      };
    });
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* 顶部创建/编辑表单 */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', color: 'var(--text-main)' }}>
              {editingId ? `编辑${modeTitle}` : `记录${modeTitle}`}
            </h2>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {mode === 'life' ? '记录真实发生的人生经历和人物记忆，不生成平行分支，也不做世界推演。'
                : mode === 'interaction' ? '记录 AI 伴侣角色之间/与你发生的重要互动，不做世界结构编辑与完整模拟。'
                : '先保存事件，再为它添加选择、结果、后续事件；普通事件可以只保留一个既定结果。'}
            </div>
          </div>
          <div style={{ flex: 1 }} />
          {narrative && <span style={{ fontSize: '11px', color: 'var(--text-muted)', border: '1px dashed var(--card-border)', borderRadius: '7px', padding: '6px 9px' }}>
            流程：保存事件 → 在下方事件库选择事件 → 事件详情中的「分支沙盒」
          </span>}
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: 2 }}>
              <label style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>{mode === 'interaction' ? '互动名称' : mode === 'life' ? '经历名称' : '事件名称'}</label>
              <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} 
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)' }} placeholder="例如：公司宣布缩减预算" />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>{mode === 'interaction' ? '互动发生时间' : mode === 'life' ? '发生日期/时间' : '小说内时间'}</label>
              <input type="text" value={formData.story_time} onChange={e => setFormData({...formData, story_time: e.target.value})} 
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)' }} placeholder="例如：第三年春" />
            </div>
          </div>

          {narrative && <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>剧情线</label>
              <select value={formData.storyline} onChange={e => setFormData({...formData, storyline: e.target.value})} 
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)' }}>
                <option value="主线">主线剧情</option>
                <option value="副线">副线剧情</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>事件层级</label>
              <select value={formData.scale} onChange={e => setFormData({...formData, scale: e.target.value})} 
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)' }}>
                <option value="宏观">🌍 宏观 (时代/大事件)</option>
                <option value="中观">⚔️ 中观 (重要剧情)</option>
                <option value="微观">🍵 微观 (日常/支线)</option>
              </select>
            </div>
          </div>}

          <div>
            <label style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>事件领域（可多选）</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {['资源冲击', '关系扰动', '地位评价', '意义扰动', '控制失效', '机会变化', '慢性压力', '存在转变'].map(opt => (
                <button key={opt} type="button" onClick={() => toggleArrayItem('domain', opt)}
                  style={{ padding: '6px 12px', borderRadius: '20px', border: `1px solid ${formData.domain.includes(opt) ? 'var(--primary-color)' : 'var(--card-border)'}`, background: formData.domain.includes(opt) ? 'rgba(128,128,128,0.15)' : 'transparent', color: formData.domain.includes(opt) ? 'var(--primary-color)' : 'var(--text-muted)', fontSize: '12px', cursor: 'pointer' }}>
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '24px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>事件极性</label>
              <select value={formData.polarity} onChange={e => setFormData({...formData, polarity: e.target.value})}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)' }}>
                {['威胁', '奖赏', '扩张', '稳定', '腐化'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>事件强度</label>
              <select value={formData.intensity} onChange={e => setFormData({...formData, intensity: e.target.value})}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)' }}>
                {['低', '中', '高'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '24px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>发生地点</label>
              <select value={formData.location_id || ''} onChange={e => setFormData({...formData, location_id: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)' }}>
                <option value="">不指定地点</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>涉及组织</label>
              <select value={formData.organization_id || ''} onChange={e => setFormData({...formData, organization_id: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)' }}>
                <option value="">不涉及组织</option>
                {organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>涉及的人物（可多选）</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {characters.map(c => (
                <button key={c.id} type="button" onClick={() => toggleArrayItem('participants', c.id)}
                  style={{ padding: '6px 12px', borderRadius: '20px', border: `1px solid ${formData.participants.includes(c.id) ? 'var(--primary-color)' : 'var(--card-border)'}`, background: formData.participants.includes(c.id) ? 'rgba(128,128,128,0.15)' : 'transparent', color: formData.participants.includes(c.id) ? 'var(--primary-color)' : 'var(--text-muted)', fontSize: '12px', cursor: 'pointer' }}>
                  {c.name || '未命名'}
                </button>
              ))}
            </div>
          </div>

          {/* ✅ 新增：前置事件（因果关联），仅叙事模式开放 */}
          {narrative && <div>
            <label style={{ fontSize: '13px', color: 'var(--primary-color)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>🔗 因果关系（选择是由哪些事件引发的）</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', maxHeight: '120px', overflowY: 'auto', padding: '8px', border: '1px dashed var(--card-border)', borderRadius: '8px' }}>
              {events.filter(e => e.id !== editingId).length === 0 ? (
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>暂无其他事件可供选择</span>
              ) : (
                events.filter(e => e.id !== editingId).map(e => (
                  <button key={e.id} type="button" onClick={() => toggleArrayItem('caused_by', e.id)}
                    style={{ padding: '4px 10px', borderRadius: '16px', border: `1px solid ${formData.caused_by.includes(e.id) ? 'var(--primary-color)' : 'var(--card-border)'}`, background: formData.caused_by.includes(e.id) ? 'rgba(128,128,128,0.14)' : 'transparent', color: formData.caused_by.includes(e.id) ? 'var(--primary-color)' : 'var(--text-muted)', fontSize: '12px', cursor: 'pointer' }}>
                    {e.name}
                  </button>
                ))
              )}
            </div>
          </div>}

          <div>
            <label style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>客观事实描述</label>
            <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} rows={3}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)', resize: 'vertical' }} placeholder="只记录发生了什么，不写主观感受..." />
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button onClick={handleSave} style={{ padding: '10px 24px', background: 'var(--primary-color)', color: 'var(--primary-text)', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>
              {editingId ? '保存修改' : '发布事件'}
            </button>
            {editingId && (
              <button 
                onClick={() => { setEditingId(null); setFormData({ name: '', domain: [], polarity: '威胁', intensity: '中', description: '', participants: [], story_time: '', location_id: '', organization_id: '', storyline: '主线', scale: '中观', caused_by: [] }); }} 
                style={{ padding: '10px 24px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--card-border)', borderRadius: '6px', cursor: 'pointer' }}>
                取消编辑
              </button>
            )}
          </div>
        </div>
      </div>

      {narrative && (editingId ? (
        <div className="glass-card" style={{ padding: '20px' }}>
          <EventChoicePanel
            eventId={editingId}
            eventName={formData.name}
            worldId={worldId}
            events={events.map((e: any) => ({ id: e.id, name: e.name }))}
            onEventsChanged={loadData}
            onOpenSandbox={() => onOpenSandbox?.()}
          />
        </div>
      ) : (
        <div className="glass-card" style={{ padding: '20px', borderStyle: 'dashed' }}>
          <h3 style={{ margin: 0, fontSize: '14px', color: 'var(--text-main)' }}>事件发展与选择</h3>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px', lineHeight: 1.7 }}>
            保存事件后，这里会出现多剧情编辑区：可添加多个选择，分别配置结果、后续事件与平行沙盒。删除或调整分支不会改动事件基础字段。
          </div>
        </div>
      ))}

      {/* 下方事件库 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', color: 'var(--text-main)' }}>{mode === 'life' ? '人生经历库' : mode === 'interaction' ? '互动事件库' : '事件库'}</h2>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{narrative ? '故事线管理从这里引用事件，不复制事件数据' : '只记录与人物相关的事实/互动，不进入故事线与世界推演'}</span>
        </div>
        {events.length === 0 ? (
          <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>暂无事件，请在上方创建。</div>
        ) : (
          events.map(event => (
            <div
              key={event.id}
              className="glass-card"
              onClick={() => handleEdit(event)}
              style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', cursor: 'pointer', borderLeft: `4px solid ${event.storyline === '副线' ? '#3b82f6' : (event.polarity === '威胁' || event.polarity === '腐化' ? 'var(--danger-color)' : 'var(--primary-color)')}` }}
            >
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', color: 'var(--text-main)' }}>
                    <span style={{ fontSize: '12px', padding: '2px 8px', background: 'rgba(128,128,128,0.1)', color: 'var(--text-muted)', borderRadius: '4px', marginRight: '8px' }}>
                      {event.scale === '宏观' ? '🌍 宏观' : event.scale === '微观' ? '🍵 微观' : '⚔️ 中观'}
                    </span>
                    <span style={{ fontSize: '12px', padding: '2px 8px', background: event.storyline === '副线' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(128,128,128,0.1)', color: event.storyline === '副线' ? '#3b82f6' : 'var(--primary-color)', borderRadius: '4px', marginRight: '8px' }}>
                      {event.storyline || '主线'}
                    </span>
                    {event.name} 
                    {event.story_time && <span style={{ marginLeft: '12px', fontSize: '12px', padding: '2px 8px', background: 'rgba(128,128,128,0.1)', borderRadius: '4px', color: 'var(--text-muted)' }}>时间: {event.story_time}</span>}
                  </h3>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>系统记录时间: {new Date(event.created_at).toLocaleString()}</div>
                </div>
                
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ padding: '4px 10px', background: 'rgba(128,128,128,0.15)', borderRadius: '20px', fontSize: '12px', color: 'var(--text-main)', marginRight: '8px' }}>{event.polarity} · {event.intensity}</span>
                  {narrative && <button onClick={(e) => { e.stopPropagation(); setSandboxEvent(event); }} style={{ background: 'transparent', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', fontSize: '13px', fontWeight: 700 }}>🧪 事件详情 · 分支沙盒</button>}
                  <button onClick={(e) => { e.stopPropagation(); handleEdit(event); }} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '13px' }}>✏️ 编辑</button>
                  <button onClick={(e) => { e.stopPropagation(); void handleDelete(event.id); }} style={{ background: 'transparent', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', fontSize: '13px' }}>🗑️ 删除</button>
                </div>
              </div>

              {/* ✅ 新增：展示因果关联 */}
              {event.caused_by && event.caused_by.length > 0 && (
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12px', color: 'var(--primary-color)', background: 'rgba(128,128,128,0.08)', padding: '8px 12px', borderRadius: '6px', border: '1px dashed var(--card-border)' }}>
                  <span>🔗 源于事件：</span>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {event.caused_by.map((cid: string) => {
                      const cause = events.find(e => e.id === cid);
                      if (!cause) return null;
                      return <span key={cid} style={{ background: 'var(--bg-color)', padding: '2px 8px', borderRadius: '12px', border: '1px solid var(--card-border)' }}>{cause.name}</span>;
                    })}
                  </div>
                </div>
              )}
              
              {event.domain && event.domain.length > 0 && (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {event.domain.map((d: string) => (
                    <span key={d} style={{ fontSize: '11px', border: '1px solid var(--card-border)', padding: '2px 8px', borderRadius: '4px', color: 'var(--text-muted)' }}>{d}</span>
                  ))}
                </div>
              )}

              <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-main)', lineHeight: 1.5 }}>{event.description}</p>
              
              {event.location_id && (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  📍 发生地点：{locations.find(l => l.id === event.location_id)?.name || '未知'}
                </div>
              )}
              {event.organization_id && (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  🏛️ 涉及组织：{organizations.find(o => o.id === event.organization_id)?.name || '未知'}
                </div>
              )}
              
              {event.participants && event.participants.length > 0 && (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                  参与者：{event.participants.map((id: string) => {
                    const c = characters.find((char: any) => char.id === id);
                    return c ? c.name : '未知人物';
                  }).join('、')}
                </div>
              )}

              <EventCausalityPanel
                eventId={event.id}
                worldId={worldId || ''}
                events={events}
                characters={characters}
                organizations={organizations}
                onChanged={loadData}
              />
            </div>
          ))
        )}
      </div>
      {sandboxEvent && (
        <EventSandboxModal
          event={sandboxEvent}
          onClose={() => setSandboxEvent(null)}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
}