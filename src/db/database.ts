import Dexie, { type Table } from 'dexie'
import type { World } from '../types/world'
import type { WorldBuildingConfig } from '../types/worldBuilding'

class WorldSimulatorDatabase extends Dexie {
  worlds!: Table<World, string>
  worldBuildingConfigs!: Table<WorldBuildingConfig, string>
  characters!: Table<any, string> // ✅ 新增：声明人物表

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
  }
}

export const db = new WorldSimulatorDatabase()