/**
 * 全局 AI 助手上下文仓库。
 *
 * 设计原则：助手完全自包含。页面不需要为了接入助手而修改任何布局；
 * App 在路由切换时写入页面上下文，面板统一读取。
 * 预留了可选的「实体 / 表单」注册槽位，未来任何页面都可以
 * 通过调用 registerAssistantForm / setAssistantEntity 无侵入接入。
 */

export interface AssistantPageContext {
  page: string
  label: string
  worldId: string
  worldName: string
}

export interface AssistantEntityContext {
  type: string
  id: string
  name: string
}

export interface AssistantFormField {
  key: string
  label: string
  type: string
  value: string
  options?: string[]
}

export interface AssistantFormRegistration {
  title: string
  fields: AssistantFormField[]
  apply: (patch: Record<string, unknown>) => void
}

export interface AssistantState {
  page: AssistantPageContext
  entity: AssistantEntityContext | null
  form: AssistantFormRegistration | null
}

const defaultPage: AssistantPageContext = {
  page: 'overview',
  label: '世界总览',
  worldId: '',
  worldName: '',
}

let state: AssistantState = {
  page: defaultPage,
  entity: null,
  form: null,
}

const listeners = new Set<() => void>()

function emit() {
  state = { ...state }
  listeners.forEach((listener) => listener())
}

export function subscribeAssistant(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getAssistantState(): AssistantState {
  return state
}

export function setAssistantPage(next: AssistantPageContext) {
  const current = state.page
  if (
    current.page === next.page &&
    current.label === next.label &&
    current.worldId === next.worldId &&
    current.worldName === next.worldName
  ) {
    return
  }
  state = { ...state, page: next }
  emit()
}

export function setAssistantEntity(next: AssistantEntityContext | null) {
  const current = state.entity
  if (current?.type === next?.type && current?.id === next?.id && current?.name === next?.name) {
    return
  }
  state = { ...state, entity: next }
  emit()
}

export function clearAssistantEntity(type?: string, id?: string) {
  if (!state.entity) return
  if (type && state.entity.type !== type) return
  if (id && state.entity.id !== id) return
  state = { ...state, entity: null }
  emit()
}

/**
 * 页面可选注册结构化表单（不强制）。
 * 注册后助手优先使用注册字段；未注册时自动扫描当前页面 DOM 表单。
 */
export function registerAssistantForm(form: AssistantFormRegistration | null) {
  if (!form) {
    if (!state.form) return () => {}
    state = { ...state, form: null }
    emit()
    return () => {}
  }
  state = { ...state, form }
  emit()
  return () => {
    if (state.form === form) {
      state = { ...state, form: null }
      emit()
    }
  }
}
