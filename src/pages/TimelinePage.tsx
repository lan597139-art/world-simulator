import { useState, useEffect, useMemo } from 'react';

export default function TimelinePage({ worldId, onNavigate }: { worldId?: string, onNavigate?: (page: any) => void }) {
  const [events, setEvents] = useState<any[]>([]);
  const [characters, setCharacters] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);

  const [viewMode, setViewMode] = useState<'world' | 'character'>('world');
  const [filterStartYear, setFilterStartYear] = useState<string>('all');
  const [filterEndYear, setFilterEndYear] = useState<string>('all');
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [filterDay, setFilterDay] = useState<string>('all');
  const [filterHour, setFilterHour] = useState<string>('all');

  const [selectedCharId, setSelectedCharId] = useState<string>('');
  const [detailEvent, setDetailEvent] = useState<any>(null);

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
    } catch (error) { console.error(error); }
  };

  useEffect(() => { loadData(); }, [worldId]);

  const locMap = useMemo(() => new Map(locations.map(l => [l.id, l.name])), [locations]);
  const orgMap = useMemo(() => new Map(organizations.map(o => [o.id, o.name])), [organizations]);

  const extractTimeParts = (timeStr: string) => {
    if (!timeStr) return { year: null };
    const yMatch = timeStr.match(/(-?\d+(?:\.\d+)?)/);
    return { year: yMatch ? parseFloat(yMatch[1]) : null };
  };

  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      const parts = extractTimeParts(e.story_time);
      if (parts.year !== null) {
        if (filterStartYear !== 'all' && parts.year < parseFloat(filterStartYear)) return false;
        if (filterEndYear !== 'all' && parts.year > parseFloat(filterEndYear)) return false;
      }
      return true;
    });
  }, [events, filterStartYear, filterEndYear]);

  const { groupedByTime, sortedTimeKeys } = useMemo(() => {
    const grouped: Record<string, { main: any[], sub: any[], displayTime: string, sortKey: number }> = {};
    filteredEvents.forEach(e => {
      const parts = extractTimeParts(e.story_time);
      const timeKey = parts.year !== null ? String(parts.year) : (e.created_at || 'unknown');
      const displayTime = e.story_time || new Date(e.created_at || Date.now()).toLocaleString();
      if (!grouped[timeKey]) grouped[timeKey] = { main: [], sub: [], displayTime, sortKey: parts.year !== null ? parts.year : Infinity };
      if (e.storyline === '副线') grouped[timeKey].sub.push(e);
      else grouped[timeKey].main.push(e);
    });
    return { groupedByTime: grouped, sortedTimeKeys: Object.keys(grouped).sort((a, b) => grouped[a].sortKey - grouped[b].sortKey) };
  }, [filteredEvents]);

  const renderCard = (event: any, isMain: boolean) => {
    return (
      <div 
        onClick={() => setDetailEvent(event)}
        style={{ 
          padding: '16px', marginBottom: '16px', cursor: 'pointer', width: '100%',
          background: '#ffffff', 
          border: '1px solid #d1d5db',
          borderLeft: `4px solid ${isMain ? '#3b82f6' : '#ef4444'}`,
          borderRadius: '8px',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
          transition: 'all 0.2s',
        }}
      >
        <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 700, color: '#111827' }}>{event.name}</h3>
        <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#4b5563', lineHeight: 1.5 }}>
          {event.description || '暂无描述'}
        </p>
        <div style={{ display: 'flex', gap: '12px' }}>
          {event.location_id && <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 500 }}>📍 {locMap.get(event.location_id)}</span>}
          {event.organization_id && <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 500 }}>🏛️ {orgMap.get(event.organization_id)}</span>}
        </div>
      </div>
    );
  };

  return (
    <div style={{ background: '#e5e7eb', minHeight: '100vh', padding: '40px 20px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        
        <header style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: '#111827' }}>06 世界时间线</h1>
          <select value={viewMode} onChange={e => setViewMode(e.target.value as any)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #9ca3af', background: '#fff', fontWeight: 600, color: '#111827', outline: 'none' }}>
            <option value="world">🌍 世界时间线</option>
            <option value="character">👤 人物时间线</option>
          </select>
        </header>

        {viewMode === 'world' && (
          <div style={{ position: 'relative' }}>
            {/* 贯穿的主轴线 */}
            <div style={{ position: 'absolute', left: '100px', top: 0, bottom: 0, width: '3px', background: '#9ca3af', zIndex: 0 }} />
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
              {sortedTimeKeys.map(timeKey => {
                const group = groupedByTime[timeKey];
                return (
                  <div key={timeKey} style={{ display: 'flex', position: 'relative' }}>
                    {/* 左侧时间 */}
                    <div style={{ width: '100px', flexShrink: 0, paddingRight: '20px', textAlign: 'right', paddingTop: '16px' }}>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>{group.displayTime}</div>
                    </div>
                    
                    {/* 中间圆点 */}
                    <div style={{ width: '3px', flexShrink: 0, background: 'transparent', position: 'relative', zIndex: 1 }}>
                       <div style={{ position: 'absolute', left: '-6px', top: '20px', width: '15px', height: '15px', borderRadius: '50%', background: '#3b82f6', border: '3px solid #e5e7eb' }} />
                    </div>

                    {/* 右侧卡片 */}
                    <div style={{ flex: 1, paddingLeft: '20px' }}>
                      {group.main.map(e => <div key={e.id}>{renderCard(e, true)}</div>)}
                      {group.sub.map(e => <div key={e.id}>{renderCard(e, false)}</div>)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {detailEvent && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }} onClick={() => setDetailEvent(null)}>
          <div style={{ width: '600px', background: '#ffffff', padding: '32px', borderRadius: '12px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: '24px', color: '#111827' }}>{detailEvent.name}</h2>
            <div style={{ marginBottom: '20px', fontSize: '15px', color: '#2563eb', fontWeight: 600 }}>⏳ {detailEvent.story_time}</div>
            <p style={{ margin: '0 0 24px 0', fontSize: '16px', color: '#374151', lineHeight: 1.8 }}>{detailEvent.description}</p>
            <button onClick={() => setDetailEvent(null)} style={{ width: '100%', padding: '12px', background: '#111827', color: '#ffffff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '15px' }}>关闭</button>
          </div>
        </div>
      )}
    </div>
  );
}