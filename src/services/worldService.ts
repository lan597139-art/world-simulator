import { db } from '../db/database'
import type { World, WorldType } from '../types/world'

export async function getAllWorlds(): Promise<World[]> {
  return db.worlds.orderBy('updatedAt').reverse().toArray()
}

export async function getWorldById(id: string): Promise<World | undefined> {
  return db.worlds.get(id)
}

export async function createWorld(data: {
  name: string
  description: string
  type: WorldType
  background: string
}): Promise<World> {
  const now = new Date().toISOString()

  const world: World = {
    id: crypto.randomUUID(),
    ...data,
    createdAt: now,
    updatedAt: now,
  }

  await db.worlds.add(world)
  return world
}

export async function updateWorld(
  id: string,
  data: Partial<Pick<World, 'name' | 'description' | 'type' | 'background'>>
): Promise<void> {
  await db.worlds.update(id, {
    ...data,
    updatedAt: new Date().toISOString(),
  })
}

export async function deleteWorld(id: string): Promise<void> {
  await db.worlds.delete(id)
}