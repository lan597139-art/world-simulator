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
    } catch (error) {
      console.error("加载时间线失败", error);
    }
  };

  useEffect(() => {
    loadData();
  }, [worldId]);

  const locMap = useMemo(() => new Map(locations.map(l => [l.id, l.name])), [locations]);
  const orgMap = useMemo(() => new Map(organizations.map(o => [o.id, o.name])), [organizations]);

  // ✅ 辅助函数：将数字转换为好看的文字（如 100000000 -> 1亿）
  const formatYearLabel = (val: number) => {
    if (val === 0) return '0 年';
    const abs = Math.abs(val);
    const sign = val < 0 ? '-' : '';
    if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(1).replace(/\.0$/, '')} 万亿年`;
    if (abs >= 1e11) return `${sign}${(abs / 1e11).toFixed(1).replace(/\.0$/, '')} 千亿年`;
    if (abs >= 1e10) return `${sign}${(abs / 1e10).toFixed(1).replace(/\.0$/, '')} 百亿年`;
    if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(1).replace(/\.0$/, '')} 十亿年`;
    if (abs >= 1e8) return `${sign}${(abs / 1e8).toFixed(1).replace(/\.0$/, '')} 亿年`;
    if (abs >= 1e7) return `${sign}${(abs / 1e7).toFixed(1).replace(/\.0$/, '')} 千万年`;
    if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1).replace(/\.0$/, '')} 百万年`;
    if (abs >= 1e5) return `${sign}${(abs / 1e5).toFixed(1).replace(/\.0$/, '')} 十万年`;
    if (abs >= 1e4) return `${sign}${(abs / 1e4).toFixed(1).replace(/\.0$/, '')} 万年`;
    return `${val} 年`;
  };

  // ✅ 史诗级时间解析引擎：兼容中文单位组合（千万年、万亿年等）
  const extractTimeParts = (timeStr: string) => {
    if (!timeStr) return { year: null, month: null, day: null, hour: null };
    const str = timeStr;
    
    // 年份提取：支持 负数、小数、中文组合单位
    let year: number | null = null;
    let isBC = str.includes('公元前') || str.includes('BC');
    
    // 优先匹配带单位的数字 (如: 1千万年, 3.5亿年, 1万亿年)
    const yMatch = str.match(/(-?\d+(?:\.\d+)?)\s*(万亿|千亿|百亿|十亿|亿|千万|百万|十万|万)?\s*年?/);
    if (yMatch) {
      let val = parseFloat(yMatch[1]);
      const unit = yMatch[2];
      if (unit) {
        const unitMap: Record<string, number> = {
          '万亿': 1e12, '千亿': 1e11, '百亿': 1e10, '十亿': 1e9, '亿': 1e8,
          '千万': 1e7, '百万': 1e6, '十万': 1e5, '万': 1e4
        };
        val *= unitMap[unit] || 1;
      }
      year = isBC ? -Math.abs(val) : val;
    } else {
      // 降级匹配纯数字
      const fallbackMatch = str.match(/(-?\d+)/);
      if (fallbackMatch) {
        year = parseFloat(fallbackMatch[1]);
        if (isBC) year = -Math.abs(year);
      }
    }

    const m = str.match(/(\d{1,2})\s*月/) || str.match(/[-/](\d{1,2})(?:[-/]|$)/);
    const d = str.match(/(\d{1,2})\s*[日号]/) || str.match(/[-/](\d{1,2})(?:\s|$)/);
    const h = str.match(/(\d{1,2})\s*[时点]/) || str.match(/(\d{1,2}):\d{2}/);

    return {
      year: year,
      month: m ? parseInt(m[1]) : null,
      day: d ? parseInt(d[1]) : null,
      hour: h ? parseInt(h[1] || h[0]) : null,
    };
  };

  // 动态提取数据中的年份
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    events.forEach(e => {
      const parts = extractTimeParts(e.story_time);
      if (parts.year !== null) years.add(parts.year);
    });
    return Array.from(years).sort((a, b) => a - b);
  }, [events]);

  // ✅ 常驻宏纪元锚点：覆盖从负无穷到千万年、万亿年
  const macroYears = [
    { val: -1e13, label: '-10 万亿年' },
    { val: -1e12, label: '-1 万亿年' },
    { val: -1e11, label: '-1000 亿年' },
    { val: -1e10, label: '-100 亿年' },
    { val: -1e9,  label: '-10 亿年' },
    { val: -1e8,  label: '-1 亿年' },
    { val: -1e7,  label: '-1000 万年' },
    { val: -1e6,  label: '-100 万年' },
    { val: -1e5,  label: '-10 万年' },
    { val: -1e4,  label: '-1 万年' },
    { val: 0,     label: '原点 (0年)' },
    { val: 1e4,   label: '1 万年' },
    { val: 1e5,   label: '10 万年' },
    { val: 1e6,   label: '100 万年' },
    { val: 1e7,   label: '1000 万年' },
    { val: 1e8,   label: '1 亿年' },
    { val: 1e9,   label: '10 亿年' },
    { val: 1e10,  label: '100 亿年' },
    { val: 1e11,  label: '1000 亿年' },
    { val: 1e12,  label: '1 万亿年' },
    { val: 1e13,  label: '10 万亿年' },
  ];

  // ================= 终极过滤引擎 =================
  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      const parts = extractTimeParts(e.story_time);

      if (parts.year !== null) {
        if (filterStartYear !== 'all' && parts.year < parseFloat(filterStartYear)) return false;
        if (filterEndYear !== 'all' && parts.year > parseFloat(filterEndYear)) return false;
      } else if (filterStartYear !== 'all' || filterEndYear !== 'all') {
        return false;
      }

      if (filterMonth !== 'all' && parts.month !== parseInt(filterMonth)) return false;
      if (filterDay !== 'all' && parts.day !== parseInt(filterDay)) return false;
      if (filterHour !== 'all' && parts.hour !== parseInt(filterHour)) return false;

      return true;
    });
  }, [events, filterStartYear, filterEndYear, filterMonth, filterDay, filterHour]);

  const { groupedByTime, sortedTimeKeys } = useMemo(() => {
    const grouped: Record<string, { main: any[], sub: any[], displayTime: string, sortKey: number }> = {};
    
    filteredEvents.forEach(e => {
      const parts = extractTimeParts(e.story_time);
      const timeKey = parts.year !== null ? String(parts.year) : (e.created_at || 'unknown');
      const displayTime = e.story_time || new Date(e.created_at || Date.now()).toLocaleString();
      
      if (!grouped[timeKey]) {
        grouped[timeKey] = { main: [], sub: [], displayTime, sortKey: parts.year !== null ? parts.year : Infinity };
      }
      if (e.storyline === '副线') grouped[timeKey].sub.push(e);
      else grouped[timeKey].main.push(e);
    });

    const sortedKeys = Object.keys(grouped).sort((a, b) => grouped[a].sortKey - grouped[b].sortKey);
    return { groupedByTime: grouped, sortedTimeKeys: sortedKeys };
  }, [filteredEvents]);

  const renderCard = (event: any, isMain: boolean) => {
    const isMacro = event.scale === '宏观';
    const isMicro = event.scale === '微观';
    
    let cardStyle: React.CSSProperties = {
      marginBottom: '16px', cursor: 'pointer', transition: 'all 0.2s',
      background: 'var(--bg-color)', position: 'relative'
    };

    if (isMacro) {
      cardStyle = { ...cardStyle, width: '100%', maxWidth: '480px', padding: '24px', border: '1px solid var(--primary-color)', borderLeft: '6px solid var(--primary-color)', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' };
    } else if (isMicro) {
      cardStyle = { ...cardStyle, width: '70%', maxWidth: '300px', padding: '10px 14px', borderLeft: '2px solid var(--card-border)', opacity: 0.85 };
    } else {
      cardStyle = { ...cardStyle, width: '90%', maxWidth: '380px', padding: '16px', borderLeft: isMain ? '3px solid var(--primary-color)' : '3px solid var(--text-muted)' };
    }

    return (
      <div className="glass-card" style={cardStyle} onClick={() => setDetailEvent(event)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <h3 style={{ margin: 0, fontSize: isMacro ? '18px' : (isMicro ? '14px' : '16px'), color: 'var(--text-main)' }}>{event.name}</h3>
          <span style={{ padding: '2px 8px', background: 'rgba(128,128,128,0.1)', borderRadius: '12px', fontSize: '11px', color: 'var(--text-main)' }}>
            {event.polarity} · {event.intensity}
          </span>
        </div>
        {event.domain && event.domain.length > 0 && (
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' }}>
            {event.domain.map((d: string) => (
              <span key={d} style={{ fontSize: '11px', border: '1px solid var(--card-border)', padding: '1px 6px', borderRadius: '4px', color: 'var(--text-muted)' }}>{d}</span>
            ))}
          </div>
        )}
        <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: 'var(--text-main)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: isMacro ? 3 : 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {event.description || '暂无详细描述'}
        </p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
          {event.location_id && (
            <span style={{ fontSize: '11px', color: 'var(--text-main)', background: 'rgba(128,128,128,0.1)', padding: '2px 8px', borderRadius: '4px' }}>
              📍 {locMap.get(event.location_id) || '未知地点'}
            </span>
          )}
          {event.organization_id && (
            <span style={{ fontSize: '11px', color: 'var(--text-main)', background: 'rgba(128,128,128,0.1)', padding: '2px 8px', borderRadius: '4px' }}>
              🏛️ {orgMap.get(event.organization_id) || '未知组织'}
            </span>
          )}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'right' }}>点击查看详情 ↗</div>
      </div>
    );
  };

  const renderCharacterTimeline = () => {
    if (!selectedCharId) return <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>请在上方选择一个人物，查看 Ta 的人生轨迹。</div>;
    const char = characters.find(c => c.id === selectedCharId);
    if (!char) return null;

    const charEvents = filteredEvents.filter(e => e.participants && e.participants.includes(selectedCharId));
    
    let historyEvents: any[] = [];
    if (char.life_history) {
      if (Array.isArray(char.life_history)) historyEvents = char.life_history;
      else if (char.life_history.events) historyEvents = char.life_history.events;
    }

    const filteredHistoryEvents = historyEvents.filter(h => {
      const parts = extractTimeParts(h.startTime);
      
      if (parts.year !== null) {
        if (filterStartYear !== 'all' && parts.year < parseFloat(filterStartYear)) return false;
        if (filterEndYear !== 'all' && parts.year > parseFloat(filterEndYear)) return false;
      } else if (filterStartYear !== 'all' || filterEndYear !== 'all') {
        return false;
      }

      if (filterMonth !== 'all' && parts.month !== parseInt(filterMonth)) return false;
      if (filterDay !== 'all' && parts.day !== parseInt(filterDay)) return false;
      if (filterHour !== 'all' && parts.hour !== parseInt(filterHour)) return false;
      return true;
    });

    const allEntries = [
      ...charEvents.map(e => ({ type: 'event', name: e.name, time: e.story_time, desc: e.description, data: e })),
      ...filteredHistoryEvents.map(h => ({ type: 'history', name: h.name || '生命经历', time: h.startTime, desc: h.facts, data: h }))
    ].sort((a, b) => {
      const partsA = extractTimeParts(a.time);
      const partsB = extractTimeParts(b.time);
      return (partsA.year ?? Infinity) - (partsB.year ?? Infinity);
    });

    if (allEntries.length === 0) {
      return <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>在该时间区间下，{char.name} 暂无相关记录。</div>;
    }

    return (
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h2 style={{ fontSize: '22px', color: 'var(--text-main)', margin: 0, fontWeight: 600 }}>👤 {char.name} 的人生轨迹</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '8px' }}>世界事件与个人经历的交织</p>
        </div>
        <div style={{ position: 'relative', paddingLeft: '30px' }}>
          <div style={{ position: 'absolute', left: '8px', top: '10px', bottom: '0', width: '2px', background: 'var(--card-border)' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {allEntries.map((item, idx) => (
              <div key={idx} style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: '-29px', top: '16px', width: '14px', height: '14px', borderRadius: '50%', background: item.type === 'event' ? 'var(--primary-color)' : 'var(--success-color)', border: '3px solid var(--bg-color)', zIndex: 1 }} />
                <div className="glass-card" style={{ padding: '16px', borderLeft: `3px solid ${item.type === 'event' ? 'var(--primary-color)' : 'var(--success-color)'}`, cursor: 'pointer' }} onClick={() => setDetailEvent(item.data)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)' }}>{item.type === 'event' ? '🌍 ' : '📖 '}{item.name}</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>⏳ {item.time || '未知时间'}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-main)', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.desc || '无详细描述'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', height: '100%', overflowY: 'auto' }}>
      
      <header style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ margin: '0 0 8px 0', fontSize: '24px', color: 'var(--text-main)' }}>06 世界时间线</h1>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-muted)' }}>世界演变与人物经历的编年史。</p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', background: 'var(--card-bg)', padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--card-border)', flexWrap: 'wrap' }}>
          <select value={viewMode} onChange={e => setViewMode(e.target.value as 'world' | 'character')} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)', fontWeight: 600, cursor: 'pointer' }}>
            <option value="world">🌍 世界时间线</option>
            <option value="character">👤 人物时间线</option>
          </select>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            
            {/* 起始时间 */}
            <select 
              value={filterStartYear} 
              onChange={e => setFilterStartYear(e.target.value)}
              style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)', fontWeight: 600, cursor: 'pointer', maxWidth: '130px' }}
            >
              <option value="all">起始时间</option>
              <optgroup label="宇宙/宏纪元">
                {macroYears.map(m => <option key={`macro-s-${m.val}`} value={m.val}>{m.label}</option>)}
              </optgroup>
              {availableYears.length > 0 && (
                <optgroup label="本世界已有时间">
                  {availableYears.map(y => (
                    <option key={`start-${y}`} value={y}>{formatYearLabel(y)}</option>
                  ))}
                </optgroup>
              )}
            </select>

            <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>至</span>

            {/* 结束时间 */}
            <select 
              value={filterEndYear} 
              onChange={e => setFilterEndYear(e.target.value)}
              style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)', fontWeight: 600, cursor: 'pointer', maxWidth: '130px' }}
            >
              <option value="all">结束时间</option>
              <optgroup label="宇宙/宏纪元">
                {macroYears.map(m => <option key={`macro-e-${m.val}`} value={m.val}>{m.label}</option>)}
              </optgroup>
              {availableYears.length > 0 && (
                <optgroup label="本世界已有时间">
                  {availableYears.map(y => (
                    <option key={`end-${y}`} value={y}>{formatYearLabel(y)}</option>
                  ))}
                </optgroup>
              )}
            </select>

            <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)', fontWeight: 600, cursor: 'pointer' }}>
              <option value="all">🗓️ 全部月份</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{m} 月</option>
              ))}
            </select>

            <select value={filterDay} onChange={e => setFilterDay(e.target.value)} style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)', fontWeight: 600, cursor: 'pointer' }}>
              <option value="all">⏱️ 全部日期</option>
              {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                <option key={d} value={d}>{d} 日</option>
              ))}
            </select>

            <select value={filterHour} onChange={e => setFilterHour(e.target.value)} style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)', fontWeight: 600, cursor: 'pointer' }}>
              <option value="all">🕒 全部小时</option>
              {Array.from({ length: 24 }, (_, i) => i).map(h => (
                <option key={h} value={h}>{h} 时</option>
              ))}
            </select>
          </div>

          {viewMode === 'character' && (
            <select value={selectedCharId} onChange={e => setSelectedCharId(e.target.value)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--primary-color)', background: 'transparent', color: 'var(--primary-color)', fontWeight: 600, cursor: 'pointer' }}>
              <option value="">选择人物...</option>
              {characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
        </div>
      </header>

      {events.length === 0 ? (
        <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>世界一片空白，去 05 事件管理发布第一个事件吧。</div>
      ) : (
        viewMode === 'world' ? (
          filteredEvents.length === 0 ? (
            <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>该时间区间下暂无事件记录，请切换其他维度。</div>
          ) : (
          <div style={{ position: 'relative', maxWidth: '900px', margin: '0 auto' }}>
            <div style={{ position: 'absolute', left: '50%', top: '20px', bottom: '0', width: '2px', background: 'var(--card-border)', transform: 'translateX(-50%)' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
              {sortedTimeKeys.map(timeKey => {
                const group = groupedByTime[timeKey];
                return (
                  <div key={timeKey} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 1fr', position: 'relative' }}>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', paddingRight: '16px' }}>
                      {group.main.length > 0 && <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--primary-color)', marginBottom: '12px' }}>主线</div>}
                      {group.main.map(e => <div key={e.id}>{renderCard(e, true)}</div>)}
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '4px' }}>
                      <div style={{ padding: '4px 12px', background: 'var(--bg-color)', border: '1px solid var(--card-border)', borderRadius: '20px', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', zIndex: 2, whiteSpace: 'nowrap' }}>⏳ {group.displayTime}</div>
                      <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: 'var(--text-main)', marginTop: '12px', zIndex: 2 }} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', paddingLeft: '16px' }}>
                      {group.sub.length > 0 && <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--primary-color)', marginBottom: '12px' }}>副线</div>}
                      {group.sub.map(e => <div key={e.id}>{renderCard(e, false)}</div>)}
                    </div>

                  </div>
                );
              })}
            </div>
          </div>
          )
        ) : renderCharacterTimeline()
      )}

      {detailEvent && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }} onClick={() => setDetailEvent(null)}>
          <div className="glass-card" style={{ width: '600px', maxHeight: '80vh', overflowY: 'auto', padding: '32px', background: 'var(--bg-color)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <span style={{ padding: '4px 12px', background: 'rgba(128,128,128,0.1)', borderRadius: '20px', fontSize: '12px', color: 'var(--text-main)' }}>
                    {detailEvent.scale === '宏观' ? '🌍 宏观事件' : detailEvent.scale === '微观' ? '🍵 微观事件' : '⚔️ 中观事件'}
                  </span>
                  <span style={{ padding: '4px 12px', background: 'rgba(128,128,128,0.1)', borderRadius: '20px', fontSize: '12px', color: 'var(--text-main)' }}>
                    {detailEvent.polarity} · {detailEvent.intensity}
                  </span>
                </div>
                <h2 style={{ margin: 0, fontSize: '24px', color: 'var(--text-main)' }}>{detailEvent.name}</h2>
                <div style={{ marginTop: '8px', fontSize: '14px', color: 'var(--primary-color)', fontWeight: 600 }}>⏳ {detailEvent.story_time || new Date(detailEvent.created_at || '').toLocaleString()}</div>
              </div>
              <button onClick={() => setDetailEvent(null)} style={{ background: 'transparent', border: 'none', fontSize: '24px', cursor: 'pointer', color: 'var(--text-muted)' }}>×</button>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ margin: '0 0 8px 0', color: 'var(--text-main)', fontSize: '14px' }}>客观事实描述</h4>
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-main)', lineHeight: 1.8, background: 'rgba(128,128,128,0.05)', padding: '16px', borderRadius: '8px' }}>
                {detailEvent.description || detailEvent.facts || '暂无描述'}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              {detailEvent.location_id && (
                <div style={{ fontSize: '13px', color: 'var(--text-main)', background: 'rgba(128,128,128,0.1)', padding: '8px 16px', borderRadius: '8px' }}>
                  📍 发生地点：{locMap.get(detailEvent.location_id) || '未知'}
                </div>
              )}
              {detailEvent.organization_id && (
                <div style={{ fontSize: '13px', color: 'var(--text-main)', background: 'rgba(128,128,128,0.1)', padding: '8px 16px', borderRadius: '8px' }}>
                  🏛️ 涉及组织：{orgMap.get(detailEvent.organization_id) || '未知'}
                </div>
              )}
            </div>

            {detailEvent.participants && detailEvent.participants.length > 0 && (
              <div style={{ marginTop: '24px', borderTop: '1px dashed var(--card-border)', paddingTop: '16px' }}>
                <h4 style={{ margin: '0 0 12px 0', color: 'var(--text-main)', fontSize: '14px' }}>涉及人物</h4>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {detailEvent.participants.map((id: string) => {
                    const c = characters.find((char: any) => char.id === id);
                    if (!c) return null;
                    return (
                      <span key={id} style={{ padding: '4px 12px', background: 'rgba(128,128,128,0.1)', border: '1px solid var(--card-border)', borderRadius: '20px', fontSize: '13px', color: 'var(--text-main)' }}>
                        {c.name}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {(() => {
              const causes = events.filter(e => detailEvent.caused_by?.includes(e.id));
              const effects = events.filter(e => e.caused_by?.includes(detailEvent.id));
              
              if (causes.length === 0 && effects.length === 0) return null;

              return (
                <div style={{ marginTop: '24px', borderTop: '1px dashed var(--card-border)', paddingTop: '16px' }}>
                  <h4 style={{ margin: '0 0 12px 0', color: 'var(--primary-color)', fontSize: '14px' }}>🔗 事件因果链条</h4>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(128,128,128,0.03)', padding: '16px', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
                    
                    {causes.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', width: '60px', flexShrink: 0 }}>前置原因：</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {causes.map(c => (
                            <span 
                              key={c.id} 
                              onClick={(e) => { e.stopPropagation(); setDetailEvent(c); }}
                              style={{ fontSize: '12px', color: 'var(--text-main)', background: 'rgba(128,128,128,0.1)', padding: '2px 10px', borderRadius: '12px', cursor: 'pointer', border: '1px solid transparent', transition: 'all 0.2s' }}
                              onMouseOver={(e) => e.currentTarget.style.border = '1px solid var(--primary-color)'}
                              onMouseOut={(e) => e.currentTarget.style.border = '1px solid transparent'}
                            >
                              ⬅️ {c.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', width: '60px', flexShrink: 0 }}>当前事件：</span>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--primary-color)' }}>{detailEvent.name}</span>
                    </div>

                    {effects.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', width: '60px', flexShrink: 0 }}>后续影响：</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {effects.map(e => (
                            <span 
                              key={e.id} 
                              onClick={(evt) => { evt.stopPropagation(); setDetailEvent(e); }}
                              style={{ fontSize: '12px', color: 'var(--text-main)', background: 'rgba(128,128,128,0.1)', padding: '2px 10px', borderRadius: '12px', cursor: 'pointer', border: '1px solid transparent', transition: 'all 0.2s' }}
                              onMouseOver={(evt) => evt.currentTarget.style.border = '1px solid var(--primary-color)'}
                              onMouseOut={(evt) => evt.currentTarget.style.border = '1px solid transparent'}
                            >
                              {e.name} ➡️
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              );
            })()}

            <div style={{ display: 'flex', gap: '12px', marginTop: '32px', paddingTop: '16px', borderTop: '1px dashed var(--card-border)' }}>
              <button 
                onClick={() => { setDetailEvent(null); if (onNavigate) onNavigate('events'); }}
                style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid var(--primary-color)', color: 'var(--primary-color)', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
              >
                📅 前往 05 事件管理
              </button>
              
              <button 
                onClick={() => { setDetailEvent(null); if (onNavigate) onNavigate('character-management'); }}
                style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid var(--success-color)', color: 'var(--success-color)', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
              >
                👤 前往 03 查看人物
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}