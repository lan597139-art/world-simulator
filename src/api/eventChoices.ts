import { API_ORIGIN } from './config'

const BASE = `${API_ORIGIN}/api`

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`
    try {
      const body = await response.json()
      if (body?.detail) message = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
    } catch {
      /* keep status */
    }
    throw new Error(message)
  }
  return (await response.json()) as T
}

export interface EventChoiceOption {
  id: string
  choice_id: string
  label: string
  consequence: string
  outcome_event_id?: string | null
  outcome_event_name: string
  target_branch_id?: string | null
  source: string
  confirmed: boolean
  order_index: number
}

export interface EventChoice {
  id: string
  event_id: string
  title: string
  description: string
  precondition: Record<string, unknown>
  status: string
  order_index: number
  options: EventChoiceOption[]
}

export const listEventChoices = (eventId: string) => request<EventChoice[]>(`/events/${eventId}/choices`)
export const createEventChoice = (eventId: string, payload: { title: string; description?: string }) =>
  request<EventChoice>(`/events/${eventId}/choices`, { method: 'POST', body: JSON.stringify(payload) })
export const updateEventChoice = (choiceId: string, payload: { title?: string; description?: string; status?: string; order_index?: number }) =>
  request<EventChoice>(`/event-choices/${choiceId}`, { method: 'PATCH', body: JSON.stringify(payload) })
export const updateEventOption = (optionId: string, payload: { label?: string; consequence?: string; outcome_event_id?: string | null; order_index?: number }) =>
  request<EventChoiceOption>(`/event-choice-options/${optionId}`, { method: 'PATCH', body: JSON.stringify(payload) })
export const createFollowUpEvent = (worldId: string, name: string) =>
  request<{ id: string; name: string }>(`/events`, {
    method: 'POST',
    body: JSON.stringify({ world_id: worldId, name, description: '', storyline: '支线', scale: '中观' }),
  })
export const deleteEventChoice = (choiceId: string) =>
  request<{ status: string }>(`/event-choices/${choiceId}`, { method: 'DELETE' })
export const createEventOption = (
  choiceId: string,
  payload: { label: string; consequence?: string; outcome_event_id?: string },
) => request<EventChoiceOption>(`/event-choices/${choiceId}/options`, { method: 'POST', body: JSON.stringify(payload) })
export const deleteEventOption = (optionId: string) =>
  request<{ status: string }>(`/event-choice-options/${optionId}`, { method: 'DELETE' })
export const makeEventSandbox = (optionId: string) =>
  request<{ branch_id: string; name: string; existing: boolean }>(
    `/event-choice-options/${optionId}/sandbox`,
    { method: 'POST', body: JSON.stringify({}) },
  )
