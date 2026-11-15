import type { SettingsPreferences } from '../api/settings'

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
}
