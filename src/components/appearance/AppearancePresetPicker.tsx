import { useEffect, useState } from 'react'
import { Check, Plus, Save, Trash2, X } from 'lucide-react'
import { tr, type Lang } from '../../i18n'
import {
  PRESET_APPEARANCES,
  PRESET_IDS,
  PRESET_META,
  USER_PRESET_CHANGE_EVENT,
  createUserPreset,
  deleteUserPreset,
  ensureDefaultUserPresets,
  loadUserPresets,
  type Appearance,
  type SystemPresetId,
  type UserPreset,
} from '../../utils/appearance'

type Props = {
  lang: Lang
  /** 正在编辑的用户预设 id；null 表示没有载入任何用户预设。 */
  editingId: string | null
  /** 当前草稿外观：新增空位与保存预设时写入。 */
  currentAppearance: Appearance
  /** 系统预设 1/2：一键全局应用。 */
  onSystemApply: (id: SystemPresetId) => void
  /** 点击用户预设：载入到草稿进行调节。 */
  onUserSelect: (preset: UserPreset) => void
  /** 保存当前草稿为指定用户预设。 */
  onSaveUser: (id: string, name: string, appearance: Appearance) => void
  /** 删除用户预设。 */
  onUserDelete: (id: string) => void
  /** 取消编辑当前用户预设。 */
  onUserCancel: () => void
}

/** 用预设的卡片档渲染一块玻璃缩略图，所见即所得。 */
function swatchStyle(appearance: Appearance) {
  const card = appearance.glass_profiles.card
  return {
    background: `color-mix(in srgb, var(--glass-frost-bg) ${card.opacity}%, transparent)`,
    backdropFilter: `blur(${card.blur}px)`,
    WebkitBackdropFilter: `blur(${card.blur}px)`,
    border: `1px solid color-mix(in srgb, #fff ${card.border}%, var(--glass-border))`,
    borderRadius: `${card.radius}px`,
    boxShadow: `0 ${card.shadow * 0.3}px ${card.shadow * 0.8}px rgba(0, 0, 0, .14)`,
  }
}

/**
 * 预设选择器：预设 1/2 为系统预设，一键全局应用；
 * 预设 3 起与「➕」为用户自定义，点击载入调节，调节后保存（含背景照片）。
 */
export default function PresetPicker({
  lang,
  editingId,
  currentAppearance,
  onSystemApply,
  onUserSelect,
  onSaveUser,
  onUserDelete,
  onUserCancel,
}: Props) {
  const [presets, setPresets] = useState<UserPreset[]>(() => loadUserPresets())
  const [nameDraft, setNameDraft] = useState('')

  useEffect(() => {
    if (loadUserPresets().length === 0) setPresets(ensureDefaultUserPresets())
    const sync = () => setPresets(loadUserPresets())
    window.addEventListener(USER_PRESET_CHANGE_EVENT, sync)
    return () => window.removeEventListener(USER_PRESET_CHANGE_EVENT, sync)
  }, [])

  useEffect(() => {
    const active = presets.find((preset) => preset.id === editingId)
    setNameDraft(active?.name ?? '')
  }, [editingId, presets])

  const editing = presets.find((preset) => preset.id === editingId) || null

  const handleAdd = () => {
    const preset = createUserPreset(currentAppearance)
    onUserSelect(preset)
  }

  return (
    <div className="ws-preset-picker">
      <div className="ws-studio-section-label">
        <span>{tr(lang, '预设（一键全局使用）', 'Presets (one-click global)')}</span>
        <span>{tr(lang, '1/2 为系统，其余自定义', '1/2 system, rest custom')}</span>
      </div>
      <div className="ws-preset-grid">
        {PRESET_IDS.map((id) => (
          <button
            key={id}
            type="button"
            className="ws-preset ws-preset-system"
            onClick={() => onSystemApply(id)}
            title={tr(lang, PRESET_META[id].zh, PRESET_META[id].en)}
          >
            <span className="ws-preset-swatch" style={swatchStyle(PRESET_APPEARANCES[id])} />
            <span className="ws-preset-label">{tr(lang, PRESET_META[id].zh, PRESET_META[id].en)}</span>
            <span className="ws-preset-badge">{tr(lang, '系统', 'System')}</span>
          </button>
        ))}

        {presets.map((preset) => (
          <div
            key={preset.id}
            className={`ws-preset-wrap${editingId === preset.id ? ' is-editing' : ''}`}
          >
            <button
              type="button"
              className="ws-preset"
              onClick={() => onUserSelect(preset)}
              title={preset.name}
            >
              <span className="ws-preset-swatch" style={swatchStyle(preset.appearance)} />
              <span className="ws-preset-label">{preset.name}</span>
            </button>
            <button
              type="button"
              className="ws-preset-delete"
              onClick={() => {
                deleteUserPreset(preset.id)
                onUserDelete(preset.id)
              }}
              aria-label={tr(lang, '删除预设', 'Delete preset')}
              title={tr(lang, '删除预设', 'Delete preset')}
            >
              <Trash2 size={11} />
            </button>
          </div>
        ))}

        <button type="button" className="ws-preset-add" onClick={handleAdd} title={tr(lang, '新增自定义预设', 'Add custom preset')}>
          <Plus size={16} />
          <span className="ws-preset-label">{tr(lang, '➕ 新增', '➕ Add')}</span>
        </button>
      </div>

      {editing && (
        <div className="ws-preset-save-bar">
          <span className="ws-preset-editing-hint">
            {tr(lang, `正在编辑 ${editing.name}，调节后保存`, `Editing ${editing.name}; save after tuning`)}
          </span>
          <input
            className="ws-preset-name-input"
            value={nameDraft}
            onChange={(event) => setNameDraft(event.target.value)}
            placeholder={tr(lang, '预设名称', 'Preset name')}
            aria-label={tr(lang, '预设名称', 'Preset name')}
          />
          <button
            type="button"
            className="ws-studio-btn primary"
            onClick={() => onSaveUser(editing.id, nameDraft.trim() || editing.name, currentAppearance)}
          >
            <Save size={12} /> {tr(lang, '保存预设', 'Save preset')}
          </button>
          <button type="button" className="ws-studio-btn" onClick={onUserCancel}>
            <X size={12} /> {tr(lang, '取消', 'Cancel')}
          </button>
        </div>
      )}
    </div>
  )
}
