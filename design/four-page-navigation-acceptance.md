# 四个指定页面导航优化 · 实施与验收记录

## 1. 实施结果

| 页面 | 调整前 | 调整后 |
|---|---|---|
| 人物种子编辑器 | 标题区 + 横向 01—08 卡片 | 标题区 + 38px 悬浮球；点击展开 168px 模块抽屉，再点收起 |
| 写作辅助 | 全宽玻璃卡片阶段条 | 44px 轻量阶段条；正文区域获得更多高度 |
| 世界构建 | 标题 + 4 个横向阶段卡片 + 子模块 Chip | 38px 悬浮球；点击展开 4 阶段抽屉；阶段上下文 + 单行子模块 Subnav |
| 模拟推演 | 全宽玻璃卡片阶段条；操作与导航混排 | 44px 轻量阶段条；中间控制台明确“运行操作”分组 |

统一保留：

- 全局顶栏 `CreationCenterTopbar`，位置、搜索、AI 状态、后端状态、用户入口不变。
- 产品业务导航 `ProductWorkspaceNav`，Tab 数组、顺序、路由不变。
- 现有配色、字体、圆角、阴影、云宝助手不变。
- 人物表单、写作编辑器、世界设定字段、模拟三栏工作区与推演逻辑不变。

## 2. 悬浮球交互

### 人物种子编辑器

- 收起：仅显示 38px 圆形球，球内显示当前模块编号 `01—08`。
- 展开：左侧浮出 168px 抽屉，列出 8 个模块的编号、完整标题、简介。
- 当前模块深色选中；点击其他模块立即切换右侧内容，抽屉保持展开。
- 再次点击球收起；按 `Esc` 也可收起。
- 抽屉为绝对定位悬浮层，不改变右侧编辑区宽度，不产生布局位移。

### 世界构建

- 收起：球内显示当前世界阶段编号 `01—04`。
- 展开：168px 抽屉列出四个阶段及说明。
- 当前阶段深色选中；切换后上下文行与阶段子模块同步更新。
- 再次点击球收起；`Esc` 可收起。
- 压力源阶段无子模块时，Subnav 为空，直接显示压力源内容。

## 3. 实际 DOM 层级

### 人物种子编辑器

```text
CreationCenterTopbar                         GLOBAL
ProductWorkspaceNav / 人物管理               BUSINESS
CharacterBuildingPage
  header.cb-scene-head                       PAGE HEADER
  div.nav-orb-dock.cb-module-dock            PAGE MODULE NAV
    button.nav-orb.cb-module-orb             悬浮球（收起/展开）
    nav.nav-orb-drawer.cb-module-drawer      168px 抽屉（展开时）
  main.character-main-full                   当前模块内容
```

### 写作辅助

```text
CreationCenterTopbar                         GLOBAL
ProductWorkspaceNav / 模拟与写作             BUSINESS
SimulationWritingPage
  div.sw-stagebar                            44px 页面阶段条
  WritingPage
    aside 手稿库                              WORKSPACE
    main 写作工作台                            WORKSPACE
    aside 推演参照/素材提取                     PANEL TABS
```

### 世界构建

```text
CreationCenterTopbar                         GLOBAL
ProductWorkspaceNav / 世界管理上下文          BUSINESS
WorldBuildingPage
  header.wb-scene-head                       PAGE HEADER
  div.nav-orb-dock.wb-stage-dock             PAGE STAGE NAV
  div.wb-stage-context                       当前阶段上下文
  div.wb-subnav                              阶段内模块
  内容区                                      SETTINGS CONTENT
```

### 模拟推演

```text
CreationCenterTopbar                         GLOBAL
ProductWorkspaceNav / 模拟与写作             BUSINESS
SimulationWritingPage
  div.sw-stagebar                            44px 页面阶段条
  SimulationPage
    div.sim-control-head                     运行操作分组
    三栏工作区                                事件 / 控制 / 结果
```

## 4. 修改文件

- `src/pages/CharacterBuildingPage.tsx`
  - 横向 Stepper 替换为悬浮球 + 模块抽屉。
  - 页面标题不再 sticky，避免与产品导航吸附冲突。
  - 仅导航 JSX；表单字段、模块数据、保存逻辑未变。
- `src/pages/WorldBuildingPage.tsx`
  - 横向阶段卡片替换为悬浮球 + 阶段抽屉。
  - 增加当前阶段上下文行；子模块 Subnav 保留。
  - 世界数据、字段、保存接口未变。
- `src/pages/SimulationPage.tsx`
  - 中间控制台增加“运行操作”分组；按钮文字由“自动连续推演”收敛为“连续推演”。
  - 推演逻辑未变。
- `src/pages/SimulationWritingPage.tsx`
  - 未改 JSX；阶段条通过 CSS 轻量化。
- `src/styles/product-workspace.css`
  - 新增 `.nav-orb-*`、`.wb-stage-context`、`.sim-control-head` 等样式。
  - 调整 `.sw-stagebar` 为 44px 轻量条。

未修改：

- `ProductWorkspaceNav.tsx` Tab 数组与顺序
- `CreationCenterTopbar.tsx`
- 路由、权限、后端接口、数据库
- 写作编辑器与 AI 调用
- 云宝悬浮助手

## 5. 测试结果

### 构建

```text
✓ built in 474ms
```

仅 chunk 体积提示，无编译错误。

### 人物种子编辑器

- 编辑入口可正常打开。
- 悬浮球显示 `01`；点击展开，抽屉含 8 项。
- 点击 `05` 后：标题变为“个体特征与思想钢印”，球编号变为 `05`，抽屉保持展开。
- 再次点击球：抽屉关闭，`aria-expanded=false`。
- 抽屉展开前后布局偏移：`0`。
- 滚动 520px 后：球吸附在顶栏下方，`orbTop=128`，产品导航底部 `121`，无重叠。
- 页面横向溢出：无。

### 世界构建

- 原有横向阶段导航已移除，页面仅保留 1 个悬浮球。
- 点击展开：4 个阶段全部存在。
- 点击 `04`：上下文显示 `STAGE 04 / 压力源`，球编号 `04`，Subnav 为空，直接显示压力源内容。
- 点击球可再次收起。
- 1024px 宽度：无横向溢出。

### 写作辅助

- 阶段条高度：`44px`，不再使用玻璃卡片圆角。
- 手稿库、编辑区、右侧 AI 面板三栏结构保留。
- 阶段 `02 写作输出` 可切换，切回 `01 模拟运行` 正常。

### 模拟推演

- 阶段条高度：`44px`。
- 三栏工作区：事件列表 / 推演控制 / 结果观察均存在。
- 中间控制台显示“运行操作”，包含“连续推演”“单步推演”两个原有操作。
- 页面横向溢出：无。

### 历史与直达

- 四个路由均可直接访问：
  - `?page=character-management`
  - `?page=writing`
  - `?page=world-building`
  - `?page=simulation`
- 产品导航切换与浏览器前进/后退沿用原有路由逻辑，本次未改路由。

## 6. 截图

- `design/impl-character-nav.png`
- `design/impl-world-nav.png`
- `design/impl-writing-nav.png`
- `design/impl-simulation-nav.png`
