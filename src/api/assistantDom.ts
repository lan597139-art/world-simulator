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
