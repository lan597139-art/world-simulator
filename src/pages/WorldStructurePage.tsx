import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import * as api from '../api/structure'
import * as writingApi from '../api/writing'
import type { DraftItem } from '../api/writing'

// =====================================================================
// 主题与基础组件
// =====================================================================

const card: CSSProperties = {
  background: 'var(--card-bg)',
  border: '1px solid var(--card-border)',
  borderRadius: '14px',
  boxShadow: 'var(--card-shadow)',
  backdropFilter: 'blur(18px)',
}

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: '8px',
  border: '1px solid var(--card-border)',
  background: 'transparent',
  color: 'var(--text-main)',
  fontSize: '13px',
  outline: 'none',
}

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: '11px',
  color: 'var(--text-muted)',
  marginBottom: '4px',
  letterSpacing: '0.04em',
}

function Btn({
  children,
  onClick,
  kind = 'ghost',
  disabled,
  title,
}: {
  children: ReactNode
  onClick?: () => void
  kind?: 'ghost' | 'primary' | 'danger'
  disabled?: boolean
  title?: string
}) {
  const palette: CSSProperties =
    kind === 'primary'
      ? { background: 'var(--primary-color)', color: 'var(--primary-text)', border: '1px solid var(--primary-color)' }
      : kind === 'danger'
        ? { background: 'transparent', color: 'var(--danger-color)', border: '1px solid var(--danger-color)' }
        : { background: 'transparent', color: 'var(--text-main)', border: '1px solid var(--card-border)' }
  return (
    <button
      title={title}
      disabled={disabled}
      onClick={onClick}
      style={{
        ...palette,
        padding: '6px 12px',
        borderRadius: '8px',
        fontSize: '12px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: '10px' }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <div style={{ padding: '28px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
      {text}
    </div>
  )
}

function Tag({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'accent' | 'warn' }) {
  const color =
    tone === 'accent' ? 'var(--text-main)' : tone === 'warn' ? 'var(--danger-color)' : 'var(--text-muted)'
  return (
    <span
      style={{
        fontSize: '10px',
        padding: '1px 6px',
        borderRadius: '999px',
        border: `1px solid ${color}`,
        color,
        opacity: 0.9,
      }}
    >
      {children}
    </span>
  )
}

// =====================================================================
// 页头 / 分支导航
// =====================================================================

const BRANCHES = [
  { key: 'world_profile', label: '世界基础', icon: '◈' },
  { key: 'world_rules', label: '世界规则', icon: '§' },
  { key: 'space_time', label: '时空结构', icon: '◷' },
  { key: 'geography', label: '地理结构', icon: '⛰' },
  { key: 'civilization_society', label: '文明与社会', icon: '⚑' },
  { key: 'organizations', label: '组织结构', icon: '▤' },
  { key: 'people_groups', label: '人物与群体', icon: '♙' },
  { key: 'resources_economy', label: '资源与经济', icon: '◇' },
  { key: 'drafts', label: '创作草稿', icon: '✎' },
] as const

type BranchKey = (typeof BRANCHES)[number]['key']

export default function WorldStructurePage({ worldId, worldName }: { worldId: string; worldName: string }) {
  const [branch, setBranch] = useState<BranchKey>(() => {
    const requested = new URLSearchParams(window.location.search).get('branch') as BranchKey | null
    return BRANCHES.some((item) => item.key === requested) ? (requested as BranchKey) : 'geography'
  })
  const [error, setError] = useState('')
  const [world, setWorld] = useState<api.WorldLite | null>(null)

  useEffect(() => {
    if (!worldId) return
    api
      .getWorld(worldId)
      .then(setWorld)
      .catch((e) => setError(String(e.message || e)))
  }, [worldId])

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 640 }}>
      <aside
        style={{
          width: '212px',
          flexShrink: 0,
          borderRight: '1px solid var(--card-border)',
          padding: '18px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}
      >
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.12em', marginBottom: '8px' }}>
          结构目录
        </div>
        {BRANCHES.map((item) => {
          const active = item.key === branch
          return (
            <button
              key={item.key}
              onClick={() => setBranch(item.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                width: '100%',
                padding: '9px 10px',
                borderRadius: '9px',
                border: active ? '1px solid var(--text-main)' : '1px solid transparent',
                background: active ? 'var(--card-bg)' : 'transparent',
                color: 'var(--text-main)',
                fontSize: '13px',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <span style={{ opacity: 0.6, width: '14px' }}>{item.icon}</span>
              {item.label}
            </button>
          )
        })}
        <div style={{ marginTop: 'auto', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.7 }}>
          <div>{worldName}</div>
          <div>
            {world?.world_scale
              ? `尺度：${{ city: '城市', province: '地区', nation: '国家', global: '全球', planet: '行星', galaxy: '星系' }[world.world_scale] || world.world_scale}`
              : '世界结构 V1.0'}
          </div>
        </div>
      </aside>

      <section style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {error && (
          <div
            style={{
              margin: '14px 18px 0',
              padding: '9px 12px',
              borderRadius: '9px',
              border: '1px solid var(--danger-color)',
              color: 'var(--danger-color)',
              fontSize: '12px',
            }}
          >
            {error}
            <button
              onClick={() => setError('')}
              style={{ float: 'right', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
            >
              ×
            </button>
          </div>
        )}
        <div style={{ flex: 1, minHeight: 0, padding: '14px 18px 22px' }}>
          {branch === 'geography' && <GeographyPanel worldId={worldId} onError={setError} />}
          {branch === 'organizations' && <OrganizationPanel worldId={worldId} onError={setError} />}
          {branch === 'world_rules' && <RulesPanel worldId={worldId} onError={setError} />}
          {branch === 'space_time' && <TimePanel worldId={worldId} onError={setError} />}
          {branch === 'civilization_society' && <SocietyPanel worldId={worldId} onError={setError} />}
          {branch === 'resources_economy' && <ResourcesPanel worldId={worldId} onError={setError} />}
          {branch === 'world_profile' && <NodesPanel worldId={worldId} branch={branch} onError={setError} />}
          {branch === 'people_groups' && <NodesPanel worldId={worldId} branch={branch} onError={setError} />}
          {branch === 'drafts' && <DraftPanel worldId={worldId} onError={setError} />}
        </div>
      </section>
    </div>
  )
}

// =====================================================================
// 地理：单一父节点树
// =====================================================================

function GeographyPanel({ worldId, onError }: { worldId: string; onError: (msg: string) => void }) {
  const [tree, setTree] = useState<api.LocationNode[]>([])
  const [types, setTypes] = useState<api.LocationType[]>([])
  const [selected, setSelected] = useState<api.LocationNode | null>(null)
  const [form, setForm] = useState({ name: '', typeId: '', parentId: '', status: 'normal', description: '' })
  const [busy, setBusy] = useState(false)

  const reload = useCallback(async () => {
    try {
      const [nextTree, nextTypes] = await Promise.all([
        api.getLocationTree(worldId),
        api.listLocationTypes(worldId),
      ])
      setTree(nextTree)
      setTypes(nextTypes)
    } catch (e: any) {
      onError(String(e.message || e))
    }
  }, [worldId, onError])

  useEffect(() => {
    reload()
  }, [reload])

  const flat = useMemo(() => {
    const out: { node: api.LocationNode; depth: number }[] = []
    const walk = (nodes: api.LocationNode[], depth: number) => {
      nodes.forEach((node) => {
        out.push({ node, depth })
        walk(node.children || [], depth + 1)
      })
    }
    walk(tree, 0)
    return out
  }, [tree])

  const descendants = useCallback((node: api.LocationNode): Set<string> => {
    const ids = new Set<string>()
    const walk = (n: api.LocationNode) => {
      ids.add(n.id)
      ;(n.children || []).forEach(walk)
    }
    walk(node)
    return ids
  }, [])

  const select = (node: api.LocationNode | null) => {
    setSelected(node)
    if (node) {
      setForm({
        name: node.name,
        typeId: node.location_type_id || '',
        parentId: node.parent_location_id || '',
        status: node.status || 'normal',
        description: node.description || '',
      })
    } else {
      setForm({ name: '', typeId: '', parentId: '', status: 'normal', description: '' })
    }
  }

  const save = async () => {
    if (!form.name.trim()) return onError('地点名称不能为空')
    setBusy(true)
    try {
      if (selected) {
        await api.updateLocation(selected.id, {
          name: form.name,
          location_type_id: form.typeId || null,
          parent_location_id: form.parentId || null,
          status: form.status,
          description: form.description,
        })
      } else {
        await api.createLocation({
          world_id: worldId,
          name: form.name,
          location_type_id: form.typeId || null,
          parent_location_id: form.parentId || null,
          description: form.description,
        })
      }
      await reload()
      select(null)
    } catch (e: any) {
      onError(String(e.message || e))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!selected) return
    if (!window.confirm(`删除地点「${selected.name}」？有子节点时会被拒绝。`)) return
    try {
      await api.deleteLocation(selected.id)
      await reload()
      select(null)
    } catch (e: any) {
      onError(String(e.message || e))
    }
  }

  const blockedParents = selected ? descendants(selected) : new Set<string>()

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: '16px', height: '100%' }}>
      <div style={{ ...card, padding: '14px', overflow: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div>
            <div style={{ fontSize: '14px', color: 'var(--text-main)' }}>地理树</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              每个地点只能有一个直接父节点
            </div>
          </div>
          <Btn onClick={() => select(null)}>+ 根地点</Btn>
        </div>

        {flat.length === 0 && <Empty text="还没有地点。先建一个国家，再往下分省、市、区。" />}

        {flat.map(({ node, depth }) => (
          <button
            key={node.id}
            onClick={() => select(node)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              textAlign: 'left',
              padding: '7px 8px',
              paddingLeft: `${8 + depth * 18}px`,
              marginBottom: '2px',
              borderRadius: '7px',
              border: selected?.id === node.id ? '1px solid var(--text-main)' : '1px solid transparent',
              background: selected?.id === node.id ? 'var(--card-bg)' : 'transparent',
              color: 'var(--text-main)',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            <span style={{ opacity: depth === 0 ? 0.9 : 0.45, fontSize: '11px' }}>
              {depth === 0 ? '◆' : '└'}
            </span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {node.name}
            </span>
            <Tag>{node.location_type_name || '未分类'}</Tag>
          </button>
        ))}
      </div>

      <div style={{ ...card, padding: '16px', overflow: 'auto' }}>
        <div style={{ fontSize: '14px', color: 'var(--text-main)', marginBottom: '4px' }}>
          {selected ? `编辑：${selected.name}` : '新增地点'}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '14px' }}>
          类型决定允许的上级类型；移动会自动写入历史。
        </div>

        <Field label="名称">
          <input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="类型">
          <select style={inputStyle} value={form.typeId} onChange={(e) => setForm({ ...form, typeId: e.target.value })}>
            <option value="">未分类</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.system ? '（系统）' : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field label="上级地点">
          <select style={inputStyle} value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })}>
            <option value="">无（根节点）</option>
            {flat
              .filter(({ node }) => !blockedParents.has(node.id))
              .map(({ node, depth }) => (
                <option key={node.id} value={node.id}>
                  {'　'.repeat(depth)}
                  {node.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="状态">
          <select style={inputStyle} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="normal">正常</option>
            <option value="locked">封锁</option>
            <option value="abandoned">废弃</option>
            <option value="destroyed">毁坏</option>
          </select>
        </Field>
        <Field label="描述">
          <textarea
            style={{ ...inputStyle, minHeight: '64px' }}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>

        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
          <Btn kind="primary" onClick={save} disabled={busy}>
            {selected ? '保存' : '创建'}
          </Btn>
          {selected && <Btn kind="danger" onClick={remove}>删除</Btn>}
        </div>

        {selected && (
          <div style={{ marginTop: '16px', borderTop: '1px solid var(--card-border)', paddingTop: '12px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>子地点</div>
            {selected.children.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>暂无</div>
            ) : (
              selected.children.map((child) => (
                <div key={child.id} style={{ fontSize: '12px', color: 'var(--text-main)', padding: '2px 0' }}>
                  · {child.name} <Tag>{child.location_type_name}</Tag>
                </div>
              ))
            )}
            <div style={{ marginTop: '10px' }}>
              <Btn
                onClick={() => {
                  setSelected(null)
                  setForm({
                    name: '',
                    typeId: '',
                    parentId: selected.id,
                    status: 'normal',
                    description: '',
                  })
                }}
              >
                + 在此下新增子地点
              </Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// =====================================================================
// 组织：组织 / 部门 / 职位 / 任职
// =====================================================================

/** datetime-local → 后端可解析的 "YYYY-MM-DD HH:MM:SS" */
const localToBackend = (value: string) => `${value.replace('T', ' ')}:00`

function OrganizationPanel({ worldId, onError }: { worldId: string; onError: (msg: string) => void }) {
  const [orgs, setOrgs] = useState<api.Organization[]>([])
  const [orgId, setOrgId] = useState('')
  const [tree, setTree] = useState<api.OrgTree | null>(null)
  const [characters, setCharacters] = useState<api.CharacterLite[]>([])
  const [unitName, setUnitName] = useState('')
  const [unitParent, setUnitParent] = useState('')
  const [positionName, setPositionName] = useState('')
  const [positionUnit, setPositionUnit] = useState('')
  const [appointPosition, setAppointPosition] = useState('')
  const [appointCharacter, setAppointCharacter] = useState('')
  const [appointStart, setAppointStart] = useState('')
  const [endTime, setEndTime] = useState('')
  const [newOrg, setNewOrg] = useState({ name: '', type: 'company' })

  // 编辑态：组织资料 / 选中部门 / 选中职位
  const [orgDraft, setOrgDraft] = useState({ name: '', type: 'company', status: 'normal' })
  const [selUnitId, setSelUnitId] = useState('')
  const [unitDraft, setUnitDraft] = useState({ name: '', parent: '', type: 'department', status: 'active' })
  const [selPositionId, setSelPositionId] = useState('')
  const [positionDraft, setPositionDraft] = useState({ name: '', level: '', unit: '' })

  const reloadOrgs = useCallback(async () => {
    try {
      const [nextOrgs, nextChars] = await Promise.all([
        api.listOrganizations(worldId),
        api.listCharacters(worldId),
      ])
      setOrgs(nextOrgs)
      setCharacters(nextChars)
      if (!orgId && nextOrgs.length) setOrgId(nextOrgs[0].id)
    } catch (e: any) {
      onError(String(e.message || e))
    }
  }, [worldId, orgId, onError])

  const reloadTree = useCallback(async () => {
    if (!orgId) {
      setTree(null)
      return
    }
    try {
      setTree(await api.getOrgTree(orgId))
    } catch (e: any) {
      onError(String(e.message || e))
    }
  }, [orgId, onError])

  useEffect(() => {
    reloadOrgs()
  }, [reloadOrgs])

  useEffect(() => {
    reloadTree()
  }, [reloadTree])

  useEffect(() => {
    if (!tree) return
    setOrgDraft({
      name: tree.organization.name,
      type: tree.organization.organization_type || 'company',
      status: tree.organization.status || 'normal',
    })
  }, [tree?.organization.id, tree?.organization.name, tree?.organization.organization_type, tree?.organization.status])

  useEffect(() => {
    setSelUnitId('')
    setSelPositionId('')
  }, [orgId])

  const findUnit = (nodes: api.UnitNode[], id: string): api.UnitNode | null => {
    for (const node of nodes) {
      if (node.id === id) return node
      const child = findUnit(node.children || [], id)
      if (child) return child
    }
    return null
  }

  const unitsFlat = useMemo(() => {
    const out: { unit: api.UnitNode; depth: number }[] = []
    const walk = (nodes: api.UnitNode[], depth: number) => {
      nodes.forEach((unit) => {
        out.push({ unit, depth })
        walk(unit.children || [], depth + 1)
      })
    }
    if (tree) walk(tree.units, 0)
    return out
  }, [tree])

  const selectedUnit = useMemo(
    () => (tree && selUnitId ? findUnit(tree.units, selUnitId) : null),
    [tree, selUnitId],
  )

  const selectedPosition = useMemo(() => {
    if (!tree || !selPositionId) return null
    const all: api.Position[] = []
    const walk = (nodes: api.UnitNode[]) => {
      nodes.forEach((node) => {
        all.push(...node.positions)
        walk(node.children || [])
      })
    }
    walk(tree.units)
    return all.find((position) => position.id === selPositionId) || null
  }, [tree, selPositionId])

  const selectUnit = (unit: api.UnitNode) => {
    setSelUnitId(unit.id)
    setSelPositionId('')
    setUnitDraft({
      name: unit.name,
      parent: unit.parent_unit_id || '',
      type: unit.unit_type || 'department',
      status: unit.status || 'active',
    })
  }

  const selectPosition = (position: api.Position) => {
    setSelPositionId(position.id)
    setPositionDraft({
      name: position.name,
      level: position.position_level || '',
      unit: position.unit_id,
    })
  }

  const addOrg = async () => {
    if (!newOrg.name.trim()) return onError('组织名称不能为空')
    try {
      const created = await api.createOrganization({ world_id: worldId, name: newOrg.name, organization_type: newOrg.type })
      setNewOrg({ name: '', type: 'company' })
      await reloadOrgs()
      setOrgId(created.id)
    } catch (e: any) {
      onError(String(e.message || e))
    }
  }

  const saveOrg = async () => {
    if (!tree) return
    if (!orgDraft.name.trim()) return onError('组织名称不能为空')
    try {
      await api.updateOrganization(tree.organization.id, {
        name: orgDraft.name.trim(),
        organization_type: orgDraft.type,
        status: orgDraft.status,
      })
      await reloadOrgs()
      await reloadTree()
    } catch (e: any) {
      onError(String(e.message || e))
    }
  }

  const addUnit = async () => {
    if (!tree || !unitName.trim()) return onError('部门名称不能为空')
    try {
      await api.createUnit({
        world_id: worldId,
        organization_id: tree.organization.id,
        parent_unit_id: unitParent || null,
        name: unitName,
      })
      setUnitName('')
      await reloadTree()
    } catch (e: any) {
      onError(String(e.message || e))
    }
  }

  const saveUnit = async () => {
    if (!selUnitId) return
    if (!unitDraft.name.trim()) return onError('部门名称不能为空')
    try {
      await api.updateUnit(selUnitId, {
        name: unitDraft.name.trim(),
        parent_unit_id: unitDraft.parent || null,
        unit_type: unitDraft.type,
        status: unitDraft.status,
      })
      await reloadTree()
    } catch (e: any) {
      onError(String(e.message || e))
    }
  }

  const removeUnit = async () => {
    if (!selUnitId) return
    if (!confirm('删除该部门？部门下仍有职位或子部门时会被拒绝。')) return
    try {
      await api.deleteUnit(selUnitId)
      setSelUnitId('')
      await reloadTree()
    } catch (e: any) {
      onError(String(e.message || e))
    }
  }

  const addPosition = async () => {
    if (!positionName.trim() || !positionUnit) return onError('请填写职位名称并选择部门')
    try {
      await api.createPosition({ world_id: worldId, unit_id: positionUnit, name: positionName })
      setPositionName('')
      await reloadTree()
    } catch (e: any) {
      onError(String(e.message || e))
    }
  }

  const savePosition = async () => {
    if (!selPositionId) return
    if (!positionDraft.name.trim() || !positionDraft.unit) return onError('请填写职位名称并选择部门')
    try {
      await api.updatePosition(selPositionId, {
        name: positionDraft.name.trim(),
        position_level: positionDraft.level || null,
        unit_id: positionDraft.unit,
      })
      await reloadTree()
    } catch (e: any) {
      onError(String(e.message || e))
    }
  }

  const removePosition = async () => {
    if (!selPositionId) return
    if (!confirm('撤销该职位？仍有人物在任时会被拒绝。')) return
    try {
      await api.deletePosition(selPositionId)
      setSelPositionId('')
      await reloadTree()
    } catch (e: any) {
      onError(String(e.message || e))
    }
  }

  const appoint = async () => {
    if (!appointPosition || !appointCharacter) return onError('请选择职位与人物')
    try {
      await api.createAppointment({
        world_id: worldId,
        position_id: appointPosition,
        character_id: appointCharacter,
        start_time: appointStart ? localToBackend(appointStart) : undefined,
      })
      setAppointCharacter('')
      setAppointStart('')
      await reloadTree()
    } catch (e: any) {
      onError(String(e.message || e))
    }
  }

  const endAppoint = async (appointmentId: string) => {
    try {
      await api.endAppointment(appointmentId, endTime ? localToBackend(endTime) : null)
      await reloadTree()
    } catch (e: any) {
      onError(String(e.message || e))
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '240px minmax(0, 1fr) 320px', gap: '16px', height: '100%' }}>
      <div style={{ ...card, padding: '14px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ fontSize: '14px', color: 'var(--text-main)', marginBottom: '10px' }}>组织</div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {orgs.length === 0 && <Empty text="尚无组织" />}
          {orgs.map((org) => (
            <button
              key={org.id}
              onClick={() => setOrgId(org.id)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '8px 10px',
                marginBottom: '3px',
                borderRadius: '7px',
                border: orgId === org.id ? '1px solid var(--text-main)' : '1px solid transparent',
                background: orgId === org.id ? 'var(--card-bg)' : 'transparent',
                color: 'var(--text-main)',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              {org.name}
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{org.organization_type}</div>
            </button>
          ))}
        </div>
        <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: '10px' }}>
          <Field label="新组织">
            <input
              style={inputStyle}
              placeholder="名称"
              value={newOrg.name}
              onChange={(e) => setNewOrg({ ...newOrg, name: e.target.value })}
            />
          </Field>
          <select
            style={{ ...inputStyle, marginBottom: '8px' }}
            value={newOrg.type}
            onChange={(e) => setNewOrg({ ...newOrg, type: e.target.value })}
          >
            <option value="company">企业</option>
            <option value="government">政府机构</option>
            <option value="military">军队</option>
            <option value="party">政党</option>
            <option value="ngo">NGO / 基金会</option>
            <option value="family">家族</option>
          </select>
          <Btn kind="primary" onClick={addOrg}>创建组织</Btn>
        </div>
      </div>

      <div style={{ ...card, padding: '14px', overflow: 'auto' }}>
        {!tree ? (
          <Empty text="选择或创建一个组织" />
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontSize: '14px', color: 'var(--text-main)' }}>{tree.organization.name}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {tree.unit_count} 部门 · {tree.position_count} 职位 · {tree.active_appointments} 在任
              </div>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              点击部门或职位可编辑；正式组织架构与实际权力关系分开保存。
            </div>

            <div style={{ margin: '12px 0' }}>
              {unitsFlat.length === 0 && <Empty text="还没有部门" />}
              {unitsFlat.map(({ unit, depth }) => (
                <div
                  key={unit.id}
                  onClick={() => selectUnit(unit)}
                  style={{
                    padding: '8px 10px',
                    marginLeft: `${depth * 18}px`,
                    marginBottom: '4px',
                    borderRadius: '8px',
                    border: selUnitId === unit.id ? '1px solid var(--text-main)' : '1px solid var(--card-border)',
                    borderLeft: depth > 0 ? '3px solid rgba(128,128,128,0.35)' : undefined,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-main)' }}>
                      {unit.name}
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '6px' }}>
                        {unit.unit_type || 'department'}
                      </span>
                    </span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <Btn
                        onClick={() => {
                          setUnitParent(unit.id)
                          onError('')
                        }}
                        title="作为新增部门时的上级"
                      >
                        + 子部门
                      </Btn>
                      <Btn onClick={() => setPositionUnit(unit.id)}>+ 职位</Btn>
                    </div>
                  </div>
                  {unit.positions.length === 0 ? (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>无职位</div>
                  ) : (
                    unit.positions.map((position) => (
                      <div
                        key={position.id}
                        onClick={(event) => {
                          event.stopPropagation()
                          selectPosition(position)
                        }}
                        style={{
                          marginTop: '6px',
                          fontSize: '12px',
                          color: 'var(--text-main)',
                          padding: '2px 6px',
                          borderRadius: '6px',
                          background: selPositionId === position.id ? 'rgba(128,128,128,0.12)' : 'transparent',
                          cursor: 'pointer',
                        }}
                      >
                        <span style={{ opacity: 0.7 }}>职位：</span>
                        {position.name}
                        {position.holders.length === 0 ? (
                          <span style={{ color: 'var(--text-muted)' }}>（空缺）</span>
                        ) : (
                          position.holders.map((holder) => (
                            <span key={holder.appointment_id} style={{ marginLeft: '8px' }}>
                              <Tag tone="accent">{holder.character_name}</Tag>
                              <button
                                onClick={(event) => {
                                  event.stopPropagation()
                                  endAppoint(holder.appointment_id)
                                }}
                                style={{
                                  marginLeft: '6px',
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--text-muted)',
                                  cursor: 'pointer',
                                  fontSize: '11px',
                                }}
                              >
                                离任
                              </button>
                            </span>
                          ))
                        )}
                        <button
                          onClick={(event) => {
                            event.stopPropagation()
                            setAppointPosition(position.id)
                            setAppointCharacter('')
                          }}
                          style={{
                            marginLeft: '8px',
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            fontSize: '11px',
                          }}
                        >
                          任命
                        </button>
                      </div>
                    ))
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div style={{ ...card, padding: '16px', overflow: 'auto' }}>
        <div style={{ fontSize: '14px', color: 'var(--text-main)', marginBottom: '12px' }}>编辑与新增</div>

        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>组织资料</div>
        <Field label="组织名称">
          <input
            style={inputStyle}
            value={orgDraft.name}
            disabled={!tree}
            onChange={(e) => setOrgDraft({ ...orgDraft, name: e.target.value })}
          />
        </Field>
        <Field label="组织类型">
          <select
            style={inputStyle}
            value={orgDraft.type}
            disabled={!tree}
            onChange={(e) => setOrgDraft({ ...orgDraft, type: e.target.value })}
          >
            <option value="company">企业</option>
            <option value="government">政府机构</option>
            <option value="military">军队</option>
            <option value="party">政党</option>
            <option value="ngo">NGO / 基金会</option>
            <option value="family">家族</option>
            <option value="academic">学术机构</option>
            <option value="religious">宗教组织</option>
            <option value="gang">帮派</option>
            <option value="other">其他</option>
          </select>
        </Field>
        <Field label="组织状态">
          <select
            style={inputStyle}
            value={orgDraft.status}
            disabled={!tree}
            onChange={(e) => setOrgDraft({ ...orgDraft, status: e.target.value })}
          >
            <option value="normal">正常</option>
            <option value="expanding">扩张</option>
            <option value="declining">衰退</option>
            <option value="dissolved">解散</option>
          </select>
        </Field>
        <Btn kind="primary" onClick={saveOrg} disabled={!tree}>保存组织资料</Btn>

        {selectedUnit && (
          <>
            <div style={{ borderTop: '1px solid var(--card-border)', margin: '16px 0' }} />
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
              部门编辑：{selectedUnit.name}
            </div>
            <Field label="部门名称">
              <input style={inputStyle} value={unitDraft.name} onChange={(e) => setUnitDraft({ ...unitDraft, name: e.target.value })} />
            </Field>
            <Field label="上级部门（移动）">
              <select style={inputStyle} value={unitDraft.parent} onChange={(e) => setUnitDraft({ ...unitDraft, parent: e.target.value })}>
                <option value="">（直属组织）</option>
                {unitsFlat
                  .filter(({ unit }) => unit.id !== selectedUnit.id)
                  .map(({ unit, depth }) => (
                    <option key={unit.id} value={unit.id}>
                      {'　'.repeat(depth)}
                      {unit.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="部门类型">
              <select style={inputStyle} value={unitDraft.type} onChange={(e) => setUnitDraft({ ...unitDraft, type: e.target.value })}>
                <option value="department">部门</option>
                <option value="committee">委员会</option>
                <option value="office">办公室</option>
                <option value="team">团队 / 小组</option>
                <option value="branch">分支机构</option>
              </select>
            </Field>
            <Field label="部门状态">
              <select style={inputStyle} value={unitDraft.status} onChange={(e) => setUnitDraft({ ...unitDraft, status: e.target.value })}>
                <option value="active">正常</option>
                <option value="suspended">暂停</option>
                <option value="archived">撤销</option>
              </select>
            </Field>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Btn kind="primary" onClick={saveUnit}>保存部门</Btn>
              <Btn kind="danger" onClick={removeUnit}>删除部门</Btn>
            </div>
          </>
        )}

        {selectedPosition && (
          <>
            <div style={{ borderTop: '1px solid var(--card-border)', margin: '16px 0' }} />
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
              职位编辑：{selectedPosition.name}
            </div>
            <Field label="职位名称">
              <input style={inputStyle} value={positionDraft.name} onChange={(e) => setPositionDraft({ ...positionDraft, name: e.target.value })} />
            </Field>
            <Field label="职级">
              <input style={inputStyle} placeholder="如 P6 / 主管级" value={positionDraft.level} onChange={(e) => setPositionDraft({ ...positionDraft, level: e.target.value })} />
            </Field>
            <Field label="所属部门（调动）">
              <select style={inputStyle} value={positionDraft.unit} onChange={(e) => setPositionDraft({ ...positionDraft, unit: e.target.value })}>
                {unitsFlat.map(({ unit, depth }) => (
                  <option key={unit.id} value={unit.id}>
                    {'　'.repeat(depth)}
                    {unit.name}
                  </option>
                ))}
              </select>
            </Field>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Btn kind="primary" onClick={savePosition}>保存职位</Btn>
              <Btn kind="danger" onClick={removePosition}>撤销职位</Btn>
            </div>
          </>
        )}

        <div style={{ borderTop: '1px solid var(--card-border)', margin: '16px 0' }} />
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>新增部门 / 职位 / 任职</div>

        <Field label="部门名称">
          <input style={inputStyle} value={unitName} onChange={(e) => setUnitName(e.target.value)} />
        </Field>
        <Field label="上级部门">
          <select style={inputStyle} value={unitParent} onChange={(e) => setUnitParent(e.target.value)}>
            <option value="">（直属组织）</option>
            {unitsFlat.map(({ unit, depth }) => (
              <option key={unit.id} value={unit.id}>
                {'　'.repeat(depth)}
                {unit.name}
              </option>
            ))}
          </select>
        </Field>
        <Btn onClick={addUnit} disabled={!tree}>+ 添加部门</Btn>

        <div style={{ borderTop: '1px solid var(--card-border)', margin: '16px 0' }} />

        <Field label="职位名称">
          <input style={inputStyle} value={positionName} onChange={(e) => setPositionName(e.target.value)} />
        </Field>
        <Field label="所属部门">
          <select style={inputStyle} value={positionUnit} onChange={(e) => setPositionUnit(e.target.value)}>
            <option value="">选择部门</option>
            {unitsFlat.map(({ unit, depth }) => (
              <option key={unit.id} value={unit.id}>
                {'　'.repeat(depth)}
                {unit.name}
              </option>
            ))}
          </select>
        </Field>
        <Btn onClick={addPosition}>+ 添加职位</Btn>

        <div style={{ borderTop: '1px solid var(--card-border)', margin: '16px 0' }} />

        <Field label="任命职位">
          <select style={inputStyle} value={appointPosition} onChange={(e) => setAppointPosition(e.target.value)}>
            <option value="">选择职位</option>
            {unitsFlat.flatMap(({ unit, depth }) =>
              unit.positions.map((position) => (
                <option key={position.id} value={position.id}>
                  {'　'.repeat(depth)}
                  {unit.name} / {position.name}
                </option>
              )),
            )}
          </select>
        </Field>
        <Field label="人物">
          <select style={inputStyle} value={appointCharacter} onChange={(e) => setAppointCharacter(e.target.value)}>
            <option value="">选择人物</option>
            {characters.map((character) => (
              <option key={character.id} value={character.id}>
                {character.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="任命时间（留空为当前）">
          <input
            type="datetime-local"
            style={inputStyle}
            value={appointStart}
            onChange={(e) => setAppointStart(e.target.value)}
          />
        </Field>
        <Btn kind="primary" onClick={appoint}>创建任职</Btn>

        <Field label="离任时间（留空为当前，供上方离任使用）">
          <input
            type="datetime-local"
            style={inputStyle}
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
        </Field>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '10px', lineHeight: 1.7 }}>
          任职只引用人物 ID，不复制人物档案；离任会保留历史记录。调整任职 = 按指定时间离任后重新任命。
        </div>
      </div>
    </div>
  )
}

// =====================================================================
// 规则
// =====================================================================

function RulesPanel({ worldId, onError }: { worldId: string; onError: (msg: string) => void }) {
  const [rules, setRules] = useState<api.WorldRule[]>([])
  const [orgs, setOrgs] = useState<api.Organization[]>([])
  const [form, setForm] = useState({ name: '', category: 'social', description: '', scopeType: 'world', scopeId: '' })

  const reload = useCallback(async () => {
    try {
      const [nextRules, nextOrgs] = await Promise.all([api.listRules(worldId), api.listOrganizations(worldId)])
      setRules(nextRules)
      setOrgs(nextOrgs)
    } catch (e: any) {
      onError(String(e.message || e))
    }
  }, [worldId, onError])

  useEffect(() => {
    reload()
  }, [reload])

  const create = async () => {
    if (!form.name.trim()) return onError('规则名称不能为空')
    try {
      await api.createRule(worldId, {
        name: form.name,
        rule_category: form.category,
        description: form.description,
        scopes:
          form.scopeType === 'world'
            ? [{ scope_type: 'world', scope_id: worldId }]
            : form.scopeId
              ? [{ scope_type: form.scopeType, scope_id: form.scopeId }]
              : [],
      })
      setForm({ name: '', category: 'social', description: '', scopeType: 'world', scopeId: '' })
      await reload()
    } catch (e: any) {
      onError(String(e.message || e))
    }
  }

  const remove = async (id: string) => {
    if (!window.confirm('删除该规则？')) return
    try {
      await api.deleteRule(id)
      await reload()
    } catch (e: any) {
      onError(String(e.message || e))
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: '16px', height: '100%' }}>
      <div style={{ ...card, padding: '14px', overflow: 'auto' }}>
        <div style={{ fontSize: '14px', color: 'var(--text-main)', marginBottom: '10px' }}>世界规则</div>
        {rules.length === 0 && <Empty text="还没有规则" />}
        {rules.map((rule) => (
          <div key={rule.id} style={{ padding: '10px', border: '1px solid var(--card-border)', borderRadius: '9px', marginBottom: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-main)' }}>{rule.name}</span>
              <button
                onClick={() => remove(rule.id)}
                style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', fontSize: '11px' }}
              >
                删除
              </button>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {rule.rule_category} · {rule.status} · {rule.scopes.length} 个适用范围
            </div>
            {rule.description && (
              <div style={{ fontSize: '12px', color: 'var(--text-main)', marginTop: '6px', opacity: 0.85 }}>{rule.description}</div>
            )}
          </div>
        ))}
      </div>
      <div style={{ ...card, padding: '16px' }}>
        <div style={{ fontSize: '14px', color: 'var(--text-main)', marginBottom: '12px' }}>新增规则</div>
        <Field label="名称">
          <input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="分类">
          <select style={inputStyle} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            <option value="natural">自然</option>
            <option value="social">社会</option>
            <option value="legal">法律</option>
            <option value="economic">经济</option>
            <option value="special">特殊</option>
          </select>
        </Field>
        <Field label="适用范围">
          <div style={{ display: 'flex', gap: '6px' }}>
            <select
              style={{ ...inputStyle, flex: 1 }}
              value={form.scopeType}
              onChange={(e) => setForm({ ...form, scopeType: e.target.value, scopeId: '' })}
            >
              <option value="world">整个世界</option>
              <option value="organization">组织</option>
            </select>
            {form.scopeType === 'organization' && (
              <select
                style={{ ...inputStyle, flex: 1 }}
                value={form.scopeId}
                onChange={(e) => setForm({ ...form, scopeId: e.target.value })}
              >
                <option value="">选择组织</option>
                {orgs.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </Field>
        <Field label="规则内容">
          <textarea
            style={{ ...inputStyle, minHeight: '80px' }}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>
        <Btn kind="primary" onClick={create}>创建规则</Btn>
      </div>
    </div>
  )
}

// =====================================================================
// 时空
// =====================================================================

function TimePanel({ worldId, onError }: { worldId: string; onError: (msg: string) => void }) {
  const [ts, setTs] = useState<api.TimeSettings | null>(null)
  const [histories, setHistories] = useState<api.HistoryItem[]>([])
  const [eras, setEras] = useState<api.EraItem[]>([])

  const reload = useCallback(async () => {
    try {
      const [nextTs, nextHistories, nextEras] = await Promise.all([
        api.getTimeSettings(worldId),
        api.listHistories(worldId),
        api.listEras(worldId),
      ])
      setTs(nextTs)
      setHistories(nextHistories)
      setEras(nextEras)
    } catch (e: any) {
      onError(String(e.message || e))
    }
  }, [worldId, onError])

  useEffect(() => {
    reload()
  }, [reload])

  const setMode = async (mode: 'manual' | 'realtime') => {
    try {
      setTs(await api.updateTimeSettings(worldId, { time_mode: mode }))
    } catch (e: any) {
      onError(String(e.message || e))
    }
  }

  const advance = async (days: number) => {
    try {
      setTs(await api.advanceTime(worldId, { days }))
      await reload()
    } catch (e: any) {
      onError(String(e.message || e))
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: '16px', height: '100%' }}>
      <div style={{ ...card, padding: '18px' }}>
        <div style={{ fontSize: '14px', color: 'var(--text-main)', marginBottom: '12px' }}>世界时间</div>
        {!ts ? (
          <Empty text="加载中" />
        ) : (
          <>
            <div style={{ fontSize: '26px', color: 'var(--text-main)', letterSpacing: '0.02em' }}>
              {ts.current_time?.replace('T', ' ').slice(0, 16)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
              {ts.calendar_type} · {ts.timezone} · 每天 {ts.day_length_hours} 小时
            </div>

            <div style={{ marginTop: '22px', fontSize: '12px', color: 'var(--text-main)' }}>推进模式（二选一）</div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <Btn kind={ts.time_mode === 'manual' ? 'primary' : 'ghost'} onClick={() => setMode('manual')}>
                手动推进
              </Btn>
              <Btn kind={ts.time_mode === 'realtime' ? 'primary' : 'ghost'} onClick={() => setMode('realtime')}>
                随真实时间流逝
              </Btn>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', lineHeight: 1.7 }}>
              手动：只在你点击时前进。实时：按“现实多少秒 = 世界一天”自动前进（当前{' '}
              {ts.real_seconds_per_world_day} 秒/天）。
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
              {[1, 7, 30].map((d) => (
                <Btn key={d} onClick={() => advance(d)} disabled={ts.time_mode === 'realtime'}>
                  +{d} 天
                </Btn>
              ))}
            </div>
            {ts.time_mode === 'realtime' && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                实时模式下时间自动前进，手动按钮已禁用。
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ ...card, padding: '16px', overflow: 'auto' }}>
        <div style={{ fontSize: '14px', color: 'var(--text-main)', marginBottom: '12px' }}>时代</div>
        {eras.length === 0 && <Empty text="还没有时代记录" />}
        {eras.map((era) => (
          <div key={era.id} style={{ padding: '7px 0', borderBottom: '1px solid var(--card-border)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-main)' }}>{era.name}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {era.start_time?.slice(0, 10) || '未知'} → {era.end_time?.slice(0, 10) || '至今'}
            </div>
            {era.description && (
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.6 }}>
                {era.description}
              </div>
            )}
          </div>
        ))}
        <div style={{ borderTop: '1px solid var(--card-border)', margin: '14px 0' }} />
        <div style={{ fontSize: '14px', color: 'var(--text-main)', marginBottom: '12px' }}>状态历史</div>
        {histories.length === 0 && <Empty text="还没有历史记录" />}
        {histories.slice(0, 40).map((item) => (
          <div key={item.id} style={{ padding: '7px 0', borderBottom: '1px solid var(--card-border)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-main)' }}>
              {item.entity_name || item.entity_type} · {item.field}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {String(item.old_value ?? '∅')} → {String(item.new_value ?? '∅')}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {item.occurred_at?.replace('T', ' ').slice(0, 16)} {item.reason ? `· ${item.reason}` : ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// =====================================================================
// 社会
// =====================================================================

function SocietyPanel({ worldId, onError }: { worldId: string; onError: (msg: string) => void }) {
  const [societies, setSocieties] = useState<api.SocietyItem[]>([])
  const [groups, setGroups] = useState<api.SocialGroupItem[]>([])
  const [form, setForm] = useState({ name: '', type: 'nation', government: '' })
  const [groupForm, setGroupForm] = useState({ name: '', type: 'class', societyId: '' })

  const reload = useCallback(async () => {
    try {
      const [nextSocieties, nextGroups] = await Promise.all([
        api.listSocieties(worldId),
        api.listSocialGroups(worldId),
      ])
      setSocieties(nextSocieties)
      setGroups(nextGroups)
    } catch (e: any) {
      onError(String(e.message || e))
    }
  }, [worldId, onError])

  useEffect(() => {
    reload()
  }, [reload])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: '16px', height: '100%' }}>
      <div style={{ ...card, padding: '14px', overflow: 'auto' }}>
        <div style={{ fontSize: '14px', color: 'var(--text-main)', marginBottom: '10px' }}>社会实体</div>
        {societies.length === 0 && <Empty text="国家 / 文明等社会实体放这里" />}
        {societies.map((society) => (
          <div key={society.id} style={{ padding: '9px 0', borderBottom: '1px solid var(--card-border)' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-main)' }}>
              {society.name} <Tag>{society.society_type}</Tag>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {society.government_form || '未填写政体'} · {groups.filter((g) => g.society_id === society.id).length} 个群体
            </div>
            {society.description && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.6 }}>
                {society.description}
              </div>
            )}
          </div>
        ))}

        <div style={{ fontSize: '14px', color: 'var(--text-main)', margin: '18px 0 10px' }}>社会群体</div>
        {groups.length === 0 && <Empty text="阶层 / 族群 / 宗教群体" />}
        {groups.map((group) => (
          <div key={group.id} style={{ padding: '5px 0', borderBottom: '1px solid var(--card-border)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-main)' }}>
              {group.name} <Tag>{group.group_type}</Tag>
            </div>
            {group.description && (
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.6 }}>
                {group.description}
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ ...card, padding: '16px', overflow: 'auto' }}>
        <div style={{ fontSize: '14px', color: 'var(--text-main)', marginBottom: '12px' }}>新增</div>
        <Field label="社会实体名称">
          <input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="类型">
          <select style={inputStyle} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="nation">国家</option>
            <option value="civilization">文明</option>
            <option value="tribe">部落</option>
            <option value="city_state">城邦</option>
          </select>
        </Field>
        <Field label="政体">
          <input style={inputStyle} value={form.government} onChange={(e) => setForm({ ...form, government: e.target.value })} />
        </Field>
        <Btn
          kind="primary"
          onClick={async () => {
            if (!form.name.trim()) return onError('名称不能为空')
            try {
              await api.createSociety(worldId, {
                name: form.name,
                society_type: form.type,
                government_form: form.government,
              })
              setForm({ name: '', type: 'nation', government: '' })
              await reload()
            } catch (e: any) {
              onError(String(e.message || e))
            }
          }}
        >
          创建社会实体
        </Btn>

        <div style={{ borderTop: '1px solid var(--card-border)', margin: '16px 0' }} />

        <Field label="群体名称">
          <input style={inputStyle} value={groupForm.name} onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })} />
        </Field>
        <Field label="所属社会">
          <select style={inputStyle} value={groupForm.societyId} onChange={(e) => setGroupForm({ ...groupForm, societyId: e.target.value })}>
            <option value="">（不指定）</option>
            {societies.map((society) => (
              <option key={society.id} value={society.id}>
                {society.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="类型">
          <select style={inputStyle} value={groupForm.type} onChange={(e) => setGroupForm({ ...groupForm, type: e.target.value })}>
            <option value="class">阶层</option>
            <option value="ethnic">族群</option>
            <option value="religious">宗教</option>
            <option value="cultural">文化</option>
            <option value="profession">职业</option>
          </select>
        </Field>
        <Btn
          onClick={async () => {
            if (!groupForm.name.trim()) return onError('名称不能为空')
            try {
              await api.createSocialGroup(worldId, {
                name: groupForm.name,
                group_type: groupForm.type,
                society_id: groupForm.societyId || null,
              })
              setGroupForm({ name: '', type: 'class', societyId: '' })
              await reload()
            } catch (e: any) {
              onError(String(e.message || e))
            }
          }}
        >
          创建群体
        </Btn>
      </div>
    </div>
  )
}

// =====================================================================
// 资源
// =====================================================================

function ResourcesPanel({ worldId, onError }: { worldId: string; onError: (msg: string) => void }) {
  const [resources, setResources] = useState<api.ResourceItem[]>([])
  const [types, setTypes] = useState<api.ResourceType[]>([])
  const [holdings, setHoldings] = useState<api.ResourceHolding[]>([])
  const [orgs, setOrgs] = useState<api.Organization[]>([])
  const [form, setForm] = useState({ name: '', typeId: '', quantity: '0', unit: '' })
  const [holdingForm, setHoldingForm] = useState({ holderType: 'organization', holderId: '', role: 'holder', resourceId: '' })
  const [txForm, setTxForm] = useState({ resourceId: '', amount: '', reason: '' })

  const reload = useCallback(async () => {
    try {
      const [nextResources, nextTypes, nextHoldings, nextOrgs] = await Promise.all([
        api.listResources(worldId),
        api.listResourceTypes(worldId),
        api.listHoldings(worldId),
        api.listOrganizations(worldId),
      ])
      setResources(nextResources)
      setTypes(nextTypes)
      setHoldings(nextHoldings)
      setOrgs(nextOrgs)
    } catch (e: any) {
      onError(String(e.message || e))
    }
  }, [worldId, onError])

  useEffect(() => {
    reload()
  }, [reload])

  const typeName = (id: string) => types.find((t) => t.id === id)?.name || '—'

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: '16px', height: '100%' }}>
      <div style={{ ...card, padding: '14px', overflow: 'auto' }}>
        <div style={{ fontSize: '14px', color: 'var(--text-main)', marginBottom: '10px' }}>资源</div>
        {resources.length === 0 && <Empty text="还没有资源" />}
        {resources.map((resource) => (
          <div key={resource.id} style={{ padding: '10px', border: '1px solid var(--card-border)', borderRadius: '9px', marginBottom: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-main)' }}>{resource.name}</span>
              <span style={{ fontSize: '13px', color: 'var(--text-main)' }}>
                {resource.quantity} {resource.unit}
              </span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {typeName(resource.resource_type_id)} ·{' '}
              {holdings.filter((h) => h.resource_id === resource.id).length} 条持有关系
            </div>
          </div>
        ))}
      </div>

      <div style={{ ...card, padding: '16px', overflow: 'auto' }}>
        <div style={{ fontSize: '14px', color: 'var(--text-main)', marginBottom: '12px' }}>新增资源</div>
        <Field label="名称">
          <input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="类型">
          <select style={inputStyle} value={form.typeId} onChange={(e) => setForm({ ...form, typeId: e.target.value })}>
            <option value="">选择类型</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ flex: 1 }}>
            <Field label="数量">
              <input style={inputStyle} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </Field>
          </div>
          <div style={{ flex: 1 }}>
            <Field label="单位">
              <input style={inputStyle} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            </Field>
          </div>
        </div>
        <Btn
          kind="primary"
          onClick={async () => {
            if (!form.name.trim() || !form.typeId) return onError('请填写名称并选择类型')
            try {
              await api.createResource(worldId, {
                name: form.name,
                resource_type_id: form.typeId,
                quantity: Number(form.quantity) || 0,
                unit: form.unit,
              })
              setForm({ name: '', typeId: '', quantity: '0', unit: '' })
              await reload()
            } catch (e: any) {
              onError(String(e.message || e))
            }
          }}
        >
          创建资源
        </Btn>

        <div style={{ borderTop: '1px solid var(--card-border)', margin: '16px 0' }} />

        <div style={{ fontSize: '13px', color: 'var(--text-main)', marginBottom: '10px' }}>持有 / 管理 / 使用</div>
        <Field label="资源">
          <select style={inputStyle} value={holdingForm.resourceId} onChange={(e) => setHoldingForm({ ...holdingForm, resourceId: e.target.value })}>
            <option value="">选择资源</option>
            {resources.map((resource) => (
              <option key={resource.id} value={resource.id}>
                {resource.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="角色">
          <select style={inputStyle} value={holdingForm.role} onChange={(e) => setHoldingForm({ ...holdingForm, role: e.target.value })}>
            <option value="holder">持有者</option>
            <option value="manager">管理者</option>
            <option value="user">可使用者</option>
          </select>
        </Field>
        <Field label="组织">
          <select style={inputStyle} value={holdingForm.holderId} onChange={(e) => setHoldingForm({ ...holdingForm, holderId: e.target.value })}>
            <option value="">选择组织</option>
            {orgs.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </Field>
        <Btn
          onClick={async () => {
            if (!holdingForm.resourceId || !holdingForm.holderId) return onError('请选择资源与组织')
            try {
              await api.createHolding({
                world_id: worldId,
                resource_id: holdingForm.resourceId,
                holder_type: 'organization',
                holder_id: holdingForm.holderId,
                role: holdingForm.role,
              })
              await reload()
            } catch (e: any) {
              onError(String(e.message || e))
            }
          }}
        >
          添加持有关系
        </Btn>

        <div style={{ borderTop: '1px solid var(--card-border)', margin: '16px 0' }} />

        <div style={{ fontSize: '13px', color: 'var(--text-main)', marginBottom: '10px' }}>收支（写流水 + 历史）</div>
        <Field label="资源">
          <select style={inputStyle} value={txForm.resourceId} onChange={(e) => setTxForm({ ...txForm, resourceId: e.target.value })}>
            <option value="">选择资源</option>
            {resources.map((resource) => (
              <option key={resource.id} value={resource.id}>
                {resource.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="变动（负数=支出）">
          <input style={inputStyle} value={txForm.amount} onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })} />
        </Field>
        <Field label="原因">
          <input style={inputStyle} value={txForm.reason} onChange={(e) => setTxForm({ ...txForm, reason: e.target.value })} />
        </Field>
        <Btn
          onClick={async () => {
            if (!txForm.resourceId || !txForm.amount) return onError('请选择资源并填写变动值')
            try {
              await api.createTransaction({
                world_id: worldId,
                resource_id: txForm.resourceId,
                amount: Number(txForm.amount),
                reason: txForm.reason,
              })
              setTxForm({ resourceId: '', amount: '', reason: '' })
              await reload()
            } catch (e: any) {
              onError(String(e.message || e))
            }
          }}
        >
          记录变动
        </Btn>
      </div>
    </div>
  )
}

// =====================================================================
// 通用目录节点（世界基础 / 人物与群体）：支持绑定真实实体
// =====================================================================

type RefOption = { id: string; name: string }

const REF_TYPES: { value: string; label: string }[] = [
  { value: 'location', label: '地点' },
  { value: 'organization', label: '组织' },
  { value: 'character', label: '人物' },
  { value: 'society', label: '社会实体' },
  { value: 'social_group', label: '社会群体' },
  { value: 'resource', label: '资源' },
  { value: 'rule', label: '规则' },
  { value: 'era', label: '时代' },
]

function flattenLocations(nodes: api.LocationNode[]): RefOption[] {
  return nodes.flatMap((node) => [
    { id: node.id, name: node.name },
    ...flattenLocations(node.children || []),
  ])
}

function NodesPanel({
  worldId,
  branch,
  onError,
}: {
  worldId: string
  branch: BranchKey
  onError: (msg: string) => void
}) {
  const [nodes, setNodes] = useState<api.WorldNode[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [refOptions, setRefOptions] = useState<Record<string, RefOption[]>>({})
  const [characters, setCharacters] = useState<api.CharacterLite[]>([])
  const [form, setForm] = useState({
    name: '',
    description: '',
    nodeType: 'folder' as 'folder' | 'entity_ref' | 'note',
    refType: 'location',
    refId: '',
  })

  const selected = nodes.find((node) => node.id === selectedId) || null

  const reload = useCallback(async () => {
    try {
      const [nextNodes, nextChars, locTree, orgs, chars, societies, groups, resources, rules, eras] =
        await Promise.all([
          api.listNodes(worldId, branch),
          branch === 'people_groups' ? api.listCharacters(worldId) : Promise.resolve([]),
          api.getLocationTree(worldId),
          api.listOrganizations(worldId),
          api.listCharacters(worldId),
          api.listSocieties(worldId),
          api.listSocialGroups(worldId),
          api.listResources(worldId),
          api.listRules(worldId),
          api.listEras(worldId),
        ])
      setNodes(nextNodes)
      setCharacters(nextChars)
      setRefOptions({
        location: flattenLocations(locTree),
        organization: orgs.map((item) => ({ id: item.id, name: item.name })),
        character: chars.map((item) => ({ id: item.id, name: item.name })),
        society: societies.map((item) => ({ id: item.id, name: item.name })),
        social_group: groups.map((item) => ({ id: item.id, name: item.name })),
        resource: resources.map((item) => ({ id: item.id, name: item.name })),
        rule: rules.map((item) => ({ id: item.id, name: item.name })),
        era: eras.map((item) => ({ id: item.id, name: item.name })),
      })
    } catch (e: any) {
      onError(String(e.message || e))
    }
  }, [worldId, branch, onError])

  useEffect(() => {
    reload()
  }, [reload])

  const roots = nodes.filter((node) => !node.parent_id || !nodes.some((n) => n.id === node.parent_id))
  const childrenOf = (id: string) => nodes.filter((node) => node.parent_id === id)

  const refName = (type: string | null, id: string | null) => {
    if (!type || !id) return ''
    return refOptions[type]?.find((option) => option.id === id)?.name || id
  }

  const resetForm = () => {
    setSelectedId('')
    setForm({ name: '', description: '', nodeType: 'folder', refType: 'location', refId: '' })
  }

  const selectNode = (node: api.WorldNode) => {
    setSelectedId(node.id)
    setForm({
      name: node.name,
      description: node.description || '',
      nodeType: (node.node_type as any) || 'folder',
      refType: node.ref_type || 'location',
      refId: node.ref_id || '',
    })
  }

  const save = async () => {
    if (!form.name.trim()) return onError('节点名称不能为空')
    if (form.nodeType === 'entity_ref' && (!form.refType || !form.refId)) {
      return onError('绑定实体时必须选择实体类型与具体实体')
    }
    const payload = {
      name: form.name,
      description: form.description,
      node_type: form.nodeType,
      ref_type: form.nodeType === 'entity_ref' ? form.refType : null,
      ref_id: form.nodeType === 'entity_ref' ? form.refId : null,
    }
    try {
      if (selected) {
        await api.updateNode(selected.id, payload)
      } else {
        await api.createNode(worldId, { ...payload, branch })
      }
      resetForm()
      await reload()
    } catch (e: any) {
      onError(String(e.message || e))
    }
  }

  const remove = async () => {
    if (!selected) return
    if (!window.confirm(`删除节点「${selected.name}」？`)) return
    try {
      await api.deleteNode(selected.id)
      resetForm()
      await reload()
    } catch (e: any) {
      onError(String(e.message || e))
    }
  }

  const renderNode = (node: api.WorldNode, depth: number) => {
    const bound = node.node_type === 'entity_ref' ? refName(node.ref_type, node.ref_id) : ''
    return (
      <div key={node.id}>
        <div
          onClick={() => selectNode(node)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '7px 10px',
            paddingLeft: `${10 + depth * 18}px`,
            borderBottom: '1px solid var(--card-border)',
            borderLeft: selectedId === node.id ? '2px solid var(--text-main)' : '2px solid transparent',
            background: selectedId === node.id ? 'var(--card-bg)' : 'transparent',
            fontSize: '13px',
            color: 'var(--text-main)',
            cursor: 'pointer',
          }}
        >
          <span style={{ opacity: 0.45, fontSize: '11px' }}>{depth === 0 ? '◆' : '└'}</span>
          <span style={{ flex: 1 }}>{node.name}</span>
          {bound && <Tag tone="accent">→ {bound}</Tag>}
          <Tag>{node.node_type === 'folder' ? '目录' : node.node_type === 'entity_ref' ? '实体' : '笔记'}</Tag>
        </div>
        {childrenOf(node.id).map((child) => renderNode(child, depth + 1))}
      </div>
    )
  }

  const options = refOptions[form.refType] || []

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: '16px', height: '100%' }}>
      <div style={{ ...card, padding: '14px', overflow: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ fontSize: '14px', color: 'var(--text-main)' }}>
            {branch === 'world_profile' ? '世界基础目录' : '人物与群体目录'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {nodes.length} 个节点 · 点击可编辑/绑定实体
          </div>
        </div>
        {roots.length === 0 && <Empty text="暂无目录节点" />}
        {roots.map((node) => renderNode(node, 0))}
      </div>

      <div style={{ ...card, padding: '16px', overflow: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ fontSize: '14px', color: 'var(--text-main)' }}>
            {selected ? `编辑节点：${selected.name}` : '新增目录节点'}
          </div>
          {selected && (
            <button
              onClick={resetForm}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '11px', cursor: 'pointer' }}
            >
              取消选择
            </button>
          )}
        </div>

        <Field label="名称">
          <input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="类型">
          <select
            style={inputStyle}
            value={form.nodeType}
            onChange={(e) => setForm({ ...form, nodeType: e.target.value as any })}
          >
            <option value="folder">目录（仅展示）</option>
            <option value="entity_ref">绑定实体</option>
            <option value="note">笔记</option>
          </select>
        </Field>

        {form.nodeType === 'entity_ref' && (
          <>
            <Field label="实体类型">
              <select
                style={inputStyle}
                value={form.refType}
                onChange={(e) => setForm({ ...form, refType: e.target.value, refId: '' })}
              >
                {REF_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="绑定到">
              <select style={inputStyle} value={form.refId} onChange={(e) => setForm({ ...form, refId: e.target.value })}>
                <option value="">选择实体</option>
                {options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </Field>
            {options.length === 0 && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '-4px', marginBottom: '10px' }}>
                该世界还没有「{REF_TYPES.find((item) => item.value === form.refType)?.label}」实体。
              </div>
            )}
          </>
        )}

        <Field label="说明">
          <textarea
            style={{ ...inputStyle, minHeight: '56px' }}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>

        <div style={{ display: 'flex', gap: '8px' }}>
          <Btn kind="primary" onClick={save}>
            {selected ? '保存' : '创建'}
          </Btn>
          {selected && <Btn kind="danger" onClick={remove}>删除</Btn>}
          {selected && selected.node_type === 'entity_ref' && (
            <Btn
              onClick={async () => {
                try {
                  await api.updateNode(selected.id, { node_type: 'folder', ref_type: null, ref_id: null })
                  resetForm()
                  await reload()
                } catch (e: any) {
                  onError(String(e.message || e))
                }
              }}
            >
              解除绑定
            </Btn>
          )}
        </div>

        {selected?.node_type === 'entity_ref' && (
          <div style={{ marginTop: '14px', fontSize: '11px', color: 'var(--text-muted)' }}>
            当前绑定：
            {REF_TYPES.find((item) => item.value === selected.ref_type)?.label || selected.ref_type} /{' '}
            {refName(selected.ref_type, selected.ref_id) || selected.ref_id}
          </div>
        )}

        {branch === 'people_groups' && (
          <>
            <div style={{ borderTop: '1px solid var(--card-border)', margin: '16px 0' }} />
            <div style={{ fontSize: '13px', color: 'var(--text-main)', marginBottom: '8px' }}>
              本世界人物（{characters.length}）
            </div>
            {characters.length === 0 && <Empty text="人物由人物管理模块创建" />}
            {characters.map((character) => (
              <div key={character.id} style={{ fontSize: '12px', color: 'var(--text-main)', padding: '3px 0' }}>
                · {character.name}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

// =====================================================================
// 创作草稿：写作工作台提取后待入库的素材
// =====================================================================

const DRAFT_TYPE_LABEL: Record<DraftItem['entity_type'], string> = {
  character: '人物',
  location: '地点',
  event: '事件',
  organization: '组织',
  relationship: '关系',
}

function DraftPanel({ worldId, onError }: { worldId: string; onError: (msg: string) => void }) {
  const [drafts, setDrafts] = useState<DraftItem[]>([])
  const [filter, setFilter] = useState<'pending' | 'all'>('all')
  const [busyId, setBusyId] = useState('')
  const [bulkBusy, setBulkBusy] = useState(false)
  const [notice, setNotice] = useState('')

  const reload = useCallback(async () => {
    try {
      setDrafts(await writingApi.listWorldDrafts(worldId, filter))
    } catch (e: any) {
      onError(String(e.message || e))
    }
  }, [worldId, filter, onError])

  useEffect(() => {
    reload()
  }, [reload])

  const approve = async (draft: DraftItem) => {
    const target = draft.target_label || DRAFT_TYPE_LABEL[draft.entity_type]
    if (!window.confirm(`将「${draft.name}」入库到【${target}】？\n\n${draft.target_detail || ''}`)) return
    setBusyId(draft.id)
    try {
      const result = await writingApi.approveDraft(draft.id)
      setNotice(result.message || `${draft.name} 已入库`)
      await reload()
    } catch (e: any) {
      onError(String(e.message || e))
    } finally {
      setBusyId('')
    }
  }

  const approveAll = async () => {
    const pending = drafts.filter((draft) => draft.status === 'pending')
    if (pending.length === 0) return
    const byTarget = pending.reduce<Record<string, number>>((acc, draft) => {
      const target = draft.target_label || DRAFT_TYPE_LABEL[draft.entity_type]
      acc[target] = (acc[target] || 0) + 1
      return acc
    }, {})
    const summary = Object.entries(byTarget).map(([target, count]) => `${target} ${count} 条`).join('；')
    if (!window.confirm(`将 ${pending.length} 条草稿分批入库：\n${summary}\n\n入库后可逐条撤销。`)) return
    setBulkBusy(true)
    let done = 0
    let failure = ''
    for (const draft of pending) {
      try {
        await writingApi.approveDraft(draft.id)
        done += 1
      } catch (e: any) {
        failure = `${draft.name}：${String(e.message || e)}`
      }
    }
    setNotice(`已入库 ${done} 条${failure ? `；${failure}` : ''}`)
    setBulkBusy(false)
    await reload()
  }

  const undo = async (draft: DraftItem) => {
    if (!window.confirm(`撤销「${draft.name}」的入库？\n\n这会删除刚创建的${draft.target_label || '实体'}，草稿退回待入库。`)) return
    setBusyId(draft.id)
    try {
      const result = await writingApi.undoDraftApproval(draft.id)
      setNotice(result.message)
      await reload()
    } catch (e: any) {
      onError(String(e.message || e))
    } finally {
      setBusyId('')
    }
  }

  const remove = async (draft: DraftItem) => {
    if (!window.confirm(`删除草稿「${draft.name}」？`)) return
    setBusyId(draft.id)
    try {
      await writingApi.deleteDraft(draft.id)
      setNotice(`${draft.name} 草稿已删除`)
      await reload()
    } catch (e: any) {
      onError(String(e.message || e))
    } finally {
      setBusyId('')
    }
  }

  const edit = async (draft: DraftItem) => {
    const name = window.prompt('修改草稿名称', draft.name)
    if (name === null) return
    const summary = window.prompt('修改草稿摘要', draft.summary || '')
    if (summary === null) return
    try {
      await writingApi.updateDraft(draft.id, { name: name.trim() || draft.name, summary })
      setNotice(`${draft.name} 已更新`)
      await reload()
    } catch (e: any) {
      onError(String(e.message || e))
    }
  }

  const ignore = async (draft: DraftItem) => {
    setBusyId(draft.id)
    try {
      await writingApi.ignoreDraft(draft.id)
      setNotice(`${draft.name} 已忽略`)
      await reload()
    } catch (e: any) {
      onError(String(e.message || e))
    } finally {
      setBusyId('')
    }
  }

  return (
    <div style={{ padding: '22px 26px', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '21px', color: 'var(--text-main)' }}>创作草稿</h2>
          <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.7 }}>
            写作工作台从章节里提取的素材先停在这里。入库后会以“待细化”状态进入对应结构分支。
          </p>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <Btn
            kind="primary"
            onClick={() => void approveAll()}
            disabled={bulkBusy || !drafts.some((draft) => draft.status === 'pending')}
          >
            {bulkBusy ? '批量入库中…' : '全部入库'}
          </Btn>
          <Btn kind={filter === 'pending' ? 'primary' : 'ghost'} onClick={() => setFilter('pending')}>待入库</Btn>
          <Btn kind={filter === 'all' ? 'primary' : 'ghost'} onClick={() => setFilter('all')}>全部</Btn>
        </div>
      </div>

      {notice && (
        <div style={{ marginTop: '14px', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--primary-color)', fontSize: '11px', color: 'var(--text-main)' }}>
          {notice}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '18px', maxWidth: '860px' }}>
        {drafts.length === 0 && (
          <div style={{ ...card, padding: '34px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.9 }}>
            还没有草稿。<br />
            去 08 写作工作台写一章，点“解析本章”，提取结果会出现在这里。
          </div>
        )}
        {drafts.map((draft) => (
          <div key={draft.id} style={{ ...card, padding: '15px 17px', opacity: draft.status === 'pending' ? 1 : 0.55 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)' }}>{draft.name}</span>
                  <Tag>{DRAFT_TYPE_LABEL[draft.entity_type]}</Tag>
                  <Tag tone="accent">{Math.round((draft.confidence || 0) * 100)}%</Tag>
                  {draft.status !== 'pending' && <Tag tone={draft.status === 'accepted' ? 'accent' : 'warn'}>{draft.status === 'accepted' ? '已入库' : '已忽略'}</Tag>}
                </div>
                {draft.summary && (
                  <p style={{ margin: '7px 0 0', fontSize: '12px', color: 'var(--text-main)', lineHeight: 1.7 }}>{draft.summary}</p>
                )}
                {draft.evidence && (
                  <p style={{ margin: '6px 0 0', fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.65, borderLeft: '2px solid var(--card-border)', paddingLeft: '8px' }}>
                    原文：{draft.evidence}
                  </p>
                )}
                <div style={{ marginTop: '7px', fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.7 }}>
                  来源：{draft.story_title || '未知章节'}<br />
                  入库去向：<strong style={{ color: 'var(--text-main)' }}>{draft.target_label || DRAFT_TYPE_LABEL[draft.entity_type]}</strong>
                  {draft.target_branch ? ` · ${draft.target_branch}` : ''}
                  {draft.status === 'accepted' && draft.approved_entity_id ? ` · 实体 ID ${draft.approved_entity_id}` : ''}
                </div>
              </div>
              {draft.status === 'pending' && (
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '260px' }}>
                  <Btn kind="primary" onClick={() => void approve(draft)} disabled={busyId === draft.id}>
                    {busyId === draft.id ? '入库中…' : `入库到${draft.target_label || DRAFT_TYPE_LABEL[draft.entity_type]}`}
                  </Btn>
                  <Btn onClick={() => void edit(draft)} disabled={busyId === draft.id}>编辑</Btn>
                  <Btn onClick={() => void ignore(draft)} disabled={busyId === draft.id}>忽略</Btn>
                  <Btn kind="danger" onClick={() => void remove(draft)} disabled={busyId === draft.id}>删除草稿</Btn>
                </div>
              )}
              {draft.status === 'accepted' && (
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0, flexDirection: 'column' }}>
                  <Btn kind="danger" onClick={() => void undo(draft)} disabled={busyId === draft.id}>
                    {busyId === draft.id ? '撤销中…' : '撤销入库'}
                  </Btn>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)', maxWidth: '140px', lineHeight: 1.5 }}>删除错误实体，草稿退回待入库</span>
                </div>
              )}
              {draft.status === 'ignored' && (
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  <Btn kind="danger" onClick={() => void remove(draft)} disabled={busyId === draft.id}>删除草稿</Btn>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
