import { useEffect, useMemo, useState } from 'react'
import {
  ArrowUpRight,
  Bot,
  Brain,
  HeartHandshake,
  MessageCircle,
  MessagesSquare,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import type { ChatMemory, ChatThread } from '../api/chat'
import { listMemories, listThreads } from '../api/chat'
import type { Lang } from './centerShared'
import {
  apiGet,
  excerpt,
  formatDate,
  initialOf,
  toCharacter,
  fetchWorlds,
  type BasicCharacter,
} from './centerShared'
import './../styles/centers.css'

type FilterKey = 'all' | 'lead' | 'important' | 'support' | 'villain' | 'companion'

type RelationRow = {
  id: string
  relation_type: string
  description: string
  source_id: string
  target_id: string
  source_type?: string
  target_type?: string
}

type MemoryRow = ChatMemory & { character_name: string }

function copyFor(lang: Lang) {
  return lang === 'zh'
    ? {
        eyebrow: 'AI INTERACTION CENTER',
        title: 'AI 互动中心',
        subtitle: '找到想对话的角色，让关系、记忆与故事在一次次互动中继续生长。',
        startChat: '开始对话',
        roleplay: '角色扮演',
        characters: '角色',
        sessions: '会话',
        memories: '记忆',
        relations: '关系',
        search: '搜索角色、身份、世界…',
        all: '全部',
        lead: '主角',
        important: '重要配角',
        support: '配角',
        villain: '反派',
        companion: 'AI 伴侣',
        recommended: '推荐角色',
        recommendedKicker: 'CHARACTERS TO MEET',
        myCharacters: '我的角色',
        rosterKicker: 'CHARACTER LIBRARY',
        resultUnit: '位角色',
        noCharacters: '没有匹配的角色',
        noCharactersHint: '换一个关键词或分类继续寻找。',
        chat: '对话',
        profile: '档案',
        companionKicker: 'LONG-TERM COMPANION',
        companionTitle: 'AI 伴侣',
        companionFallback: '长期互动对象',
        companionHint: '独立会话与长期记忆，让每次相处都被记住。',
        continueChat: '继续陪伴',
        globalAI: '全局 AI 人格',
        recent: '最近会话',
        recentKicker: 'RECENT CONVERSATIONS',
        group: '多人聊天室',
        groupKicker: 'GROUP ROOMS',
        participants: '参与角色',
        messages: '条消息',
        openChat: '继续会话',
        openGroup: '进入聊天室',
        noSessions: '还没有会话记录',
        noSessionsHint: '选择一位角色开始对话，会话会出现在这里。',
        noGroup: '还没有多人聊天室',
        noGroupHint: '在现有聊天页选择两位以上角色即可创建群聊。',
        relationsTitle: '关系互动',
        relationsKicker: 'RELATIONSHIPS & EVENTS',
        personRelations: '关系记录',
        interactionEvents: '互动事件',
        viewRelations: '关系网络',
        viewEvents: '互动事件',
        noRelations: '还没有人物关系',
        memoryTitle: '记忆管理',
        memoryKicker: 'LONG-TERM MEMORY',
        viewMemories: '管理记忆',
        noMemories: '还没有长期记忆',
        importance: '重要度',
        actionsTitle: '角色与玩法',
        actionsKicker: 'CREATE & ROLEPLAY',
        roleplayTitle: '角色扮演',
        roleplayDesc: '以角色身份进入模拟，让选择改变关系与世界。',
        enterSimulation: '进入模拟',
        createCharacter: '创建角色',
        publishAuth: '角色发布与授权',
        publishAuthHint: '发布、公开授权与使用范围尚未接入后端，当前仅支持本地角色。',
        localOnly: '本地作品',
        noPublish: '0 个公开角色 · 0 项授权',
        note: '单角色聊天、群聊、关系与记忆均复用现有真实能力；角色发布与授权暂无后端。',
      }
    : {
        eyebrow: 'AI INTERACTION CENTER',
        title: 'AI Interaction Center',
        subtitle: 'Meet characters, and let relationships, memories, and stories grow through every interaction.',
        startChat: 'Start chatting',
        roleplay: 'Roleplay',
        characters: 'Characters',
        sessions: 'Sessions',
        memories: 'Memories',
        relations: 'Relations',
        search: 'Search characters, identities, worlds…',
        all: 'All',
        lead: 'Lead',
        important: 'Key supporting',
        support: 'Supporting',
        villain: 'Antagonist',
        companion: 'AI companion',
        recommended: 'Recommended characters',
        recommendedKicker: 'CHARACTERS TO MEET',
        myCharacters: 'My characters',
        rosterKicker: 'CHARACTER LIBRARY',
        resultUnit: 'characters',
        noCharacters: 'No matching characters',
        noCharactersHint: 'Try another keyword or category.',
        chat: 'Chat',
        profile: 'Profile',
        companionKicker: 'LONG-TERM COMPANION',
        companionTitle: 'AI companion',
        companionFallback: 'Long-term companion',
        companionHint: 'Independent sessions and long-term memory keep every interaction.',
        continueChat: 'Continue',
        globalAI: 'Global AI persona',
        recent: 'Recent conversations',
        recentKicker: 'RECENT CONVERSATIONS',
        group: 'Group rooms',
        groupKicker: 'GROUP ROOMS',
        participants: 'Participants',
        messages: 'messages',
        openChat: 'Continue',
        openGroup: 'Enter room',
        noSessions: 'No conversations yet',
        noSessionsHint: 'Start a conversation with a character and it will appear here.',
        noGroup: 'No group rooms yet',
        noGroupHint: 'Choose two or more characters in the chat page to create a group.',
        relationsTitle: 'Relationship interaction',
        relationsKicker: 'RELATIONSHIPS & EVENTS',
        personRelations: 'Relation records',
        interactionEvents: 'Interaction events',
        viewRelations: 'Relationship network',
        viewEvents: 'Events',
        noRelations: 'No character relations yet',
        memoryTitle: 'Memory management',
        memoryKicker: 'LONG-TERM MEMORY',
        viewMemories: 'Manage memories',
        noMemories: 'No long-term memories yet',
        importance: 'Importance',
        actionsTitle: 'Characters & play',
        actionsKicker: 'CREATE & ROLEPLAY',
        roleplayTitle: 'Roleplay',
        roleplayDesc: 'Enter simulation as a character and let choices change relations and the world.',
        enterSimulation: 'Enter simulation',
        createCharacter: 'Create character',
        publishAuth: 'Publish & licensing',
        publishAuthHint: 'Publishing, public licensing, and usage scopes are not connected yet. Characters remain local.',
        localOnly: 'Local work',
        noPublish: '0 public characters · 0 licenses',
        note: 'Single chat, group chat, relations, and memory reuse real existing capabilities. Character publishing and licensing have no backend yet.',
      }
}

export default function AICenterPage({
  lang,
  user,
  onOpenChat,
  onOpenCharacters,
  onOpenRelationships,
  onOpenEvents,
  onOpenMemories,
  onOpenSimulation,
}: {
  lang: Lang
  user: { display_name?: string } | null
  onOpenChat: (worldId: string, characterId?: string) => void
  onOpenCharacters: () => void
  onOpenRelationships: () => void
  onOpenEvents: () => void
  onOpenMemories: () => void
  onOpenSimulation: () => void
}) {
  const copy = copyFor(lang)
  const [characters, setCharacters] = useState<BasicCharacter[]>([])
  const [threads, setThreads] = useState<ChatThread[]>([])
  const [relations, setRelations] = useState<RelationRow[]>([])
  const [eventCount, setEventCount] = useState(0)
  const [memories, setMemories] = useState<MemoryRow[]>([])
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterKey>('all')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const worlds = await fetchWorlds(true)
        const [characterRows, relationshipRows, eventRows] = await Promise.all([
          apiGet<any[]>('/characters').catch(() => []),
          apiGet<RelationRow[]>('/relationships').catch(() => []),
          apiGet<any[]>('/events').catch(() => []),
        ])
        if (cancelled) return

        const worldIds = new Set(worlds.map((world) => world.id))
        const mappedCharacters = characterRows.map((row) => toCharacter(row, worlds))
        setCharacters(mappedCharacters)
        setRelations(relationshipRows.filter((row) => worldIds.has(String((row as any).world_id || ''))))
        setEventCount(eventRows.filter((row) => worldIds.has(String(row.world_id || ''))).length)

        const threadGroups = await Promise.all(
          worlds.map((world) => listThreads(world.id).catch(() => [])),
        )
        if (cancelled) return
        const uniqueThreads = new Map<string, ChatThread>()
        threadGroups.flat().forEach((thread) => uniqueThreads.set(thread.id, thread))
        const allThreads = [...uniqueThreads.values()].sort((a, b) =>
          String(b.last_message_at || b.created_at || '').localeCompare(String(a.last_message_at || a.created_at || '')),
        )
        setThreads(allThreads)

        const memoryGroups = await Promise.all(
          allThreads.map((thread) => listMemories(thread.id).catch(() => [])),
        )
        if (cancelled) return
        const uniqueMemories = new Map<string, ChatMemory>()
        memoryGroups.flat().forEach((memory) => uniqueMemories.set(memory.id, memory))
        const nameById = new Map(mappedCharacters.map((character) => [character.id, character.name]))
        setMemories(
          [...uniqueMemories.values()]
            .map((memory) => ({ ...memory, character_name: nameById.get(memory.character_id) || '角色' }))
            .sort((a, b) => (b.importance || 0) - (a.importance || 0) || String(b.created_at || '').localeCompare(String(a.created_at || ''))),
        )
      } catch {
        /* keep honest empty states */
      } finally {
        if (!cancelled) setLoaded(true)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  const names = useMemo(() => new Map(characters.map((character) => [character.id, character.name])), [characters])
  const companion = useMemo(
    () => characters.find((character) => character.kind === 'companion') || characters.find((character) => character.name === '小满') || null,
    [characters],
  )
  const companionThreads = useMemo(
    () => threads.filter((thread) => thread.participants.some((participant) => participant.character_id === companion?.id)),
    [threads, companion],
  )
  const recommended = useMemo(() => {
    const rank = (character: BasicCharacter) => {
      if (character.id === companion?.id) return 0
      if (character.role.includes('主角')) return 1
      if (character.role.includes('重要')) return 2
      if (character.role.includes('反派')) return 4
      return 3
    }
    return [...characters].sort((a, b) => rank(a) - rank(b)).slice(0, 3)
  }, [characters, companion])

  const filters: Array<{ key: FilterKey; label: string; count: number }> = [
    { key: 'all', label: copy.all, count: characters.length },
    { key: 'lead', label: copy.lead, count: characters.filter((character) => character.role.includes('主角') && !character.role.includes('重要')).length },
    { key: 'important', label: copy.important, count: characters.filter((character) => character.role.includes('重要')).length },
    { key: 'support', label: copy.support, count: characters.filter((character) => character.role.includes('配角') && !character.role.includes('重要')).length },
    { key: 'villain', label: copy.villain, count: characters.filter((character) => character.role.includes('反派')).length },
    { key: 'companion', label: copy.companion, count: characters.filter((character) => character.kind === 'companion').length },
  ]

  const roster = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return characters.filter((character) => {
      const inFilter =
        filter === 'all' ||
        (filter === 'lead' && character.role.includes('主角') && !character.role.includes('重要')) ||
        (filter === 'important' && character.role.includes('重要')) ||
        (filter === 'support' && character.role.includes('配角') && !character.role.includes('重要')) ||
        (filter === 'villain' && character.role.includes('反派')) ||
        (filter === 'companion' && character.kind === 'companion')
      const inSearch = !needle || `${character.name} ${character.role} ${character.identity} ${character.worldName} ${character.intro}`.toLowerCase().includes(needle)
      return inFilter && inSearch
    })
  }, [characters, filter, query])

  const recentThreads = useMemo(
    () => threads.filter((thread) => (thread.message_count || 0) > 0).slice(0, 4),
    [threads],
  )
  const groupThread = useMemo(() => threads.find((thread) => thread.kind === 'group') || null, [threads])
  const characterRelations = relationshipsOnly(relations)
  const relationPreview = characterRelations.slice(0, 3)
  const relationshipTotal = relations.length

  return (
    <div className="ct-content ai-content">
      <section className="ct-hero">
        <div className="ct-hero-copy">
          <div className="ct-eyebrow">{copy.eyebrow}</div>
          <h1>{copy.title}</h1>
          <p>{copy.subtitle}</p>
        </div>
        <div className="ct-hero-actions">
          <div className="ct-stats">
            <div><strong>{loaded ? characters.length : '—'}</strong><span>{copy.characters}</span></div>
            <div><strong>{loaded ? threads.length : '—'}</strong><span>{copy.sessions}</span></div>
            <div><strong>{loaded ? memories.length : '—'}</strong><span>{copy.memories}</span></div>
            <div><strong>{loaded ? relationshipTotal : '—'}</strong><span>{copy.relations}</span></div>
          </div>
          <button type="button" className="ct-primary" onClick={() => onOpenChat(recommended[0]?.worldId || companion?.worldId || '', recommended[0]?.id || companion?.id)}>
            <MessageCircle aria-hidden="true" strokeWidth={1.7} />
            {copy.startChat}
          </button>
        </div>
      </section>

      <div className="ct-top-grid ai-top-grid">
        <section className="ct-section ai-recommend">
          <div className="ct-section-head">
            <div>
              <span className="ct-kicker">{copy.recommendedKicker}</span>
              <h2>{copy.recommended}</h2>
            </div>
            <Sparkles aria-hidden="true" strokeWidth={1.5} />
          </div>
          {!loaded ? (
            <div className="ct-loading">{lang === 'zh' ? '正在读取角色…' : 'Loading characters…'}</div>
          ) : recommended.length === 0 ? (
            <div className="ct-empty"><UserRound aria-hidden="true" strokeWidth={1.4} /><strong>{copy.noCharacters}</strong></div>
          ) : (
            <div className="ai-reco-grid">
              {recommended.map((character) => (
                <article className="ai-char-card" key={character.id}>
                  <div className="ai-char-top">
                    <span className={`ct-avatar${character.kind === 'companion' ? ' companion' : ''}`}>{initialOf(character.name)}</span>
                    <div>
                      <span className="ai-char-role">{character.role}</span>
                      <h3>{character.name}</h3>
                      <p>{character.worldName || copy.globalAI}</p>
                    </div>
                  </div>
                  <p className="ai-char-intro">{excerpt(character.intro, 110) || copy.companionHint}</p>
                  <div className="ai-char-foot">
                    <button type="button" onClick={() => onOpenChat(character.worldId, character.id)}>{copy.chat} <ArrowUpRight aria-hidden="true" strokeWidth={1.8} /></button>
                    <button type="button" className="muted" onClick={onOpenCharacters}>{copy.profile}</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="ct-section ai-companion">
          <div className="ct-section-head light">
            <div>
              <span className="ct-kicker">{copy.companionKicker}</span>
              <h2>{copy.companionTitle}</h2>
            </div>
            <HeartHandshake aria-hidden="true" strokeWidth={1.5} />
          </div>
          {companion ? (
            <>
              <div className="ai-companion-profile">
                <span className="ai-companion-avatar">{initialOf(companion.name)}</span>
                <div>
                  <strong>{companion.name}</strong>
                  <span>{companion.identity || copy.companionFallback}</span>
                </div>
              </div>
              <p className="ai-companion-hint">{excerpt(companion.intro, 110) || copy.companionHint}</p>
              <div className="ai-companion-meta">
                <span>{companionThreads.length} {copy.sessions}</span>
                <span>{memories.filter((memory) => memory.character_id === companion.id).length} {copy.memories}</span>
              </div>
              <button type="button" className="ai-companion-primary" onClick={() => onOpenChat(companion.worldId, companion.id)}>
                {copy.continueChat} <ArrowUpRight aria-hidden="true" strokeWidth={1.8} />
              </button>
            </>
          ) : (
            <div className="ct-empty light"><Bot aria-hidden="true" strokeWidth={1.4} /><strong>{copy.companionFallback}</strong></div>
          )}
        </section>
      </div>

      <div className="ct-two-grid ai-session-grid">
        <section className="ct-section">
          <div className="ct-section-head">
            <div>
              <span className="ct-kicker">{copy.recentKicker}</span>
              <h2>{copy.recent}</h2>
            </div>
            <MessageCircle aria-hidden="true" strokeWidth={1.5} />
          </div>
          {recentThreads.length === 0 ? (
            <div className="ct-empty"><MessageCircle aria-hidden="true" strokeWidth={1.4} /><strong>{copy.noSessions}</strong><p>{copy.noSessionsHint}</p></div>
          ) : (
            <div className="ai-session-list">
              {recentThreads.map((thread) => (
                <button type="button" className="ai-session-row" key={thread.id} onClick={() => onOpenChat(thread.world_id)}>
                  <span className={`ai-session-icon${thread.kind === 'group' ? ' group' : ''}`}>
                    {thread.kind === 'group' ? <Users aria-hidden="true" strokeWidth={1.5} /> : <MessageCircle aria-hidden="true" strokeWidth={1.5} />}
                  </span>
                  <span className="ai-session-copy">
                    <span className="ai-session-title">
                      <strong>{thread.title}</strong>
                      <small>{thread.kind === 'group' ? copy.group : copy.chat}</small>
                    </span>
                    <span>{thread.participants.map((participant) => participant.character_name).join(' · ') || '—'}</span>
                    <p>{excerpt(thread.last_message?.content || thread.summary, 82) || copy.noSessionsHint}</p>
                  </span>
                  <span className="ai-session-meta">
                    <small>{formatDate(thread.last_message_at, lang)}</small>
                    <span>{thread.message_count || 0} {copy.messages}</span>
                  </span>
                  <ArrowUpRight aria-hidden="true" strokeWidth={1.8} />
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="ct-section ai-group">
          <div className="ct-section-head">
            <div>
              <span className="ct-kicker">{copy.groupKicker}</span>
              <h2>{copy.group}</h2>
            </div>
            <MessagesSquare aria-hidden="true" strokeWidth={1.5} />
          </div>
          {groupThread ? (
            <article className="ai-group-card">
              <div className="ai-group-title">
                <span className="ai-group-mark"><MessagesSquare aria-hidden="true" strokeWidth={1.5} /></span>
                <div>
                  <strong>{groupThread.title}</strong>
                  <span>{groupThread.message_count || 0} {copy.messages}</span>
                </div>
              </div>
              <div className="ai-group-participants">
                <small>{copy.participants}</small>
                <div>
                  {groupThread.participants.map((participant) => (
                    <span key={participant.id}>{participant.character_name}</span>
                  ))}
                </div>
              </div>
              <p>{excerpt(groupThread.last_message?.content || groupThread.summary, 100) || copy.group}</p>
              <button type="button" className="ct-ghost" onClick={() => onOpenChat(groupThread.world_id)}>
                {copy.openGroup} <ArrowUpRight aria-hidden="true" strokeWidth={1.8} />
              </button>
            </article>
          ) : (
            <div className="ct-empty"><MessagesSquare aria-hidden="true" strokeWidth={1.4} /><strong>{copy.noGroup}</strong><p>{copy.noGroupHint}</p></div>
          )}
        </section>
      </div>

      <section className="ct-section ai-roster">
        <div className="ct-section-head">
          <div>
            <span className="ct-kicker">{copy.rosterKicker}</span>
            <h2>{copy.myCharacters}</h2>
          </div>
          <button type="button" className="ct-section-link" onClick={onOpenCharacters}>
            {copy.createCharacter} <Plus aria-hidden="true" strokeWidth={1.8} />
          </button>
        </div>
        <div className="ct-toolbar ai-toolbar">
          <div className="ct-search">
            <Search aria-hidden="true" strokeWidth={1.7} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.search} aria-label={copy.search} />
            {query && <button type="button" onClick={() => setQuery('')} aria-label="clear"><X aria-hidden="true" strokeWidth={1.8} /></button>}
          </div>
          <div className="ct-filters">
            {filters.map((item) => (
              <button type="button" key={item.key} className={`ct-filter${filter === item.key ? ' active' : ''}`} onClick={() => setFilter(item.key)}>
                {item.label}<span>{item.count}</span>
              </button>
            ))}
          </div>
          <div className="ct-toolbar-meta">{roster.length} {copy.resultUnit}</div>
        </div>
        {!loaded ? (
          <div className="ct-loading">{lang === 'zh' ? '正在读取角色…' : 'Loading characters…'}</div>
        ) : roster.length === 0 ? (
          <div className="ct-empty large"><UserRound aria-hidden="true" strokeWidth={1.4} /><strong>{copy.noCharacters}</strong><p>{copy.noCharactersHint}</p></div>
        ) : (
          <div className="ai-roster-grid">
            {roster.map((character) => (
              <button type="button" className="ai-roster-card" key={character.id} onClick={() => onOpenChat(character.worldId, character.id)}>
                <span className={`ct-avatar small${character.kind === 'companion' ? ' companion' : ''}`}>{initialOf(character.name)}</span>
                <span className="ai-roster-copy">
                  <strong>{character.name}</strong>
                  <span>{character.role}{character.worldName ? ` · ${character.worldName}` : ''}</span>
                  <p>{excerpt(character.intro, 84) || character.identity || '—'}</p>
                </span>
                <ArrowUpRight aria-hidden="true" strokeWidth={1.8} />
              </button>
            ))}
          </div>
        )}
      </section>

      <div className="ct-three-grid ai-lower-grid">
        <section className="ct-section">
          <div className="ct-section-head">
            <div>
              <span className="ct-kicker">{copy.relationsKicker}</span>
              <h2>{copy.relationsTitle}</h2>
            </div>
            <HeartHandshake aria-hidden="true" strokeWidth={1.5} />
          </div>
          <div className="ai-stat-pair">
            <div><strong>{relationshipTotal}</strong><span>{copy.personRelations}</span></div>
            <div><strong>{eventCount}</strong><span>{copy.interactionEvents}</span></div>
          </div>
          {relationPreview.length === 0 ? (
            <div className="ct-inline-empty">{copy.noRelations}</div>
          ) : (
            <div className="ai-relation-list">
              {relationPreview.map((relation) => (
                <div className="ai-relation-row" key={relation.id}>
                  <span>{names.get(relation.source_id) || '角色'} <i>→</i> {names.get(relation.target_id) || '角色'}</span>
                  <strong>{relation.relation_type}</strong>
                  <p>{excerpt(relation.description, 54) || '—'}</p>
                </div>
              ))}
            </div>
          )}
          <div className="ai-card-actions">
            <button type="button" onClick={onOpenRelationships}>{copy.viewRelations} <ArrowUpRight aria-hidden="true" strokeWidth={1.8} /></button>
            <button type="button" onClick={onOpenEvents}>{copy.viewEvents} <ArrowUpRight aria-hidden="true" strokeWidth={1.8} /></button>
          </div>
        </section>

        <section className="ct-section">
          <div className="ct-section-head">
            <div>
              <span className="ct-kicker">{copy.memoryKicker}</span>
              <h2>{copy.memoryTitle}</h2>
            </div>
            <Brain aria-hidden="true" strokeWidth={1.5} />
          </div>
          {memories.length === 0 ? (
            <div className="ct-inline-empty">{copy.noMemories}</div>
          ) : (
            <div className="ai-memory-list">
              {memories.slice(0, 3).map((memory) => (
                <div className="ai-memory-row" key={memory.id}>
                  <span className="ai-memory-head">
                    <strong>{memory.character_name}</strong>
                    <small>{memory.scope || 'long-term'} · {copy.importance} {Math.round((memory.importance || 0) * 100)}%</small>
                  </span>
                  <p>{excerpt(memory.content, 92)}</p>
                </div>
              ))}
            </div>
          )}
          <div className="ai-card-actions">
            <button type="button" onClick={onOpenMemories}>{copy.viewMemories} <ArrowUpRight aria-hidden="true" strokeWidth={1.8} /></button>
            <span className="ai-total">{memories.length} {copy.memories}</span>
          </div>
        </section>

        <section className="ct-section ai-actions-card">
          <div className="ct-section-head">
            <div>
              <span className="ct-kicker">{copy.actionsKicker}</span>
              <h2>{copy.actionsTitle}</h2>
            </div>
            <ShieldCheck aria-hidden="true" strokeWidth={1.5} />
          </div>
          <div className="ai-roleplay">
            <span className="ai-action-mark"><Sparkles aria-hidden="true" strokeWidth={1.5} /></span>
            <strong>{copy.roleplayTitle}</strong>
            <p>{copy.roleplayDesc}</p>
            <button type="button" onClick={onOpenSimulation}>{copy.enterSimulation} <ArrowUpRight aria-hidden="true" strokeWidth={1.8} /></button>
          </div>
          <div className="ai-publish">
            <div><strong>{copy.publishAuth}</strong><span>{copy.noPublish}</span></div>
            <p>{copy.publishAuthHint}</p>
          </div>
          <button type="button" className="ct-ghost ai-create" onClick={onOpenCharacters}>
            <Plus aria-hidden="true" strokeWidth={1.8} /> {copy.createCharacter}
          </button>
        </section>
      </div>

      <div className="ct-note">{copy.note} · {user?.display_name || (lang === 'zh' ? '本地创作者' : 'Local creator')}</div>
    </div>
  )
}

function relationshipsOnly(rows: RelationRow[]) {
  return rows.filter((row) => {
    const sourceType = row.source_type || 'character'
    const targetType = row.target_type || 'character'
    return sourceType === 'character' && targetType === 'character'
  })
}
