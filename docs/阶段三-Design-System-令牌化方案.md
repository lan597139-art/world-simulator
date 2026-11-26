# 阶段三：统一 Design System（令牌化）方案与首批落地

对应需求章节：统一 Design System。目标不是“再定义一套变量”，而是把各页面里
**写死的白/黑表面色**收进一套与主题联动的语义令牌，让深色模式不再靠每个文件底部手写一段覆盖。

## 1. 现状盘点（改造前）

`src/styles/*.css` 中 `rgba(255,255,255,…)` / `rgba(0,0,0,…)` / `#fff` / `#000` 的出现次数：

| 文件 | 数量 | 说明 |
|---|---|---|
| `product-workspace.css` | 128 | 工作台/编辑器区域，多数是玻璃高光与描边，需按语义拆分 |
| `centers.css` | 56 | 各中心页通用外壳 |
| `appearance-studio.css` | 44 | 外观控制台本身，部分是该面板的正当取值 |
| `community.css` | 37 | 内容社区 |
| `creation-center.css` | 30 | 创作中心 |
| `design-system.css` | 25 | 令牌定义处，属正常 |
| `user-center.css` | 24 | **本轮已清零** |
| 其余 | 43 | 零散 |

其中真正会在深色模式下失效的是两类：
1. `rgba(255,255,255,.1~.32)` 用作“内嵌面”（卡片里的计数格、内联按钮）——深色下过亮或发灰；
2. `rgba(0,0,0,.04~.12)` 用作描边/阴影——深色下几乎不可见。

这些文件此前的解法是在文件末尾追加 `@media (prefers-color-scheme: dark)` 覆盖块，
同一套语义写两遍，改一处漏一处。

## 2. 新增语义令牌

追加在 `src/styles/design-system.css` 末尾，命名沿用既有 `--ws-*` 前缀：

```css
--ws-inset-1 … --ws-inset-4   /* 内嵌面：卡片中的卡片、计数格、内联按钮 */
--ws-card-grad-a / -b         /* 卡片渐变两端 */
--ws-scrim                    /* 弹层遮罩 */
--ws-shadow-sm / -md / -lg    /* 三级阴影 */
```

关键设计：内嵌面与渐变用 `color-mix(in srgb, var(--glass-frost-bg) N%, transparent)` 派生，
`--glass-frost-bg` 本身就是主题色（浅色 `#fff` / 深色 `#1c1c1e`），所以**令牌只写一次，深浅自动成立**；
遮罩与阴影在深色下需要更重，用显式的 `prefers-color-scheme` 与 `html[data-theme]` 两套覆盖，
保证系统偏好和设置中心手动切换都被尊重。

## 3. 首批落地：`user-center.css`（24 → 0）

| 原写法 | 替换为 | 处数 |
|---|---|---|
| `rgba(255,255,255,.14)` | `var(--ws-inset-1)` | 4 |
| `rgba(255,255,255,.16 / .18)` | `var(--ws-inset-2)` | 6 |
| `rgba(255,255,255,.24)` | `var(--ws-inset-3)` | 1 |
| `rgba(255,255,255,.32)` | `var(--ws-inset-4)` | 1 |
| `linear-gradient(145deg, white .72, white .36)` | `linear-gradient(145deg, var(--ws-card-grad-a), var(--ws-card-grad-b))` | 1 |
| `rgba(0,0,0,.48)` | `var(--ws-scrim)` | 1 |
| 三种 `box-shadow` | `var(--ws-shadow-sm/-md/-lg)` | 4 |
| `#171717`（弹窗底） | `var(--surface-solid)` | 1 |

同时**删除了 38 行手写深色覆盖块**（`@media (prefers-color-scheme: dark)` 里重复设置的
`.uc-card`、`.uc-ghost-button`、`.uc-follow-counts > div`、`.uc-modal` 等），
这些语义现在由令牌承担，不再需要第二套值。

## 4. 验证

令牌解析（同一页面，强制 `html[data-theme]` 切换）：

| 令牌 | light | dark |
|---|---|---|
| `--ws-inset-2` | `color-mix(#ffffff 18%, transparent)` | `color-mix(#1c1c1e 18%, transparent)` |
| `--ws-card-grad-a` | `color-mix(#ffffff 72%, transparent)` | `color-mix(#1c1c1e 72%, transparent)` |
| `--ws-scrim` | `rgba(0,0,0,.48)` | `rgba(0,0,0,.62)` |
| `.uc-follow-counts > div` 实算背景 | `srgb 1 1 1 / .84` | `srgb .11 .11 .12 / .84` |

