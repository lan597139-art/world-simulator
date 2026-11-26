import type { SettingsPreferences } from '../api/settings'
import { applyPreferenceTokens } from './appearance'

export function applyExperience(preferences: SettingsPreferences) {
  const root = document.documentElement
  root.dataset.theme = preferences.theme
  root.dataset.density = preferences.density
  root.dataset.fontSize = preferences.font_size
  root.dataset.reduceMotion = preferences.reduce_motion ? 'true' : 'false'
  root.dataset.motion = preferences.reduce_motion ? 'reduce' : 'full'
  try {
    root.dataset.skin = localStorage.getItem('ws.ui.skin') || 'default'
    const glass = localStorage.getItem('ws.ui.glass') || 'medium'
    if (glass === 'medium') delete root.dataset.glass
    else root.dataset.glass = glass
  } catch { /* private mode */ }
  // 偏好写入 data-* 后刷新偏好驱动的档位令牌（玻璃 / 字号）：
  // 外观系统的内联值会遮蔽 html[data-*] 的 CSS 档位规则，需在此去除，
  // 保证首次加载（applyExperience 晚于 applyAppearance）与偏好变更路径一致。
  applyPreferenceTokens()
}
