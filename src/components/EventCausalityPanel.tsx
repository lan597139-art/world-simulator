import { useEffect, useState } from 'react'

const API = 'http://127.0.0.1:8000/api'

const RELATION_TYPES: { value: string; label: string }[] = [
  { value: 'causes', label: '直接导致' },
  { value: 'contributes_to', label: '促成' },
  { value: 'triggers', label: '触发' },
  { value: 'prevents', label: '阻止' },
  { value: 'enables', label: '使其成为可能' },
  { value: 'escalates', label: '加剧' },
  { value: 'follows', label: '时间上后续' },
  { value: 'correlates_with', label: '相关（因果未确认）' },
]

const PARTICIPANT_ROLES = ['发起者', '执行者', '决策者', '协助者', '见证者', '受益者', '反对者']
const IMPACT_TYPES = ['损失', '收益', '状态改变', '关系改变', '机会', '风险', '认知冲击']

/** 人物对事件的认知维度与事件客观维度分开保存（见开发2 §5.8） */
const PERCEIVED_POLARITY = ['威胁', '奖赏', '扩张', '稳定', '腐化']
const PERCEIVED_INTENSITY = ['低', '中', '高']

const emptyPerception = {
  characterId: '',
  perceived_content: '',
  perceived_polarity: '威胁',
  perceived_intensity: '中',
  attribution_target: '',
  certainty: '0.5',
  information_source: '',
  perceived_at: '',
}

interface Props {
  eventId: string
  worldId: string
  events: any[]
  characters: any[]
  organizations: any[]
  onChanged?: () => void
}

const chip = (active: boolean) => ({
  padding: '3px 9px',
  borderRadius: '999px',
  border: `1px solid ${active ? 'var(--text-main)' : 'var(--card-border)'}`,
  background: active ? 'var(--text-main)' : 'transparent',
  color: active ? 'var(--bg-color)' : 'var(--text-main)',
  fontSize: '11px',
  cursor: 'pointer',
})

const selectStyle = {
  padding: '6px 8px',
  borderRadius: '6px',
  border: '1px solid var(--card-border)',
  background: 'transparent',
  color: 'var(--text-main)',
  fontSize: '12px',
}

