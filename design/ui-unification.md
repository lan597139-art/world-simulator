# 世界模拟器 UI 统一控制系统重构

> 目标：取消父级「UI 控制台」与子级「Material & Type Studio」两套控制器，
> 建立唯一的 **UNIFIED UI DESIGN STUDIO**，以全局 Design Tokens 为单一配置源，
> 做到「调整一次，全站同步」。

## 一、原有系统问题审计结果

### 1.1 两套控制器并存

| 控制器 | 位置 | 职责 |
| --- | --- | --- |
| 父级 UI 控制台 | `src/components/appearance/AppearanceStudio.tsx`（悬浮滑杆） | 主题、玻璃目标多选、玻璃/液态/字体参数、逐页作用域、预设 |
| 子级 Material & Type Studio | `src/pages/SettingsPage.tsx` `section === 'experience'` | 语言、主题、密度、正文大小、皮肤、玻璃强度、背景、玻璃/字体滑杆、预设、恢复默认 |

### 1.2 重复与冲突根源

1. **玻璃参数重复维护**
   - 父级按 `glass_profiles[nav|card|modal|control|liquid]` 五档各存 11 个参数，并提供「目标多选 + 单独微调 + 同步」三种写入路径。
   - 子级又提供「玻璃模糊度 / 玻璃透明度 / 辉光强度」三个滑杆，经 `updateAppearance` 把 `glass_blur/glass_opacity` 一次性写入全部档位。
   - 两套写入路径作用在同一份 `Appearance`，用户在设置中心调的模糊度会与悬浮调节器的分档数据互相覆盖。

2. **字体参数重复**
   - 父级「字体文字」页有完整字体参数；子级另有一套玻璃/字体滑杆，字段重复、作用域不同。

3. **预设管理器重复**
   - 两处都渲染 `PresetPicker`，操作同一份用户预设存储，但保存作用域（逐页 vs 全站）与编辑流程不一致。

4. **主题重复且父级联动**
   - 父级通过预设可切主题，子级把主题存进账号偏好，两套来源、两套保存时机。

5. **作用域冲突**
   - 父级支持「本页 / 全站」两套作用域并逐页保存覆盖；子级的 `useEffect([appearance])` 在打开设置中心时无条件 `applyAppearance + saveAppearance`（全局），两者对作用域的处理互相覆盖。

6. **组件目标多选器暴露给用户**
   - 用户被迫理解 `nav / card / modal / control / liquid` 与 `text_scopes` 的组件分类，才能让调节生效；默认未选时行为隐式（回退到全部），与「一次调整全站同步」相悖。

7. **样式令牌层已具备基础，但缺少统一入口**
   - `appearance.ts` 的 `applyAppearance` 已把玻璃/字体参数写到 `<html>` 上的 CSS 变量；`design-system.css` 已派生表面底色与导航条目令牌；`appearance-studio.css` 已用 `html[data-glass-targets~="card"] :is(...)` 把卡片档接入各页面组件。问题集中在「入口分散、参数重复、作用域打架」，而非令牌层本身。

## 二、新的统一 UI 架构说明

### 2.1 单一配置源

`Appearance`（`src/utils/appearance.ts`）仍是唯一的视觉配置与令牌来源，内部按五大模块归组：

```
uiConfig
├── appearance  主题 / 语言 / 信息密度 / 正文大小 / 减少动效 / 操作提示 /
│               自动保存 / 视觉皮肤 / 性能模式
├── material    模糊 / 透明度 / 边框 / 着色 / 渐变 / 磨砂 / 圆角 / 阴影 /
│               玻璃厚度 / 折射 / 色散 / 辉光（全局单一参数）
├── typography  字体 / 字号 / 字重 / 斜体 / 字色 / 透明度 / 色相 / 描边 /
│               阴影 / 字距 / 行高 / 垂直偏移 / 文字背景全套
├── background  图片 / 透明度 / 模糊 / 焦点裁切 / 辉光（环境光）
└── presets     系统预设 1/2 + 用户自定义预设
```

