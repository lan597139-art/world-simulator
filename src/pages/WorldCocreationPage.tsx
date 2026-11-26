/**
 * 共创：世界共创的邀请与创作开发选择。
 *
 * - 协作成员：复用世界协作接口，邀请成员、调整角色、移除成员。
 * - 创作开发选择：本世界共创方向的可配置项（新增 / 编辑 / 删除）。
 */
import { useEffect, useState } from 'react'
import { Users, Plus, Pencil, Trash2, UserPlus } from 'lucide-react'
import * as api from '../api/worldCreation'
import * as collab from '../api/collaboration'
import type { WorldCocreationChoice } from '../api/worldCreation'
import { Btn, Card, Empty, Field, Select, Tag, TextArea, TextInput, WorldCreationPage, formatDate } from '../components/world-creation/WorldCreationShell'
import '../styles/world-creation.css'

const ROLE_LABELS: Record<string, string> = { owner: '创建者', editor: '编辑者', viewer: '只读' }
const STATUS_LABELS: Record<string, string> = { pending: '待接受', accepted: '已加入', declined: '已拒绝' }

export default function WorldCocreationPage({ worldId }: { worldId: string }) {
  const [collabData, setCollabData] = useState<collab.CollaboratorList | null>(null)
  const [choices, setChoices] = useState<WorldCocreationChoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('viewer')
  const [inviting, setInviting] = useState(false)

  const [editingChoice, setEditingChoice] = useState<WorldCocreationChoice | null>(null)
  const [creatingChoice, setCreatingChoice] = useState(false)
  const [choiceForm, setChoiceForm] = useState({ title: '', description: '' })
  const [savingChoice, setSavingChoice] = useState(false)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [collabResult, choiceResult] = await Promise.all([
        collab.listWorldCollaborators(worldId),
        api.listCocreationChoices(worldId),
      ])
      setCollabData(collabResult)
      setChoices(choiceResult)
    } catch (err) {
      setError(String((err as Error).message || err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [worldId])

  const invite = async () => {
    const username = inviteName.trim().replace(/^@/, '')
    if (!username) {
      setError('请输入要邀请的用户名')
      return
    }
    setInviting(true)
    setError('')
    try {
      await collab.inviteWorldCollaborator(worldId, username, inviteRole)
      setInviteName('')
      await load()
    } catch (err) {
      setError(String((err as Error).message || err))
    } finally {
      setInviting(false)
    }
  }

  const changeRole = async (id: string, role: 'editor' | 'viewer') => {
    try {
      await collab.updateWorldCollaborator(id, role)
      await load()
    } catch (err) {
      setError(String((err as Error).message || err))
    }
  }

  const removeCollaborator = async (id: string) => {
    if (!window.confirm('确定移除该协作成员？')) return
    try {
      await collab.removeWorldCollaborator(id)
      await load()
    } catch (err) {
      setError(String((err as Error).message || err))
    }
  }

  const startCreateChoice = () => {
    setCreatingChoice(true)
    setEditingChoice(null)
    setChoiceForm({ title: '', description: '' })
  }

  const startEditChoice = (choice: WorldCocreationChoice) => {
    setCreatingChoice(false)
    setEditingChoice(choice)
    setChoiceForm({ title: choice.title, description: choice.description })
  }

  const cancelChoice = () => {
    setCreatingChoice(false)
    setEditingChoice(null)
    setChoiceForm({ title: '', description: '' })
  }

  const saveChoice = async () => {
    if (!choiceForm.title.trim()) {
      setError('选择项名称不能为空')
      return
    }
    setSavingChoice(true)
    setError('')
    try {
      if (editingChoice) {
        await api.updateCocreationChoice(worldId, editingChoice.id, choiceForm)
      } else {
        await api.createCocreationChoice(worldId, choiceForm)
      }
      cancelChoice()
      await load()
    } catch (err) {
      setError(String((err as Error).message || err))
    } finally {
      setSavingChoice(false)
    }
  }

  const removeChoice = async (choice: WorldCocreationChoice) => {
    if (!window.confirm(`确定删除「${choice.title}」？`)) return
    try {
      await api.deleteCocreationChoice(worldId, choice.id)
      await load()
    } catch (err) {
      setError(String((err as Error).message || err))
    }
  }

  const canManage = Boolean(collabData?.can_manage)
  const showChoiceEditor = creatingChoice || Boolean(editingChoice)

  return (
    <WorldCreationPage
      title="共创"
      subtitle="邀请协作成员，并配置本世界共创的创作开发方向"
      icon={<Users size={16} />}
      error={error}
      onRetry={load}
    >
      {loading && <Card><Empty text="加载中…" /></Card>}
      {!loading && collabData && (
        <Card
          title="协作成员"
          aside={
            <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Tag tone="accent">{ROLE_LABELS[collabData.role] || collabData.role}</Tag>
            </span>
          }
        >
          {canManage && (
            <div className="wc-form-row">
              <Field label="邀请用户名">
                <TextInput value={inviteName} onChange={setInviteName} placeholder="输入对方用户名" />
              </Field>
              <Field label="角色">
                <Select
                  value={inviteRole}
                  onChange={(value) => setInviteRole(value as 'editor' | 'viewer')}
                  options={[{ value: 'viewer', label: '只读' }, { value: 'editor', label: '编辑者' }]}
                />
              </Field>
              <Field label=" ">
                <Btn kind="primary" onClick={invite} disabled={inviting}><UserPlus size={13} /> 邀请</Btn>
              </Field>
            </div>
          )}
          <div className="wc-list" style={{ marginTop: canManage ? 14 : 0 }}>
            <div className="wc-row">
              <div className="wc-row-copy">
                <div className="wc-row-title">{collabData.owner.name || collabData.owner.username || '创建者'}</div>
                <div className="wc-row-meta">创建者 · 拥有全部权限</div>
              </div>
              <span className="wc-tag is-accent">{ROLE_LABELS.owner}</span>
            </div>
            {collabData.items.length === 0 ? (
              <Empty text="还没有协作成员。" />
            ) : (
              collabData.items.map((item) => (
                <div className="wc-row" key={item.id}>
                  <div className="wc-row-copy">
                    <div className="wc-row-title">{item.user.name || item.user.username || '已注销用户'}</div>
                    <div className="wc-row-meta">
                      {item.user.username} · {STATUS_LABELS[item.status] || item.status}
                      {item.created_at && ` · 加入于 ${formatDate(item.created_at)}`}
                    </div>
                  </div>
                  <div className="wc-row-actions">
                    {canManage && (
                      <>
                        <Select
                          value={item.role}
                          onChange={(value) => void changeRole(item.id, value as 'editor' | 'viewer')}
                          options={[{ value: 'viewer', label: '只读' }, { value: 'editor', label: '编辑者' }]}
                        />
                        <Btn kind="danger" onClick={() => void removeCollaborator(item.id)}><Trash2 size={12} /></Btn>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      <Card
        title={editingChoice ? `编辑开发选择：${editingChoice.title}` : '新增开发选择'}
        aside={showChoiceEditor && <Btn onClick={cancelChoice}>取消</Btn>}
      >
        {showChoiceEditor ? (
          <>
            <Field label="名称">
              <TextInput value={choiceForm.title} onChange={(value) => setChoiceForm((prev) => ({ ...prev, title: value }))} />
            </Field>
            <Field label="说明">
              <TextArea rows={3} value={choiceForm.description} onChange={(value) => setChoiceForm((prev) => ({ ...prev, description: value }))} />
            </Field>
            <div style={{ display: 'flex', gap: 10 }}>
              <Btn kind="primary" onClick={saveChoice} disabled={savingChoice}>{savingChoice ? '保存中…' : '保存'}</Btn>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn kind="primary" onClick={startCreateChoice}><Plus size={13} /> 新增开发选择</Btn>
          </div>
        )}
      </Card>

      <Card title={`创作开发选择（${choices.length}）`}>
        {choices.length === 0 ? (
          <Empty text="还没有配置共创开发选择。" />
        ) : (
          <div className="wc-list">
            {choices.map((choice) => (
              <div className="wc-row" key={choice.id}>
                <div className="wc-row-copy">
                  <div className="wc-row-title">{choice.title}</div>
                  <div className="wc-row-meta">{choice.description || '暂无说明'}</div>
                </div>
                <div className="wc-row-actions">
                  <Btn onClick={() => startEditChoice(choice)}><Pencil size={12} /> 编辑</Btn>
                  <Btn kind="danger" onClick={() => void removeChoice(choice)}><Trash2 size={12} /></Btn>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </WorldCreationPage>
  )
}
