import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, Loader2, Shield, UserPlus, Users, X } from 'lucide-react'
import {
  inviteWorldCollaborator,
  heartbeatWorldPresence,
  listWorldCollaborators,
  removeWorldCollaborator,
  updateWorldCollaborator,
  type CollaboratorList,
  type PresencePayload,
  type WorldCollaborator,
} from '../../api/collaboration'

type Props = {
  worldId: string
  worldName: string
  lang: string
  onClose: () => void
}

const copy = (lang: string, zh: string, en: string) => (lang === 'zh' ? zh : en)
const roleLabel = (lang: string, role: string) => (
  role === 'owner'
    ? copy(lang, '创建者', 'Owner')
    : role === 'editor'
      ? copy(lang, '可编辑', 'Editor')
      : copy(lang, '只读', 'Viewer')
)
const statusLabel = (lang: string, status: string) => (
  status === 'accepted'
    ? copy(lang, '已加入', 'Joined')
    : status === 'pending'
      ? copy(lang, '待接受', 'Pending')
      : copy(lang, '已拒绝', 'Declined')
)

const isOnline = (presence: PresencePayload | null, userId: string) => Boolean(presence?.online.some((item) => item.id === userId))

export default function WorldCollaborationDialog({ worldId, worldName, lang, onClose }: Props) {
  const [data, setData] = useState<CollaboratorList | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [username, setUsername] = useState('')
  const [role, setRole] = useState<'editor' | 'viewer'>('viewer')
  const [presence, setPresence] = useState<PresencePayload | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setData(await listWorldCollaborators(worldId))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [worldId])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    let live = true
    const beat = async () => {
      try {
        const payload = await heartbeatWorldPresence(worldId)
        if (live) setPresence(payload)
      } catch {
        // 在线状态失败不应影响成员管理。
      }
    }
    void beat()
    const timer = window.setInterval(beat, 15000)
    return () => { live = false; window.clearInterval(timer) }
  }, [worldId])

  const invite = async () => {
    const name = username.trim().replace(/^@/, '')
    if (!name) return
    setBusy('invite')
    setError('')
    setNotice('')
    try {
      await inviteWorldCollaborator(worldId, name, role)
      setUsername('')
      setNotice(copy(lang, '邀请已发送，对方会在通知中心看到。', 'Invitation sent. It appears in their notification center.'))
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy('')
    }
  }

  const changeRole = async (member: WorldCollaborator, next: 'editor' | 'viewer') => {
    setBusy(member.id)
    setError('')
    try {
      await updateWorldCollaborator(member.id, next)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy('')
    }
  }

  const remove = async (member: WorldCollaborator) => {
    const message = copy(
      lang,
      `移除「${member.user.name}」的协作权限？对方将立即失去该世界访问权。`,
      `Remove ${member.user.name} from this world? They lose access immediately.`,
    )
    if (!window.confirm(message)) return
    setBusy(member.id)
    setError('')
    try {
      await removeWorldCollaborator(member.id)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy('')
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={copy(lang, '世界协作成员', 'World collaborators')}
      onMouseDown={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px', background: 'rgba(0,0,0,.42)', backdropFilter: 'blur(6px)',
      }}
    >
      <div
        className="ws-glass-surface"
        onMouseDown={(event) => event.stopPropagation()}
        style={{
          width: 'min(620px, 100%)', maxHeight: 'min(760px, 88vh)', overflow: 'auto',
          borderRadius: '18px', padding: '22px', boxSizing: 'border-box',
          display: 'flex', flexDirection: 'column', gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '10px', letterSpacing: '.14em', color: 'var(--text-muted)' }}>COLLABORATION</div>
            <h2 style={{ margin: '4px 0 0', fontSize: '20px', color: 'var(--text-main)' }}>{worldName}</h2>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', marginTop: '6px', fontSize: '10px', color: 'var(--text-muted)' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: presence?.count ? '#22c55e' : 'var(--text-muted)', boxShadow: presence?.count ? '0 0 0 3px rgba(34,197,94,.14)' : 'none' }} />
              {copy(lang, `当前在线 ${presence?.count || 0} 人`, `${presence?.count || 0} online`)}
            </div>
            <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              {copy(
                lang,
                '创建者可邀请编辑者或只读成员。被邀请者接受后，世界才会出现在对方的世界列表。',
                'The owner can invite editors or viewers. A world appears in their list only after acceptance.',
              )}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label={copy(lang, '关闭', 'Close')} style={{ border: 0, background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}>
            <X size={18} />
          </button>
        </div>

        {error && <div role="alert" style={{ padding: '10px 12px', borderRadius: '10px', background: 'rgba(239,68,68,.1)', color: 'var(--danger-color)', fontSize: '12px' }}>{error}</div>}
        {notice && <div style={{ padding: '10px 12px', borderRadius: '10px', background: 'rgba(34,197,94,.1)', color: '#15803d', fontSize: '12px' }}>{notice}</div>}

        {loading ? (
          <div style={{ padding: '24px', display: 'flex', gap: '8px', alignItems: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            <Loader2 size={16} className="ws-spin" /> {copy(lang, '加载成员…', 'Loading members…')}
          </div>
        ) : data ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', borderRadius: '12px', border: '1px solid var(--card-border)', background: 'rgba(128,128,128,.06)' }}>
              <Shield size={16} color="var(--primary-color)" />
              <div style={{ flex: 1 }}>
                <strong style={{ fontSize: '13px', color: 'var(--text-main)' }}>
                  {isOnline(presence, data.owner.id) && <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', marginRight: '5px', verticalAlign: '1px' }} />}
                  {data.owner.name}
                </strong>
                <span style={{ marginLeft: '8px', fontSize: '10px', color: 'var(--text-muted)' }}>@{data.owner.username}</span>
              </div>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{roleLabel(lang, 'owner')}</span>
            </div>

            {data.can_manage && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <label style={{ flex: '1 1 220px', display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '11px', color: 'var(--text-muted)' }}>
                  {copy(lang, '用户名', 'Username')}
                  <input
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder={copy(lang, '输入对方用户名，不需要 @', 'Their username, without @')}
                    style={{ padding: '10px 12px', borderRadius: '9px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)', fontSize: '13px' }}
                  />
                </label>
                <label style={{ flex: '0 0 118px', display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '11px', color: 'var(--text-muted)' }}>
                  {copy(lang, '权限', 'Role')}
                  <select
                    value={role}
                    onChange={(event) => setRole(event.target.value as 'editor' | 'viewer')}
                    style={{ padding: '10px 12px', borderRadius: '9px', border: '1px solid var(--card-border)', background: 'var(--bg-color)', color: 'var(--text-main)', fontSize: '13px' }}
                  >
                    <option value="viewer">{roleLabel(lang, 'viewer')}</option>
                    <option value="editor">{roleLabel(lang, 'editor')}</option>
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => void invite()}
                  disabled={busy === 'invite' || !username.trim()}
                  style={{ alignSelf: 'flex-end', height: '39px', padding: '0 16px', borderRadius: '9px', border: '1px solid var(--primary-color)', background: 'var(--primary-color)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600 }}
                >
                  <UserPlus size={14} /> {copy(lang, '邀请', 'Invite')}
                </button>
              </div>
            )}

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
                <Users size={13} /> {copy(lang, '协作成员', 'Members')} · {data.items.length}
              </div>
              {data.items.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', border: '1px dashed var(--card-border)', borderRadius: '12px' }}>
                  {data.can_manage
                    ? copy(lang, '还没有协作成员。输入对方用户名发出邀请。', 'No collaborators yet. Invite someone by username.')
                    : copy(lang, '你是该世界的当前协作者。', 'You are the current collaborator on this world.')}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {data.items.map((member) => (
                    <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '11px', border: '1px solid var(--card-border)' }}>
                      <div style={{ width: '30px', height: '30px', borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'rgba(128,128,128,.12)', color: 'var(--text-main)', fontSize: '12px', overflow: 'hidden', boxShadow: isOnline(presence, member.user.id) ? '0 0 0 2px #22c55e' : 'none' }}>
                        {member.user.avatar ? <img src={member.user.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : member.user.name.slice(0, 1)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {isOnline(presence, member.user.id) && <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', marginRight: '5px', verticalAlign: '1px' }} />}
                          {member.user.name}
                        </strong>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>@{member.user.username} · {statusLabel(lang, member.status)}</span>
                      </div>
                      {data.can_manage ? (
                        <>
                          <select
                            value={member.role}
                            onChange={(event) => void changeRole(member, event.target.value as 'editor' | 'viewer')}
                            disabled={busy === member.id || member.status !== 'accepted'}
                            style={{ padding: '6px 8px', borderRadius: '7px', border: '1px solid var(--card-border)', background: 'var(--bg-color)', color: 'var(--text-main)', fontSize: '11px' }}
                          >
                            <option value="viewer">{roleLabel(lang, 'viewer')}</option>
                            <option value="editor">{roleLabel(lang, 'editor')}</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => void remove(member)}
                            disabled={busy === member.id}
                            aria-label={copy(lang, '移除成员', 'Remove member')}
                            style={{ border: 0, background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                          >
                            <X size={15} />
                          </button>
                        </>
                      ) : (
                        <>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{roleLabel(lang, member.role)}</span>
                          <button
                            type="button"
                            onClick={() => void remove(member)}
                            disabled={busy === member.id}
                            style={{ padding: '6px 9px', borderRadius: '7px', border: '1px solid rgba(239,68,68,.24)', background: 'rgba(239,68,68,.08)', color: 'var(--danger-color)', cursor: 'pointer', fontSize: '10px' }}
                          >
                            {copy(lang, '退出', 'Leave')}
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {data.can_manage && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', fontSize: '10px', lineHeight: 1.6, color: 'var(--text-muted)' }}>
                <Copy size={12} style={{ marginTop: '2px' }} />
                {copy(
                  lang,
                  '编辑者可以修改世界内人物、事件、关系与故事；创建者始终保留世界设定、删除和成员管理权限。',
                  'Editors can modify characters, events, relationships and stories. The owner keeps world settings, deletion and member management.',
                )}
              </div>
            )}
          </>
        ) : null}

        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '4px' }}>
          <button type="button" onClick={onClose} style={{ padding: '9px 16px', borderRadius: '9px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer', fontSize: '12px' }}>
            <Check size={13} style={{ verticalAlign: '-2px', marginRight: '4px' }} />
            {copy(lang, '完成', 'Done')}
          </button>
        </div>
      </div>
    </div>
  )
}
