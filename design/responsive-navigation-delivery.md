# 阶段二 / 阶段三 交付说明：响应式布局 + 信息密度 + 面包屑导航

> 承接 `design/responsive-layout-audit.md`（阶段一审计）。本文档记录阶段二（公共基础设施）
> 与阶段三（页面迁移）的完成成果、修改文件与验收方式。

## 一、阶段二：公共基础设施（已完成）

### 1. 统一响应式断点

不再依赖页面各自写死的断点，全站统一为三档：

| 档位 | 断点 | 语义 |
| --- | --- | --- |
| 桌面 | `> 1024px` | 多列、常驻侧栏、面包屑显示完整路径 |
| 平板 | `768px ~ 1024px` | 多列收敛为单列、侧栏转为抽屉、面包屑压缩 |
| 移动 | `< 768px` | 单列、抽屉、面包屑折叠中间层级 |

断点统一落在 `src/styles/navigation.css`，页面不再新增断点。

### 2. 统一布局与密度变量（`src/styles/design-system.css`）

`html` 上新增一套全站唯一来源的 `--ws-*` 令牌，并随 `data-density` 联动：

| 变量 | 默认（舒适） | compact | spacious |
| --- | --- | --- | --- |
| `--ws-sidebar-width` | 264px | — | — |
| `--ws-nav-height` | 68px | — | — |
| `--ws-content-max` | 1280px | — | — |
| `--ws-content-pad` | 24px | 16px | 34px |
| `--ws-card-pad` | 16px | 10px | 22px |
| `--ws-card-gap` | 16px | 10px | 22px |
| `--ws-section-gap` | 24px | 16px | 34px |
| `--ws-control-min-h` | 34px | 30px | 42px |
| `--ws-nav-item-pad-y/x` | 10/12px | 7/10px | 13/14px |
| `--leading-body` | 1.72 | 1.58 | 1.82 |

**密度真实改变布局，而非仅改字号**：卡片内边距、页面内边距、区块间距、控件最小高度、
导航条目内边距全部由令牌驱动，并通过 `navigation.css` 中的 `!important` 覆盖原先写死的内联
样式，确保密度选择在整站生效。

### 3. 统一面包屑

- **路由映射**：`src/navigation/navRegistry.ts`
  - 定义全量 `PageKey`、`GLOBAL_NAV_GROUPS`（个人空间 / 创作与体验 / 创作管理 / 账户服务）。
  - `buildBreadcrumb({ page, product, productConfig, lang })` 从**真实**的
    `productConfig.nav_groups` 与全局侧栏分组推导路径，不虚构层级。
  - 示例：`世界模拟器 > 创作中心 > 场景管理 > 场景编辑`、
    `世界模拟器 > 设置中心 > 视觉设置`。
- **组件**：`src/components/navigation/Breadcrumb.tsx`
  - 祖先一律可点击，当前页高亮且不可点击（`aria-current="page"`）。
  - 不依赖浏览器历史，随路由变化自动更新；深链接 / 刷新均显示正确路径。
  - 桌面/平板显示完整路径；移动端自动折叠中间层级为 `…`，点击可展开。
- **接入**：`App.tsx` 统一计算 `crumbs` 并传给 `CreationCenterTopbar`；
  原散落在页面内的“返回创作中心/返回”按钮（社区社交、灵果经济）已移除，
  由面包屑承担层级跳转，导航角色归位。

### 4. 响应式外壳（`src/styles/navigation.css`）

- `.main-area` 侧栏偏移改用 `--ws-sidebar-width` / `--ws-sidebar-collapsed-width`，
  不再在 JS 里写死 `marginLeft`。
- `≤1024px`：侧栏转为固定抽屉（`translateX(-100%)` + 遮罩），主内容全宽，隐藏侧栏标签。
- `≥1440px`：主内容按 `--ws-content-max-wide` 收口，避免超宽屏无限拉伸。

## 二、阶段三：页面迁移（已完成）

### 1. 卡片 / 容器统一

- **间距统一**：共享卡片网格的 `gap` 统一由 `--ws-card-gap` 驱动。
- **消除嵌套外壳**：`.ct-section` / `.spirit-panel` / 设置面板内的重复卡片外壳被去除，
  内层子项改为“分组 + 分隔线”，减少视觉层级而非删除卡片（AI 中心、游戏中心、灵果经济、设置中心）。
