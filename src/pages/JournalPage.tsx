import { useEffect, useMemo, useState } from 'react'
import * as journal from '../api/journal'
import * as grants from '../api/aiGrants'
import { listMyPublications, publishBiography, publishEntry, withdrawPublication, type AuthorPublication } from '../api/community'
import { getYunbao } from '../api/yunbao'
import { listInformationSources, type InformationSource } from '../api/informationSources'

type Tab = 'entries' | 'people' | 'biographies' | 'grants' | 'published'

const today = () => new Date().toISOString().slice(0, 10)

const fieldStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 8,
  border: '1px solid var(--card-border)', background: 'transparent',
  color: 'var(--text-main)', fontSize: 12, boxSizing: 'border-box',
}
const buttonStyle: React.CSSProperties = {
  padding: '7px 12px', borderRadius: 8, border: '1px solid var(--card-border)',
  background: 'transparent', color: 'var(--text-main)', cursor: 'pointer', fontSize: 12,
}
const primaryStyle: React.CSSProperties = {
  ...buttonStyle, background: 'var(--text-main)', color: 'var(--bg-color)',
}

function emptyDraft() {
  return {
    entry_date: today(), title: '', content: '', mood: '', tags: '',
    entry_type: 'diary', info_class: 'basic', sensitivity: 'normal', person_ids: [] as string[],
  }
}

