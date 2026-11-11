import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { API_ORIGIN } from '../api/config'
import { loadAiSettings } from '../api/aiSettings'
import { listPersonas, listPersonaThreads, listPersonaMessages, chatWithPersona, type Persona } from '../api/personas'
import { getAssistantState, subscribeAssistant } from '../api/assistantContext'
import {
  applyDomFormPatch,
  collectDemoTargets,
  collectDomFormFields,
  executeDemoAction,
  type DemoAction,
} from '../api/assistantDom'

type Action =
  | { type: 'fill_form'; fields: Record<string, unknown>; summary?: string }
  | {
      type: 'update_entity'
      entity_type: string
      entity_id: string
      fields: Record<string, unknown>
      summary?: string
    }
  | { type: 'navigate'; page: string; summary?: string }
  | { type: 'click'; ai_id?: string; selector?: string; text?: string; summary?: string }
  | { type: 'fill'; id: string; value: string; summary?: string }

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  actions?: Action[]
  label?: string
  contextLabel?: string
  pageKey?: string
  error?: boolean
}

const STORAGE_KEY = 'ws.assistant.chat.v1'

const PAGE_LABELS: Record<string, string> = {
  overview: '世界总览',
  'world-management': '世界管理',
  'world-building': '世界建设配置',
  'world-data': '世界设定',
  'world-structure': '世界结构',
  'character-management': '人物管理',
  relationships: '关系与组织',
  events: '事件管理',
  timeline: '时间线',
  simulation: '模拟运行',
  writing: '写作辅助',
  archive: '归档库',
  trash: '回收站',
  'time-machine': '时光机',
}

const ENTITY_LABELS: Record<string, string> = {
  character: '人物',
  world: '世界',
  event: '事件',
  story: '章节',
  location: '地点',
  organization: '组织',
}

const ENDPOINTS: Record<string, (id: string) => string> = {
  world: (id) => `/api/worlds/${id}`,
  character: (id) => `/api/characters/${id}`,
  event: (id) => `/api/events/${id}`,
  story: (id) => `/api/writings/${id}`,
  location: (id) => `/api/locations/${id}`,
  organization: (id) => `/api/organizations/${id}`,
}

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function loadMessages(): ChatMessage[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const rows = JSON.parse(raw)
    return Array.isArray(rows) ? rows.slice(-40) : []
  } catch {
    return []
  }
}

function saveMessages(messages: ChatMessage[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40)))
  } catch {
    // 隐私模式或容量不足时静默失败。
  }
}

