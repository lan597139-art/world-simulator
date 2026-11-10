/**
 * 通用表单识别与回填：直接读取当前页面可见表单，不要求任何页面改造。
 * 回填使用原生 value setter + input/change 事件，兼容 React 受控组件。
 */

import type { AssistantFormField } from './assistantContext'

const FIELD_ATTR = 'data-assistant-field'
let fieldCounter = 0

function isVisible(element: HTMLElement) {
  if (element.closest('[data-ai-assistant]')) return false
  if (element.hidden) return false
  const style = window.getComputedStyle(element)
  if (style.display === 'none' || style.visibility === 'hidden') return false
  const rect = element.getBoundingClientRect()
  return rect.width > 1 && rect.height > 1
}

function textOf(element: Element | null | undefined) {
  return (element?.textContent || '').replace(/\s+/g, ' ').trim()
}

function labelFor(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) {
  if (element.id) {
    const explicit = document.querySelector(`label[for="${CSS.escape(element.id)}"]`)
    if (explicit) return textOf(explicit)
  }
  const wrapping = element.closest('label')
  if (wrapping) return textOf(wrapping)
  const container = element.closest('div, section, fieldset')
  const label = container?.querySelector(':scope > label, :scope > div > label')
  if (label) return textOf(label)
  // 无 label 时，若上层容器只有一个控件，用容器标题当字段名
  let ancestor = element.parentElement
  for (let depth = 0; depth < 3 && ancestor; depth++) {
    if (ancestor.querySelectorAll('input, textarea, select').length === 1) {
      const heading = ancestor.querySelector('h1, h2, h3, h4, h5, strong, b')
      if (heading && textOf(heading)) return textOf(heading)
    }
    ancestor = ancestor.parentElement
  }
  const aria = element.getAttribute('aria-label')
  if (aria) return aria
  if ('placeholder' in element && element.placeholder) return element.placeholder
  return element.name || element.type
}

function keyFor(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) {
  if (element.id) return `id:${element.id}`
  let assigned = element.getAttribute(FIELD_ATTR)
  if (!assigned) {
    assigned = `field-${++fieldCounter}`
    element.setAttribute(FIELD_ATTR, assigned)
  }
  return `dom:${assigned}`
}

function valueString(value: string | number | readonly string[] | undefined) {
  if (Array.isArray(value)) return value.join(',')
  return String(value ?? '')
}

/** 收集当前页面可见表单字段（密码 / 文件 / 搜索 / API Key 类输入一律排除）。 */
export function collectDomFormFields(): AssistantFormField[] {
  const fields: AssistantFormField[] = []
  const radioGroups = new Map<string, { labels: string[]; values: string[]; selected: string }>()

  const elements = Array.from(
    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      'input, textarea, select'
    )
  )

  for (const element of elements) {
    if (!isVisible(element) || element.disabled || ('readOnly' in element && element.readOnly)) continue
    if (element instanceof HTMLInputElement) {
      if (['password', 'file', 'hidden', 'search', 'submit', 'button', 'reset', 'image'].includes(element.type)) continue
      const haystack = `${element.name} ${element.id} ${element.placeholder}`.toLowerCase()
      if (/(api.?key|token|password|secret)/.test(haystack)) continue
      if (element.type === 'radio') {
        if (!element.name) continue
        const group = radioGroups.get(element.name) || { labels: [], values: [], selected: '' }
        group.labels.push(labelFor(element))
        group.values.push(element.value)
        if (element.checked) group.selected = element.value
        radioGroups.set(element.name, group)
        continue
      }
      if (element.type === 'checkbox') {
        fields.push({
          key: keyFor(element),
          label: labelFor(element),
          type: 'checkbox',
          value: element.checked ? 'true' : 'false',
        })
        continue
      }
    }
    if (element instanceof HTMLSelectElement) {
      fields.push({
        key: keyFor(element),
        label: labelFor(element),
        type: 'select',
        value: element.value,
        options: Array.from(element.options).map((option) => option.value).filter(Boolean),
      })
      continue
    }
    fields.push({
      key: keyFor(element),
      label: labelFor(element),
      type: element instanceof HTMLTextAreaElement ? 'textarea' : (element as HTMLInputElement).type || 'text',
      value: valueString(element.value).slice(0, 800),
    })
    if (fields.length >= 36) break
  }

  for (const [name, group] of radioGroups) {
    if (fields.length >= 40) break
    const uniqueLabels = Array.from(new Set(group.labels))
    fields.push({
      key: `radio:${name}`,
      label: uniqueLabels.length > 1 ? uniqueLabels.slice(0, 4).join(' / ') : name,
      type: 'radio',
      value: group.selected,
      options: Array.from(new Set(group.values)),
    })
  }

  return fields.slice(0, 40)
}

