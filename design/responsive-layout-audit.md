# 全站响应式布局 / 信息密度 / 面包屑导航 —— 阶段一审计结果

> 状态：阶段一完成。本文件只做审计与方案，不含页面改动。

## 1. 现状问题清单

### 1.1 布局外壳（App.tsx + creation-center.css）

| 问题 | 证据 |
| --- | --- |
| 侧边栏固定 260px，收起为 0，但**没有平板/移动端抽屉机制** | `App.tsx:910` `width: sidebarCollapsed ? 0 : 260`；`design-system.css:349` `.app-sidebar` 仅桌面样式 |
| `main-area` 用 `marginLeft: 260` 硬编码偏移，与侧栏宽度强耦合 | `App.tsx:1046` `marginLeft: sidebarCollapsed ? 0 : 260` |
| 顶栏高度固定 60px，未由设计变量控制 | `App.tsx:1102` `height: '60px'`；`.cc-topbar` 未定义高度变量 |
| 主内容区**无统一最大宽度**：`.cc-content` 是 1280px，而多数页面各写各的 | `creation-center.css:771` `max-width: 1280px`；`App.tsx:1470` Overview 用 `maxWidth: '1200px'` |
| 页面内容容器内边距散落：`29px 36px`、`2rem`、`1.5rem` 混用 | `creation-center.css:773`；各页面 `padding: '2rem'` |
| 全屏编辑器（Comic / 写作）内部三栏硬编码，无断点折叠 | `App.tsx` 无相关布局变量；`design-system.css` 仅对 chat/timeline 做了 760px 修复 |

### 1.2 响应式断点严重不统一

全站 25 个不同的 `max-width` 断点，没有统一断点变量：

```
760(24) 900(14) 820(12) 620(10) 1080(10) 980(8) 860(8) 700(8)
560(8) 1240(8) 640(6) 680(4) 600(4) 1280(4) 1120(4) 1100(4)
960(2) 800(2) 780(2) 720(2) 1380(2) 1180(2) 1050(2) 1000(2)
```

后果：同一屏宽下不同页面表现不一致，无法保证「全站同一套响应式规则」。

### 1.3 信息密度只改了行高，没有控制布局

`design-system.css:195-198` 中 `data-density` **仅**设置 `--leading-body`，完全不影响卡片内边距、栏间距、控件尺寸、留白。紧凑/宽松模式在布局上没有实际效果。

`applyExperience()`（`utils/experience.ts`）写入 `data-density`，但没有布局侧的响应。

### 1.4 卡片与容器嵌套、间距不统一

- 卡片类众多：`.glass-card / .cc-card / .cw-card / .spirit-panel / .settings-card / .pwh-card / .rel-universe` 等，各自写死 padding。
- 页面大量「卡片套卡片」，例如设置中心多级卡片嵌套、创作中心 Bento 内再嵌玻璃卡，视觉层级过深。
- 间距值分散（见阶段二统一为令牌）。

### 1.5 面包屑与返回按钮现状

1. **两处竞争实现**：
   - `App.tsx:1103-1136` 的 `.breadcrumb`（含 `← 返回` 按钮）——经核实**是死代码**：所有 5 个产品都在 `WORKSPACE_PRODUCTS` 中，`isProductWorkspace || isGlobalShell` 恒为真，永远走 `CreationCenterTopbar`，该分支不可达。
   - `CreationCenterTopbar.tsx:228-233` 的 `.cc-breadcrumb` ——**仅覆盖全局中心页**，产品工作区页面显示的是 `.cc-back`「返回创作中心」按钮，没有层级路径。
2. **返回目标分散**：`setActivePage('home')`、`handleHomeNav('home')`、`handleExitWorld`、`onBackToCenter`、各页 `onBack` 共 8+ 处，目标与副作用不一致。
3. **历史栈不可靠**：`navigate()` 入栈，但 `openProductPage / handleHomeNav / switchProduct` 等都会 `setNavStack([])`，`goBack()` 只接了 `WorldBuildingPage`、`CharacterListPage` 两处。
4. **深层链接**：`?product=&world=&page=` 在刷新后能恢复页面，但面包屑需要从**真实路由状态**派生，而非浏览器历史。