- **密度内边距**：`.glass-card` / `.cc-card` / `.cw-card` / `.spirit-panel` / `.settings-card` 等
  统一使用 `--ws-card-pad`；页面容器统一使用 `--ws-content-pad`。

### 2. 平板 / 移动重排

- `.cs-layout` / `.settings-layout` / `.bc-layout` / `.ca-shell` / `.ct-top-grid` /
  `.spirit-transfer-layout` / `.uc-profile-copy` 等多列布局在 `≤1024px` 统一收敛为单列，
  集中收口，避免同屏宽下各页表现不一致。

### 3. 横向溢出修复

对审计标记的固定宽度点位补齐 `maxWidth` / `boxSizing`，消除移动端/小屏溢出：

- `ChatPage`（250/300px）、`CharacterBuildingPage`（600/500px）、`DiaryPage`（310px）、
  `StorylinePage`（500/320px）、`TimelinePage`（600px）、`UnifiedTimelinePage`（640px）、
  `RelationshipsPage`（300px）、`WorldDataPage`（300px）、`WorldStructurePage`（212px）。

## 三、修改文件清单

**新增**
- `src/navigation/navRegistry.ts`
- `src/components/navigation/Breadcrumb.tsx`
- `src/hooks/useMediaQuery.ts`
- `src/styles/navigation.css`
- `design/responsive-layout-audit.md`（阶段一）

**修改**
- `src/App.tsx`：`crumbs` 计算、侧栏抽屉、统一面包屑、移除页面级返回按钮接线
- `src/main.tsx`：引入 `navigation.css`
- `src/components/creation-center/CreationCenterTopbar.tsx`：接入统一面包屑 + 抽屉开关
- `src/components/creation-center/CreationCenterSidebar.tsx`：支持 `drawerOpen`
- `src/styles/design-system.css`：布局与密度令牌体系
- `src/styles/creation-center.css`：`--ws-nav-height` / `--ws-content-max`
- `src/pages/CommunitySocialPage.tsx` / `src/pages/SpiritEconomyPage.tsx`：移除重复返回按钮
- `src/pages/ChatPage.tsx`：导航高度改用令牌 + 溢出防护
- 各溢出修复页面（见上）

## 四、验收方式与结果

### 1. 构建与类型

- `npm run build` 通过（Vite 8 / rolldown）。
- 真实类型检查 `tsc -p tsconfig.app.json --noEmit`：相对改造前基线（55 项）**减少 1 项**
  （修复了 `product/labels.ts` 的 `TS2614`），**未新增任何类型错误**；其余均为改造前已存在、
  与本次任务无关的历史错误。

### 2. 六档视口真实浏览器验收（CDP，30 项检查）

在 2048 / 1440 / 1024 / 768 / 390 / 360 六档视口下，对创作中心、设置、社区社交、
游戏世界管理、产品工作区共 30 组页面进行检查：

- **横向溢出**：`scrollWidth - clientWidth` 与逐元素越界检测，**30/30 全部为 0**。
- **卡片/导航挤压**：无元素超出视口右边界（排除横向滚动容器内的合法子项）。
- **侧栏抽屉**：`>1024px` 常驻可见、主内容按 `--ws-sidebar-width` 留位；
  `≤1024px` 侧栏转为固定抽屉（默认隐藏），主内容全宽。
- **面包屑**：桌面/平板显示完整路径，移动端自动折叠中间层级为 `…` 且可展开。

### 3. 面包屑交互验收

- 真实层级：`世界模拟器 > 游戏创作 > 世界构建 > 02 世界管理`（由 `nav_groups` 派生）。
- 祖先可点击：点击「游戏创作」跳转到产品首页，点击「世界构建」跳转到分组首项；
  当前页高亮且不可点击（`aria-current="page"`）。
- 路由变化自动更新，深链接/刷新显示正确路径。
- 移动端折叠：折叠态 `世界模拟器 / … / 02 世界管理`，展开后显示完整路径。

### 4. 密度验收

切换 `data-density` 后，卡片内边距真实变化：

| 密度 | `--ws-card-pad` | 实测卡片 padding |
| --- | --- | --- |
| 紧凑 compact | 10px | 10px |
| 舒适 comfortable | 16px | 16px |
| 宽松 spacious | 22px | 22px |

证明密度联动的是布局间距与内边距，而非仅字号。

### 5. 抽屉交互验收

移动端点击顶栏导航按钮：`.cc-sidebar` 由 `is-collapsed`（隐藏、左移）切换为
`is-drawer-open`（可见、归位）；点击遮罩后恢复收起，行为正确。