- **全局统一**：`setMaterialGlobal()` / `setMaterialGlobalPatch()` 把任一材质参数同步写入全部 5 个玻璃档位，用户只面对一套参数。
- **组件适配保留在内部**：各档位 profile 仍然存在，供不同组件按渲染能力消费；用户不再接触档位分类。
- **别名兼容**：`glass_blur/glass_opacity` 等旧字段在统一写入时同步更新，避免设计系统别名与分档数据打架。

### 2.2 统一入口

`src/components/appearance/UnifiedDesignStudio.tsx` 是唯一控制台，五大模块：

- **01 APPEARANCE**：主题、语言、信息密度、正文大小、减少动效、操作提示、自动保存、视觉皮肤、性能模式。
- **02 MATERIAL**：12 项全局材质参数 + 可读性保护。
- **03 TYPOGRAPHY**：全部字体与文字效果参数。
- **04 BACKGROUND**：图片上传 / URL / 清除、官方素材库、透明度、模糊、焦点裁切、辉光。
- **05 PRESETS**：系统预设 1/2、用户自定义预设、新增 / 保存 / 应用 / 删除 / 一键清除。

预览与保存使用同一 `draft` 状态：草稿变更即时 `applyAppearance` 生效，点「保存」才落盘，保证预览与最终结果一致。

### 2.3 账号与本地的职责

- 主题 / 语言 / 密度 / 正文大小 / 动效 / 提示 / 自动保存 → 账号偏好，经 `updateSettings` 同步，并以 DOM 令牌为离线兜底。
- 皮肤 / 性能模式 → 本地外观偏好（`ws.ui.skin` / `ws.ui.glass`）。
- 玻璃 / 字体 / 背景 / 预设 → 本地视觉配置（`ws.ui.appearance` / `ws.ui.preset.v1.*`），由统一工作室管理。
- 设置中心不再保存外观，只保留账号级设置与「打开统一设计工作室」入口。

### 2.4 渲染机制

毛玻璃（CSS `backdrop-filter`）与液态玻璃（WebGL2 折射）底层实现不变，但共用同一组设计令牌；不支持 WebGL2 时自动退回 CSS 毛玻璃。**未删除** Refraction / Dispersion / Frost 等高级能力。

## 三、修改过的文件与模块清单

| 文件 | 变更 |
| --- | --- |
| `src/utils/appearance.ts` | 新增 `GLASS_PROFILE_FIELDS`、`GLOBAL_MATERIAL_TARGET`、`readMaterialGlobal`、`setMaterialGlobal`、`setMaterialGlobalPatch` 等统一材质助手 |
| `src/components/appearance/UnifiedDesignStudio.tsx` | **新增**：唯一控制台，五大模块，移除目标多选与点选 |
| `src/components/appearance/AppearanceStudio.tsx` | **删除**：被 UnifiedDesignStudio 取代 |
| `src/App.tsx` | 挂载 `UnifiedDesignStudio`；页面切换改为应用全站统一外观 |
| `src/pages/SettingsPage.tsx` | 移除重复的玻璃 / 字体 / 背景 / 预设控制，体验区改为统一工作室入口；删除冲突的外观自动保存副作用 |
| `src/styles/appearance-studio.css` | 保留既有面板/预设样式，新增五大模块组件样式（选择框、开关、背景上传、焦点网格等） |

## 四、删除的重复功能清单

- 玻璃目标多选器（`glass_targets` 勾选、全选 / 清空 / 仅导航 / 仅卡片）。
- 文字作用范围多选器（`text_scopes` 勾选）。
- 点选组件微调（`ws-pick` / `pickTargetFor`）。
- 「仅调整当前目标 / 同步到全部已选目标」二选一开关。
- 本页 / 全站作用域切换与逐页保存（`savePageAppearance` 界面入口）。
- 设置中心内重复的玻璃模糊度 / 玻璃透明度 / 辉光强度滑杆。
- 设置中心内重复的字体参数、背景参数、预设管理器、恢复默认入口。
- 设置中心在打开时无条件覆盖全局外观的 `useEffect([appearance])` 副作用。
- 子级「打开悬浮调节器」的旧文案与跳转（改为统一设计工作室）。

## 五、保留的原有功能清单