布局零回归：`visual_baseline.py compare --engine chrome` **42/42 一致**（换色不该动布局，动了就是错）。
构建通过，tsc 维持 35 个既有错误。

## 5. 第二批落地：centers / community / creation-center

三个文件共 123 处纯白/纯黑写法全部清零（`centers.css` 56、`community.css` 37、
`creation-center.css` 30）。全局统计从 **391 → 285**（剩余里 `design-system.css` 的 42 处是令牌定义本身，属正常）。

映射规则按**用途**分三族，而不是按透明度一刀切：

| 用途 | 规则 | 令牌 |
|---|---|---|
| 背景面（卡片、计数格、内联按钮、渐变面） | 从主题玻璃色派生，深浅自动翻转 | `--ws-inset-1..10`、`--ws-card-grad-*` |
| 玻璃描边、内高光、光晕 | 纯白光源线，深浅都成立，不随主题 | `--ws-rim-*`、`--ws-rim-hi` |
| 深色面上的文字 | 仅用于深底，不随主题反色 | `--ws-dark-fg/-muted/-faint` |
| 悬停提亮 | 从主题玻璃色派生 | `--ws-hover` |
| 分隔线 | 正文色派生 | `--divider`（既有令牌） |
| 阴影 | 深色下自动加重 | `--ws-shadow-sm/-md/-lg` |

### 深色块：必须用「抬亮」令牌，不能用「表面」令牌

这是本批最关键的判断。页面底部的 `@media (prefers-color-scheme: dark)` 块里，
`rgba(255,255,255,N)` 的语义是**把深色表面抬亮一点**，不是表面本色。
若一并换成 `--ws-inset-*`，深色下会变成暗色派生，抬升消失、表面反而下沉。

因此单独定义了 `--ws-lift-1..9`（`rgba(255,255,255,.015~.1)`，不随主题变化），
只允许出现在深色覆盖块内。三处深色块已按此修正，并把块内原有的白 alpha 逐档对应回填。

### 验证

- **布局零回归**：`compare --engine chrome` 42/42 一致（7 视口 × 6 页）。换色不动布局，动了就是错。
- **令牌翻转**：`--ws-inset-5` 浅色 `#ffffff 14%` → 深色 `#1c1c1e 14%`；
  `--ws-lift-7` 在两套主题下都是 `rgba(255,255,255,0.1)`，即深色块里的抬升被正确保留。
- **实算值**：`.ct-stats` 浅色 `srgb 1 1 1 / .84` → 深色 `srgb .11 .11 .12 / .84`；
  `.cc-topbar` 下描边浅色 `srgb .72 .72 .72 / .33` → 深色 `srgb 1 1 1 / .37`（深色块生效）。
- 构建通过，tsc 维持 35 个既有错误，lint 0 error。

### 过程中确认的两件事

1. **外观控制台已全局覆盖部分页面面**：`appearance-studio.css` 用玻璃令牌覆盖了 `.cm-toolbar`、
   `.cm-section`、`.ct-stats` 等一批选择器，因此这些页面级的深色块在视觉上是冗余的。
   转换后仍然正确（令牌解析与外观控制台同源），但没有出现「双重覆盖」的问题——
   实算值来自外观控制台那一侧，页面令牌作为兜底。
2. **死样式**：`creation-center.css` 有 17 个类名在当前 TSX 中已不存在
   （旧创作中心的 `.cc-tool*`、`.cc-recent-*`、`.cc-asset*` 等），`community.css` 有 5 个，
   `centers.css` 有 1 个。这些规则的令牌化是安全的，但它们属于「删死样式」这项独立工作，
   不在颜色令牌化范围内，需要单独排期。

## 6. 白/黑玻璃令牌化：已全部完成

按既定顺序逐文件完成，页面样式规则中的白/黑硬编码已归零：

| 批次 | 文件 | 硬编码白/黑 | 处理方式 |
| --- | --- | --- | --- |
| 第一批 | `user-center.css` | 24 → 0 | 背景面→`--ws-inset-*`、描边→`--ws-rim-*`、深色面文字→`--ws-dark-*` |
| 第二批 | `centers.css` / `community.css` / `creation-center.css` | 56 / 37 / 30 → 0 | 同上；深色块一律用主题无关的 `--ws-lift-*` |
| 第三批 | `product-workspace.css` | 128 → 0 | 按属性分类逐类映射（含 `var()` 回退、渐变、`drop-shadow`） |
| 第四批 | 12 个零散文件 | 53 → 0 | 同规则批量处理 |
| 第五批 | `appearance-studio.css` | 44 → 0 | **公式与静态色分开处理**（见 §7） |

