import { useState, useEffect } from 'react';
import { API_ORIGIN } from '../api/config';
import { createBranch, listBranches, listDirections, simulateBranch } from '../api/multipath';
import type { Branch, Direction } from '../api/multipath';

type Props = {
  onWriteChapter?: (eventId: string) => void
  auxiliary?: boolean
  worldId?: string
}

export default function SimulationPage({ onWriteChapter, auxiliary = false, worldId = '' }: Props) {
  const [events, setEvents] = useState<any[]>([]);
  const [simulations, setSimulations] = useState<any[]>([]); // ✅ 记录已推演的数据
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  
  const [isSimulating, setIsSimulating] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [aiStatus, setAiStatus] = useState<any>(null);
  const [aiProbing, setAiProbing] = useState(false);
  const [direction, setDirection] = useState<string>(() => localStorage.getItem('ws.sim.direction') || '');
  const [perspective, setPerspective] = useState<string>(() => localStorage.getItem('ws.sim.perspective') || '第三人称限知 · 跟随主导人物');

  // 可选多路径：默认关闭，关闭时流程与原来完全一致。
  const [multiPathEnabled, setMultiPathEnabled] = useState(false);
  const [mpDirections, setMpDirections] = useState<Direction[]>([]);
  const [mpBranches, setMpBranches] = useState<Branch[]>([]);
  const [mpBusy, setMpBusy] = useState(false);
  const [mpNote, setMpNote] = useState('');

  useEffect(() => { localStorage.setItem('ws.sim.direction', direction); }, [direction]);
  useEffect(() => { localStorage.setItem('ws.sim.perspective', perspective); }, [perspective]);

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
    setLogs([
      "⏳ 正在寻找未推演的事件...",
      `作者方向：${direction.trim() || '未预设（按人物引擎自然推演）'}`,
      `推演视角：${perspective.trim() || '全局客观视角'}`,
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
          body: JSON.stringify({ event_id: ev.id, direction, perspective })
        });

        if (res.ok) {
          const data = await res.json();
          setSimulationResult({
            changes: data.world_changes,
            characterActions: data.actions,
            direction,
            perspective,
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
    setLogs([
      `⏳ 正在推演：${selectedEvent.name}...`,
      `作者方向：${direction.trim() || '未预设（按人物引擎自然推演）'}`,
      `推演视角：${perspective.trim() || '全局客观视角'}`,
    ]);
    setSimulationResult(null);

    try {
      const res = await fetch(`${API_ORIGIN}/api/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: selectedEvent.id, direction, perspective })
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
        perspective,
      });
      
      // 刷新推演记录
      fetch(`${API_ORIGIN}/api/simulations`).then(res => res.json()).then(data => setSimulations(data));
      
    } catch (error: any) {
      setLogs(prev => [...prev, `❌ 错误：${error.message}`]);
    } finally {
      setIsSimulating(false);
    }
  };

  useEffect(() => {
    if (!multiPathEnabled || !selectedEvent) {
      setMpDirections([]);
      setMpBranches([]);
      return;
    }
    let alive = true;
    Promise.all([
      listDirections(selectedEvent.id).catch(() => [] as Direction[]),
      (selectedEvent.world_id ? listBranches(selectedEvent.world_id) : Promise.resolve([] as Branch[])),
    ]).then(([dirs, branches]) => {
      if (!alive) return;
      setMpDirections(dirs as Direction[]);
      setMpBranches((branches as Branch[]).filter((b) => b.root_event_id === selectedEvent.id && b.status !== 'archived'));
    });
    return () => { alive = false; };
  }, [multiPathEnabled, selectedEvent]);

  const handleCreateBranch = async (dir?: Direction) => {
    if (!selectedEvent) return;
    setMpBusy(true);
    try {
      const fallback = dir ? `方向：${dir.name}` : `分支：${selectedEvent.name}`;
      const name = (mpNote.trim() || fallback).slice(0, 40);
      const branch = await createBranch({
        root_event_id: selectedEvent.id,
        source_direction_id: dir?.id,
        name,
      });
      setMpBranches((prev) => [branch, ...prev]);
      setMpNote('');
      setLogs((prev) => [...prev, `⑂ 已创建分支「${branch.name}」（沙盒，不影响主时间线）`]);
    } catch (error: any) {
      setLogs((prev) => [...prev, `❌ 创建分支失败：${error.message || error}`]);
    } finally {
      setMpBusy(false);
    }
  };

  const handleSimulateBranch = async (branch: Branch) => {
    if (!selectedEvent) return;
    setMpBusy(true);
    try {
      const result = await simulateBranch(branch.id, { event_id: selectedEvent.id, perspective });
      setMpBranches((prev) => prev.map((b) => (b.id === branch.id ? { ...b, node_count: (b.node_count || 0) + 1 } : b)));
      setLogs((prev) => [...prev, `⑂ 分支「${branch.name}」推演完成：${result.state_hint || '已写入分支快照'}`]);
    } catch (error: any) {
      setLogs((prev) => [...prev, `❌ 分支推演失败：${error.message || error}`]);
    } finally {
      setMpBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)', gap: '16px', padding: '1rem', boxSizing: 'border-box' }}>
      
      {/* 1. 左侧：事件库 */}
      <div className="glass-card" style={{ width: '300px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
      <div className="glass-card" style={{ flex: 1, minWidth: '400px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-main)' }}>推演引擎控制</h3>
          
          <div style={{ display: 'flex', gap: '12px' }}>
            {/* ✅ 新增：连续推演按钮 */}
            <button 
              onClick={handleContinuousSimulate}
              disabled={isSimulating}
              style={{ 
                padding: '8px 20px', background: 'transparent', border: '1px solid var(--primary-color)', color: 'var(--primary-color)', 
                borderRadius: '6px', cursor: isSimulating ? 'not-allowed' : 'pointer', fontWeight: 600
              }}
            >
              ⏩ 自动连续推演
            </button>
            <button 
              onClick={handleSimulate}
              disabled={isSimulating || !selectedEvent}
              style={{ 
                padding: '8px 24px', background: isSimulating ? 'var(--card-border)' : 'var(--primary-color)', 
                color: isSimulating ? 'var(--text-muted)' : 'var(--primary-text)', 
                border: 'none', borderRadius: '6px', cursor: isSimulating ? 'not-allowed' : 'pointer', fontWeight: 600
              }}
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
              style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-main)', fontSize: '12px', resize: 'vertical', lineHeight: 1.6 }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '11px', color: 'var(--text-muted)' }}>
            推演视角
            <input
              value={perspective}
              onChange={(event) => setPerspective(event.target.value)}
              placeholder="例如：第三人称限知 · 跟随韩立"
              style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-main)', fontSize: '12px' }}
            />
            <span style={{ fontSize: '10px', lineHeight: 1.5 }}>视角决定重点观察谁，不改变世界客观变化。设置会自动记住。</span>
          </label>
        </div>

        <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--card-border)', background: 'rgba(128,128,128,0.03)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-main)', fontWeight: 600, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={multiPathEnabled}
              onChange={(event) => setMultiPathEnabled(event.target.checked)}
            />
            启用多路径（可选）
            <span style={{ fontSize: '10px', fontWeight: 400, color: 'var(--text-muted)' }}>
              关闭时保持原有单线推演；开启后可从同一事件分出不同走向，结果存入沙盒。
            </span>
          </label>
          {multiPathEnabled && (
            <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
              {!selectedEvent && (
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>先在左侧选择一个事件，再建分支。</div>
              )}
              {selectedEvent && (
                <>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      value={mpNote}
                      onChange={(event) => setMpNote(event.target.value)}
                      placeholder="分支名称（可选，留空自动命名）"
                      style={{ flex: 1, padding: '5px 8px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-main)', fontSize: '11px' }}
                    />
                    <button
                      type="button"
                      onClick={() => void handleCreateBranch()}
                      disabled={mpBusy}
                      style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid var(--primary-color)', background: 'transparent', color: 'var(--primary-color)', fontSize: '10px', cursor: mpBusy ? 'not-allowed' : 'pointer' }}
                    >
                      从此事件建分支
                    </button>
                  </div>
                  {mpDirections.length > 0 && (
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center', fontSize: '10px', color: 'var(--text-muted)' }}>
                      按方向建分支：
                      {mpDirections.slice(0, 4).map((dir) => (
                        <button
                          key={dir.id}
                          type="button"
                          onClick={() => void handleCreateBranch(dir)}
                          disabled={mpBusy}
                          style={{ padding: '3px 7px', borderRadius: '999px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)', fontSize: '10px', cursor: mpBusy ? 'not-allowed' : 'pointer' }}
                        >
                          {dir.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {mpBranches.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {mpBranches.slice(0, 4).map((branch) => (
                        <div key={branch.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: 'var(--text-muted)' }}>
                          <span style={{ color: 'var(--text-main)' }}>⑂ {branch.name}</span>
                          <span>{branch.node_count} 个节点</span>
                          <button
                            type="button"
                            onClick={() => void handleSimulateBranch(branch)}
                            disabled={mpBusy}
                            style={{ padding: '2px 6px', borderRadius: '5px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)', fontSize: '10px', cursor: mpBusy ? 'not-allowed' : 'pointer' }}
                          >
                            在分支中推演
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
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
      <div className="glass-card" style={{ width: '350px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-main)' }}>推演结果观察</h3>
          <button
            onClick={() => {
              if (!selectedEvent) return
              if (direction.trim()) localStorage.setItem('ws.write.direction', direction)
              if (perspective.trim()) localStorage.setItem('ws.write.perspective', perspective)
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