export default function EventCausalityPanel({
  eventId,
  worldId,
  events,
  characters,
  organizations,
  onChanged,
}: Props) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'participant' | 'impact' | 'causal' | 'perception'>('causal')
  const [participants, setParticipants] = useState<any[]>([])
  const [impacts, setImpacts] = useState<any[]>([])
  const [relations, setRelations] = useState<any[]>([])
  const [perceptions, setPerceptions] = useState<any[]>([])
  const [error, setError] = useState('')

  const [participantForm, setParticipantForm] = useState({ entityId: '', role: '发起者' })
  const [impactForm, setImpactForm] = useState({ entityId: '', type: '状态改变' })
  const [relationForm, setRelationForm] = useState({ target: '', type: 'causes', confidence: '0.8' })
  const [perceptionForm, setPerceptionForm] = useState({ ...emptyPerception })

  const load = async () => {
    try {
      const [p, i, r, pc] = await Promise.all([
        fetch(`${API}/events/${eventId}/participants`).then((res) => res.json()),
        fetch(`${API}/events/${eventId}/impacts`).then((res) => res.json()),
        fetch(`${API}/worlds/${worldId}/event-relations?event_id=${eventId}`).then((res) => res.json()),
        fetch(`${API}/events/${eventId}/perceptions`).then((res) => res.json()),
      ])
      setParticipants(p)
      setImpacts(i)
      setRelations(r)
      setPerceptions(Array.isArray(pc) ? pc : [])
    } catch (e: any) {
      setError(String(e.message || e))
    }
  }

  useEffect(() => {
    if (open) load()
  }, [open, eventId])

  const post = async (path: string, body: unknown) => {
    const res = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(typeof data.detail === 'string' ? data.detail : '保存失败')
    }
    return res.json()
  }

  const entityName = (type: string, id: string) => {
    if (type === 'character') return characters.find((c) => c.id === id)?.name || '未知人物'
    if (type === 'organization') return organizations.find((o) => o.id === id)?.name || '未知组织'
    return id
  }

  const nameOfEvent = (id: string) => events.find((e) => e.id === id)?.name || '未知事件'
  const outgoing = relations.filter((r) => r.source_event_id === eventId)
  const incoming = relations.filter((r) => r.target_event_id === eventId)

  /** attribution_target 存的是实体 ID 或自由文本，优先按人物/组织解析 */
  const attributionName = (value: string) => {
    if (!value) return '未归因'
    return (
      characters.find((c) => c.id === value)?.name ||
      organizations.find((o) => o.id === value)?.name ||
      value
    )
  }

  const characterName = (id: string) => characters.find((c) => c.id === id)?.name || '未知人物'

  const savePerception = async () => {
    if (!perceptionForm.characterId) {
      setError('请选择认知所属人物')
      return
    }
    try {
      await post(`/events/${eventId}/perceptions`, {
        character_id: perceptionForm.characterId,
        perceived_content: perceptionForm.perceived_content,
        perceived_polarity: perceptionForm.perceived_polarity,
        perceived_intensity: perceptionForm.perceived_intensity,
        attribution_target: perceptionForm.attribution_target || null,
        certainty: perceptionForm.certainty === '' ? null : Number(perceptionForm.certainty),
        information_source: perceptionForm.information_source,
        perceived_at: perceptionForm.perceived_at
          ? new Date(perceptionForm.perceived_at).toISOString()
          : undefined,
      })
      setPerceptionForm({ ...emptyPerception })
      setError('')
      await load()
      onChanged?.()
    } catch (e: any) {
      setError(String(e.message || e))
    }
  }

  const editPerception = (row: any) => {
    setPerceptionForm({
      characterId: row.character_id,
      perceived_content: row.perceived_content || '',
      perceived_polarity: row.perceived_polarity || '威胁',
      perceived_intensity: row.perceived_intensity || '中',
      attribution_target: row.attribution_target || '',
      certainty: row.certainty == null ? '' : String(row.certainty),
      information_source: row.information_source || '',
      perceived_at: row.perceived_at ? new Date(row.perceived_at).toISOString().slice(0, 16) : '',
    })
  }

  const removePerception = async (id: string) => {
    try {
      const res = await fetch(`${API}/perceptions/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(typeof data.detail === 'string' ? data.detail : '删除失败')
      }
      await load()
      onChanged?.()
    } catch (e: any) {
      setError(String(e.message || e))
    }
  }

  return (
    <div style={{ marginTop: '10px', borderTop: '1px dashed var(--card-border)', paddingTop: '10px' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{ background: 'transparent', border: 'none', color: 'var(--primary-color)', fontSize: '12px', cursor: 'pointer', padding: 0 }}
      >
        {open ? '▾ 收起关系与因果' : '▸ 展开关系与因果（参与方 / 影响 / 因果链 / 人物认知）'}
      </button>

      {open && (
        <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {error && <div style={{ fontSize: '12px', color: 'var(--danger-color)' }}>{error}</div>}

          <div style={{ display: 'flex', gap: '6px' }}>
            {[
              { key: 'causal', label: `因果 (${relations.length})` },
              { key: 'participant', label: `参与方 (${participants.length})` },
              { key: 'impact', label: `影响 (${impacts.length})` },
              { key: 'perception', label: `认知 (${perceptions.length})` },
            ].map((item) => (
              <button key={item.key} style={chip(tab === item.key)} onClick={() => setTab(item.key as any)}>
                {item.label}
              </button>
            ))}
          </div>

          {tab === 'causal' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
              {outgoing.map((r) => (
                <div key={r.id} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-muted)' }}>本事件</span>
                  <span style={{ padding: '1px 6px', border: '1px solid var(--card-border)', borderRadius: '4px' }}>
                    {r.relation_label}
                  </span>
                  <span>《{nameOfEvent(r.target_event_id)}》</span>
                  {r.confidence != null && (
                    <span style={{ color: 'var(--text-muted)' }}>置信 {Math.round(r.confidence * 100)}%</span>
                  )}
                </div>
              ))}
              {incoming.map((r) => (
                <div key={r.id} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span>《{nameOfEvent(r.source_event_id)}》</span>
                  <span style={{ padding: '1px 6px', border: '1px solid var(--card-border)', borderRadius: '4px' }}>
                    {r.relation_label}
                  </span>
                  <span style={{ color: 'var(--text-muted)' }}>本事件</span>
                </div>
              ))}
              {relations.length === 0 && <div style={{ color: 'var(--text-muted)' }}>暂无因果关联（允许未知原因）</div>}

              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', marginTop: '4px' }}>
                <select
                  style={selectStyle}
                  value={relationForm.target}
                  onChange={(e) => setRelationForm({ ...relationForm, target: e.target.value })}
                >
                  <option value="">选择结果事件</option>
                  {events
                    .filter((e) => e.id !== eventId)
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                </select>
                <select
                  style={selectStyle}
                  value={relationForm.type}
                  onChange={(e) => setRelationForm({ ...relationForm, type: e.target.value })}
                >
                  {RELATION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <input
                  style={{ ...selectStyle, width: '64px' }}
                  value={relationForm.confidence}
                  onChange={(e) => setRelationForm({ ...relationForm, confidence: e.target.value })}
                  title="置信度 0-1，可留空表示未知"
                />
                <button
                  style={chip(false)}
                  onClick={async () => {
                    if (!relationForm.target) return
                    try {
                      await post('/event-relations', {
                        world_id: worldId,
                        source_event_id: eventId,
                        target_event_id: relationForm.target,
                        relation_type: relationForm.type,
                        confidence: relationForm.confidence === '' ? null : Number(relationForm.confidence),
                      })
                      setRelationForm({ ...relationForm, target: '' })
                      await load()
                      onChanged?.()
                    } catch (e: any) {
                      setError(String(e.message || e))
                    }
                  }}
                >
                  + 添加因果
                </button>
              </div>
            </div>
          )}

          {tab === 'participant' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
              {participants.map((p) => (
                <div key={p.id} style={{ display: 'flex', gap: '8px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{p.participant_role || '参与者'}</span>
                  <span>{entityName(p.entity_type, p.entity_id)}</span>
                </div>
              ))}
              {participants.length === 0 && <div style={{ color: 'var(--text-muted)' }}>暂无参与者</div>}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <select
                  style={selectStyle}
                  value={participantForm.entityId}
                  onChange={(e) => setParticipantForm({ ...participantForm, entityId: e.target.value })}
                >
                  <option value="">选择人物</option>
                  {characters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <select
                  style={selectStyle}
                  value={participantForm.role}
                  onChange={(e) => setParticipantForm({ ...participantForm, role: e.target.value })}
                >
                  {PARTICIPANT_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
                <button
                  style={chip(false)}
                  onClick={async () => {
                    if (!participantForm.entityId) return
                    try {
                      await post(`/events/${eventId}/participants`, {
                        entity_type: 'character',
                        entity_id: participantForm.entityId,
                        participant_role: participantForm.role,
                      })
                      setParticipantForm({ ...participantForm, entityId: '' })
                      await load()
                    } catch (e: any) {
                      setError(String(e.message || e))
                    }
                  }}
                >
                  + 添加参与方
                </button>
              </div>
            </div>
          )}

          {tab === 'impact' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
              {impacts.map((p) => (
                <div key={p.id} style={{ display: 'flex', gap: '8px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{p.impact_type || '影响'}</span>
                  <span>{entityName(p.entity_type, p.entity_id)}</span>
                  {p.impact_level && <span style={{ color: 'var(--text-muted)' }}>强度 {p.impact_level}</span>}
                </div>
              ))}
              {impacts.length === 0 && <div style={{ color: 'var(--text-muted)' }}>暂无影响对象</div>}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <select
                  style={selectStyle}
                  value={impactForm.entityId}
                  onChange={(e) => setImpactForm({ ...impactForm, entityId: e.target.value })}
                >
                  <option value="">选择影响对象</option>
                  <optgroup label="人物">
                    {characters.map((c) => (
                      <option key={c.id} value={`character:${c.id}`}>
                        {c.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="组织">
                    {organizations.map((o) => (
                      <option key={o.id} value={`organization:${o.id}`}>
                        {o.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
                <select
                  style={selectStyle}
                  value={impactForm.type}
                  onChange={(e) => setImpactForm({ ...impactForm, type: e.target.value })}
                >
                  {IMPACT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                <button
                  style={chip(false)}
                  onClick={async () => {
                    if (!impactForm.entityId) return
                    const [entityType, entityId] = impactForm.entityId.split(':')
                    try {
                      await post(`/events/${eventId}/impacts`, {
                        entity_type: entityType,
                        entity_id: entityId,
                        impact_type: impactForm.type,
                      })
                      setImpactForm({ ...impactForm, entityId: '' })
                      await load()
                    } catch (e: any) {
                      setError(String(e.message || e))
                    }
                  }}
                >
                  + 添加影响
                </button>
              </div>
            </div>
          )}

          {tab === 'perception' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                客观事件只有一个；这里记录每个人物自己认为发生了什么、归因给谁、有多大把握。
              </div>
              {perceptions.map((p) => (
                <div
                  key={p.id}
                  style={{
                    border: '1px solid var(--card-border)',
                    borderRadius: '6px',
                    padding: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <strong>{characterName(p.character_id)}</strong>
                    <span style={{ color: 'var(--text-muted)' }}>
                      认知：{p.perceived_polarity || '未定'} / {p.perceived_intensity || '未定'}
                    </span>
                    {p.certainty != null && (
                      <span style={{ color: 'var(--text-muted)' }}>把握 {Math.round(p.certainty * 100)}%</span>
                    )}
                    <span style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                      <button style={chip(false)} onClick={() => editPerception(p)}>
                        编辑
                      </button>
                      <button style={chip(false)} onClick={() => removePerception(p.id)}>
                        删除
                      </button>
                    </span>
                  </div>
                  {p.perceived_content && <div style={{ color: 'var(--text-main)' }}>{p.perceived_content}</div>}
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', color: 'var(--text-muted)' }}>
                    <span>归因：{attributionName(p.attribution_target)}</span>
                    {p.information_source && <span>信息来源：{p.information_source}</span>}
                    {p.perceived_at && <span>认知时间：{String(p.perceived_at).replace('T', ' ').slice(0, 16)}</span>}
                  </div>
                </div>
              ))}
              {perceptions.length === 0 && <div style={{ color: 'var(--text-muted)' }}>暂无人物的主观认知记录</div>}

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  border: '1px dashed var(--card-border)',
                  borderRadius: '6px',
                  padding: '8px',
                }}
              >
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <select
                    style={selectStyle}
                    value={perceptionForm.characterId}
                    onChange={(e) => setPerceptionForm({ ...perceptionForm, characterId: e.target.value })}
                  >
                    <option value="">选择认知人物</option>
                    {characters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <select
                    style={selectStyle}
                    value={perceptionForm.perceived_polarity}
                    onChange={(e) => setPerceptionForm({ ...perceptionForm, perceived_polarity: e.target.value })}
                    title="人物主观认为的极性，可与客观事件极性不同"
                  >
                    {PERCEIVED_POLARITY.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                  <select
                    style={selectStyle}
                    value={perceptionForm.perceived_intensity}
                    onChange={(e) => setPerceptionForm({ ...perceptionForm, perceived_intensity: e.target.value })}
                  >
                    {PERCEIVED_INTENSITY.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                  <input
                    style={{ ...selectStyle, width: '56px' }}
                    value={perceptionForm.certainty}
                    onChange={(e) => setPerceptionForm({ ...perceptionForm, certainty: e.target.value })}
                    title="确定程度 0-1，留空表示未知"
                  />
                </div>
                <textarea
                  style={{ ...selectStyle, minHeight: '48px', resize: 'vertical' }}
                  value={perceptionForm.perceived_content}
                  onChange={(e) => setPerceptionForm({ ...perceptionForm, perceived_content: e.target.value })}
                  placeholder="人物认为发生了什么（可填写误解、传闻或片面信息）"
                />
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <select
                    style={selectStyle}
                    value={perceptionForm.attribution_target}
                    onChange={(e) => setPerceptionForm({ ...perceptionForm, attribution_target: e.target.value })}
                    title="人物把责任归因给谁"
                  >
                    <option value="">未归因</option>
                    <optgroup label="人物">
                      {characters.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="组织">
                      {organizations.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                  <input
                    style={{ ...selectStyle, minWidth: '140px', flex: 1 }}
                    value={perceptionForm.information_source}
                    onChange={(e) => setPerceptionForm({ ...perceptionForm, information_source: e.target.value })}
                    placeholder="信息来源：亲历 / 传闻 / 上级通报…"
                  />
                  <input
                    type="datetime-local"
                    style={selectStyle}
                    value={perceptionForm.perceived_at}
                    onChange={(e) => setPerceptionForm({ ...perceptionForm, perceived_at: e.target.value })}
                    title="认知形成时间，留空则取当前时间"
                  />
                  <button style={chip(false)} onClick={savePerception}>
                    {perceptionForm.characterId ? '+ 保存认知' : '+ 添加认知'}
                  </button>
                  <button style={chip(false)} onClick={() => setPerceptionForm({ ...emptyPerception })}>
                    清空
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
