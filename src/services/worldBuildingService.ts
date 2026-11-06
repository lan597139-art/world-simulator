
import { db } from '../db/database'
import type { WorldBuildingConfig } from '../types/worldBuilding'

export async function getWorldBuildingConfig(
  worldId: string
): Promise<WorldBuildingConfig | undefined> {
  return db.worldBuildingConfigs
    .where('worldId')
    .equals(worldId)
    .first()
}

export async function saveWorldBuildingConfig(
  config: WorldBuildingConfig
): Promise<void> {
  const existing = await getWorldBuildingConfig(config.worldId)

  const updatedConfig: WorldBuildingConfig = {
    ...config,
    id: existing?.id ?? config.id,
    updatedAt: new Date().toISOString(),
  }

  if (existing) {
    await db.worldBuildingConfigs.put(updatedConfig)
  } else {
    await db.worldBuildingConfigs.add(updatedConfig)
  }
}

export async function initializeWorldBuildingConfig(
  worldId: string
): Promise<WorldBuildingConfig> {
  const existing = await getWorldBuildingConfig(worldId)

  if (existing) {
    return existing
  }

  const config: WorldBuildingConfig = {
    id: crypto.randomUUID(),
    worldId,
    selections: {},
    parameters: {},
    updatedAt: new Date().toISOString(),
  }

  await db.worldBuildingConfigs.add(config)

  return config
}

export async function deleteWorldBuildingConfig(
  worldId: string
): Promise<void> {
  await db.worldBuildingConfigs
    .where('worldId')
    .equals(worldId)
    .delete()
}
