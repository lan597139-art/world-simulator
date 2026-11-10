/**
 * 全局模型预设字典（唯一配置源）。
 * 所有场景化模型菜单只允许从这里读取，禁止在组件里重复维护。
 *
 * 注意：以下为需求给定的候选清单（ID/接口地址以服务商最新文档为准）；
 * 「保存并测试」通过后，才代表该配置在当前环境真实可用。
 */

export interface ModelPreset {
  id: string
  name: string
  provider: string
  category: string
  baseUrl: string
  modelId: string
  description: string
  costLevel: 'free' | 'low' | 'medium' | 'high' | 'unknown'
  network: 'domestic' | 'overseas' | 'local' | 'unknown'
  warnings?: string[]
  enabled: boolean
}

export const COST_LABELS: Record<ModelPreset['costLevel'], string> = {
  free: '免费',
  low: '低价',
  medium: '中等',
  high: '高价',
  unknown: '未知',
}

export const NETWORK_LABELS: Record<ModelPreset['network'], string> = {
  domestic: '国内直连',
  overseas: '海外接口',
  local: '本地服务',
  unknown: '',
}

export const WARNING_TEXTS = {
  overseas: '⚠️ 海外接口可能需要网络代理，或建议使用第三方中转 Base URL。',
  highCost: '💰 该模型推理成本较高，请酌情使用。',
  local: '本地模型需要确保本地服务已经启动，并且后端能够访问对应接口地址。',
} as const

export const MODEL_PRESETS: ModelPreset[] = [
  // 5.1 智能助手与极速填表
  {
    id: 'glm-4-flash',
    name: '智谱 GLM-4-Flash',
    provider: '智谱',
    category: 'quick',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    modelId: 'glm-4-flash',
    description: '免费快速，适合问答、信息提取、快速填表。',
    costLevel: 'free',
    network: 'domestic',
    enabled: true,
  },
  {
    id: 'qwen-7b',
    name: '硅基 Qwen-7B',
    provider: '硅基流动',
    category: 'quick',
    baseUrl: 'https://api.siliconflow.cn/v1',
    modelId: 'Qwen/Qwen2.5-7B-Instruct',
    description: '轻量低价，适合短文本处理与极速填表。',
    costLevel: 'free',
    network: 'domestic',
    enabled: true,
  },
  {
    id: 'gpt-4o-mini',
    name: 'OpenAI GPT-4o-mini',
    provider: 'OpenAI',
    category: 'quick',
    baseUrl: 'https://api.openai.com/v1',
    modelId: 'gpt-4o-mini',
    description: '低价通用，适合信息提取与简单问答。',
    costLevel: 'low',
    network: 'overseas',
    enabled: true,
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'Google',
    category: 'quick',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    modelId: 'gemini-2.5-flash',
    description: '快速低价，适合简单问答与信息提取。',
    costLevel: 'low',
    network: 'overseas',
    enabled: true,
  },

  // 5.2 角色扮演与世界推演：国内优选
  {
    id: 'qwen-27b',
    name: '硅基 Qwen-27B',
    provider: '硅基流动',
    category: 'roleplay-domestic',
    baseUrl: 'https://api.siliconflow.cn/v1',
    modelId: 'Qwen/Qwen3.5-27B',
    description: '适合人物行为模拟与人格动力分析。',
    costLevel: 'medium',
    network: 'domestic',
    enabled: true,
  },
  {
    id: 'deepseek-v3',
    name: '硅基 DeepSeek-V3',
    provider: '硅基流动',
    category: 'roleplay-domestic',
    baseUrl: 'https://api.siliconflow.cn/v1',
    modelId: 'deepseek-ai/DeepSeek-V3.2',
    description: '适合角色扮演、世界状态演化与关系推演。',
    costLevel: 'medium',
    network: 'domestic',
    enabled: true,
  },

  // 5.3 角色扮演与世界推演：海外顶尖
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'Google',
    category: 'roleplay-overseas',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    modelId: 'gemini-2.5-pro',
    description: '长上下文，适合复杂人物关系与多角色交互。',
    costLevel: 'high',
    network: 'overseas',
    enabled: true,
  },
  {
    id: 'gpt-4o',
    name: 'OpenAI GPT-4o',
    provider: 'OpenAI',
    category: 'roleplay-overseas',
    baseUrl: 'https://api.openai.com/v1',
    modelId: 'gpt-4o',
    description: '适合复杂世界推演与多角色交互。',
    costLevel: 'high',
    network: 'overseas',
    enabled: true,
  },

  // 5.4 长文本撰写与小说生成
  {
    id: 'glm-4-plus',
    name: '智谱 GLM-4-Plus',
    provider: '智谱',
    category: 'longform',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    modelId: 'glm-4-plus',
    description: '适合长文本生成与连续剧情撰写。',
    costLevel: 'high',
    network: 'domestic',
    enabled: true,
  },
  {
    id: 'kimi-moonshot',
    name: 'Kimi Moonshot',
    provider: '月之暗面',
    category: 'longform',
    baseUrl: 'https://api.moonshot.cn/v1',
    modelId: 'moonshot-v1-8k',
    description: '长上下文，适合连续剧情与人物语言风格维持。',
    costLevel: 'medium',
    network: 'domestic',
    enabled: true,
  },

  // 5.5 因果逻辑与深度思考
  {
    id: 'deepseek-r1',
    name: '硅基 DeepSeek-R1',
    provider: '硅基流动',
    category: 'reasoning',
    baseUrl: 'https://api.siliconflow.cn/v1',
    modelId: 'deepseek-ai/DeepSeek-R1',
    description: '推理模型，适合复杂事件链与因果分析。',
    costLevel: 'high',
    network: 'domestic',
    enabled: true,
  },
  {
    id: 'o3',
    name: 'OpenAI o3',
    provider: 'OpenAI',
    category: 'reasoning',
    baseUrl: 'https://api.openai.com/v1',
    modelId: 'o3',
    description: '深度推理，适合多变量推演与复杂决策。',
    costLevel: 'high',
    network: 'overseas',
    enabled: true,
  },
]

