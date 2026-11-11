import { useEffect, useMemo, useRef, useState } from 'react'
import { API_ORIGIN } from '../api/config'
import * as api from '../api/chat'
import { createDiary } from '../api/diary'
import type { AiRole, ChatMemory, ChatMessage, ChatThread } from '../api/chat'

const card: React.CSSProperties = {
  background: 'var(--card-bg)',
  border: '1px solid var(--card-border)',
  borderRadius: '12px',
  padding: '12px',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  minHeight: 0,
}
const input: React.CSSProperties = {
  padding: '7px 9px',
  borderRadius: '7px',
  border: '1px solid var(--card-border)',
  background: 'var(--card-bg)',
  color: 'var(--text-main)',
  fontSize: '12px',
  minWidth: 0,
}
const btn: React.CSSProperties = {
  padding: '6px 11px',
  borderRadius: '7px',
  border: '1px solid var(--primary-color)',
  background: 'transparent',
  color: 'var(--primary-color)',
  fontSize: '11px',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}
const hint: React.CSSProperties = { fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.6 }

export default function ChatPage({ worldId }: { worldId?: string }) {
  const [threads, setThreads] = useState<ChatThread[]>([])
  const [characters, setCharacters] = useState<any[]>([])
  const [threadId, setThreadId] = useState('')
  const [thread, setThread] = useState<ChatThread | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [memories, setMemories] = useState<ChatMemory[]>([])
  const [role, setRole] = useState<AiRole | null>(null)
  const [selectedChar, setSelectedChar] = useState('')
  const [groupIds, setGroupIds] = useState<string[]>([])
  const [showConvert, setShowConvert] = useState(false)
  const [eventTitle, setEventTitle] = useState('')
  const [writeExperience, setWriteExperience] = useState(false)
  const [convertCount, setConvertCount] = useState(10)
  const [impact, setImpact] = useState<any | null>(null)
  const [impactBusy, setImpactBusy] = useState(false)
  const [identityName, setIdentityName] = useState('')
  const [selfCharacters, setSelfCharacters] = useState<any[]>([])
  const [selfCharacterId, setSelfCharacterId] = useState('')
  const [identityRole, setIdentityRole] = useState('')
  const [oocAllowed, setOocAllowed] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [log, setLog] = useState('')
  const [tone, setTone] = useState('')
  const [stance, setStance] = useState('')
  const [displayName, setDisplayName] = useState('')
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const characterName = useMemo(() => {
    const map = new Map(characters.map((char) => [char.id, char.name]))
    return (id?: string | null) => (id ? map.get(id) || '角色' : '')
  }, [characters])

  const loadThreads = () => worldId && api.listThreads(worldId).then(setThreads).catch((error) => setLog(String(error.message || error)))

  useEffect(() => {
    if (!worldId) return
    loadThreads()
    fetch(`${API_ORIGIN}/api/characters?world_id=${worldId}`)
      .then((res) => res.json())
      .then((rows) => {
        const list = Array.isArray(rows) ? rows : rows.items || []
        setCharacters(list)
        const preferred = sessionStorage.getItem('ws.chatCharacterId')
        sessionStorage.removeItem('ws.chatCharacterId')
        setSelectedChar((prev) => {
          if (preferred && list.some((c: any) => c.id === preferred)) return preferred
          return prev && list.some((c: any) => c.id === prev) ? prev : list[0]?.id || ''
        })
      })
      .catch((error) => setLog(String(error.message || error)))
    fetch(`http://127.0.0.1:8000/api/characters?world_id=${worldId}`)
      .then((res) => res.json())
      .then((rows) => setSelfCharacters((Array.isArray(rows) ? rows : []).filter((c: any) => c.persona_type === 'self')))
      .catch(() => setSelfCharacters([]))
  }, [worldId])

  useEffect(() => {
    if (!threadId) {
      setThread(null); setMessages([]); setMemories([]); setRole(null)
      return
    }
    Promise.all([api.getThread(threadId), api.listMemories(threadId)])
      .then(([data, memRows]) => {
        setThread(data)
        setMessages(data.messages || [])
        setMemories(memRows)
        const identity = (data.settings || {}).user_identity || {}
        setIdentityName(identity.name || '')
        setIdentityRole(identity.role || '')
        setSelfCharacterId((data.settings || {}).user_character_id || '')
        setOocAllowed(Boolean((data.settings || {}).ooc_allowed))
        const first = data.participants[0]
        if (first && data.kind === 'private') {
          api.getAiRole(first.character_id).then((item) => {
            setRole(item)
            setDisplayName(item.display_name || item.preview?.identity?.name || first.character_name)
            setTone(item.persona?.voice?.tone || item.preview?.voice?.tone || '')
            setStance(item.persona?.relation_to_user?.stance || item.preview?.relation_to_user?.stance || '')
          }).catch(() => undefined)
        }
      })
      .catch((error) => setLog(String(error.message || error)))
  }, [threadId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length])

  const createPrivate = async () => {
    if (!worldId || !selectedChar) return
    setBusy(true)
    try {
      const created = await api.createThread({ world_id: worldId, kind: 'private', character_id: selectedChar })
      await loadThreads()
      setThreadId(created.id)
      setLog('会话已创建')
    } catch (error: any) {
      setLog(`❌ ${error.message || error}`)
    } finally {
      setBusy(false)
    }
  }

  const createGroup = async () => {
    if (!worldId || groupIds.length < 2) { setLog('❌ 群聊至少选两个人物'); return }
    setBusy(true)
    try {
      const created = await api.createThread({ world_id: worldId, kind: 'group', character_ids: groupIds })
      await loadThreads()
      setThreadId(created.id)
      setGroupIds([])
      setLog('群聊已创建')
    } catch (error: any) {
      setLog(`❌ ${error.message || error}`)
    } finally {
      setBusy(false)
    }
  }

  const send = async () => {
    if (!threadId || !draft.trim() || busy) return
    setBusy(true)
    const content = draft.trim()
    try {
      if (thread?.kind === 'group') {
        const result = await api.groupTurn(threadId, content)
        setMessages((prev) => [...prev, result.user_message, ...result.replies])
      } else {
        const result = await api.sendMessage(threadId, content)
        setMessages((prev) => [...prev, result.user_message, result.reply])
      }
      setDraft('')
      loadThreads()
      api.listMemories(threadId).then(setMemories).catch(() => undefined)
    } catch (error: any) {
      setLog(`❌ ${error.message || error}`)
    } finally {
      setBusy(false)
    }
  }

  const generateRole = async () => {
    if (!role) return
    setBusy(true)
    try {
      const built = await api.buildAiRole(role.character_id)
      setRole(built)
      setDisplayName(built.display_name)
      setTone(built.persona?.voice?.tone || '')
      setStance(built.persona?.relation_to_user?.stance || '')
      setLog('角色配置已生成')
    } catch (error: any) {
      setLog(`❌ ${error.message || error}`)
    } finally {
      setBusy(false)
    }
  }

  const saveRole = async () => {
    if (!role) return
    setBusy(true)
    try {
      const persona = {
        ...(role.persona || role.preview || {}),
        voice: { ...((role.persona || role.preview || {}).voice || {}), tone },
        relation_to_user: { ...((role.persona || role.preview || {}).relation_to_user || {}), stance },
      }
      const saved = await api.saveAiRole(role.character_id, { display_name: displayName, persona, enabled: true })
      setRole(saved)
      setLog('角色配置已保存')
    } catch (error: any) {
      setLog(`❌ ${error.message || error}`)
    } finally {
      setBusy(false)
    }
  }

  const toggleEnabled = async () => {
    if (!role) return
    try {
      const saved = await api.saveAiRole(role.character_id, { enabled: !role.enabled })
      setRole(saved)
      setLog(saved.enabled ? '已开启角色聊天' : '已关闭角色聊天')
    } catch (error: any) {
      setLog(`❌ ${error.message || error}`)
    }
  }

  const convert = async () => {
    if (!thread || !messages.length) { setLog('❌ 先进行一段对话'); return }
    setBusy(true)
    try {
      const result = await api.chatToEvent(thread.id, { title: eventTitle || undefined, message_count: convertCount })
      let message = `事件已创建：${result.event.name}`
      if (writeExperience && thread.participants[0]) {
        await api.chatToExperience(thread.id, { character_id: thread.participants[0].character_id, title: eventTitle || undefined })
        message += '；已写入人物经历'
      }
      setLog(message)
      setShowConvert(false)
    } catch (error: any) {
      setLog(`❌ ${error.message || error}`)
    } finally {
      setBusy(false)
    }
  }

  const saveChatDiary = async () => {
    if (!thread || messages.length === 0) return
    setBusy(true)
    try {
      const excerpt = messages.slice(-6).map((message) => {
        const who = message.sender_type === 'user' ? '我' : (characterName(message.character_id) || '角色')
        return `${who}：${message.content}`
      }).join('\n')
      await createDiary({
        content: excerpt,
        title: `与${thread.title.replace(/^与|的对话$/g, '')}的对话摘录`,
        source_type: 'chat',
        source_ref: { thread_id: thread.id },
        world_id: thread.world_id,
        entry_date: new Date().toISOString().slice(0, 10),
      })
      setLog('最近对话已存为日记（来源：聊天摘录）')
    } catch (error: any) {
      setLog(`❌ ${error.message || error}`)
    } finally {
      setBusy(false)
    }
  }

  const saveIdentity = async () => {
    if (!thread) return
    setBusy(true)
    try {
      const saved = await api.updateThread(thread.id, {
        settings: { user_identity: { name: identityName, role: identityRole }, user_character_id: selfCharacterId, ooc_allowed: oocAllowed },
      })
      setThread(saved)
      setLog('我的身份已保存')
    } catch (error: any) {
      setLog(`❌ ${error.message || error}`)
    } finally {
      setBusy(false)
    }
  }

  const summarizeNow = async () => {
    if (!thread) return
    setBusy(true)
    try {
      const memory = await api.summarizeMemories(thread.id, thread.participants[0]?.character_id)
      setMemories((prev) => [memory, ...prev])
      setLog('已生成 AI 摘要记忆')
    } catch (error: any) {
      setLog(`❌ ${error.message || error}`)
    } finally {
      setBusy(false)
    }
  }

  const previewImpactNow = async () => {
    if (!thread) return
    setImpactBusy(true)
    try {
      const proposal = await api.previewImpact(thread.id)
      setImpact(proposal)
      setLog('影响建议已生成，确认后才会应用')
    } catch (error: any) {
      setLog(`❌ ${error.message || error}`)
    } finally {
      setImpactBusy(false)
    }
  }

  const applyImpactNow = async () => {
    if (!impact) return
    setImpactBusy(true)
    try {
      const result = await api.applyImpact(impact.id)
      setImpact(result.impact)
      setLog(`影响已应用：关系 ${result.relationship_ids.length} 条`)
    } catch (error: any) {
      setLog(`❌ ${error.message || error}`)
    } finally {
      setImpactBusy(false)
    }
  }

  const dismissImpactNow = async () => {
    if (!impact) return
    try {
      await api.dismissImpact(impact.id)
      setImpact(null)
      setLog('影响建议已忽略')
    } catch (error: any) {
      setLog(`❌ ${error.message || error}`)
    }
  }

  const removeMemory = async (id: string) => {
    try {
      await api.deleteMemory(id)
      setMemories((prev) => prev.filter((item) => item.id !== id))
    } catch (error: any) {
      setLog(`❌ ${error.message || error}`)
    }
  }

  if (!worldId) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>请先进入一个世界。</div>

  return (
    <div style={{ padding: '1rem', display: 'flex', gap: '12px', height: 'calc(100vh - 60px)', boxSizing: 'border-box' }}>
      <div style={{ ...card, width: '250px' }}>
        <h3 style={{ margin: 0, fontSize: '14px' }}>AI 角色聊天</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <select value={selectedChar} onChange={(e) => setSelectedChar(e.target.value)} style={input}>
            {characters.map((char) => <option key={char.id} value={char.id}>{char.name}</option>)}
          </select>
          <button style={btn} disabled={busy} onClick={() => void createPrivate()}>+ 与选中人物私聊</button>
          <details>
            <summary style={{ ...hint, cursor: 'pointer' }}>新建群聊（选 2–6 人）</summary>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', margin: '6px 0' }}>
              {characters.map((char) => (
                <label key={char.id} style={{ ...hint, display: 'flex', alignItems: 'center', gap: '3px', border: '1px solid var(--card-border)', borderRadius: '999px', padding: '2px 7px' }}>
                  <input
                    type="checkbox"
                    checked={groupIds.includes(char.id)}
                    onChange={(e) => setGroupIds((prev) => e.target.checked ? [...prev, char.id] : prev.filter((id) => id !== char.id))}
                  />
                  {char.name}
                </label>
              ))}
            </div>
            <button style={btn} disabled={busy || groupIds.length < 2} onClick={() => void createGroup()}>+ 创建群聊</button>
          </details>
        </div>
        <div style={{ ...hint }}>角色回复由其档案中的引擎、印记、经历与关系生成，不会替你做决定。</div>
        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {threads.map((item) => (
            <button
              key={item.id}
              onClick={() => setThreadId(item.id)}
              style={{
                textAlign: 'left', padding: '8px', borderRadius: '8px', cursor: 'pointer',
                border: `1px solid ${item.id === threadId ? 'var(--primary-color)' : 'var(--card-border)'}`,
                background: item.id === threadId ? 'rgba(128,128,128,0.12)' : 'transparent',
                color: 'var(--text-main)', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '3px',
              }}
            >
              <span style={{ fontWeight: 600 }}>{item.kind === 'group' ? '群聊' : '私聊'} · {item.title}</span>
              <span style={hint}>{item.last_message?.content?.slice(0, 34) || '还没有消息'}</span>
            </button>
          ))}
          {!threads.length && <div style={hint}>还没有会话，先选一个人物开始。</div>}
        </div>
      </div>

      <div style={{ ...card, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <strong style={{ fontSize: '14px' }}>{thread?.title || '选择或新建会话'}</strong>
          {thread?.kind === 'group' && <span style={hint}>AI 每轮选 1–3 位角色发言</span>}
          <div style={{ flex: 1 }} />
          {log && <span style={{ ...hint, color: 'var(--text-main)' }}>{log}</span>}
        </div>
        {thread && messages.length > 0 && (
          <div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button style={{ ...btn, borderColor: 'var(--card-border)', color: 'var(--text-muted)' }} onClick={() => { setShowConvert((prev) => !prev); setEventTitle(`${thread.title} · 对话记录`) }}>
                {showConvert ? '收起整理' : '整理为事件'}
              </button>
              <button style={{ ...btn, borderColor: 'var(--card-border)', color: 'var(--text-muted)' }} disabled={impactBusy} onClick={() => void previewImpactNow()}>
                影响预览
              </button>
            </div>
            {showConvert && (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '6px', flexWrap: 'wrap' }}>
                <input value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} placeholder="事件标题" style={{ ...input, flex: 1, minWidth: '160px' }} />
                <input
                  type="number" min={1} max={100} value={convertCount}
                  onChange={(e) => setConvertCount(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
                  title="取最近多少条消息"
                  style={{ ...input, width: '64px' }}
                />
                <label style={{ ...hint, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input type="checkbox" checked={writeExperience} onChange={(e) => setWriteExperience(e.target.checked)} /> 写入角色经历
                </label>
                <button style={btn} disabled={busy} onClick={() => void convert()}>保存</button>
              </div>
            )}
          </div>
        )}
        {impact && (
          <div style={{ border: '1px solid var(--card-border)', borderRadius: '8px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-main)' }}>{impact.summary || '影响建议'}</div>
            {impact.relationships?.map((item: any, index: number) => (
              <div key={index} style={hint}>
                {item.source_name} → {item.target_name}：{item.quadrant} / {item.strength}（{item.reason || item.relation_type}）
              </div>
            ))}
            {impact.six_axis && Object.keys(impact.six_axis).length > 0 && (
              <div style={hint}>
                六轴增量：{Object.entries(impact.six_axis).map(([key, value]) => `${key} ${Number(value) > 0 ? '+' : ''}${value}`).join(' · ')}
                {impact.negentropy ? ` · negentropy ${impact.negentropy > 0 ? '+' : ''}${impact.negentropy}` : ''}
              </div>
            )}
            {impact.status === 'pending' ? (
              <div style={{ display: 'flex', gap: '6px' }}>
                <button style={btn} disabled={impactBusy} onClick={() => void applyImpactNow()}>应用影响</button>
                <button style={{ ...btn, borderColor: 'var(--card-border)', color: 'var(--text-muted)' }} disabled={impactBusy} onClick={() => void dismissImpactNow()}>忽略</button>
              </div>
            ) : (
              <div style={hint}>状态：{impact.status === 'applied' ? '已应用' : '已忽略'}</div>
            )}
          </div>
        )}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0 }}>
          {messages.map((message) => {
            const mine = message.sender_type === 'user'
            return (
              <div key={message.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '78%', padding: '8px 10px', borderRadius: '10px', fontSize: '12.5px', lineHeight: 1.65,
                  background: mine ? 'rgba(64,158,255,0.14)' : 'rgba(128,128,128,0.10)',
                  border: '1px solid var(--card-border)', whiteSpace: 'pre-wrap',
                }}>
                  {!mine && <div style={{ ...hint, marginBottom: '2px' }}>{characterName(message.character_id) || '角色'}</div>}
                  {message.content}
                </div>
              </div>
            )
          })}
          {busy && <div style={{ ...hint }}>{thread?.kind === 'group' ? '群聊调度中…' : '角色正在思考…'}</div>}
          <div ref={bottomRef} />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() } }}
            placeholder={thread?.kind === 'group' ? '对群聊说点什么…' : '对角色说点什么…'}
            disabled={!thread || busy}
            style={{ ...input, flex: 1 }}
          />
          <button style={btn} disabled={!thread || busy || !draft.trim()} onClick={() => void send()}>发送</button>
        </div>
      </div>

      <div style={{ ...card, width: '300px', overflowY: 'auto' }}>
        <h3 style={{ margin: 0, fontSize: '13px' }}>我的身份</h3>
        <div style={{ ...hint }}>角色会知道你在世界中的身份；留空则按外来交谈者处理。</div>
        {selfCharacters.length > 0 && (
          <select value={selfCharacterId} onChange={(e) => setSelfCharacterId(e.target.value)} style={input}>
            <option value="">不绑定自我人物（使用下方手填身份）</option>
            {selfCharacters.map((c: any) => <option key={c.id} value={c.id}>自我人物：{c.name}</option>)}
          </select>
        )}
        <div style={{ display: 'flex', gap: '5px' }}>
          <input value={identityName} onChange={(e) => setIdentityName(e.target.value)} placeholder="称呼，如：韩师弟" style={{ ...input, flex: 1 }} />
          <input value={identityRole} onChange={(e) => setIdentityRole(e.target.value)} placeholder="身份，如：记名弟子" style={{ ...input, flex: 1 }} />
        </div>
        <label style={{ ...hint, display: 'flex', alignItems: 'center', gap: '5px' }}>
          <input type="checkbox" checked={oocAllowed} onChange={(e) => setOocAllowed(e.target.checked)} />
          允许出戏（被明确询问时承认这是角色扮演）
        </label>
        <button style={btn} disabled={busy || !thread} onClick={() => void saveIdentity()}>保存身份</button>
        <button style={btn} disabled={busy || !thread || messages.length === 0} onClick={() => void saveChatDiary()}>最近对话存为日记</button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <h3 style={{ margin: 0, fontSize: '13px' }}>角色配置</h3>
          <div style={{ flex: 1 }} />
          {role && (
            <button style={{ ...btn, borderColor: role.enabled ? 'var(--danger-color)' : 'var(--primary-color)', color: role.enabled ? 'var(--danger-color)' : 'var(--primary-color)' }} onClick={() => void toggleEnabled()}>
              {role.enabled ? '关闭聊天' : '开启聊天'}
            </button>
          )}
        </div>
        {role ? (
          <>
            {role.exists === false && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={hint}>尚未生成角色配置。生成后可修改语气、称呼与态度。</div>
                <button style={btn} disabled={busy} onClick={() => void generateRole()}>生成配置</button>
              </div>
            )}
            {role.exists !== false && (
              <>
                <label style={hint}>对外称呼</label>
                <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={input} />
                <label style={hint}>说话方式</label>
                <textarea value={tone} onChange={(e) => setTone(e.target.value)} rows={3} style={{ ...input, resize: 'vertical' }} />
                <label style={hint}>对用户的态度</label>
                <textarea value={stance} onChange={(e) => setStance(e.target.value)} rows={3} style={{ ...input, resize: 'vertical' }} />
                <button style={btn} disabled={busy} onClick={() => void saveRole()}>保存配置</button>
                {role.persona?.engines && (
                  <div style={{ ...hint }}>
                    引擎：
                    {Object.entries(role.persona.engines).map(([key, item]: any) => `${item.label || key} ${item.value}`).join(' · ')}
                  </div>
                )}
              </>
            )}
          </>
        ) : <div style={hint}>选择私聊后显示角色配置。</div>}

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
          <h3 style={{ margin: 0, fontSize: '13px' }}>对话记忆</h3>
          <div style={{ flex: 1 }} />
          <button style={{ ...btn, padding: '3px 8px' }} disabled={busy || !thread || (thread?.message_count || 0) < 6} onClick={() => void summarizeNow()}>AI 摘要</button>
        </div>
        {memories.map((memory) => (
          <div key={memory.id} style={{ border: '1px solid var(--card-border)', borderRadius: '7px', padding: '7px', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
            <div style={{ ...hint, flex: 1, color: 'var(--text-main)' }}>{memory.content}</div>
            <button style={{ ...btn, padding: '2px 6px', borderColor: 'var(--danger-color)', color: 'var(--danger-color)' }} onClick={() => void removeMemory(memory.id)}>删</button>
          </div>
        ))}
        {!memories.length && <div style={hint}>暂无记忆；对话后会形成简短片段。</div>}
      </div>
    </div>
  )
}
