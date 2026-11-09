const API_BASE = 'http://127.0.0.1:8000/api'

export interface GrowthEntry {
  id: string
  at: string
  reason: string
  source_event_ids: string[]
  main_color: string
  changed_modules: string[]
  engine_deltas: Record<string, number>
  engine_values: Record<string, number>
}

export interface CharacterLayer {
  engines: {
    ovtde?: Record<string, { val?: number; [key: string]: unknown }>
    dominance?: Record<string, unknown>
    [key: string]: unknown
  }
  defense_mechanisms: Record<string, unknown>
  reality_conditions: Record<string, unknown>
  thought_imprints: Record<string, unknown>
}

export interface CharacterRuntime extends CharacterLayer {
  main_color: string
  version: number
  updated_at: string | null
  growth_log: GrowthEntry[]
}

export interface RuntimeView {
  character_id: string
  seed: CharacterLayer
  runtime: CharacterRuntime
}

export interface RuntimeUpdatePayload {
  engines: CharacterLayer['engines']
  defense_mechanisms: CharacterLayer['defense_mechanisms']
  reality_conditions: CharacterLayer['reality_conditions']
  thought_imprints: CharacterLayer['thought_imprints']
  main_color: string
  reason: string
  source_event_ids: string[]
  life_history?: unknown
}

async function parse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let detail = `HTTP ${response.status}`
    try {
      const body = await response.json()
      detail = body.detail || detail
    } catch {
      // keep default
    }
    throw new Error(detail)
  }
  return response.json() as Promise<T>
}

export async function getCharacterRuntime(characterId: string): Promise<RuntimeView> {
  const response = await fetch(`${API_BASE}/characters/${characterId}/runtime`)
  return parse<RuntimeView>(response)
}

export async function updateCharacterRuntime(
  characterId: string,
  payload: RuntimeUpdatePayload,
): Promise<RuntimeView & { entry: GrowthEntry }> {
  const response = await fetch(`${API_BASE}/characters/${characterId}/runtime`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return parse<RuntimeView & { entry: GrowthEntry }>(response)
}