export interface ModelCategory {
  id: string
  label: string
  presetIds: string[]
}

export const MODEL_CATEGORIES: ModelCategory[] = [
  {
    id: 'quick',
    label: '💡 智能助手与极速填表（免费/低价）',
    presetIds: ['glm-4-flash', 'qwen-7b', 'gpt-4o-mini', 'gemini-2.5-flash'],
  },
  {
    id: 'roleplay-domestic',
    label: '🎭 角色扮演与世界推演（国内优选）',
    presetIds: ['qwen-27b', 'deepseek-v3'],
  },
  {
    id: 'roleplay-overseas',
    label: '🎭 角色扮演与世界推演（海外顶尖）',
    presetIds: ['gemini-2.5-pro', 'gpt-4o'],
  },
  {
    id: 'longform',
    label: '📖 长文本撰写与小说生成',
    presetIds: ['glm-4-plus', 'kimi-moonshot', 'gemini-2.5-pro'],
  },
  {
    id: 'reasoning',
    label: '🧠 因果逻辑与深度思考',
    presetIds: ['deepseek-r1', 'o3'],
  },
]

export const CUSTOM_PRESET_ID = 'custom'

export function getPreset(id: string | undefined | null): ModelPreset | undefined {
  if (!id || id === CUSTOM_PRESET_ID) return undefined
  return MODEL_PRESETS.find((preset) => preset.id === id && preset.enabled)
}

/** 旧版配置兼容：按 baseUrl + model 反查预设。 */
export function findPresetByEndpoint(baseUrl: string, modelId: string): ModelPreset | undefined {
  const normalize = (value: string) => (value || '').trim().replace(/\/+$/, '').toLowerCase()
  const targetBase = normalize(baseUrl)
  const targetModel = normalize(modelId)
  if (!targetBase || !targetModel) return undefined
  return MODEL_PRESETS.find(
    (preset) => normalize(preset.baseUrl) === targetBase && normalize(preset.modelId) === targetModel
  )
}

/** 按成本 / 网络自动生成提示文案，预设可额外追加。 */
export function presetWarnings(preset: ModelPreset): string[] {
  const list: string[] = []
  if (preset.network === 'overseas') list.push(WARNING_TEXTS.overseas)
  if (preset.costLevel === 'high') list.push(WARNING_TEXTS.highCost)
  if (preset.network === 'local') list.push(WARNING_TEXTS.local)
  for (const warning of preset.warnings || []) {
    if (!list.includes(warning)) list.push(warning)
  }
  return list
}