function setNativeValue(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string
) {
  const prototype =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : element instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value')
  if (descriptor?.set) descriptor.set.call(element, value)
  else element.value = value
  element.dispatchEvent(new Event('input', { bubbles: true }))
  element.dispatchEvent(new Event('change', { bubbles: true }))
}

function findField(key: string) {
  if (key.startsWith('id:')) {
    return document.getElementById(key.slice(3)) as
      | HTMLInputElement
      | HTMLTextAreaElement
      | HTMLSelectElement
      | null
  }
  if (key.startsWith('radio:')) {
    const name = key.slice(6)
    return Array.from(document.querySelectorAll<HTMLInputElement>('input[type="radio"]')).filter(
      (element) => element.name === name
    )
  }
  if (key.startsWith('dom:')) {
    return document.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      `[${FIELD_ATTR}="${CSS.escape(key.slice(4))}"]`
    )
  }
  return null
}

/** 把 AI 返回的字段补丁写入页面表单，返回成功填充数。 */
export function applyDomFormPatch(patch: Record<string, unknown>) {
  let applied = 0
  for (const [key, rawValue] of Object.entries(patch)) {
    const value = typeof rawValue === 'boolean' ? String(rawValue) : String(rawValue ?? '')
    const found = findField(key)
    if (!found) continue
    if (Array.isArray(found)) {
      const option = found.find(
        (radio) => radio.value === value || labelFor(radio) === value || labelFor(radio).includes(value)
      )
      if (option) {
        option.click()
        applied += 1
      }
      continue
    }
    if (found instanceof HTMLInputElement && found.type === 'checkbox') {
      const desired = value === 'true' || value === '1' || value === '是'
      if (found.checked !== desired) found.click()
      applied += 1
      continue
    }
    if (found instanceof HTMLSelectElement) {
      const option = Array.from(found.options).find(
        (item) => item.value === value || textOf(item) === value
      )
      if (option) {
        setNativeValue(found, option.value)
        applied += 1
      }
      continue
    }
    setNativeValue(found, value)
    applied += 1
  }
  return applied
}

// ---------------------------------------------------------------------
// 演示向导：按 AI 指令定位、高亮、点击、填充页面元素
// 目标只允许命中带 data-ai-id 的演示锚点，避免误点其他控件。
// ---------------------------------------------------------------------

export type DemoAction =
  | { type: 'click'; ai_id?: string; selector?: string; text?: string; summary?: string }
  | { type: 'fill'; id: string; value: string; summary?: string }

export interface DemoTarget {
  ai_id: string
  tag: string
  label: string
  kind: 'click' | 'input'
  value?: string
}

export interface DemoTargetRef {
  ai_id?: string
  selector?: string
  text?: string
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function describeTarget(element: HTMLElement) {
  return (
    textOf(element) ||
    (element as HTMLInputElement).placeholder ||
    element.getAttribute('aria-label') ||
    element.getAttribute('data-ai-id') ||
    element.tagName.toLowerCase()
  ).slice(0, 40)
}

/** 收集页面上的演示锚点，供 AI 选择；不包含助手面板自身。 */
export function collectDemoTargets(): DemoTarget[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-ai-id]'))
    // 演示入口自身不进清单，避免 AI 递归触发演示
    .filter((element) => isVisible(element) && element.getAttribute('data-ai-id') !== 'ai-demo-trigger')
    .slice(0, 40)
    .map((element) => {
      const isInput = element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
      return {
        ai_id: String(element.getAttribute('data-ai-id')),
        tag: element.tagName.toLowerCase(),
        label: describeTarget(element),
        kind: isInput ? ('input' as const) : ('click' as const),
        value: isInput ? String((element as HTMLInputElement).value || '').slice(0, 60) : undefined,
      }
    })
}

