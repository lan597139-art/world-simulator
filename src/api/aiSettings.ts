export interface AiSettings {
  apiKey: string
  baseUrl: string
  model: string
  /** 命中的模型预设 ID（'custom' = 自定义）；旧版配置没有该字段。 */
  presetId?: string
}

export const DEFAULT_AI_BASE_URL = 'https://api.siliconflow.cn/v1'
export const DEFAULT_AI_MODEL = 'deepseek-ai/DeepSeek-V4.1-Flash'
export const AI_SETTINGS_STORAGE_KEY = 'ws.ai.settings.v1'

export function loadAiSettings(): AiSettings {
  try {
    const raw = localStorage.getItem(AI_SETTINGS_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return {
      apiKey: String(parsed?.apiKey || ''),
      baseUrl: String(parsed?.baseUrl || DEFAULT_AI_BASE_URL),
      model: String(parsed?.model || DEFAULT_AI_MODEL),
      presetId: parsed?.presetId ? String(parsed.presetId) : undefined,
    }
  } catch {
    return { apiKey: '', baseUrl: DEFAULT_AI_BASE_URL, model: DEFAULT_AI_MODEL }
  }
}

export function saveAiSettings(settings: AiSettings) {
  const clean: AiSettings = {
    apiKey: settings.apiKey.trim(),
    baseUrl: (settings.baseUrl.trim() || DEFAULT_AI_BASE_URL).replace(/\/+$/, ''),
    model: settings.model.trim() || DEFAULT_AI_MODEL,
  }
  if (settings.presetId) clean.presetId = settings.presetId
  localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(clean))
  return clean
}

export function clearAiSettings() {
  localStorage.removeItem(AI_SETTINGS_STORAGE_KEY)
}

export function hasPersonalAiKey() {
  return Boolean(loadAiSettings().apiKey)
}

export function maskApiKey(key: string) {
  const value = (key || '').trim()
  if (!value) return ''
  return value.length > 10 ? `${value.slice(0, 4)}…${value.slice(-4)}` : '已配置'
}
