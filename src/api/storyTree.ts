import { API_ORIGIN } from './config'

export type TreeBranch = {
  id: string; story_id: string; title: string; kind: string; character_id?: string | null
  character_name?: string; parent_thread_id?: string | null; order_index: number; meta?: any
}
export type TreeNode = {
  id: string; story_id: string; thread_id: string; parent_node_id?: string | null
  event_id?: string | null; event_name?: string; event_description?: string
  event_polarity?: string; event_storyline?: string; title: string
  node_status: 'filled' | 'pending' | 'new'; order_index: number; collapsed: boolean; note?: string
}
export type TreeEdge = {
  id: string; from_thread_id: string; from_event_id?: string | null
  to_thread_id: string; to_event_id?: string | null; edge_type: string; note?: string
}
export type StoryTree = {
  story: { id: string; title: string; world_id: string }
  branches: TreeBranch[]; nodes: TreeNode[]; edges: TreeEdge[]
  counts: { branches: number; filled: number; pending: number }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_ORIGIN}/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(String(data?.detail || `请求失败（HTTP ${response.status}）`))
  }
  return response.json() as Promise<T>
}

export const getStoryTree = (storyId: string) => request<StoryTree>(`/stories/${storyId}/tree`)
export const createTreeNode = (storyId: string, payload: Partial<TreeNode> & { thread_id: string }) =>
  request<TreeNode>(`/stories/${storyId}/tree/nodes`, { method: 'POST', body: JSON.stringify(payload) })
export const updateTreeNode = (nodeId: string, payload: Partial<TreeNode>) =>
  request<TreeNode>(`/story-tree-nodes/${nodeId}`, { method: 'PATCH', body: JSON.stringify(payload) })
export const deleteTreeNode = (nodeId: string) =>
  request<{ status: string }>(`/story-tree-nodes/${nodeId}`, { method: 'DELETE' })
