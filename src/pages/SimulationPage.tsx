import { useState, useEffect } from 'react';
import { API_ORIGIN } from '../api/config';

type Props = {
  onWriteChapter?: (eventId: string) => void
  auxiliary?: boolean
  worldId?: string
  embedded?: boolean
}

export default function SimulationPage({ onWriteChapter, auxiliary = false, worldId = '', embedded = false }: Props) {
  const [events, setEvents] = useState<any[]>([]);
  const [simulations, setSimulations] = useState<any[]>([]); // ✅ 记录已推演的数据
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  
  const [isSimulating, setIsSimulating] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [aiStatus, setAiStatus] = useState<any>(null);
  const [aiProbing, setAiProbing] = useState(false);
  
  // 作者方向 & 视角状态
  const [direction, setDirection] = useState<string>(() => localStorage.getItem('ws.sim.direction') || '');
  
  // 视角改为：模式 + 角色
  const [perspectiveMode, setPerspectiveMode] = useState<string>(() => localStorage.getItem('ws.sim.perspectiveMode') || 'third_limited');
  const [perspectiveChar, setPerspectiveChar] = useState<string>(() => localStorage.getItem('ws.sim.perspectiveChar') || '');
  const [characters, setCharacters] = useState<any[]>([]);

  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  useEffect(() => { localStorage.setItem('ws.sim.direction', direction); }, [direction]);
  useEffect(() => { localStorage.setItem('ws.sim.perspectiveMode', perspectiveMode); }, [perspectiveMode]);
  useEffect(() => { localStorage.setItem('ws.sim.perspectiveChar', perspectiveChar); }, [perspectiveChar]);

  // 根据模式和角色拼装最终要发送的视角字符串
  const buildPerspectiveString = () => {
    if (perspectiveMode === 'third_omniscient') return '第三人称全知（上帝视角）';
    if (perspectiveMode === 'ensemble') return '群像多视角（多角色切换）';
    const charName = perspectiveChar || '主导人物';
    if (perspectiveMode === 'first_person') return `第一人称（代入 ${charName}）`;
    return `第三人称限知（跟随 ${charName}）`;
  };

  useEffect(() => {
    // 拉取事件和推演记录
    Promise.all([
      fetch(`${API_ORIGIN}/api/events${worldId ? `?world_id=${worldId}` : ''}`).then(res => res.json()),
      fetch(`${API_ORIGIN}/api/simulations`).then(res => res.json())
    ]).then(([eventsData, simsData]) => {
      setEvents(eventsData);
      setSimulations(simsData);
    }).catch(err => console.error("加载数据失败", err));
    
    fetch(`${API_ORIGIN}/api/ai/status`)
      .then(res => res.json())
      .then(setAiStatus)
      .catch(() => setAiStatus(null));

    // 拉取人物列表用于视角选择
    if (worldId) {
      fetch(`${API_ORIGIN}/api/characters?world_id=${worldId}`)
        .then(res => res.json())
        .then(data => setCharacters(Array.isArray(data) ? data : []))
        .catch(console.error);
    }
  }, [worldId]);

  const probeAi = async () => {
    setAiProbing(true)
    try {
      const res = await fetch(`${API_ORIGIN}/api/ai/status?probe=true`)
      setAiStatus(await res.json())
    } catch {
      setAiStatus({ configured: false, probe_error: "无法连接后端" })
    } finally {
      setAiProbing(false)
    }
  }

  // 当选中事件时，拉取该事件的历史推演记录
  useEffect(() => {
    if (!selectedEvent) {
      setSimulationResult(null);
      return;
    }
    
    fetch(`${API_ORIGIN}/api/simulations/${selectedEvent.id}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) {
          setSimulationResult({
            changes: data[0].world_changes,
            characterActions: data[0].character_actions,
            direction: data[0].direction,
            perspective: data[0].perspective,
          });
        } else {
          setSimulationResult(null);
        }
      })
      .catch(err => console.error("获取历史推演失败", err));
  }, [selectedEvent]);

  // ✅ 自动连续推演逻辑
  const handleContinuousSimulate = async () => {
    setIsSimulating(true);
    const finalPerspective = buildPerspectiveString();
    setLogs([
      "⏳ 正在寻找未推演的事件...",
      `作者方向：${direction.trim() || '未预设（按人物引擎自然推演）'}`,
      `推演视角：${finalPerspective}`,
    ]);
    
    // 找出还没推演过的事件
    const unprocessed = events.filter(e => !simulations.some(s => s.event_id === e.id));
    
    if (unprocessed.length === 0) {
      setLogs(prev => [...prev, "✅ 所有事件均已推演完毕，无需继续。"]);
      setIsSimulating(false);
      return;
    }

    // 最多取 5 个进行连跑
    const toRun = unprocessed.slice(0, 5);
    setLogs(prev => [...prev, `🎯 找到 ${toRun.length} 个待推演事件，开始自动运转...`]);

    for (let i = 0; i < toRun.length; i++) {
      const ev = toRun[i];
      setSelectedEvent(ev);
      setLogs(prev => [...prev, `\n▶️ [${i+1}/${toRun.length}] 正在推演：${ev.name}...`]);
      setSimulationResult(null);

      try {
        const res = await fetch(`${API_ORIGIN}/api/simulate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event_id: ev.id, direction, perspective: finalPerspective })
        });

        if (res.ok) {
          const data = await res.json();
          setSimulationResult({
            changes: data.world_changes,
            characterActions: data.actions,
            direction,
            perspective: finalPerspective,
          });
          setLogs(prev => [...prev, `✅ [${ev.name}] 推演完成。`]);
        } else {
          const error = await res.json().catch(() => ({}));
          setLogs(prev => [...prev, `❌ [${ev.name}] 推演失败：${error.detail || `HTTP ${res.status}`}`]);
        }
      } catch (err) {
        setLogs(prev => [...prev, `❌ 网络错误。`]);
      }
      
      // 停顿 1.5 秒，让你看清结果
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    
    // 刷新全局数据
    fetch(`${API_ORIGIN}/api/simulations`).then(res => res.json()).then(data => setSimulations(data));
    setLogs(prev => [...prev, `\n🎉 连续推演结束！世界线已更新。`]);
    setIsSimulating(false);
  };

  // 单步推演
  const handleSimulate = async () => {
    if (!selectedEvent) return alert("请先在左侧选择一个事件");
    
    setIsSimulating(true);
    const finalPerspective = buildPerspectiveString();
    setLogs([
      `⏳ 正在推演：${selectedEvent.name}...`,
      `作者方向：${direction.trim() || '未预设（按人物引擎自然推演）'}`,
      `推演视角：${finalPerspective}`,
    ]);
    setSimulationResult(null);

    try {
      const res = await fetch(`${API_ORIGIN}/api/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: selectedEvent.id, direction, perspective: finalPerspective })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "推演失败");
      }

      const data = await res.json();
      setLogs(prev => [...prev, "🧠 AI 引擎计算完成，世界线已收束。"]);
      setSimulationResult({
        changes: data.world_changes,
        characterActions: data.actions,
        direction,
        perspective: finalPerspective,
      });
      
      // 刷新推演记录
      fetch(`${API_ORIGIN}/api/simulations`).then(res => res.json()).then(data => setSimulations(data));
      
    } catch (error: any) {
      setLogs(prev => [...prev, `❌ 错误：${error.message}`]);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className={`sim-page${embedded ? ' is-embedded' : ''}`}>
      
      {/* 1. 左侧：事件库 */}
      <div className={`sim-panel sim-left${leftOpen ? '' : ' is-hidden'}`}>
        <div style={{ padding: '16px', borderBottom: '1px solid var(--card-border)' }}>
          <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-main)' }}>{auxiliary ? '辅助推演 · 事件注入' : '事件注入台'}</h3>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>{auxiliary ? '文学创作以人物与叙事为主，这里只辅助检查事件可能走向' : '选择事件或开启自动推演'}</p>
          {auxiliary && <div style={{ marginTop: 9, padding: 7, borderRadius: 6, border: '1px dashed var(--card-border)', fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            辅助模式不会自动改写正文或故事线；推演结果需要你手动采纳。
          </div>}
          {aiStatus && (
            <div style={{ marginTop: '10px', padding: '7px 9px', borderRadius: '6px', border: '1px solid var(--card-border)', background: aiStatus.configured ? 'rgba(128,128,128,0.08)' : 'rgba(255,69,58,0.08)', fontSize: '10px', lineHeight: 1.6, color: 'var(--text-muted)' }}>
              {aiStatus.configured
                ? `${aiStatus.using_personal_key ? '使用我的 Key' : '使用站长共享 Key'} ${aiStatus.key_hint || ''} · ${aiStatus.model || ''}`
                : (aiStatus.message || '未配置 API Key，AI 推演不可用。')}
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => void probeAi()}
                  disabled={aiProbing}
                  style={{ padding: '3px 8px', borderRadius: '5px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer', fontSize: '10px' }}
                >
                  {aiProbing ? '测试中…' : '测试 AI 连接'}
                </button>
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent('open-ai-settings'))}
                  style={{ padding: '3px 8px', borderRadius: '5px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer', fontSize: '10px' }}
                >
                  {aiStatus.using_personal_key ? '更换我的 Key' : '填写我的 Key'}
                </button>
              </div>
              {aiStatus.probe_error && <div style={{ marginTop: '5px', color: 'var(--danger-color)' }}>{aiStatus.probe_error}</div>}
              {aiStatus.probe_ok && <div style={{ marginTop: '5px', color: '#10b981' }}>连接正常</div>}
            </div>
          )}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {events.map(ev => {
            const isDone = simulations.some(s => s.event_id === ev.id);
            return (
              <div 
                key={ev.id} 
                onClick={() => setSelectedEvent(ev)}
                style={{ 
                  padding: '12px', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s',
                  background: selectedEvent?.id === ev.id ? 'rgba(128,128,128,0.15)' : 'transparent',
                  border: `1px solid ${selectedEvent?.id === ev.id ? 'var(--primary-color)' : 'var(--card-border)'}`
                }}
              >
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)', display: 'flex', justifyContent: 'space-between' }}>
                  {ev.name}
                  {isDone && <span style={{ fontSize: '11px', color: '#10b981' }}>已推演</span>}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{ev.polarity} · {ev.intensity}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 2. 中间：推演控制 */}
      <div className="sim-console">
        <div className="sim-control-head">
          <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-main)' }}>推演引擎控制</h3>
          
          <div className="sim-run-actions">
            <span className="sim-run-label">面板</span>
            <button
              type="button"
              className={`sim-view-btn${leftOpen ? ' is-on' : ''}`}
              onClick={() => setLeftOpen((prev) => !prev)}
            >事件</button>
            <button
              type="button"
              className={`sim-view-btn${rightOpen ? ' is-on' : ''}`}
              onClick={() => setRightOpen((prev) => !prev)}
            >结果</button>
            <span className="sim-run-label">运行操作</span>
            <button
              type="button"
              className="sim-run-btn is-secondary"
              onClick={handleContinuousSimulate}
              disabled={isSimulating}
            >
              ⏩ 连续推演
            </button>
            <button
              type="button"
              className="sim-run-btn is-primary"
              onClick={handleSimulate}
              disabled={isSimulating || !selectedEvent}
            >
              {isSimulating ? '推演中...' : '▶ 单步推演'}
            </button>
          </div>
        </div>

        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--card-border)', background: 'rgba(128,128,128,0.05)', display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '12px' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '11px', color: 'var(--text-muted)' }}>
            作者预设推演方向
            <textarea
              value={direction}
              onChange={(event) => setDirection(event.target.value)}
              rows={2}
              placeholder="例如：这次冲突不要立刻爆发，让韩立先隐忍观察；留空则按人物引擎自然推演。"
              style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', border: '1px solid var(--card-border)', background: 'var(--ws-surface-bg)', color: 'var(--text-main)', fontSize: '12px', resize: 'vertical', lineHeight: 1.6 }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '11px', color: 'var(--text-muted)' }}>
            推演视角
            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                value={perspectiveMode}
                onChange={(event) => setPerspectiveMode(event.target.value)}
                style={{ flex: 1, padding: '8px 10px', borderRadius: '7px', border: '1px solid var(--card-border)', background: 'var(--ws-surface-bg)', color: 'var(--text-main)', fontSize: '12px', outline: 'none' }}
              >
                <option value="third_limited">第三人称限知（跟随角色）</option>
                <option value="first_person">第一人称（代入角色）</option>
                <option value="third_omniscient">第三人称全知（上帝视角）</option>
                <option value="ensemble">群像多视角</option>
              </select>
              
              {(perspectiveMode === 'third_limited' || perspectiveMode === 'first_person') && (
                <select
                  value={perspectiveChar}
                  onChange={(event) => setPerspectiveChar(event.target.value)}
                  style={{ flex: 1, padding: '8px 10px', borderRadius: '7px', border: '1px solid var(--card-border)', background: 'var(--ws-surface-bg)', color: 'var(--text-main)', fontSize: '12px', outline: 'none' }}
                >
                  <option value="">自动跟随主导人物</option>
                  {characters.map((c: any) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              )}
            </div>
            <span style={{ fontSize: '10px', lineHeight: 1.5 }}>视角决定重点观察谁，不改变世界客观变化。设置会自动记住。</span>
          </label>
        </div>

        <div style={{ flex: 1, padding: '24px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '13px', lineHeight: 1.8, color: 'var(--text-main)' }}>
          {!selectedEvent && !isSimulating && <div style={{ color: 'var(--text-muted)' }}>请在左侧选择事件，或直接点击连续推演。</div>}
          {selectedEvent && (
            <div style={{ marginBottom: '20px', padding: '16px', background: 'rgba(128,128,128,0.1)', borderRadius: '8px' }}>
              <strong>[当前输入事件]</strong> {selectedEvent.name}<br/>
              <span style={{ color: 'var(--text-muted)' }}>描述：{selectedEvent.description || '无'}</span>
            </div>
          )}
          {logs.map((log, i) => <div key={i}>{log}</div>)}
        </div>
      </div>

      {/* 3. 右侧：推演结果 */}
      <div className={`sim-panel sim-right${rightOpen ? '' : ' is-hidden'}`}>
        <div style={{ padding: '16px', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-main)' }}>推演结果观察</h3>
          <button
            onClick={() => {
              if (!selectedEvent) return
              if (direction.trim()) localStorage.setItem('ws.write.direction', direction)
              localStorage.setItem('ws.write.perspective', buildPerspectiveString())
              onWriteChapter?.(selectedEvent.id)
            }}
            disabled={!selectedEvent || !simulationResult}
            style={{
              padding: '6px 10px',
              borderRadius: '7px',
              border: '1px solid var(--primary-color)',
              background: 'transparent',
              color: 'var(--primary-color)',
              fontSize: '11px',
              fontWeight: 600,
              cursor: !selectedEvent || !simulationResult ? 'not-allowed' : 'pointer',
              opacity: !selectedEvent || !simulationResult ? 0.45 : 1,
            }}
          >
            写成章节 →
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {!simulationResult ? (
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '40px' }}>等待推演结果...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {(simulationResult.direction || simulationResult.perspective) && (
                <div style={{ padding: '10px 12px', borderRadius: '7px', border: '1px solid var(--card-border)', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.7 }}>
                  {simulationResult.direction ? <div>方向：{simulationResult.direction}</div> : null}
                  {simulationResult.perspective ? <div>视角：{simulationResult.perspective}</div> : null}
                </div>
              )}
              <div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: 'var(--primary-color)' }}>世界现实变化</h4>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-main)', background: 'rgba(128,128,128,0.1)', padding: '12px', borderRadius: '6px' }}>{simulationResult.changes}</p>
              </div>
              <div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: 'var(--primary-color)' }}>人物自主行动</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {simulationResult.characterActions.map((act: any, i: number) => (
                    <div key={i} style={{ border: '1px solid var(--card-border)', padding: '12px', borderRadius: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: '13px', color: 'var(--text-main)' }}>
                        <span>{act.name}</span>
                        <span style={{ color: 'var(--primary-color)', fontSize: '11px' }}>{act.engine}</span>
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-main)', marginTop: '8px' }}>{act.action}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>状态: {act.status}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}