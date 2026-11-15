import { useState, useEffect } from 'react';
import EventCausalityPanel from '../components/EventCausalityPanel';
import EventChoicePanel from '../components/EventChoicePanel';
import EventSandboxModal from '../components/EventSandboxModal';
import { ArrowLeft } from 'lucide-react';

// 新增：剧情线配置表
const STORYLINE_OPTIONS = [
  { value: '主线', label: '主线' },
  { value: '支线', label: '支线' },
  { value: '副本', label: '副本' },
  { value: '隐线', label: '隐线' },
];

// 新增：剧情线对应颜色表
const STORYLINE_COLORS: Record<string, { text: string, bg: string, border: string }> = {
  '主线': { text: 'var(--primary-color)', bg: 'rgba(128,128,128,0.1)', border: 'var(--primary-color)' },
  '支线': { text: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)', border: '#3b82f6' },
  '副本': { text: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)', border: '#8b5cf6' },
  '隐线': { text: '#c08a2e', bg: 'rgba(192, 138, 46, 0.15)', border: '#c08a2e' },
};

export default function EventsPage({ worldId, onOpenSandbox, onNavigate, mode = 'narrative' }: {
  worldId?: string; onOpenSandbox?: () => void; onNavigate?: (page: string) => void
  mode?: 'narrative' | 'interaction' | 'life'
}) {
  const narrative = mode === 'narrative';
  const modeTitle = mode === 'interaction' ? '互动事件' : mode === 'life' ? '人生经历' : '事件';
  
  // 控制沉浸式表单视图
  const [isFormOpen, setIsFormOpen] = useState(false);

  const [events, setEvents] = useState<any[]>([]);
  const [characters, setCharacters] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);
  
  const emptyForm = {
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
    caused_by: [] as string[]
  };

  const [formData, setFormData] = useState({ ...emptyForm });
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
    setIsFormOpen(false);
    setEditingId(null);
    setFormData({ ...emptyForm });
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
        await loadData();
        if (!editingId) {
          setIsFormOpen(false);
          alert('事件已创建。');
        } else {
          alert('修改已保存');
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
      caused_by: ev.caused_by || []
    });
    setIsFormOpen(true);
  };

  const handleCreateNew = () => {
    setEditingId(null);
    setFormData({ ...emptyForm });
    setIsFormOpen(true);
  };

  const handleCancel = () => {
    setIsFormOpen(false);
    setEditingId(null);
    setFormData({ ...emptyForm });
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

  const toggleArrayItem = (field: 'domain' | 'participants' | 'caused_by', value: string) => {
    setFormData(prev => {
      const arr = prev[field];
      return {
        ...prev,
        [field]: arr.includes(value) ? arr.filter(i => i !== value) : [...arr, value]
      };
    });
  };

  // ================= 沉浸式表单视图 =================
  if (isFormOpen) {
    return (
      <div style={{ width: '100%', height: 'calc(100vh - 120px)', overflowY: 'auto', background: 'var(--bg-color)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* 顶部操作栏：左侧返回+标题，右侧取消+保存 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <button onClick={handleCancel} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'rgba(128,128,128,0.1)', border: 'none', borderRadius: '8px', cursor: 'pointer', color: 'var(--text-main)', fontWeight: 600 }}>
                <ArrowLeft size={16} /> 返回事件库
              </button>
              <h2 style={{ margin: 0, fontSize: '24px', color: 'var(--text-main)' }}>
                {editingId ? `编辑${modeTitle}` : `创建${modeTitle}`}
              </h2>
            </div>
            
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={handleCancel} style={{ padding: '10px 24px', background: 'transparent', color: 'var(--text-main)', border: '1px solid var(--card-border)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
                取消
              </button>
              <button onClick={handleSave} style={{ padding: '10px 24px', background: 'var(--primary-color)', color: 'var(--primary-text)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
                {editingId ? '保存修改' : '发布事件'}
              </button>
            </div>
          </div>

          {/* 表单主体 */}
          <div className="glass-card" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              <div style={{ display: 'flex', gap: '24px' }}>
                <div style={{ flex: 2 }}>
                  <label style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>{mode === 'interaction' ? '互动名称' : mode === 'life' ? '经历名称' : '事件名称'}</label>
                  <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} 
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)', fontSize: '15px' }} placeholder="例如：公司宣布缩减预算" />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>{mode === 'interaction' ? '互动发生时间' : mode === 'life' ? '发生日期/时间' : '小说内时间'}</label>
                  <input type="text" value={formData.story_time} onChange={e => setFormData({...formData, story_time: e.target.value})} 
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)', fontSize: '15px' }} placeholder="例如：第三年春" />
                </div>
              </div>

              {narrative && <div style={{ display: 'flex', gap: '24px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>剧情线</label>
                  <select value={formData.storyline} onChange={e => setFormData({...formData, storyline: e.target.value})} 
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)', fontSize: '15px' }}>
                    {/* 修改：遍历新的四个选项 */}
                    {STORYLINE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>事件层级</label>
                  <select value={formData.scale} onChange={e => setFormData({...formData, scale: e.target.value})} 
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)', fontSize: '15px' }}>
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
                      style={{ padding: '8px 16px', borderRadius: '20px', border: `1px solid ${formData.domain.includes(opt) ? 'var(--primary-color)' : 'var(--card-border)'}`, background: formData.domain.includes(opt) ? 'rgba(128,128,128,0.15)' : 'transparent', color: formData.domain.includes(opt) ? 'var(--primary-color)' : 'var(--text-muted)', fontSize: '13px', cursor: 'pointer' }}>
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '24px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>事件极性</label>
                  <select value={formData.polarity} onChange={e => setFormData({...formData, polarity: e.target.value})}
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)', fontSize: '15px' }}>
                    {['威胁', '奖赏', '扩张', '稳定', '腐化'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>事件强度</label>
                  <select value={formData.intensity} onChange={e => setFormData({...formData, intensity: e.target.value})}
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)', fontSize: '15px' }}>
                    {['低', '中', '高'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '24px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>发生地点</label>
                  <select value={formData.location_id || ''} onChange={e => setFormData({...formData, location_id: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)', fontSize: '15px' }}>
                    <option value="">不指定地点</option>
                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>涉及组织</label>
                  <select value={formData.organization_id || ''} onChange={e => setFormData({...formData, organization_id: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)', fontSize: '15px' }}>
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
                      style={{ padding: '8px 16px', borderRadius: '20px', border: `1px solid ${formData.participants.includes(c.id) ? 'var(--primary-color)' : 'var(--card-border)'}`, background: formData.participants.includes(c.id) ? 'rgba(128,128,128,0.15)' : 'transparent', color: formData.participants.includes(c.id) ? 'var(--primary-color)' : 'var(--text-muted)', fontSize: '13px', cursor: 'pointer' }}>
                      {c.name || '未命名'}
                    </button>
                  ))}
                </div>
              </div>

              {narrative && <div>
                <label style={{ fontSize: '13px', color: 'var(--primary-color)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>🔗 因果关系（选择是由哪些事件引发的）</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', maxHeight: '160px', overflowY: 'auto', padding: '12px', border: '1px dashed var(--card-border)', borderRadius: '8px' }}>
                  {events.filter(e => e.id !== editingId).length === 0 ? (
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>暂无其他事件可供选择</span>
                  ) : (
                    events.filter(e => e.id !== editingId).map(e => (
                      <button key={e.id} type="button" onClick={() => toggleArrayItem('caused_by', e.id)}
                        style={{ padding: '6px 14px', borderRadius: '16px', border: `1px solid ${formData.caused_by.includes(e.id) ? 'var(--primary-color)' : 'var(--card-border)'}`, background: formData.caused_by.includes(e.id) ? 'rgba(128,128,128,0.14)' : 'transparent', color: formData.caused_by.includes(e.id) ? 'var(--primary-color)' : 'var(--text-muted)', fontSize: '13px', cursor: 'pointer' }}>
                        {e.name}
                      </button>
                    ))
                  )}
                </div>
              </div>}

              <div>
                <label style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>客观事实描述</label>
                <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} rows={4}
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)', fontSize: '15px', resize: 'vertical' }} placeholder="只记录发生了什么，不写主观感受..." />
              </div>
            </div>
          </div>

          {/* 事件发展与选择扩展区 */}
          {narrative && editingId && (
            <div className="glass-card" style={{ padding: '32px' }}>
              <EventChoicePanel
                eventId={editingId}
                eventName={formData.name}
                worldId={worldId}
                events={events.map((e: any) => ({ id: e.id, name: e.name }))}
                onEventsChanged={loadData}
                onOpenSandbox={() => onOpenSandbox?.()}
              />
            </div>
          )}

        </div>
      </div>
    );
  }

  // ================= 全宽列表视图 =================
  return (
    <div style={{ padding: '32px', width: '100%', height: 'calc(100vh - 120px)', overflowY: 'auto', background: 'var(--bg-color)' }}>
      
      {/* 只有标题，去掉了右上角的按钮 */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ margin: 0, fontSize: '24px', color: 'var(--text-main)', fontWeight: 600 }}>
          {mode === 'life' ? '人生经历库' : mode === 'interaction' ? '互动事件库' : '事件库'}
        </h2>
        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          {narrative ? '故事线管理从这里引用事件，不复制事件数据' : '只记录与人物相关的事实/互动'}
        </span>
      </div>
      
      {/* 强制 3 列网格 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '24px' }}>
        
        {/* 👇 空白新建卡片 👇 */}
        <div
          onClick={handleCreateNew}
          className="glass-card"
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            cursor: 'pointer',
            borderStyle: 'dashed',
            borderWidth: '2px',
            borderColor: 'var(--card-border)',
            background: 'transparent',
            transition: 'all 0.2s ease',
            minHeight: '220px',
            color: 'var(--text-muted)'
          }}
          onMouseOver={(e) => { 
            e.currentTarget.style.borderColor = 'var(--primary-color)'; 
            e.currentTarget.style.color = 'var(--text-main)'; 
            e.currentTarget.style.transform = 'translateY(-2px)'; 
          }}
          onMouseOut={(e) => { 
            e.currentTarget.style.borderColor = 'var(--card-border)'; 
            e.currentTarget.style.color = 'var(--text-muted)'; 
            e.currentTarget.style.transform = 'none'; 
          }}
        >
          <span style={{ fontSize: '32px', fontWeight: 300, marginBottom: '12px' }}>＋</span>
          <span style={{ fontSize: '16px', fontWeight: 600 }}>创建新事件</span>
          <span style={{ fontSize: '12px', marginTop: '8px' }}>点击进入沉浸式记录页面</span>
        </div>

        {events.map(event => {
          // 根据剧情线获取对应的颜色配置
          const slColor = STORYLINE_COLORS[event.storyline] || STORYLINE_COLORS['主线'];
          
          // 计算左侧边框颜色：如果是支线/副本/隐线使用对应颜色，如果是主线则根据极性判断
          const borderLeftColor = event.storyline !== '主线' 
            ? slColor.border 
            : (event.polarity === '威胁' || event.polarity === '腐化' ? 'var(--danger-color)' : 'var(--primary-color)');

          return (
            <div
              key={event.id}
              className="glass-card"
              onClick={() => handleEdit(event)}
              style={{ 
                padding: '24px', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '16px', 
                cursor: 'pointer', 
                borderLeft: `4px solid ${borderLeftColor}`,
                transition: 'all 0.2s ease',
              }}
              onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)'; }}
              onMouseOut={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', color: 'var(--text-main)' }}>
                    <span style={{ fontSize: '12px', padding: '2px 8px', background: 'rgba(128,128,128,0.1)', color: 'var(--text-muted)', borderRadius: '4px', marginRight: '8px' }}>
                      {event.scale === '宏观' ? '🌍 宏观' : event.scale === '微观' ? '🍵 微观' : '⚔️ 中观'}
                    </span>
                    
                    {/* 修改：剧情线标签使用对应颜色 */}
                    <span style={{ fontSize: '12px', padding: '2px 8px', background: slColor.bg, color: slColor.text, borderRadius: '4px', marginRight: '8px' }}>
                      {event.storyline || '主线'}
                    </span>
                    {event.name} 
                  </h3>
                  {event.story_time && <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>⏳ {event.story_time}</div>}
                </div>
                
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ padding: '4px 10px', background: 'rgba(128,128,128,0.15)', borderRadius: '20px', fontSize: '12px', color: 'var(--text-main)' }}>{event.polarity} · {event.intensity}</span>
                  {narrative && <button onClick={(e) => { e.stopPropagation(); setSandboxEvent(event); }} style={{ background: 'transparent', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', fontSize: '13px', fontWeight: 700 }}>🧪 沙盒</button>}
                </div>
              </div>

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

              <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-main)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{event.description}</p>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto' }}>
                <div>
                  {event.location_id && (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      📍 {locations.find(l => l.id === event.location_id)?.name || '未知'}
                    </div>
                  )}
                  {event.organization_id && (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      🏛️ {organizations.find(o => o.id === event.organization_id)?.name || '未知'}
                    </div>
                  )}
                  {event.participants && event.participants.length > 0 && (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      参与者：{event.participants.map((id: string) => {
                        const c = characters.find((char: any) => char.id === id);
                        return c ? c.name : '未知人物';
                      }).join('、')}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={(e) => { e.stopPropagation(); void handleDelete(event.id); }} style={{ background: 'transparent', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', fontSize: '13px' }}>🗑️ 删除</button>
                </div>
              </div>

              <EventCausalityPanel
                eventId={event.id}
                worldId={worldId || ''}
                events={events}
                characters={characters}
                organizations={organizations}
                onChanged={loadData}
              />
            </div>
          );
        })}
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