function findDemoTarget(ref: DemoTargetRef): HTMLElement | null {
  if (ref.ai_id) {
    const element = document.querySelector<HTMLElement>(`[data-ai-id="${CSS.escape(ref.ai_id)}"]`)
    if (element && isVisible(element)) return element
  }
  if (ref.selector) {
    try {
      const element = document.querySelector<HTMLElement>(ref.selector)
      if (element && isVisible(element)) return element
    } catch {
      // 非法选择器直接跳过，避免把异常抛给会话
    }
  }
  if (ref.text) {
    const wanted = ref.text.trim()
    const candidates = Array.from(
      document.querySelectorAll<HTMLElement>('button, a, [role="button"], [data-ai-id]')
    ).filter((element) => isVisible(element))
    const exact = candidates.find((element) => textOf(element) === wanted)
    if (exact) return exact
    const partial = candidates.find((element) => textOf(element).includes(wanted))
    if (partial) return partial
  }
  return null
}

/** 高亮目标元素：描边 + 呼吸光圈，1.6 秒后自动消失。 */
export function highlightDemoTarget(element: HTMLElement, ms = 1600) {
  const rect = element.getBoundingClientRect()
  const ring = document.createElement('div')
  ring.setAttribute('data-ai-demo-highlight', '')
  ring.style.cssText = [
    'position:fixed',
    `top:${Math.max(0, rect.top - 3)}px`,
    `left:${Math.max(0, rect.left - 3)}px`,
    `width:${Math.max(8, rect.width + 6)}px`,
    `height:${Math.max(8, rect.height + 6)}px`,
    'border-radius:8px',
    'border:2px solid var(--primary-color, #6366f1)',
    'background:color-mix(in srgb, var(--primary-color, #6366f1) 16%, transparent)',
    'box-shadow:0 0 0 4px color-mix(in srgb, var(--primary-color, #6366f1) 28%, transparent)',
    'pointer-events:none',
    'z-index:2147483000',
    'transition:opacity .35s ease',
  ].join(';')
  document.body.appendChild(ring)
  element.scrollIntoView({ block: 'center', behavior: 'smooth' })
  window.setTimeout(() => {
    ring.style.opacity = '0'
    window.setTimeout(() => ring.remove(), 400)
  }, ms)
}

/**
 * 执行一条演示指令。click 会先高亮再点击；fill 用原生 setter 写入受控组件。
 * 失败时抛出可读错误，由调用方决定是否停止后续步骤。
 */
export async function executeDemoAction(action: DemoAction): Promise<string> {
  if (action.type === 'fill') {
    const element = findDemoTarget({ ai_id: action.id })
    if (!element) throw new Error(`没找到要填入的输入框：${action.id}`)
    if (
      !(element instanceof HTMLInputElement) &&
      !(element instanceof HTMLTextAreaElement) &&
      !(element instanceof HTMLSelectElement)
    ) {
      throw new Error(`目标不是输入框：${action.id}`)
    }
    highlightDemoTarget(element, 900)
    element.scrollIntoView({ block: 'center', behavior: 'smooth' })
    await delay(280)
    setNativeValue(element, action.value)
    return `已填入「${action.value}」`
  }

  const element = findDemoTarget(action)
  if (!element) throw new Error('没找到要点击的按钮（页面可能已切换）')
  highlightDemoTarget(element, 1100)
  element.scrollIntoView({ block: 'center', behavior: 'smooth' })
  await delay(420)
  element.click()
  return `已点击「${describeTarget(element)}」`
}