function MarkdownText({ text }: { text: string }) {
  const lines = (text || '').split('\n')
  const nodes: ReactNode[] = []
  let code: string[] = []
  let inCode = false

  const inline = (line: string, key: string) => {
    const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={`${key}-${index}`}>{part.slice(2, -2)}</strong>
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code
            key={`${key}-${index}`}
            style={{ padding: '1px 5px', borderRadius: '5px', background: 'rgba(128,128,128,0.18)', fontSize: '11px' }}
          >
            {part.slice(1, -1)}
          </code>
        )
      }
      return <span key={`${key}-${index}`}>{part}</span>
    })
  }

  lines.forEach((line, index) => {
    if (line.trim().startsWith('```')) {
      if (inCode) {
        nodes.push(
          <pre
            key={`code-${index}`}
            style={{ margin: '8px 0', padding: '10px', borderRadius: '8px', background: 'rgba(0,0,0,0.22)', overflowX: 'auto', fontSize: '11px', lineHeight: 1.6 }}
          >
            <code>{code.join('\n')}</code>
          </pre>
        )
        code = []
        inCode = false
      } else {
        inCode = true
      }
      return
    }
    if (inCode) {
      code.push(line)
      return
    }
    if (!line.trim()) {
      nodes.push(<div key={`blank-${index}`} style={{ height: '5px' }} />)
      return
    }
    const heading = line.match(/^(#{1,4})\s+(.*)$/)
    if (heading) {
      nodes.push(
        <div key={`h-${index}`} style={{ fontWeight: 700, fontSize: heading[1].length <= 2 ? '15px' : '13px', margin: '7px 0 3px', color: 'var(--text-main)' }}>
          {inline(heading[2], `h-${index}`)}
        </div>
      )
      return
    }
    const bullet = line.match(/^\s*[-*]\s+(.*)$/)
    if (bullet) {
      nodes.push(
        <div key={`b-${index}`} style={{ display: 'flex', gap: '7px', margin: '2px 0' }}>
          <span style={{ color: 'var(--primary-color)', lineHeight: 1.7 }}>•</span>
          <span style={{ lineHeight: 1.7 }}>{inline(bullet[1], `b-${index}`)}</span>
        </div>
      )
      return
    }
    const numbered = line.match(/^\s*(\d+)[.、]\s+(.*)$/)
    if (numbered) {
      nodes.push(
        <div key={`n-${index}`} style={{ display: 'flex', gap: '7px', margin: '2px 0' }}>
          <span style={{ color: 'var(--primary-color)', fontWeight: 600, lineHeight: 1.7 }}>{numbered[1]}.</span>
          <span style={{ lineHeight: 1.7 }}>{inline(numbered[2], `n-${index}`)}</span>
        </div>
      )
      return
    }
    nodes.push(
      <div key={`p-${index}`} style={{ lineHeight: 1.72, margin: '2px 0' }}>
        {inline(line, `p-${index}`)}
      </div>
    )
  })
  if (code.length) {
    nodes.push(
      <pre key="code-tail" style={{ margin: '8px 0', padding: '10px', borderRadius: '8px', background: 'rgba(0,0,0,0.22)', overflowX: 'auto', fontSize: '11px' }}>
        <code>{code.join('\n')}</code>
      </pre>
    )
  }
  return <div>{nodes}</div>
}

function actionTone(type: string) {
  if (type === 'fill_form') return '填入表单'
  if (type === 'update_entity') return '应用修改'
  if (type === 'click') return '点击此处'
  if (type === 'fill') return '填入此处'
  return '打开页面'
}

export default function AIAssistantPanel({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const state = useSyncExternalStore(subscribeAssistant, getAssistantState, getAssistantState)
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadMessages())
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [backendState, setBackendState] = useState<'unknown' | 'ok' | 'missing' | 'offline'>('unknown')
  const [applied, setApplied] = useState<Record<string, string>>({})
  const [lastSelection, setLastSelection] = useState('')
  const [unread, setUnread] = useState(false)
  const [isNarrow, setIsNarrow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches
  )
  const [personas, setPersonas] = useState<Persona[]>([])
  const [personaId, setPersonaId] = useState('')
  const [personaThreadId, setPersonaThreadId] = useState('')
  const listRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => { if (!personaId) saveMessages(messages) }, [messages, personaId])

  useEffect(() => {
    const handler = () => {
      const selection = window.getSelection()
      const text = selection?.toString().trim() || ''
      if (!text || text.length > 1500) return
      const anchor = selection?.anchorNode
      if (anchor && panelRef.current?.contains(anchor)) return
      setLastSelection(text)
    }
    document.addEventListener('selectionchange', handler)
    return () => document.removeEventListener('selectionchange', handler)
  }, [])

  useEffect(() => {
    if (!open) return
    void listPersonas().then(setPersonas).catch(() => setPersonas([]))
  }, [open])

  useEffect(() => {
    if (!open) return
    if (!personaId) {
      setMessages(loadMessages())
      setPersonaThreadId('')
      return
    }
    let alive = true
    void listPersonaThreads(personaId).then(async (threads) => {
      if (!alive) return
      if (!threads.length) { setPersonaThreadId(''); setMessages([]); return }
      setPersonaThreadId(threads[0].id)
      const rows = await listPersonaMessages(personaId, threads[0].id)
      if (!alive) return
      setMessages(rows.map((row) => ({
        id: row.id, role: row.role === 'user' ? 'user' : 'assistant', content: row.content,
        contextLabel: `人格：${personas.find((p) => p.id === personaId)?.name || ''}`,
      })))
    }).catch(() => { if (alive) { setMessages([]); setPersonaThreadId('') } })
    return () => { alive = false }
  }, [open, personaId])

  useEffect(() => {
    if (!open) return
    let alive = true
    fetch(`${API_ORIGIN}/api/assistant/health`)
      .then(async (response) => {
        if (!alive) return
        if (response.ok) setBackendState('ok')
        else setBackendState('missing')
      })
      .catch(() => {
        if (alive) setBackendState('offline')
      })
    return () => {
      alive = false
    }
  }, [open])

  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [open, messages, sending])

  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => inputRef.current?.focus(), 80)
    return () => clearTimeout(timer)
  }, [open])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && open) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // 宽屏停靠为侧栏（不遮挡页面），窄屏自动回退为悬浮层。
  useEffect(() => {
    const query = window.matchMedia('(max-width: 900px)')
    const handler = (event: MediaQueryListEvent) => setIsNarrow(event.matches)
    query.addEventListener('change', handler)
    return () => query.removeEventListener('change', handler)
  }, [])

  const pageLabel = state.page.label || PAGE_LABELS[state.page.page] || state.page.page
  const entity = state.entity
  const fieldCount = state.form?.fields.length || 0

  const contextText = useMemo(() => {
    if (personaId) {
      const persona = personas.find((p) => p.id === personaId)
      return `独立人格「${persona?.name || '个人 AI'}」 · 独立会话与记忆`
    }
    const bits = [pageLabel]
    if (state.page.worldName) bits.push(state.page.worldName)
    if (entity?.name) {
      const typeLabel = ENTITY_LABELS[entity.type] || entity.type
      bits.push(`${typeLabel}「${entity.name}」`)
    }
    if (fieldCount) bits.push(`${fieldCount} 个表单字段`)
    return bits.join(' · ')
  }, [pageLabel, state.page.worldName, entity, fieldCount, personaId, personas])

  const quickPrompts = useMemo(() => {
    const prompts: string[] = []
    if (personaId) {
      return ['帮我整理一下今天的任务和优先级', '陪我梳理一下现在的状态', '用你的方式回答：我接下来该做什么？']
    }
    if (entity?.type === 'character') prompts.push('概括当前人物，并指出设定上的冲突')
    else if (entity?.type === 'story') prompts.push('分析当前章节的节奏，给我下一步建议')
    else if (entity?.type === 'event') prompts.push('帮我补全当前事件的因果与影响')
    else if (entity?.type === 'world') prompts.push('这个世界下一步可以发生什么')
    if (fieldCount) prompts.push('帮我根据当前页面设定补全这个表单')
    prompts.push('解释当前页面，告诉我下一步能做什么')
    prompts.push('你能帮我做什么？')
    return Array.from(new Set(prompts)).slice(0, 3)
  }, [entity, fieldCount, personaId])

  const send = useCallback(
    async (preset?: string, options?: { hidden?: boolean; autoRun?: boolean; demo?: boolean }) => {
      const text = (preset ?? input).trim()
      if (!text || sending) return
      const snapshot = getAssistantState()
      const domFields = collectDomFormFields()
      const fields = snapshot.form?.fields?.length ? snapshot.form.fields : domFields
      const form = fields.length
        ? {
            title: snapshot.form?.title || `${snapshot.page.label || '当前页面'}表单`,
            registered: Boolean(snapshot.form),
            fields,
          }
        : null
      const userMessage: ChatMessage = {
        id: uid(),
        role: 'user',
        content: text,
        label: options?.hidden ? '✨ 观看 AI 演示本页' : undefined,
        pageKey: snapshot.page.page,
      }
      const nextMessages = [...messages, userMessage]
      setMessages(nextMessages)
      setInput('')
      setSending(true)
      setUnread(false)
      if (personaId) {
        try {
          const result = await chatWithPersona(personaId, text, personaThreadId || undefined)
          setPersonaThreadId(result.thread_id)
          setMessages((prev) => [...prev, {
            id: uid(), role: 'assistant', content: result.reply,
            contextLabel: `人格：${result.persona.name}`,
          }])
        } catch (error: any) {
          setMessages((prev) => [...prev, {
            id: uid(), role: 'assistant', content: String(error?.message || '人格对话失败'), error: true,
          }])
        } finally { setSending(false) }
        return
      }
      try {
        const settings = loadAiSettings()
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (settings.apiKey) {
          headers['X-AI-API-Key'] = settings.apiKey
          if (settings.baseUrl) headers['X-AI-Base-URL'] = settings.baseUrl
          if (settings.model) headers['X-AI-Model'] = settings.model
        }
        const response = await fetch(`${API_ORIGIN}/api/assistant/chat`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            messages: nextMessages
              .filter((message) => !message.error)
              .slice(-18)
              .map((message) => ({ role: message.role, content: message.content })),
            context: {
              page: snapshot.page.page,
              page_label: snapshot.page.label,
              world_id: snapshot.page.worldId || null,
              world_name: snapshot.page.worldName,
              entity_type: snapshot.entity?.type || '',
              entity_id: snapshot.entity?.id || '',
              entity_name: snapshot.entity?.name || '',
              form,
              selection: lastSelection,
              demo: Boolean(options?.demo),
              dom_targets: collectDemoTargets(),
            },
          }),
        })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(String(data?.detail || `请求失败（HTTP ${response.status}）`))
        }
        const reply = String(data.reply || '').trim()
        const actions = Array.isArray(data.actions) ? (data.actions as Action[]) : []
        const assistantMessage: ChatMessage = {
          id: uid(),
          role: 'assistant',
          content: reply || '我已经看到当前页面了。',
          actions,
          contextLabel: data.context_label,
          pageKey: snapshot.page.page,
        }
        setMessages((prev) => [...prev, assistantMessage])
        if (options?.autoRun) {
          const steps = actions.filter(
            (action): action is DemoAction => action.type === 'click' || action.type === 'fill'
          )
          if (steps.length) {
            const demoActions = steps as DemoAction[]
            window.setTimeout(() => {
              void (async () => {
                for (let index = 0; index < demoActions.length; index += 1) {
                  const action = demoActions[index]
                  const key = `${assistantMessage.id}:${index}`
                  setApplied((prev) => ({ ...prev, [key]: '正在执行…' }))
                  try {
                    const status = await executeDemoAction(action)
                    setApplied((prev) => ({ ...prev, [key]: status }))
                  } catch (error: any) {
                    setApplied((prev) => ({ ...prev, [key]: String(error?.message || '执行失败') }))
                    break
                  }
                  await new Promise((resolve) => window.setTimeout(resolve, 140))
                }
              })()
            }, 260)
          }
        }
        if (!open) setUnread(true)
      } catch (error: any) {
        let text = String(error?.message || error || 'AI 请求失败，请检查后端和「AI 接入」配置。')
        if (/not found/i.test(text)) {
          setBackendState('missing')
          text = `当前后端没有「AI 助手」接口（${API_ORIGIN}/api/assistant/chat 返回 404）。通常是后端未重启或部署的还是旧版本，重启/重新部署后端后再试。`
        }
        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: 'assistant',
            content: text,
            error: true,
            pageKey: snapshot.page.page,
          },
        ])
      } finally {
        setSending(false)
      }
    },
    [input, lastSelection, messages, open, sending, personaId, personaThreadId]
  )

  const sendRef = useRef(send)
  useEffect(() => {
    sendRef.current = send
  }, [send])

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail || {}
      const prompt = String(detail.prompt || '').trim()
      if (!prompt) return
      setOpen(true)
      setUnread(false)
      setLastSelection('')
      // 给面板留出展开与渲染时间，再发送隐藏指令
      window.setTimeout(() => {
        void sendRef.current(prompt, { hidden: true, autoRun: true, demo: true })
      }, 340)
    }
    window.addEventListener('ws:assistant-demo', handler)
    return () => window.removeEventListener('ws:assistant-demo', handler)
  }, [])

  const fillForm = (
    messageId: string,
    index: number,
    action: Extract<Action, { type: 'fill_form' }>
  ) => {
    const sourcePage = messages.find((message) => message.id === messageId)?.pageKey
    if (sourcePage && state.page.page !== sourcePage) {
      setApplied((prev) => ({ ...prev, [`${messageId}:${index}`]: '页面已变化，请重新发送' }))
      return
    }
    const registered = state.form
    const keys = Object.keys(action.fields)
    const registeredKeys = registered ? registered.fields.map((field) => field.key) : []
    const domKeys = keys.filter((key) => key.startsWith('id:') || key.startsWith('dom:') || key.startsWith('radio:'))
    let count: number
    if (registered && domKeys.length === 0 && keys.some((key) => registeredKeys.includes(key))) {
      const patch: Record<string, unknown> = {}
      keys.forEach((key) => {
        if (registeredKeys.includes(key)) patch[key] = action.fields[key]
      })
      registered.apply(patch)
      count = Object.keys(patch).length
    } else {
      count = applyDomFormPatch(action.fields)
    }
    setApplied((prev) => ({
      ...prev,
      [`${messageId}:${index}`]: count ? `已填入 ${count} 项，请检查后保存` : '没有找到对应字段',
    }))
  }

  const applyUpdate = async (
    messageId: string,
    index: number,
    action: Extract<Action, { type: 'update_entity' }>
  ) => {
    const target = ENDPOINTS[action.entity_type]
    if (!target) return
    const typeLabel = ENTITY_LABELS[action.entity_type] || action.entity_type
    if (!window.confirm(`${action.summary || '修改当前对象'}\n\n将直接修改${typeLabel}，确定应用？`)) return
    setApplied((prev) => ({ ...prev, [`${messageId}:${index}`]: '正在应用…' }))
    try {
      let body: Record<string, unknown> = { ...action.fields }
      if (
        action.entity_type === 'character' &&
        action.fields.basic_profile &&
        typeof action.fields.basic_profile === 'object'
      ) {
        const current = await fetch(`${API_ORIGIN}/api/characters/${action.entity_id}`).then((res) => res.json())
        body = {
          ...body,
          basic_profile: { ...(current?.basic_profile || {}), ...(action.fields.basic_profile as object) },
        }
      }
      const response = await fetch(`${API_ORIGIN}${target(action.entity_id)}`, {
        method: action.entity_type === 'organization' || action.entity_type === 'location' ? 'PATCH' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!response.ok) {
        const detail = await response.text()
        throw new Error(`修改失败（${response.status}）：${detail.slice(0, 240)}`)
      }
      setApplied((prev) => ({ ...prev, [`${messageId}:${index}`]: '已应用，正在刷新…' }))
      setTimeout(() => window.location.reload(), 900)
    } catch (error: any) {
      setApplied((prev) => ({ ...prev, [`${messageId}:${index}`]: String(error?.message || error) }))
    }
  }

  const clearChat = () => {
    setMessages([])
    setApplied({})
    try {
      sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  }

  // 关闭态悬浮按钮外壳
  const shell: CSSProperties = {
    position: 'fixed',
    right: '22px',
    bottom: '22px',
    zIndex: 1400,
    fontFamily: 'inherit',
  }

  // 打开态外壳：宽屏停靠为右侧栏（主内容区自动收窄，不遮挡页面）；窄屏回退为悬浮层。
  const panelShell: CSSProperties = isNarrow
    ? {
        position: 'fixed',
        right: '14px',
        bottom: '14px',
        zIndex: 1400,
        width: 'min(430px, calc(100vw - 28px))',
        height: 'min(700px, calc(100vh - 28px))',
        fontFamily: 'inherit',
      }
    : {
        position: 'static',
        flex: '0 0 clamp(320px, 30vw, 420px)',
        width: 'auto',
        height: 'auto',
        alignSelf: 'stretch',
        fontFamily: 'inherit',
      }

  return (
    <>
      <style>{`
        @keyframes ws-assistant-dot-pulse {
          0%, 80%, 100% { opacity: 0.25; transform: translateY(0); }
          40% { opacity: 1; transform: translateY(-2px); }
        }
        .ws-assistant-dot { display: inline-block; font-size: 8px; animation: ws-assistant-dot-pulse 1.2s infinite ease-in-out; }
        .ws-assistant-dot:nth-child(2) { animation-delay: 0.15s; }
        .ws-assistant-dot:nth-child(3) { animation-delay: 0.3s; }
      `}</style>

      {!open && (
        <button
          type="button"
          data-ai-assistant
          onClick={() => {
            setOpen(true)
            setUnread(false)
          }}
          title="打开全局 AI 助手"
          style={{
            ...shell,
            width: '56px',
            height: '56px',
            borderRadius: '18px',
            border: '1px solid var(--card-border)',
            background: 'linear-gradient(145deg, var(--primary-color), color-mix(in srgb, var(--primary-color) 62%, #111 38%))',
            color: 'var(--primary-text)',
            cursor: 'pointer',
            boxShadow: '0 12px 30px rgba(0,0,0,0.28)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '22px',
            fontWeight: 700,
          }}
        >
          ✦
          {unread && (
            <span
              style={{
                position: 'absolute',
                top: '9px',
                right: '9px',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#ef4444',
                border: '2px solid var(--bg-color)',
              }}
            />
          )}
        </button>
      )}

      {open && (
        <div
          ref={panelRef}
          data-ai-assistant
          style={{
            ...panelShell,
            display: 'flex',
            flexDirection: 'column',
            borderRadius: isNarrow ? '18px' : 0,
            border: isNarrow ? '1px solid var(--card-border)' : 'none',
            borderLeft: isNarrow ? undefined : '1px solid var(--card-border)',
            background: 'color-mix(in srgb, var(--bg-color) 94%, transparent)',
            boxShadow: isNarrow ? '0 24px 70px rgba(0,0,0,0.35)' : 'none',
            overflow: 'hidden',
            backdropFilter: 'blur(24px)',
          }}
        >
          <header style={{ padding: '14px 15px 12px', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '11px', background: 'var(--primary-color)', color: 'var(--primary-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px', flex: '0 0 auto' }}>
              ✦
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <strong style={{ fontSize: '14px', color: 'var(--text-main)' }}>{personaId ? (personas.find((p) => p.id === personaId)?.name || '个人 AI 人格') : '全局 AI 助手'}</strong>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', border: '1px solid var(--card-border)', borderRadius: '20px', padding: '1px 6px' }}>
                  {personaId ? '独立人格 · 独立记忆' : '上下文已接入'}
                </span>
              </div>
              <select
                value={personaId}
                onChange={(event) => setPersonaId(event.target.value)}
                title="选择通用助手或某个个人 AI 人格"
                style={{ marginTop: 4, maxWidth: '100%', padding: '3px 5px', borderRadius: 6, border: '1px solid var(--card-border)', background: 'var(--bg-color)', color: 'var(--text-main)', fontSize: 10 }}
              >
                <option value="">通用助手（页面上下文 / 工具）</option>
                {personas.map((persona) => (
                  <option key={persona.id} value={persona.id}>人格：{persona.name}</option>
                ))}
              </select>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={contextText}>
                {contextText}
              </div>
            </div>
            <button type="button" onClick={clearChat} title="清空对话" style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '11px', padding: '4px' }}>
              清空
            </button>
            <button type="button" onClick={() => setOpen(false)} title="收起" style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '20px', lineHeight: 1, padding: '0 2px' }}>
              ×
            </button>
          </header>

          {backendState === 'missing' && (
            <div style={{ margin: '10px 14px 0', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--danger-color)', color: 'var(--danger-color)', fontSize: '11px', lineHeight: 1.6 }}>
              后端未加载 AI 助手接口（{API_ORIGIN}/api/assistant/chat → 404）。请重启后端或重新部署后再试。
            </div>
          )}
          {backendState === 'offline' && (
            <div style={{ margin: '10px 14px 0', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--danger-color)', color: 'var(--danger-color)', fontSize: '11px', lineHeight: 1.6 }}>
              连不上后端（{API_ORIGIN}）。请确认后端已启动、地址正确。
            </div>
          )}

          <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '15px 14px 8px', display: 'flex', flexDirection: 'column', gap: '11px' }}>
            {messages.length === 0 && (
              <div style={{ padding: '4px 2px' }}>
                <div style={{ fontSize: '13px', lineHeight: 1.7, color: 'var(--text-main)' }}>
                  我在。当前是 <strong>{pageLabel}</strong>
                  {state.page.worldName ? ` · ${state.page.worldName}` : ''}。可以正常聊天，也可以让我：
                </div>
                <div style={{ marginTop: '8px', fontSize: '12px', lineHeight: 1.8, color: 'var(--text-muted)' }}>
                  · 看懂你正在填的表单并快速填入
                  <br />
                  · 概括 / 检查当前人物、事件、章节
                  <br />
                  · 直接修改当前对象（执行前会确认）
                  <br />
                  · 带你去对应页面
                </div>
              </div>
            )}

            {messages.map((message) => (
              <div key={message.id} style={{ display: 'flex', justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div
                  style={{
                    maxWidth: message.role === 'user' ? '88%' : '94%',
                    padding: message.role === 'user' ? '9px 12px' : '10px 12px',
                    borderRadius: message.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                    background:
                      message.role === 'user'
                        ? 'var(--primary-color)'
                        : message.error
                          ? 'rgba(239,68,68,0.1)'
                          : 'rgba(128,128,128,0.11)',
                    color: message.role === 'user' ? 'var(--primary-text)' : 'var(--text-main)',
                    border: message.error ? '1px solid rgba(239,68,68,0.3)' : '1px solid transparent',
                    fontSize: '12.5px',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {message.role === 'user' ? message.label || message.content : <MarkdownText text={message.content} />}
                  {message.role === 'assistant' && message.contextLabel && (
                    <div style={{ marginTop: '6px', fontSize: '10px', color: 'var(--text-muted)' }}>{message.contextLabel}</div>
                  )}
                  {message.actions && message.actions.length > 0 && (
                    <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
                      {message.actions.map((action, index) => {
                        const key = `${message.id}:${index}`
                        const status = applied[key]
                        return (
                          <div key={key} style={{ border: '1px solid var(--card-border)', borderRadius: '9px', padding: '8px 9px', background: 'var(--card-bg)' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px', lineHeight: 1.5 }}>
                              {action.summary}
                            </div>
                            <button
                              type="button"
                              disabled={Boolean(status)}
                              onClick={() => {
                                if (action.type === 'fill_form') fillForm(message.id, index, action)
                                else if (action.type === 'update_entity') void applyUpdate(message.id, index, action)
                                else if (action.type === 'click' || action.type === 'fill') {
                                  void (async () => {
                                    setApplied((prev) => ({ ...prev, [key]: '正在执行…' }))
                                    try {
                                      const status = await executeDemoAction(action as DemoAction)
                                      setApplied((prev) => ({ ...prev, [key]: status }))
                                    } catch (error: any) {
                                      setApplied((prev) => ({ ...prev, [key]: String(error?.message || '执行失败') }))
                                    }
                                  })()
                                } else {
                                  onNavigate?.(action.page)
                                  setApplied((prev) => ({ ...prev, [key]: `已打开${PAGE_LABELS[action.page] || action.page}` }))
                                }
                              }}
                              style={{
                                width: '100%',
                                padding: '6px 8px',
                                borderRadius: '7px',
                                border: '1px solid var(--primary-color)',
                                background: action.type === 'update_entity' ? 'transparent' : 'var(--primary-color)',
                                color: action.type === 'update_entity' ? 'var(--primary-color)' : 'var(--primary-text)',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: status ? 'default' : 'pointer',
                                opacity: status ? 0.72 : 1,
                              }}
                            >
                              {status || actionTone(action.type)}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {sending && (
              <div style={{ display: 'flex', gap: '5px', alignItems: 'center', padding: '4px 8px', color: 'var(--text-muted)', fontSize: '11px' }}>
                <span className="ws-assistant-dot">●</span>
                <span className="ws-assistant-dot">●</span>
                <span className="ws-assistant-dot">●</span>
                <span style={{ marginLeft: '3px' }}>正在结合当前页面思考…</span>
              </div>
            )}
          </div>

          {messages.length === 0 && (
            <div style={{ padding: '0 13px 8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void send(prompt)}
                  style={{ padding: '5px 8px', borderRadius: '20px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-muted)', fontSize: '10.5px', cursor: 'pointer' }}
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          <div style={{ padding: '10px 11px', borderTop: '1px solid var(--card-border)' }}>
            {lastSelection && (
              <div style={{ marginBottom: '7px', fontSize: '10px', color: 'var(--text-muted)', display: 'flex', gap: '5px', alignItems: 'center' }}>
                <span style={{ color: 'var(--primary-color)' }}>◈</span>
                <span>
                  已带入选区：{lastSelection.slice(0, 42)}
                  {lastSelection.length > 42 ? '…' : ''}
                </span>
                <button type="button" onClick={() => setLastSelection('')} style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '10px' }}>
                  移除
                </button>
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    void send()
                  }
                }}
                rows={1}
                placeholder="问点什么，或让我帮你填表、改当前对象…"
                style={{
                  flex: 1,
                  resize: 'none',
                  maxHeight: '110px',
                  minHeight: '38px',
                  padding: '9px 10px',
                  borderRadius: '10px',
                  border: '1px solid var(--card-border)',
                  background: 'rgba(128,128,128,0.06)',
                  color: 'var(--text-main)',
                  fontSize: '12px',
                  lineHeight: 1.5,
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={() => void send()}
                disabled={sending || !input.trim()}
                title="发送"
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'var(--primary-color)',
                  color: 'var(--primary-text)',
                  cursor: sending || !input.trim() ? 'default' : 'pointer',
                  opacity: sending || !input.trim() ? 0.45 : 1,
                  fontSize: '16px',
                }}
              >
                ↑
              </button>
            </div>
            <div style={{ marginTop: '6px', fontSize: '9.5px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
              <span>Enter 发送 · Shift+Enter 换行</span>
              <span>动作执行前会确认</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