- 主题（跟随系统 / 浅色 / 深色）、语言、信息密度、正文大小、减少动效、操作提示、自动保存。
- 视觉皮肤（极简 / 极光 / 暖砂 / 单色）、性能模式（低 / 标准 / 高 / 实色）。
- 玻璃全部 12 项参数（含 Refraction / Dispersion / Frost / 玻璃厚度 / 辉光）。
- 字体全部参数（字体 / 字号 / 字重 / 斜体 / 字色 / 透明度 / 色相 / 描边 / 阴影 / 字距 / 行高 / 垂直偏移 / 文字背景全套）。
- 背景图片上传、URL、清除、官方素材库、透明度 / 模糊 / 焦点裁切 / 辉光。
- 预设：系统预设 1/2（经典浅色 / 经典深色）、用户自定义预设（预设 3 起 + ➕ 新增）、保存 / 应用 / 重命名 / 删除。
- 一键清除全部自定义调节、恢复默认。
- WebGL2 液态玻璃与 CSS 毛玻璃降级、可读性保护。
- 账号级设置（资料、安全、隐私、通知、数据、治理、监控、关于）不受影响。

## 六、全局组件联动测试结果

脚本：`.verify/verify_unified.py`（CDP 真实浏览器，开发源 `127.0.0.1:5173`）。

| # | 测试项 | 结果 |
| --- | --- | --- |
| 1 | 控制台外壳 | ✅ 显示 `UNIFIED UI DESIGN STUDIO`，5 个模块标签齐全；无旧目标多选器、无点选按钮 |
| 2 | 材质模糊 40 → 5 档同步 | ✅ nav/card/modal/control/liquid 全部 `40px`；旧别名 `--glass-blur` 同步 `40px` |
| 3 | 材质圆角 24 → 5 档同步 | ✅ 全部 `24` |
| 4 | 字体字号 18 | ✅ `--ws-text-size`、`--text-base` 均为 `18px` |
| 5 | 主题切换深色 | ✅ `data-theme=dark` |
| 6 | 背景模块 | ✅ 上传 / URL / 官方素材库 / 焦点裁切齐全；透明度 55 → `--ws-bg-opacity=0.55` |
| 7 | 预设模块 | ✅ 系统 1/2 + 用户 3/4/5、新增、清除按钮齐全 |
| 8 | 保存落盘 | ✅ `ws.ui.appearance` 记录模糊 40、卡片/导航/液态档一致、字号 18 |
| 9 | 页面切换保持令牌 | ✅ 切到设置中心后主题、模糊、字号令牌全部保持 |
| 10 | 组件真实响应 | ✅ `.settings-nav-item` 圆角 `24px`、`backdrop-filter: blur(45.6px) saturate(1.126)`，与全局令牌一致 |

## 七、兼容性与回归测试结果

- **构建**：`vite build` 通过；`SettingsPage` chunk 由 76KB 降至 64KB（重复控制已移除）。
- **类型**：本次改动相关文件 `tsc -p tsconfig.app.json --noEmit` 无新增错误（仓库存在与本次无关的历史类型错误，构建不受影响）。
- **数据兼容**：既有 `ws.ui.appearance`、逐页覆盖键、用户预设键全部沿用；统一材质写入会同步旧字段，未破坏历史数据。
- **设置中心回归**：账号级各分区（资料 / 安全 / 隐私 / 通知 / 数据 / 治理 / 监控 / 关于）渲染与保存逻辑未受影响，仅移除外观重复入口。
- **旧脚本**：`.verify/verify_residual.py` 面向已删除的旧控制器，不再适用；统一验证以 `.verify/verify_unified.py` 为准。

## 八、尚未解决的问题

1. **仓库存在与本次重构无关的历史类型错误**（`App.tsx`、`AICenterPage.tsx`、`ChatPage.tsx` 等），Vite 构建不执行完整类型检查，故未在本次范围内处理。
2. **历史逐页外观覆盖**仍保留在 localStorage 中，界面已不再产生新的逐页覆盖；用户点击「一键清除全部自定义调节」可彻底清理。
3. **液态玻璃场景卡**的高级参数（折射 / 色散）已纳入统一材质模块，但其 WebGL 渲染在无 WebGL2 环境下走 CSS 降级，视觉差异属预期行为。