export default function JournalPage({
  product = 'diary', worldId = '', onOpenSources,
}: { product?: string; worldId?: string; onOpenSources?: () => void }) {
  const [tab, setTab] = useState<Tab>('entries')
  const [presets, setPresets] = useState<journal.JournalPresets | null>(null)
  const [entries, setEntries] = useState<journal.JournalEntry[]>([])
  const [people, setPeople] = useState<journal.JournalPerson[]>([])
  const [sources, setSources] = useState<InformationSource[]>([])
  const [citations, setCitations] = useState<journal.JournalCitation[]>([])
  const [citationSourceId, setCitationSourceId] = useState('')
  const [bios, setBios] = useState<journal.UserBiography[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [draft, setDraft] = useState(emptyDraft)
  const [filterType, setFilterType] = useState('')
  const [busy, setBusy] = useState(false)
  const [log, setLog] = useState('')

  const [personName, setPersonName] = useState('')
  const [personRelation, setPersonRelation] = useState('')
  const [personSummary, setPersonSummary] = useState('')
  const [relations, setRelations] = useState<journal.JournalRelation[]>([])
  const [relationA, setRelationA] = useState('')
  const [relationB, setRelationB] = useState('')
  const [relationType, setRelationType] = useState('朋友')

  const [bioTitle, setBioTitle] = useState('')
  const [selectedBioId, setSelectedBioId] = useState('')
  const [chapterTitle, setChapterTitle] = useState('')
  const [chapterContent, setChapterContent] = useState('')
  const [fromEntryId, setFromEntryId] = useState('')

  const [instanceId, setInstanceId] = useState('')
  const [grantRows, setGrantRows] = useState<grants.AiGrant[]>([])
  const [accessLogs, setAccessLogs] = useState<grants.AiAccessLog[]>([])
  const [publications, setPublications] = useState<AuthorPublication[]>([])
  const [grantLevel, setGrantLevel] = useState(2)
  const [grantEntryId, setGrantEntryId] = useState('')
  const [grantMemory, setGrantMemory] = useState(false)
  const [grantPurposes, setGrantPurposes] = useState<string[]>(['chat_context'])

  const selectedEntry = entries.find((item) => item.id === selectedId)
  const selectedBio = bios.find((item) => item.id === selectedBioId)
  const allTags = useMemo(() => draft.tags.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean), [draft.tags])

  const loadEntries = async () => {
    try {
      setEntries(await journal.listJournalEntries({
        product, entry_type: filterType || undefined, world_id: worldId || undefined,
      }))
    } catch (error: any) { setLog(`❌ ${error.message || error}`) }
  }
  const loadPeople = async () => {
    try {
      setPeople(await journal.listJournalPeople())
      setRelations(await journal.listJournalRelations())
    } catch (error: any) { setLog(`❌ ${error.message || error}`) }
  }
  const loadBios = async () => {
    try {
      const rows = await journal.listUserBiographies()
      setBios(rows)
      if (!selectedBioId && rows[0]) setSelectedBioId(rows[0].id)
    } catch (error: any) { setLog(`❌ ${error.message || error}`) }
  }
  const loadGrants = async () => {
    try {
      const profile = await getYunbao()
      const id = profile.instance_id || ''
      setInstanceId(id)
      if (id) {
        setGrantRows(await grants.listGrants(id))
        setAccessLogs(await grants.grantAccessLogs())
      }
    } catch (error: any) { setLog(`❌ ${error.message || error}`) }
  }

  useEffect(() => { void journal.getJournalPresets().then(setPresets).catch(() => undefined) }, [])
  useEffect(() => { void loadEntries() }, [filterType, product, worldId])
  useEffect(() => { void loadPeople() }, [])
  useEffect(() => { void loadBios() }, [])
  useEffect(() => { void listInformationSources({ product }).then(setSources).catch(() => undefined) }, [product])
  useEffect(() => {
    if (!selectedId) { setCitations([]); return }
    void journal.listJournalCitations('journal_entry', selectedId).then(setCitations).catch(() => setCitations([]))
  }, [selectedId])
  useEffect(() => { if (tab === 'grants') void loadGrants() }, [tab])
  useEffect(() => { if (tab === 'published') void listMyPublications().then(setPublications).catch((error) => setLog(`❌ ${error.message || error}`)) }, [tab])

  const startNew = () => {
    setSelectedId('')
    setDraft(emptyDraft())
    setLog('')
  }

  const startEdit = (entry: journal.JournalEntry) => {
    setSelectedId(entry.id)
    setDraft({
      entry_date: entry.entry_date, title: entry.title, content: entry.content,
      mood: entry.mood, tags: (entry.tags || []).join(', '),
      entry_type: entry.entry_type, info_class: entry.info_class,
      sensitivity: entry.sensitivity, person_ids: entry.person_ids || [],
    })
    setLog('')
  }

  const saveEntry = async () => {
    if (!draft.content.trim()) return
    setBusy(true)
    try {
      const payload = {
        ...draft, tags: allTags, world_id: worldId || undefined,
      }
      if (selectedId) await journal.updateJournalEntry(selectedId, payload)
      else await journal.createJournalEntry({ ...payload, source_type: 'self_memory', product_key: product })
      setLog('已保存')
      await loadEntries()
    } catch (error: any) { setLog(`❌ ${error.message || error}`) }
    finally { setBusy(false) }
  }

  const removeEntry = async () => {
    if (!selectedId || !window.confirm('删除这篇记录？')) return
    setBusy(true)
    try {
      await journal.deleteJournalEntry(selectedId)
      setSelectedId(''); setDraft(emptyDraft()); setLog('已删除'); await loadEntries()
    } catch (error: any) { setLog(`❌ ${error.message || error}`) }
    finally { setBusy(false) }
  }

  const publishSelectedEntry = async () => {
    if (!selectedId) return
    const title = window.prompt('公开标题', draft.title || '一段经历')
    if (!title) return
    try {
      const row = await publishEntry([selectedId], { title, summary: '', anonymous: true })
      setLog(`已发布到社区：${row.title}`)
    } catch (error: any) { setLog(`❌ ${error.message || error}`) }
  }

  const addPerson = async () => {
    if (!personName.trim()) return
    try {
      await journal.createJournalPerson({ name: personName, relation_label: personRelation, summary: personSummary })
      setPersonName(''); setPersonRelation(''); setPersonSummary(''); setLog('人物已保存')
      await loadPeople()
    } catch (error: any) { setLog(`❌ ${error.message || error}`) }
  }

  const removePerson = async (id: string) => {
    if (!window.confirm('删除这个个人人物？')) return
    try { await journal.deleteJournalPerson(id); await loadPeople() }
    catch (error: any) { setLog(`❌ ${error.message || error}`) }
  }

  const addBio = async () => {
    if (!bioTitle.trim()) return
    try {
      const row = await journal.createUserBiography({ title: bioTitle })
      setBioTitle(''); setSelectedBioId(row.id); setLog('传记已创建'); await loadBios()
    } catch (error: any) { setLog(`❌ ${error.message || error}`) }
  }

  const addChapter = async () => {
    if (!selectedBioId || !chapterTitle.trim()) return
    try {
      await journal.createBiographyChapter(selectedBioId, { title: chapterTitle, content: chapterContent })
      setChapterTitle(''); setChapterContent(''); setLog('章节已保存'); await loadBios()
    } catch (error: any) { setLog(`❌ ${error.message || error}`) }
  }

  const chapterFromEntry = async () => {
    if (!selectedBioId || !fromEntryId) return
    try {
      await journal.createBiographyChapterFromEntries(selectedBioId, [fromEntryId], '由日记生成的章节')
      setFromEntryId(''); setLog('章节已从日记生成'); await loadBios()
    } catch (error: any) { setLog(`❌ ${error.message || error}`) }
  }

  const publishSelectedBio = async () => {
    if (!selectedBioId || !selectedBio) return
    const title = window.prompt('公开标题', selectedBio.title)
    if (!title) return
    try {
      const row = await publishBiography(selectedBioId, { title, summary: selectedBio.summary, anonymous: true })
      setLog(`传记已发布：${row.title}`)
    } catch (error: any) { setLog(`❌ ${error.message || error}`) }
  }

  const createGrant = async () => {
    if (!instanceId || !grantEntryId) { setLog('❌ 请选择云宝实例和一条日记'); return }
    try {
      await grants.createGrant({
        instance_id: instanceId, access_level: grantLevel,
        allowed_purposes: grantPurposes, allow_memory: grantMemory,
        redaction: 'none',
        scopes: [{ scope_type: 'entry', scope_id: grantEntryId, scope_label: draft.title || '指定日记' }],
      })
      setLog('授权已创建'); await loadGrants()
    } catch (error: any) { setLog(`❌ ${error.message || error}`) }
  }

  const revoke = async (id: string) => {
    if (!window.confirm('撤销授权会立即失效派生记忆，确定？')) return
    try { const row = await grants.revokeGrant(id); setLog(`已撤销，失效记忆 ${row.memory_ids.length} 条`); await loadGrants() }
    catch (error: any) { setLog(`❌ ${error.message || error}`) }
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: 1180, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 23, color: 'var(--text-main)' }}>Journal 个人内容</h1>
          <p style={{ margin: '5px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
            私人日记、个人人物与用户传记。公开、AI 授权、私人内容三种权限互相独立。
          </p>
        </div>
        <div style={{ flex: 1 }} />
        <button style={buttonStyle} onClick={onOpenSources}>信息来源</button>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {([['entries', '日记与经历'], ['people', '个人人物'], ['biographies', '我的传记'], ['grants', 'AI 授权'], ['published', '我的发布']] as Array<[Tab, string]>).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            ...buttonStyle, borderColor: tab === key ? 'var(--primary-color)' : 'var(--card-border)',
            color: tab === key ? 'var(--primary-color)' : 'var(--text-main)',
          }}>{label}</button>
        ))}
      </div>

      {tab === 'entries' && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div className="glass-card" style={{ width: 320, padding: 10, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 'calc(100vh - 230px)', overflowY: 'auto' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ ...fieldStyle, flex: 1 }}>
                <option value="">全部类型</option>
                {(presets?.entry_types || []).map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
              </select>
              <button style={buttonStyle} onClick={startNew}>+ 新建</button>
            </div>
            {entries.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: 12 }}>还没有记录。日记不需要先创建世界。</div>}
            {entries.map((entry) => (
              <button key={entry.id} onClick={() => startEdit(entry)} style={{
                textAlign: 'left', padding: 9, borderRadius: 8, cursor: 'pointer',
                border: `1px solid ${entry.id === selectedId ? 'var(--primary-color)' : 'var(--card-border)'}`,
                background: entry.id === selectedId ? 'rgba(128,128,128,0.1)' : 'transparent',
                color: 'var(--text-main)', display: 'flex', flexDirection: 'column', gap: 4,
              }}>
                <span style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                  <strong style={{ fontSize: 12 }}>{entry.title || '无题'}</strong>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{entry.entry_date}</span>
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.content}</span>
                <span style={{ fontSize: 9, color: 'var(--primary-color)' }}>{entry.entry_type_label} · {entry.sensitivity}</span>
              </button>
            ))}
          </div>

          <div className="glass-card" style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 320 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="date" value={draft.entry_date} onChange={(e) => setDraft({ ...draft, entry_date: e.target.value })} style={{ ...fieldStyle, width: 150 }} />
              <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="标题（可选）" style={{ ...fieldStyle, flex: 1 }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={draft.entry_type} onChange={(e) => setDraft({ ...draft, entry_type: e.target.value })} style={fieldStyle}>
                {(presets?.entry_types || []).map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
              </select>
              <select value={draft.info_class} onChange={(e) => setDraft({ ...draft, info_class: e.target.value })} style={fieldStyle}>
                {(presets?.info_classes || []).map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
              </select>
              <select value={draft.sensitivity} onChange={(e) => setDraft({ ...draft, sensitivity: e.target.value })} style={fieldStyle}>
                {(presets?.sensitivities || []).map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={draft.mood} onChange={(e) => setDraft({ ...draft, mood: e.target.value })} placeholder="心情（可选）" style={{ ...fieldStyle, flex: 1 }} />
              <input value={draft.tags} onChange={(e) => setDraft({ ...draft, tags: e.target.value })} placeholder="标签，逗号分隔" style={{ ...fieldStyle, flex: 2 }} />
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>关联人物：</span>
              {people.length === 0 && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>先在「个人人物」中创建</span>}
              {people.map((person) => (
                <label key={person.id} style={{ fontSize: 11, color: 'var(--text-main)', display: 'flex', gap: 3, alignItems: 'center' }}>
                  <input type="checkbox" checked={draft.person_ids.includes(person.id)} onChange={(e) => {
                    setDraft({
                      ...draft,
                      person_ids: e.target.checked
                        ? [...draft.person_ids, person.id]
                        : draft.person_ids.filter((id) => id !== person.id),
                    })
                  }} />
                  {person.name}
                </label>
              ))}
            </div>
            <textarea value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} placeholder="记录这一天、这段经历或这个想法…"
              style={{ ...fieldStyle, minHeight: 220, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.7 }} />
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              <button style={primaryStyle} disabled={busy || !draft.content.trim()} onClick={() => void saveEntry()}>保存</button>
              <button style={buttonStyle} onClick={startNew}>清空</button>
              {selectedId && <button style={buttonStyle} onClick={() => void publishSelectedEntry()}>发布到社区</button>}
              {selectedId && <button style={{ ...buttonStyle, color: 'var(--danger-color)' }} disabled={busy} onClick={() => void removeEntry()}>删除</button>}
              <div style={{ flex: 1 }} />
              {selectedEntry && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{selectedEntry.entry_type_label} · {selectedEntry.source_type}</span>}
            </div>
            {selectedId && (
              <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>引用来源：{citations.length === 0 ? '暂无' : citations.map((item) => item.source_title || item.source_id).join('、')}</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <select value={citationSourceId} onChange={(e) => setCitationSourceId(e.target.value)} style={{ ...fieldStyle, flex: 1 }}>
                    <option value="">选择信息来源…</option>
                    {sources.map((source) => <option key={source.id} value={source.id}>{source.title || source.source_type_label}</option>)}
                  </select>
                  <button style={buttonStyle} onClick={() => {
                    if (!citationSourceId || !selectedId) return
                    void journal.createJournalCitation({ target_type: 'journal_entry', target_id: selectedId, source_id: citationSourceId })
                      .then(() => journal.listJournalCitations('journal_entry', selectedId))
                      .then(setCitations).then(() => setCitationSourceId(''))
                      .catch((error) => setLog(`❌ ${error.message || error}`))
                  }}>添加引用</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'people' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 320px) 1fr', gap: 12 }}>
          <div className="glass-card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <strong style={{ fontSize: 13 }}>新增个人人物</strong>
            <input value={personName} onChange={(e) => setPersonName(e.target.value)} placeholder="姓名/称呼" style={fieldStyle} />
            <input value={personRelation} onChange={(e) => setPersonRelation(e.target.value)} placeholder="与我的关系，如朋友/家人" style={fieldStyle} />
            <textarea value={personSummary} onChange={(e) => setPersonSummary(e.target.value)} placeholder="备注" style={{ ...fieldStyle, minHeight: 90 }} />
            <button style={primaryStyle} onClick={() => void addPerson()}>保存人物</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {people.length >= 2 && (
              <div className="glass-card" style={{ padding: 12, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <select value={relationA} onChange={(e) => setRelationA(e.target.value)} style={{ ...fieldStyle, flex: 1 }}>
                  <option value="">人物 A</option>
                  {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
                </select>
                <select value={relationType} onChange={(e) => setRelationType(e.target.value)} style={{ ...fieldStyle, width: 100 }}>
                  {['朋友', '家人', '同事', '伴侣', '同学', '其他'].map((label) => <option key={label} value={label}>{label}</option>)}
                </select>
                <select value={relationB} onChange={(e) => setRelationB(e.target.value)} style={{ ...fieldStyle, flex: 1 }}>
                  <option value="">人物 B</option>
                  {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
                </select>
                <button style={buttonStyle} onClick={() => {
                  if (!relationA || !relationB || relationA === relationB) return
                  void journal.createJournalRelation({ person_id: relationA, related_person_id: relationB, relation_type: relationType })
                    .then(() => loadPeople()).then(() => { setRelationA(''); setRelationB('') })
                    .catch((error) => setLog(`❌ ${error.message || error}`))
                }}>建立关系</button>
              </div>
            )}
            {relations.map((relation) => (
              <div key={relation.id} className="glass-card" style={{ padding: 10, fontSize: 12, display: 'flex', gap: 8 }}>
                <span style={{ flex: 1 }}>{people.find((p) => p.id === relation.person_id)?.name || relation.person_id} — {relation.relation_type} — {people.find((p) => p.id === relation.related_person_id)?.name || relation.related_person_id}</span>
                <button style={{ ...buttonStyle, color: 'var(--danger-color)' }} onClick={() => void journal.deleteJournalRelation(relation.id).then(loadPeople)}>删除</button>
              </div>
            ))}
            {people.length === 0 && <div className="glass-card" style={{ padding: 18, fontSize: 12, color: 'var(--text-muted)' }}>还没有个人人物。他们只属于你，不是世界角色。</div>}
            {people.map((person) => (
              <div key={person.id} className="glass-card" style={{ padding: 12, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: 13 }}>{person.name}</strong>
                  <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--primary-color)' }}>{person.relation_label}</span>
                  <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>{person.summary || '暂无备注'}</p>
                </div>
                <button style={{ ...buttonStyle, color: 'var(--danger-color)' }} onClick={() => void removePerson(person.id)}>删除</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'biographies' && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div className="glass-card" style={{ width: 300, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input value={bioTitle} onChange={(e) => setBioTitle(e.target.value)} placeholder="新传记标题" style={fieldStyle} />
            <button style={primaryStyle} onClick={() => void addBio()}>创建传记</button>
            {bios.map((bio) => (
              <button key={bio.id} onClick={() => setSelectedBioId(bio.id)} style={{
                ...buttonStyle, textAlign: 'left',
                borderColor: selectedBioId === bio.id ? 'var(--primary-color)' : 'var(--card-border)',
              }}>
                {bio.title} · {bio.chapter_count} 章
              </button>
            ))}
          </div>
          <div className="glass-card" style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {!selectedBio ? <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>创建或选择一本用户传记。它不是世界人物传记。</div> : (
              <>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <h2 style={{ margin: 0, fontSize: 18 }}>{selectedBio.title}</h2>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{selectedBio.status}</span>
                  <div style={{ flex: 1 }} />
                  <button style={buttonStyle} onClick={() => void publishSelectedBio()}>发布传记</button>
                </div>
                <div style={{ display: 'flex', gap: 7 }}>
                  <select value={fromEntryId} onChange={(e) => setFromEntryId(e.target.value)} style={{ ...fieldStyle, flex: 1 }}>
                    <option value="">选择一篇日记生成章节…</option>
                    {entries.map((entry) => <option key={entry.id} value={entry.id}>{entry.entry_date} · {entry.title || '无题'}</option>)}
                  </select>
                  <button style={buttonStyle} onClick={() => void chapterFromEntry()}>从日记生成</button>
                </div>
                <div style={{ display: 'flex', gap: 7 }}>
                  <input value={chapterTitle} onChange={(e) => setChapterTitle(e.target.value)} placeholder="章节标题" style={{ ...fieldStyle, flex: 1 }} />
                  <button style={buttonStyle} onClick={() => void addChapter()}>添加章节</button>
                </div>
                <textarea value={chapterContent} onChange={(e) => setChapterContent(e.target.value)} placeholder="章节正文（可选）" style={{ ...fieldStyle, minHeight: 90 }} />
                {selectedBio.chapters.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>还没有章节。</div>}
                {selectedBio.chapters.map((chapter) => (
                  <div key={chapter.id} style={{ borderTop: '1px solid var(--card-border)', paddingTop: 8 }}>
                    <strong style={{ fontSize: 13 }}>{chapter.order_index + 1}. {chapter.title}</strong>
                    <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'pre-wrap', maxHeight: 100, overflow: 'hidden' }}>{chapter.content}</p>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {tab === 'grants' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 360px) 1fr', gap: 12 }}>
          <div className="glass-card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <strong style={{ fontSize: 13 }}>给云宝授权</strong>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>实例：{instanceId || '未找到云宝实例'}</div>
            <select value={grantEntryId} onChange={(e) => setGrantEntryId(e.target.value)} style={fieldStyle}>
              <option value="">选择一条私人日记</option>
              {entries.map((entry) => <option key={entry.id} value={entry.id}>{entry.entry_date} · {entry.title || '无题'}</option>)}
            </select>
            <select value={grantLevel} onChange={(e) => setGrantLevel(Number(e.target.value))} style={fieldStyle}>
              {[1, 2, 3, 4].map((level) => <option key={level} value={level}>等级 {level} · {{ 1: '基础信息', 2: '指定经历', 3: '深度内容', 4: '持续读取' }[level]}</option>)}
            </select>
            <label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="checkbox" checked={grantPurposes.includes('chat_context')} onChange={(e) => setGrantPurposes(e.target.checked ? [...grantPurposes, 'chat_context'] : grantPurposes.filter((item) => item !== 'chat_context'))} />
              允许聊天上下文
            </label>
            <label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="checkbox" checked={grantMemory} onChange={(e) => setGrantMemory(e.target.checked)} />
              允许形成长期记忆
            </label>
            <button style={primaryStyle} onClick={() => void createGrant()}>确认授权</button>
            <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
              最近访问：{accessLogs.length === 0 ? '暂无' : `${accessLogs[0].action} · ${accessLogs[0].purpose}`}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {grantRows.length === 0 && <div className="glass-card" style={{ padding: 18, fontSize: 12, color: 'var(--text-muted)' }}>还没有 AI 授权。默认不开放任何私人内容。</div>}
            {grantRows.map((grant) => (
              <div key={grant.id} className="glass-card" style={{ padding: 12 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <strong style={{ fontSize: 13 }}>等级 {grant.access_level} · {grant.access_level_label}</strong>
                  <span style={{ fontSize: 11, color: 'var(--primary-color)' }}>{grant.status}</span>
                  <div style={{ flex: 1 }} />
                  {grant.status === 'active' && <button style={{ ...buttonStyle, color: 'var(--danger-color)' }} onClick={() => void revoke(grant.id)}>撤销</button>}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>
                  范围：{grant.scopes.map((scope) => scope.scope_label || scope.scope_id || scope.scope_key).join('、') || '未设置'} · 记忆：{grant.allow_memory ? '允许' : '禁止'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'published' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {publications.length === 0 && <div className="glass-card" style={{ padding: 18, fontSize: 12, color: 'var(--text-muted)' }}>还没有公开作品。发布只是公开快照，不会改动私人原稿。</div>}
          {publications.map((row) => (
            <div key={row.id} className="glass-card" style={{ padding: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <strong style={{ fontSize: 13 }}>{row.title}</strong>
                <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--primary-color)' }}>{row.status}</span>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{row.work_type} · {row.author_display} · 阅读 {row.view_count}</div>
              </div>
              {row.status === 'published' && <button style={{ ...buttonStyle, color: 'var(--danger-color)' }} onClick={() => void withdrawPublication(row.id).then(() => listMyPublications()).then(setPublications)}>撤回</button>}
            </div>
          ))}
        </div>
      )}

      {log && <div style={{ fontSize: 11, color: log.startsWith('❌') ? 'var(--danger-color)' : 'var(--text-muted)' }}>{log}</div>}
    </div>
  )
}