**深色块铁律**：`@media (prefers-color-scheme: dark)` 内的白色高光必须用主题无关的
`--ws-lift-*`（纯白光源），不能用 `--ws-inset-*`（深色下会解析成暗玻璃，把抬亮效果吃掉）。

## 7. 第五批：`appearance-studio.css` 的公式与静态色分流

控制台文件里的 `#fff` / `rgba(255,255,255,…)` 分两类，**不能一刀切**：

1. **动态公式（保留语义，仅替换光源原语）**
   形如 `color-mix(in srgb, #fff calc(var(--ws-g-nav-border) * 1%), var(--glass-border))`，
   透明度由控制台的 `--ws-g-*` 实时计算。这类**不能**换成带透明度的令牌（会叠加两次 alpha、破坏公式），
   改为引入**光源原语**做等价替换：
   - `--ws-light: #ffffff` / `--ws-light-rgb: 255, 255, 255`（完整色 / 三通道两种形态）
   - `--ws-dark: #000000` / `--ws-dark-rgb: 0, 0, 0`
   - `--ws-dispersion-a-rgb: 255, 86, 170` / `--ws-dispersion-b-rgb: 90, 190, 255`（玻璃色散光晕）

   替换后公式语义与写死字面量**逐字一致**——实测 `.cc-topbar` 等公式目标的实算值改动前后 **0 差异**
   （明暗两主题、70 个字段）。

2. **静态设计色（映射语义令牌）**
   控制台自身的面板/悬浮球/标签等：投影→`--ws-shadow-*`、白色高光→`--ws-rim-*`、
   浅遮罩→新增 `--ws-scrim-soft`、成功提示→复用既有 `--success-strong`、
   点选描边→`color-mix(in srgb, var(--ws-light) N%, transparent)`（保留精确透明度）。

## 8. 第三轮：语义调色板（精确取值）

白/黑之外，全站还散落大量**非白/黑语义色**（绿/红/琥珀/蓝/紫 + 灰阶）。
按色族抽取为 `--ws-pal-<族>-<序号>` 令牌，**取值与原字面量逐字一致**，因此视觉零变化，
作用是把散落字面量收敛为单一来源，后续做明暗适配或收窄色板时只改令牌层即可全站生效。

- 覆盖：`src/styles/*.css`（除令牌层）与 `src/App.css`，共 20 个文件、166 个令牌。
- 页面本地令牌（如 `.tlx-page` 的 `--tlx-event` / `--tlx-transaction`）改为引用调色板，
  不再自持字面量。
- 令牌定义行、`var(--…)` 引用与注释不计入，**页面样式规则中的硬编码色已归零**。

**等价性验证**：以改动前的备份为基准，对 6 个中心页 × 明暗两主题、每组 305 个实算色值样本
做全量比对，**差异 0**；Chrome 视觉基线 42/42 一致；`tsc -b` 错误数维持 35（无新增）。

## 9. 字号阶与死样式清理（已完成）

前两项与令牌化性质不同，已单独排期完成。

### 9.1 删死样式（已完成）

判定标准：类名在 TSX/TS 源码中是否出现。最终确认失效类名：

| 文件 | 失效类 | 处理 |
| --- | --- | --- |
| `creation-center.css` | `cc-asset` / `cc-asset-arrow` / `cc-asset-copy` / `cc-asset-label` / `cc-asset-value` / `cc-assets-grid`、`cc-back`、`cc-breadcrumb-sep`、`cc-recent-grid` / `cc-recent-work`、`cc-tool` / `cc-tool-arrow` / `cc-tool-icon` / `cc-tool-name` / `cc-tool-number` / `cc-tools-grid`、`cc-workspace-icon` / `cc-workspace-title`（18 类） | 整删 43 条规则，改写 4 条组合选择器 |
| `community.css` | `cm-co-create-empty`、`cm-co-icon`、`cm-empty-note`、`cm-follow-counts`、`cm-hot-columns`（5 类） | 整删 15 条，改写 1 条 |
| `centers.css` | `ai-companion-links`（1 类） | 整删 4 条 |

处理原则：**整条选择器全为死类才整删**；组合选择器只摘除死类部分、保留活类部分。
例如 `.cc-tool:focus-visible, .cc-asset:focus-visible` 从 `.cc-scene-card:focus-visible` 的组合中摘除；
`.cc-breadcrumb span:not(.cc-breadcrumb-sep)` 因 `cc-breadcrumb-sep` 位于 `:not()` 内，规则整体保留。

同时清理跨文件引用：`appearance-studio.css` 的玻璃/文字作用域选择器与 `navigation.css` 的共享网格
选择器中，对上述死类的引用一并摘除（仅保留同组活类）。清理后全 CSS 范围对死类的引用归零。

