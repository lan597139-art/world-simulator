import Dexie, { type Table } from 'dexie'
import type { World } from '../types/world'
import type { WorldBuildingConfig } from '../types/worldBuilding'

export type LocalDraft = {
  id: string
  userId: string
  worldId: string
  kind: string
  title: string
  payload: unknown
  createdAt: string
  updatedAt: string
}

export type LocalBackup = {
  id: string
  userId: string
  label: string
  payload: unknown
  createdAt: string
}

export type LocalMediaRecord = {
  id: string
  userId: string
  worldId: string
  name: string
  mime: string
  size: number
  blob?: Blob
  remoteUrl?: string
  createdAt: string
}

class WorldSimulatorDatabase extends Dexie {
  worlds!: Table<World, string>
  worldBuildingConfigs!: Table<WorldBuildingConfig, string>
  characters!: Table<any, string> // ✅ 新增：声明人物表
  localDrafts!: Table<LocalDraft, string>
  localBackups!: Table<LocalBackup, string>
  localMedia!: Table<LocalMediaRecord, string>
  localMeta!: Table<{ key: string; value: string }, string>

  constructor() {
    super('WorldSimulatorDB')

    this.version(1).stores({
      worlds: 'id, name, type, createdAt, updatedAt',
    })

    this.version(2).stores({
      worlds: 'id, name, type, createdAt, updatedAt',
      worldBuildingConfigs: 'id, worldId, updatedAt',
    })

    // ✅ 新增：版本 3，加入人物表
    this.version(3).stores({
      worlds: 'id, name, type, createdAt, updatedAt',
      worldBuildingConfigs: 'id, worldId, updatedAt',
      characters: 'id, worldId, name, updatedAt', 
    })

    // 版本 4：按用户隔离的本地创作草稿、备份与媒体索引。
    this.version(4).stores({
      worlds: 'id, name, type, createdAt, updatedAt',
      worldBuildingConfigs: 'id, worldId, updatedAt',
      characters: 'id, worldId, name, updatedAt',
      localDrafts: 'id, userId, worldId, kind, updatedAt',
      localBackups: 'id, userId, createdAt',
      localMedia: 'id, userId, worldId, createdAt',
      localMeta: 'key',
    })
  }
}

export const db = new WorldSimulatorDatabase()