### 1.6 各导航系统职责现状

| 系统 | 现状 |
| --- | --- |
| 全局侧边栏（`.cc-sidebar`） | 一级模块导航，桌面固定；移动端无抽屉 |
| 顶部导航（`.cc-topbar` / `.app-topbar`） | 搜索、世界切换、通知、个人菜单；桌面布局，窄屏挤压 |
| 页面内部导航 | 各页自建 `.tabs / .filter / .mode-switch`（本地状态），职责正确但样式各异 |
| 面包屑 | 仅全局中心页有，产品工作区缺失；返回按钮承担了它的职责 |
| 浏览器返回 | 无专门处理 |

## 2. 涉及文件

**外壳与导航核心**
- `src/App.tsx`（外壳、activePage/navStack/navigate/goBack、两个顶栏分支、侧边栏）
- `src/components/creation-center/CreationCenterTopbar.tsx`（`.cc-breadcrumb` / `.cc-back`）
- `src/components/creation-center/CreationCenterSidebar.tsx`（全局分组）
- `src/components/workspace/ProductWorkspaceNav.tsx`（产品工作区二级导航）
- `src/components/creation-center/YunbaoGroupNav.tsx`（云宝分组导航）

**布局样式**
- `src/styles/design-system.css`（密度、玻璃、侧栏、断点）
- `src/styles/creation-center.css`（外壳、`.cc-content`、`.main-area-*`、`.cc-breadcrumb`）
- 各页面 CSS：`settings.css / community-social.css / billing-center.css / spirit-economy.css / user-center.css / works.css / creator-assets.css / product-workspace.css / yunbao-workspace.css`

**导航数据**
- `src/product/products.ts`（产品、nav_groups、allowed_modules）
- `src/product/labels.ts`（PAGE_LABELS_EN、NAV_GROUP_EN）
- `src/product/types.ts`

**页面级返回按钮**（阶段三逐步收敛）
- `CommunitySocialPage / SpiritEconomyPage / ComicWorkbenchPage / CharacterListPage / EventsPage / NarrativeGraphView` 等

## 3. 改造方案（阶段二 / 三落地）

### 3.1 统一响应式布局系统
- 在 `design-system.css` 定义**唯一断点变量** `--ws-bp-*` 与布局令牌：侧栏宽、顶栏高、内容最大宽、栏间距、卡片内边距、控件最小高。
- 外壳改用令牌：`main-area` 用 CSS 变量 + 媒体查询，而不是内联 `marginLeft: 260`。
- 平板（≤1024px）：侧栏自动转为抽屉，主内容全宽。
- 移动端（≤768px）：单栏、抽屉导航、主内容去外边距、禁止横向溢出。

### 3.2 统一信息密度系统
- 紧凑 / 舒适（默认） / 宽松 三档，分别调整**布局**令牌：卡片内边距、栏间距、区块间距、控件尺寸、行高。
- 密度与响应式断点联动：移动端在密度基础上再收紧。

### 3.3 统一面包屑导航系统
- 建立 `src/navigation/navRegistry.ts`：由**真实**产品 `nav_groups` 与全局中心分组派生层级，支持多级、可点击、当前级不可点。
- 建立统一 `<Breadcrumb>` 组件，接入两个顶栏（替换死代码 `.breadcrumb` 与 `.cc-breadcrumb`，产品工作区的 `.cc-back` 由面包屑承载）。
- 移动端路径过长自动折叠中间层级，点击展开完整路径。
- 保留浏览器返回职责；仅在全屏编辑器等交互场景保留独立返回按钮。

### 3.4 卡片与容器
- 统一卡片内边距/间距令牌，收敛重复嵌套（不删功能，只合并无意义容器）。
- 同类内容用分组 + 分隔线，卡片列数随宽度自适应。

## 4. 阶段一交付

- ✅ 问题清单（布局、断点、密度、卡片、面包屑）
- ✅ 涉及文件清单
- ✅ 改造方案
- ⏳ 阶段二：公共基础设施（断点变量、密度令牌、面包屑组件与路由映射）