验证：三个文件括号平衡；浏览器中扫描全部 `cssRules`，实际生效的 CSS 无死类规则残留；
`tsc -b` 35、`vite build` 通过；Chrome 基线 42/42。

### 9.2 桌面端小字字号阶（已完成）

新增两个微缩字号令牌，收编 `--text-xs` 以下被滥用的小字：

| 令牌 | 默认 | small | large | 收编范围 |
| --- | --- | --- | --- | --- |
| `--text-3xs` | 7.5px | 6.5px | 8px | 6–7.8px |
| `--text-2xs` | 9px | 8px | 9.5px | 8–9.5px |

- 取值取各自区间的**众数**，使多数元素字号不变，视觉变化最小。
- 全站 CSS 中 **637 处** `font-size: <10px` 硬编码 → 令牌；TSX 中 **33 处**内联 `fontSize < 10` → `var(--text-2xs)`。
- 收编后 CSS 与 TSX 中均无 `<10px` 的硬编码字号，微缩字号统一由令牌驱动，可随字号档位整体调节。

验证：`tsc -b` 35、`vite build` 通过；Chrome 基线重采集后 42/42 自洽。
字号增大带来的布局变化（卡片高度 +3–4px、个别页面滚动屏数微增）为预期结果，已写入新基线。

### 9.3 仍待处理

1. 页面底部其余手写深色块，逐个文件在转换完成后删除——**删之前必须先确认该文件所有表面都已令牌化**，
   否则会出现“深色下某块突然变白”。
2. Safari 基线待「允许远程自动化」勾选后补齐（见下节审计结论）。

## 10. 全站继承审计与回归验收（验收闸门）

在令牌化落地后，对**全局设置能否从 Tokens 一贯传递到业务页面、特殊组件是否绕过统一体系**做了全站审计，
并执行 Chrome / Safari 回归。完整证据见 `docs/阶段三-全站令牌继承审计与回归验收报告.md`。

**结论：阶段三在 Chrome 侧具备正式收尾条件（Safari 除外）。**

| 判定项 | 结果 |
| --- | --- |
| 颜色层传递（业务 CSS 零硬编码颜色，376 色值全在令牌层） | ✓ 通过 |
| 特殊组件未绕过统一体系（`LiquidGlass`、AI 助手面板等均消费令牌） | ✓ 通过 |
| 主题 / 皮肤 / 外观文字色·字号·字体传递 | ✓ 通过 |
| 字号设置传递 | ✓ 通过（初测断裂，**已修复**）：仅微缩档响应的内联遮蔽已解除，`--text-xs/sm/base/lg` 随档位正确变化（large 16/13.5/12/18.5px、small 13.5/11.5/10/16px），文本字号变化占比由 20%–58% 升至 35%–63%。**外壳硬编码已修复**：`.cc-*` 全局外壳 7 处硬编码字号映射到令牌，随档位精确缩放。残余：单页 10–13px 硬编码不经令牌（采纳率 74.4%），经影响评估属局部样式，不扩大重构 |
| 密度设置传递 | △ 部分：令牌层正常（`.cc-nav-item`/`.pwh-card` 间距随密度变化），间距令牌采纳率仅 4.2%，业务页间距基本不变，属采纳缺口 |
| 玻璃档位传递 | ✓ 通过（初测断裂，**已修复**）：`applyAppearance` 在档位生效时不再内联遮蔽，低/高/实心档位 6 页均正确生效 |
| 真实浏览器功能验证 | ✓ 通过（7 页控制台 0 错误、骨架正常、跨页档位继承精确） |
| Chrome 视觉回归 | ✓ 通过（固定状态基线 42/42，0 差异；基线已刷新） |
| Safari 视觉回归 | ✗ 未执行（环境无免密码路径，需用户在 Safari GUI 手动开启远程自动化） |

**收尾前置条件**：仅 Safari 远程自动化一项阻塞（需手动开启后补跑 `--engine safari` 基线）。
两处硬性继承断裂（玻璃档位、字号档位）的内联覆盖冲突与全局外壳字号硬编码均已修复：`applyAppearance` 末尾与
`applyExperience` 末尾共同调用 `applyPreferenceTokens()`，在档位生效时 `removeProperty` 掉被档位规则覆盖的
内联令牌，档位取值统一由 `html[data-*]` 的 CSS 规则驱动，不再构成阻断。继承链已全部接通；字号中档与密度间距
的硬编码经影响评估确认属**局部样式**（单页组件、不跨页），按"不扩大重构范围"约束不统一，记录为后续可选项。
