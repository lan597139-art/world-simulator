import { db, type LocalBackup, type LocalDraft, type LocalMediaRecord } from '../db/database'
import { getStoredAuthUser } from '../api/authToken'

export function localUserId(): string {
  return getStoredAuthUser()?.id || 'local'
}

export async function saveLocalDraft(input: {
  kind: string
  title?: string
  worldId?: string
  payload: unknown
  id?: string
}): Promise<LocalDraft> {
  const userId = localUserId()
  const now = new Date().toISOString()
  const existing = input.id ? await db.localDrafts.get(input.id) : undefined
  if (existing && existing.userId !== userId) throw new Error('不能修改其他用户的本地草稿')
  const draft: LocalDraft = {
    id: existing?.id || input.id || crypto.randomUUID(),
    userId,
    worldId: input.worldId || '',
    kind: input.kind,
    title: input.title || '未命名草稿',
    payload: input.payload,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  }
  await db.localDrafts.put(draft)
  return draft
}

export async function listLocalDrafts(kind?: string, worldId?: string): Promise<LocalDraft[]> {
  const userId = localUserId()
  let rows = await db.localDrafts.where('userId').equals(userId).toArray()
  if (kind) rows = rows.filter((row) => row.kind === kind)
  if (worldId) rows = rows.filter((row) => row.worldId === worldId)
  return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function deleteLocalDraft(id: string): Promise<void> {
  const userId = localUserId()
  const row = await db.localDrafts.get(id)
  if (!row || row.userId !== userId) return
  await db.localDrafts.delete(id)
}

export async function saveLocalBackup(label: string, payload: unknown): Promise<LocalBackup> {
  const userId = localUserId()
  const backup: LocalBackup = {
    id: crypto.randomUUID(),
    userId,
    label,
    payload,
    createdAt: new Date().toISOString(),
  }
  await db.localBackups.put(backup)
  // 每个用户最多保留最近 20 份本地备份。
  const rows = await db.localBackups.where('userId').equals(userId).toArray()
  const stale = rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(20)
  if (stale.length) await db.localBackups.bulkDelete(stale.map((row) => row.id))
  return backup
}

export async function listLocalBackups(): Promise<LocalBackup[]> {
  const userId = localUserId()
  const rows = await db.localBackups.where('userId').equals(userId).toArray()
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function saveLocalMedia(input: {
  file: Blob
  name: string
  mime?: string
  worldId?: string
}): Promise<LocalMediaRecord> {
  const userId = localUserId()
  const record: LocalMediaRecord = {
    id: crypto.randomUUID(),
    userId,
    worldId: input.worldId || '',
    name: input.name,
    mime: input.mime || input.file.type || 'application/octet-stream',
    size: input.file.size,
    blob: input.file,
    createdAt: new Date().toISOString(),
  }
  await db.localMedia.put(record)
  return record
}

export async function listLocalMedia(worldId?: string): Promise<LocalMediaRecord[]> {
  const userId = localUserId()
  let rows = await db.localMedia.where('userId').equals(userId).toArray()
  if (worldId) rows = rows.filter((row) => row.worldId === worldId)
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function exportLocalWorkspace(): Promise<Blob> {
  const userId = localUserId()
  const [drafts, backups, media] = await Promise.all([
    db.localDrafts.where('userId').equals(userId).toArray(),
    db.localBackups.where('userId').equals(userId).toArray(),
    db.localMedia.where('userId').equals(userId).toArray(),
  ])
  const payload = {
    format: 'world-simulator-local-workspace',
    version: 1,
    exportedAt: new Date().toISOString(),
    userId,
    drafts,
    backups,
    media: media.map(({ blob, ...rest }) => ({ ...rest, hasBlob: Boolean(blob) })),
  }
  return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
}

export async function clearLocalWorkspace(): Promise<void> {
  const userId = localUserId()
  await db.transaction('rw', db.localDrafts, db.localBackups, db.localMedia, async () => {
    await db.localDrafts.where('userId').equals(userId).delete()
    await db.localBackups.where('userId').equals(userId).delete()
    await db.localMedia.where('userId').equals(userId).delete()
  })
}
