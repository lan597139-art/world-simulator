import { useState, useEffect } from 'react';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch"; 

// ✅ 预设地形与气候数据
const TERRAIN_PRESETS = ['平原', '山地', '丘陵', '森林', '沙漠', '沼泽', '水域', '冰川', '盆地', '城市建筑群'];
const CLIMATE_PRESETS = ['温带', '寒带', '热带', '干旱', '湿润', '极地', '高原气候', '多风暴', '魔法紊乱'];

export default function WorldDataPage({ worldId }: { worldId?: string }) {
  const [activeTab, setActiveTab] = useState<'map' | 'org'>('map');
  
  const [locations, setLocations] = useState<any[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [worldInfo, setWorldInfo] = useState<any>(null);
  const [mapUrlInput, setMapUrlInput] = useState('');

  const [locForm, setLocForm] = useState({ 
    name: '', description: '', terrain: '', climate: '', nation: '', x: 50, y: 50,
    geo_type: '城市/都市'
  });
  const [editingLocId, setEditingLocId] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(true); 
  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);

  const [orgForm, setOrgForm] = useState({ name: '', description: '' });

  const loadData = async () => {
    try {
      const [locRes, orgRes] = await Promise.all([
        fetch(`http://127.0.0.1:8000/api/locations${worldId ? `?world_id=${worldId}` : ''}`),
        fetch(`http://127.0.0.1:8000/api/organizations${worldId ? `?world_id=${worldId}` : ''}`)
      ]);
      setLocations(await locRes.json());
      setOrganizations(await orgRes.json());
      
      if (worldId) {
        const worldRes = await fetch(`http://127.0.0.1:8000/api/worlds/${worldId}`);
        const wData = await worldRes.json();
        setWorldInfo(wData);
        setMapUrlInput(wData.map_image_url || '');
      }
    } catch (error) { console.error("加载失败", error); }
  };

  useEffect(() => {
    loadData();
    setEditingLocId(null);
    setLocForm({ name: '', description: '', terrain: '', climate: '', nation: '', x: 50, y: 50, geo_type: '城市/都市' });
  }, [worldId]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 30 * 1024 * 1024) return alert("图片过大！请选择小于 30MB 的图片。");

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxWidth = 2560; 

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          setMapUrlInput(canvas.toDataURL('image/jpeg', 0.85));
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveMapUrl = async () => {
    if (!worldId) return;
    try {
      await fetch(`http://127.0.0.1:8000/api/worlds/${worldId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ map_image_url: mapUrlInput })
      });
      setWorldInfo((prev: any) => ({ ...prev, map_image_url: mapUrlInput }));
      alert("地图底图已永久保存！");
    } catch (error) { console.error(error); }
  };

  const handleSaveLoc = async () => {
    if (!locForm.name.trim()) return alert("请输入地点名称");
    try {
      const url = editingLocId ? `http://127.0.0.1:8000/api/locations/${editingLocId}` : "http://127.0.0.1:8000/api/locations";
      const method = editingLocId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...locForm, world_id: worldId || "" })
      });
      
      if (res.ok) {
        setLocForm({ name: '', description: '', terrain: '', climate: '', nation: '', x: 50, y: 50, geo_type: '城市/都市' });
        setEditingLocId(null);
        loadData();
      }
    } catch (error) { console.error(error); }
  };

  const handleEditLoc = (loc: any) => {
    setEditingLocId(loc.id);
    setLocForm({
      name: loc.name, description: loc.description || '', terrain: loc.terrain || '', 
      climate: loc.climate || '', nation: loc.nation || '', x: loc.x || 50, y: loc.y || 50,
      geo_type: loc.geo_type || '城市/都市'
    });
    setIsPanelOpen(true); 
  };

  const handleAddOrg = async () => {
    if (!orgForm.name.trim()) return alert("请输入组织名称");
    await fetch("http://127.0.0.1:8000/api/organizations", {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...orgForm, world_id: worldId || "" })
    });
    setOrgForm({ name: '', description: '' });
    loadData();
  };

  const handleDeleteOrg = async (id: string) => {
    if (!window.confirm("确定删除该组织吗？")) return;
    await fetch(`http://127.0.0.1:8000/api/organizations/${id}`, { method: 'DELETE' });
    loadData();
  };

  const isLeftSide = locForm.x < 50;

  const getPinIcon = (type: string) => {
    const pinMap: Record<string, { icon: string, color: string }> = {
      '大陆/大洲': { icon: '🌍', color: '#8b5cf6' },
      '海洋/水域': { icon: '🌊', color: '#3b82f6' },
      '异界/位面': { icon: '🌌', color: '#6366f1' },
      '山脉/森林': { icon: '⛰️', color: '#10b981' },
      '沙漠/荒原': { icon: '🏜️', color: '#d97706' },
      '平原/草原': { icon: '🌾', color: '#84cc16' },
      '帝国/王国': { icon: '👑', color: '#ef4444' },
      '城邦/联邦': { icon: '🏛️', color: '#f59e0b' },
      '部落/营地': { icon: '⛺', color: '#b45309' },
      '省份/州': { icon: '🗺️', color: '#f97316' },
      '郡/县/领地': { icon: '🚩', color: '#e11d48' },
      '城市/都市': { icon: '🏙️', color: '#0284c7' },
      '城镇/村庄': { icon: '🏡', color: '#65a30d' },
      '城堡/要塞': { icon: '🏰', color: '#64748b' },
      '神殿/遗迹': { icon: '⛪', color: '#a855f7' },
      '酒馆/公会': { icon: '🍺', color: '#ca8a04' },
      '秘境/洞穴': { icon: '🕳️', color: '#475569' },
      '自定义': { icon: '📍', color: '#000000' }
    };
    return pinMap[type] || pinMap['自定义'];
  };

  // 获取已有的国家列表
  const existingNations = locations.filter(l => l.geo_type?.includes('国') || l.geo_type?.includes('帝国') || l.geo_type?.includes('城邦')).map(l => l.name);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '1.5rem', boxSizing: 'border-box' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '8px', background: 'var(--card-bg)', padding: '4px', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
          <button onClick={() => setActiveTab('map')} style={{ padding: '8px 24px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: activeTab === 'map' ? 'var(--primary-color)' : 'transparent', color: activeTab === 'map' ? 'var(--primary-text)' : 'var(--text-muted)', fontWeight: 600, transition: 'all 0.2s' }}>
            📍 地理与地图
          </button>
          <button onClick={() => setActiveTab('org')} style={{ padding: '8px 24px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: activeTab === 'org' ? 'var(--primary-color)' : 'transparent', color: activeTab === 'org' ? 'var(--primary-text)' : 'var(--text-muted)', fontWeight: 600, transition: 'all 0.2s' }}>
            🏛️ 势力与组织
          </button>
        </div>

        {activeTab === 'map' && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'var(--card-bg)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
            <label style={{ padding: '6px 12px', background: 'rgba(128,128,128,0.1)', border: '1px solid var(--card-border)', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', color: 'var(--text-main)', fontWeight: 600 }}>
              📁 上传底图
              <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
            </label>
            <button onClick={handleSaveMapUrl} style={{ padding: '6px 16px', background: 'var(--primary-color)', color: 'var(--primary-text)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}>应用</button>
          </div>
        )}
      </div>

      <div style={{ flex: 1, position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--card-border)', background: 'var(--bg-color)' }}>
        
        {activeTab === 'map' && (
          <>
            {!worldInfo?.map_image_url ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                请先在上方上传一张世界地图底图
              </div>
            ) : (
              <TransformWrapper initialScale={1} minScale={0.2} maxScale={8} centerOnInit={true} wheel={{ step: 0.1 }}>
                {({ zoomIn, zoomOut, resetTransform }) => {
                  let isPanning = false;
                  return (
                    <>
                      <div style={{ position: 'absolute', bottom: '20px', right: '20px', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '6px', background: 'var(--card-bg)', padding: '6px', borderRadius: '8px', border: '1px solid var(--card-border)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                        <button onClick={(e) => { e.stopPropagation(); zoomIn(); }} style={{ width: '32px', height: '32px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-main)', fontSize: '18px' }}>+</button>
                        <button onClick={(e) => { e.stopPropagation(); zoomOut(); }} style={{ width: '32px', height: '32px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-main)', fontSize: '18px' }}>-</button>
                        <button onClick={(e) => { e.stopPropagation(); resetTransform(); }} style={{ width: '32px', height: '32px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-main)' }}>↺</button>
                      </div>

                      <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }}>
                        <div
                          onMouseDown={() => { isPanning = false; }}
                          onMouseMove={() => { isPanning = true; }}
                          onClick={(e) => {
                            if (isPanning) return;
                            const rect = e.currentTarget.getBoundingClientRect();
                            const x = ((e.clientX - rect.left) / rect.width) * 100;
                            const y = ((e.clientY - rect.top) / rect.height) * 100;
                            if (x >= 0 && x <= 100 && y >= 0 && y <= 100) {
                              setLocForm({ ...locForm, x, y });
                              setEditingLocId(null);
                              setIsPanelOpen(true);
                            }
                          }}
                          style={{ position: 'relative', cursor: 'crosshair', width: 'fit-content' }}
                        >
                          <img src={worldInfo.map_image_url} alt="Map" draggable={false} style={{ display: 'block', maxWidth: 'none', height: 'auto' }} />
                          
                          {locations.map(loc => {
                            const pin = getPinIcon(loc.geo_type);
                            return (
                              <div 
                                key={loc.id}
                                onClick={(e) => { e.stopPropagation(); handleEditLoc(loc); }}
                                style={{
                                  position: 'absolute', left: `${loc.x}%`, top: `${loc.y}%`, transform: 'translate(-50%, -100%)',
                                  cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 5
                                }}
                              >
                                <div style={{ fontSize: '24px', filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.5))' }}>{pin.icon}</div>
                                <div style={{ background: pin.color, padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', boxShadow: '0 2px 6px rgba(0,0,0,0.2)', marginTop: '2px' }}>
                                  {loc.name}
                                </div>
                              </div>
                            );
                          })}
                          
                          {!editingLocId && isPanelOpen && (
                             <div style={{ position: 'absolute', left: `${locForm.x}%`, top: `${locForm.y}%`, transform: 'translate(-50%, -100%)', fontSize: '32px', filter: 'drop-shadow(0 0 10px var(--primary-color))', zIndex: 4, opacity: 0.8 }}>📍</div>
                          )}
                        </div>
                      </TransformComponent>
                    </>
                  );
                }}
              </TransformWrapper>
            )}

            {/* ✅ 悬浮表单面板 (全面UI升级) */}
            <div style={{ 
              position: 'absolute', top: '20px', width: '340px', zIndex: 20,
              ...(isLeftSide ? { right: '20px' } : { left: '20px' }),
              background: 'var(--card-bg)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid var(--card-border)', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
              padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px',
              transition: 'all 0.3s ease', 
              transform: isPanelOpen ? 'translateX(0)' : (isLeftSide ? 'translateX(120%)' : 'translateX(-120%)')
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-main)' }}>{editingLocId ? '✏️ 编辑地点' : '📍 新建地点'}</h3>
                <button onClick={() => setIsPanelOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>◀</button>
              </div>

              <div style={{ fontSize: '12px', color: 'var(--primary-color)', fontWeight: 600 }}>坐标: X {locForm.x.toFixed(1)}%, Y {locForm.y.toFixed(1)}%</div>
              
              <input type="text" placeholder="地点名称" value={locForm.name} onChange={e => setLocForm({...locForm, name: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'rgba(128,128,128,0.12)', color: 'var(--text-main)', outline: 'none' }} />
              
              {/* ✅ 分类选择器（网格面板） */}
              <div style={{ position: 'relative' }}>
                <div 
                  onClick={() => setIsTypeModalOpen(!isTypeModalOpen)}
                  style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'rgba(128,128,128,0.12)', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <span>{getPinIcon(locForm.geo_type).icon} {locForm.geo_type}</span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>▼</span>
                </div>

                {isTypeModalOpen && (
                  <div style={{ position: 'absolute', top: '40px', left: 0, right: 0, zIndex: 50, background: 'var(--bg-color)', border: '1px solid var(--card-border)', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', padding: '16px', maxHeight: '350px', overflowY: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <strong style={{ fontSize: '13px', color: 'var(--text-main)' }}>选择地理类型</strong>
                      <button onClick={() => setIsTypeModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>×</button>
                    </div>

                    {[
                      { group: '🌍 宏观世界', items: ['大陆/大洲', '海洋/水域', '异界/位面'] },
                      { group: '⛰️ 自然地貌', items: ['山脉/森林', '沙漠/荒原', '平原/草原'] },
                      { group: '🏳️ 国家与政权', items: ['帝国/王国', '城邦/联邦', '部落/营地'] },
                      { group: '🗺️ 行政区划', items: ['省份/州', '郡/县/领地'] },
                      { group: '🏙️ 聚落与建筑', items: ['城市/都市', '城镇/村庄', '城堡/要塞', '神殿/遗迹', '酒馆/公会', '秘境/洞穴'] },
                      { group: '📍 其他', items: ['自定义'] }
                    ].map(group => (
                      <div key={group.group} style={{ marginBottom: '16px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>{group.group}</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {group.items.map(item => {
                            const isActive = locForm.geo_type === item;
                            const pin = getPinIcon(item);
                            return (
                              <button
                                key={item}
                                onClick={() => { setLocForm({ ...locForm, geo_type: item }); setIsTypeModalOpen(false); }}
                                style={{ padding: '6px 10px', borderRadius: '16px', fontSize: '12px', cursor: 'pointer', border: `1px solid ${isActive ? 'var(--primary-color)' : 'var(--card-border)'}`, background: isActive ? 'var(--primary-color)' : 'rgba(128,128,128,0.05)', color: isActive ? 'var(--primary-text)' : 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '4px', transition: 'all 0.2s' }}
                              >
                                <span>{pin.icon}</span> {item}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ✅ 国家/地区（下拉框） */}
              <select 
                value={locForm.nation} 
                onChange={e => setLocForm({...locForm, nation: e.target.value})}
                style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'rgba(128,128,128,0.12)', color: 'var(--text-main)', outline: 'none' }}
              >
                <option value="">-- 选择或输入所属国家 --</option>
                {existingNations.map(n => <option key={n} value={n}>{n}</option>)}
              </select>

              {/* ✅ 地形（预设标签组） */}
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>地形地貌</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {TERRAIN_PRESETS.map(t => (
                    <button key={t} type="button" onClick={() => setLocForm({...locForm, terrain: t})}
                      style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '11px', cursor: 'pointer', border: `1px solid ${locForm.terrain === t ? 'var(--primary-color)' : 'var(--card-border)'}`, background: locForm.terrain === t ? 'var(--primary-color)' : 'transparent', color: locForm.terrain === t ? '#fff' : 'var(--text-main)' }}>
                      {t}
                    </button>
                  ))}
                  <input type="text" placeholder="自定义..." value={TERRAIN_PRESETS.includes(locForm.terrain) ? '' : locForm.terrain} onChange={e => setLocForm({...locForm, terrain: e.target.value})} style={{ width: '70px', padding: '4px 8px', borderRadius: '12px', fontSize: '11px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)', outline: 'none' }} />
                </div>
              </div>

              {/* ✅ 气候（预设标签组） */}
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>气候特征</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {CLIMATE_PRESETS.map(c => (
                    <button key={c} type="button" onClick={() => setLocForm({...locForm, climate: c})}
                      style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '11px', cursor: 'pointer', border: `1px solid ${locForm.climate === c ? 'var(--primary-color)' : 'var(--card-border)'}`, background: locForm.climate === c ? 'var(--primary-color)' : 'transparent', color: locForm.climate === c ? '#fff' : 'var(--text-main)' }}>
                      {c}
                    </button>
                  ))}
                  <input type="text" placeholder="自定义..." value={CLIMATE_PRESETS.includes(locForm.climate) ? '' : locForm.climate} onChange={e => setLocForm({...locForm, climate: e.target.value})} style={{ width: '70px', padding: '4px 8px', borderRadius: '12px', fontSize: '11px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)', outline: 'none' }} />
                </div>
              </div>

              <textarea placeholder="地点描述..." value={locForm.description} onChange={e => setLocForm({...locForm, description: e.target.value})} rows={2} style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'rgba(128,128,128,0.12)', color: 'var(--text-main)', outline: 'none', resize: 'vertical' }} />

              <button onClick={handleSaveLoc} style={{ padding: '10px', background: 'var(--primary-color)', color: 'var(--primary-text)', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, marginTop: '4px' }}>
                {editingLocId ? '保存修改' : '保存地点'}
              </button>
              {editingLocId && (
                <button onClick={() => { setEditingLocId(null); setLocForm({ name: '', description: '', terrain: '', climate: '', nation: '', x: 50, y: 50, geo_type: '城市/都市' }); }} style={{ padding: '8px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px' }}>取消编辑</button>
              )}
            </div>

            {!isPanelOpen && (
              <button onClick={() => setIsPanelOpen(true)} style={{ 
                position: 'absolute', top: '20px', zIndex: 20, 
                ...(isLeftSide ? { right: '20px' } : { left: '20px' }),
                padding: '10px 16px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, color: 'var(--text-main)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' 
              }}>
                ▶ 展开操作面板
              </button>
            )}

            <div style={{ position: 'absolute', bottom: '20px', left: '20px', right: '80px', zIndex: 15, display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px' }}>
              {locations.map(loc => {
                const pin = getPinIcon(loc.geo_type);
                return (
                  <div key={loc.id} onClick={() => handleEditLoc(loc)} style={{ flexShrink: 0, padding: '10px 16px', background: 'var(--card-bg)', backdropFilter: 'blur(10px)', border: '1px solid var(--card-border)', borderRadius: '20px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px' }}>{pin.icon}</span>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '13px' }}>{loc.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{loc.geo_type} · {loc.nation}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {activeTab === 'org' && (
          <div style={{ padding: '2rem', height: '100%', overflowY: 'auto', background: 'var(--bg-color)' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              <input type="text" placeholder="组织名称" value={orgForm.name} onChange={e => setOrgForm({...orgForm, name: e.target.value})} style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)' }} />
              <input type="text" placeholder="组织描述" value={orgForm.description} onChange={e => setOrgForm({...orgForm, description: e.target.value})} style={{ flex: 2, padding: '10px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)' }} />
              <button onClick={handleAddOrg} style={{ padding: '0 20px', background: 'var(--primary-color)', color: 'var(--primary-text)', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>添加</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
              {organizations.map(org => (
                <div key={org.id} style={{ padding: '16px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '15px' }}>{org.name}</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px', lineHeight: 1.5 }}>{org.description || '暂无描述'}</div>
                  </div>
                  <button onClick={() => handleDeleteOrg(org.id)} style={{ background: 'transparent', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', fontSize: '12px' }}>删除</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}