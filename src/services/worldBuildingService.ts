
import { db } from '../db/database'
import type { WorldBuildingConfig } from '../types/worldBuilding'
import { getWorldSettings, importWorldSettings, saveWorldSettings } from '../api/structure'

/**
 * 世界建设配置：IndexedDB 仍然是本地缓存，后端 world_settings 是权威副本。
 * - 读取：本地命中则返回，并尝试一次性导入后端（幂等）
 * - 本地没有：从后端恢复，回填本地
 * - 保存：先写本地，再异步推后端（失败不影响本地体验）
 */

const pushed = new Set<string>()

export async function getWorldBuildingConfig(
  worldId: string
): Promise<WorldBuildingConfig | undefined> {
  const local = await db.worldBuildingConfigs
    .where('worldId')
    .equals(worldId)
    .first()

  if (local) {
    if (!pushed.has(worldId)) {
      pushed.add(worldId)
      // 一次性把浏览器里的历史配置推到后端，失败静默（下次打开重试）
      importWorldSettings(worldId, {
        selections: local.selections || {},
        parameters: (local.parameters || {}) as Record<string, unknown>,
      }).catch(() => pushed.delete(worldId))
    }
    return local
  }

  // 本地为空时，尝试从后端恢复（换设备 / 清缓存场景）
  try {
    const remote = await getWorldSettings(worldId)
    if (remote && remote.revision > 0) {
      const restored: WorldBuildingConfig = {
        id: crypto.randomUUID(),
        worldId,
        selections: remote.selections || {},
        parameters: (remote.parameters || {}) as WorldBuildingConfig['parameters'],
        updatedAt: new Date().toISOString(),
      }
      await db.worldBuildingConfigs.add(restored)
      return restored
    }
  } catch {
    // 后端不可用时保持原行为
  }

  return undefined
}

export async function saveWorldBuildingConfig(
  config: WorldBuildingConfig
): Promise<void> {
  const existing = await db.worldBuildingConfigs
    .where('worldId')
    .equals(config.worldId)
    .first()

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

  // 后端为准：异步同步，不阻塞界面
  saveWorldSettings(config.worldId, {
    selections: updatedConfig.selections || {},
    parameters: (updatedConfig.parameters || {}) as Record<string, unknown>,
  }).catch((error) => {
    console.warn('世界配置后端同步失败，已保留本地副本', error)
  })
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
