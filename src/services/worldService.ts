import type { World, WorldType } from '../types/world'

const API_BASE_URL = "http://127.0.0.1:8000/api";

export async function getAllWorlds(): Promise<World[]> {
  const res = await fetch(`${API_BASE_URL}/worlds`);
  if (!res.ok) throw new Error("获取世界失败");
  return await res.json();
}

export async function getWorldById(id: string): Promise<World | undefined> {
  const res = await fetch(`${API_BASE_URL}/worlds/${id}`);
  if (res.status === 404) return undefined;
  if (!res.ok) throw new Error("获取世界失败");
  return await res.json();
}

export async function createWorld(data: {
  name: string
  description: string
  type: WorldType
  background: string
}): Promise<World> {
  const res = await fetch(`${API_BASE_URL}/worlds`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error("创建世界失败");
  return await res.json();
}

export async function updateWorld(
  id: string,
  data: Partial<Pick<World, 'name' | 'description' | 'type' | 'background'>>
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/worlds/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error("更新世界失败");
}

export async function deleteWorld(id: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/worlds/${id}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error("删除世界失败");
}