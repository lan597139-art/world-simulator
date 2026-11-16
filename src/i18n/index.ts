/** I 国际化基础设施：语言来源、持久化、文档属性与标题。 */
export type Lang = 'zh' | 'en'

const STORAGE_KEY = 'ws.ui.lang'

export const LANGUAGE_LABEL: Record<Lang, string> = { zh: '中 / EN', en: 'EN / 中' }

export function normalizeLang(value: unknown): Lang {
  return value === 'en' ? 'en' : 'zh'
}

export function loadLanguage(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'zh' || saved === 'en') return saved
  } catch { /* private mode */ }
  try {
    return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en'
  } catch {
    return 'zh'
  }
}

export function hasStoredLanguage(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === 'zh' || localStorage.getItem(STORAGE_KEY) === 'en' } catch { return false }
}

export function saveLanguage(lang: Lang): void {
  try { localStorage.setItem(STORAGE_KEY, lang) } catch { /* private mode */ }
}

export function applyDocumentLanguage(lang: Lang): void {
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
  document.documentElement.dataset.lang = lang
  document.title = lang === 'zh' ? '世界模拟器 · World Simulator' : 'World Simulator'
}

/** 页面级文案的轻量取词：用于不依赖 React 上下文的底层入口。 */
export function tr(lang: Lang, zh: string, en: string): string {
  return lang === 'zh' ? zh : en
}
