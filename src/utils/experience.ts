import type { SettingsPreferences } from '../api/settings'

export function applyExperience(preferences: SettingsPreferences) {
  const root = document.documentElement
  root.dataset.theme = preferences.theme
  root.dataset.density = preferences.density
  root.dataset.fontSize = preferences.font_size
  root.dataset.reduceMotion = preferences.reduce_motion ? 'true' : 'false'
}
