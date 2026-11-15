# 四个指定页面导航结构优化 · 现状与方案

> 状态：已按确认方案实施。左侧模块导航进一步改为“38px 悬浮球 + 168px 悬浮抽屉”，不再占据固定编辑宽度。
>
> 旧版静态预览：`design/four-page-navigation-preview.html`
>
> 实施后截图：`design/impl-character-nav.png`、`design/impl-world-nav.png`、`design/impl-writing-nav.png`、`design/impl-simulation-nav.png`

## 1. 范围

只处理：

| 页面 | 路由 / PageKey | 实际组件 |
|---|---|---|
| 人物种子编辑器 | `character-management` → 编辑态 | `CharacterListPage.tsx` → `CharacterBuildingPage.tsx` |
| 写作辅助 | `writing` | `SimulationWritingPage.tsx` → `WritingPage.tsx` |
| 世界构建 | `world-building` | `WorldBuildingPage.tsx` |
| 模拟推演 | `simulation` | `SimulationWritingPage.tsx` → `SimulationPage.tsx` |

不处理：创作中心、世界管理列表、人物列表、事件管理、时间线、云宝、其他业务中心。

## 2. 当前实际层级

### 2.1 全局共享外壳

1. `CreationCenterTopbar`
   - 位置：滚动区之外，固定在主内容区顶部，68px。
   - 内容：返回创作中心、产品图标、产品名、选择世界、搜索、AI 接入状态、后端状态、通知、头像。
2. `ProductWorkspaceNav`
   - 位置：滚动内容顶部，`sticky top: 0`，位于全局顶栏下方。
   - 职责：产品级业务模块切换（总览、世界管理、人物管理、事件管理、时间线、模拟与写作等）。
   - 现状：Tab 数组不改，仅调整页面内部导航。

> 结论：全局顶栏不是页面导航，产品导航才是“业务中心级”导航。四个页面都必须保留这两层，且不得再增加一层同职责的横向导航。

### 2.2 人物种子编辑器

当前 DOM / 层级：

```text
CreationCenterTopbar                    GLOBAL
ProductWorkspaceNav（人物管理 active）   BUSINESS
CharacterBuildingPage
  header.cb-scene-head                 PAGE HEADER
    ← 返回 / 标题 / 种子设定|当前运行态 / 保存
  div.character-stepper                PAGE MODULE NAV（01—08，横向）
  div.character-main-full
    MODULE 01/08 + 模块标题 + 表单内容  PAGE CONTENT
```

问题：

- 页面标题区、横向 01—08、产品导航三层连续堆叠。
- 01—08 使用 `flex:1` 平分宽度，模块名较长，空间不足时被压缩或截断。
- 页面标题区本身 `sticky top:0`，与产品导航的吸附关系容易形成两层吸附。
- 编辑内容区域被横向导航占用较多垂直空间。

### 2.3 写作辅助

当前 DOM / 层级：

```text
CreationCenterTopbar                    GLOBAL
ProductWorkspaceNav（模拟与写作 active） BUSINESS
SimulationWritingPage
  div.sw-stagebar（01 模拟运行 / 02 写作输出） PAGE STAGE NAV
  WritingPage
    左：手稿库                          WORKSPACE COLUMN
    中：写作工作台
      header（标题 / 状态 / 架构师|探险家）
      toolbar                           EDITOR TOOLBAR
      正文编辑器                        CONTENT
    右：推演参照 | 素材提取              PANEL TABS
```

问题：

- 产品导航 + 全宽阶段卡片 + 编辑器模式切换 + 右侧面板 Tab，形成多排“看起来同级”的导航。
- `sw-stagebar` 是整块玻璃卡片，垂直占用较大。
- 写作模式切换位于编辑器头部，但与阶段导航视觉权重接近，层级不清晰。
- 右侧面板 Tab 属于面板内部状态，不应再被理解为页面级导航。

### 2.4 世界构建

当前 DOM / 层级：

```text
CreationCenterTopbar                    GLOBAL
ProductWorkspaceNav（世界管理为上下文） BUSINESS
WorldBuildingPage
  header.wb-scene-head                 PAGE HEADER
  div.wb-level-nav（01—04，横向卡片）   PAGE STAGE NAV
  div.wb-subnav（阶段内模块，横向）      PAGE MODULE NAV
  内容区                                CONTENT
```

问题：

- 页面标题、4 个阶段卡片、阶段内模块 Chip 三层横向区域连续出现。
- 世界阶段与阶段内设定模块视觉权重接近，用户不易区分“我在哪个阶段 / 哪个模块”。
- 阶段卡片平分宽度，模块增加时只能继续横向压缩。
- 压力源没有子模块，导航结构与其他阶段不一致，需要明确处理。

### 2.5 模拟推演

当前 DOM / 层级：

```text
CreationCenterTopbar                    GLOBAL
ProductWorkspaceNav（模拟与写作 active） BUSINESS
SimulationWritingPage
  div.sw-stagebar（01 模拟运行 / 02 写作输出） PAGE STAGE NAV
  SimulationPage
    左：事件注入台                      COLUMN
    中：推演控制台                      COLUMN + OPERATIONS
    右：推演结果观察                    COLUMN
```

问题：

- 阶段导航是全宽卡片，挤占三栏工作区高度。
- 运行模式与操作按钮都位于中间控制区，功能入口和运行操作没有明确分层。
- 三栏宽度本身没有问题，不应为了导航再压缩。

## 3. 调整后的统一层级

保留三层，禁止新增同职责导航：

```text
L0 GLOBAL     CreationCenterTopbar（固定）
L1 BUSINESS   ProductWorkspaceNav（产品业务模块，sticky）
L2 PAGE       页面级阶段 / 页面标题（轻量，一条）
L3 MODULE     页面内部模块导航（左侧 Rail 或单行 Subnav）
```

视觉规范：

- L0 完全不动。
- L1 只保留现有 Tab 数组与跳转；不改图标、文字、数量。
- L2 统一为 38—48px 的轻量条，不再使用大玻璃卡片。
- L3 选中态统一：深色底 + 白字；未选中：透明底 + 次级文字。
- 不使用新配色，不引入新字体，不改变圆角体系。
- 模块名称完整显示；空间不足时 Rail 可纵向滚动，Subnav 可横向滚动，不截断、不隐藏入口。

## 4. 逐页方案

### 4.1 人物种子编辑器

结构：

```text
GLOBAL  CreationCenterTopbar
BUSINESS ProductWorkspaceNav（人物管理）
PAGE    cb-editor-head：← 返回 / 人物种子编辑器 / 种子设定|当前运行态 / 保存种子
BODY    38px 悬浮球（收起） / 168px 悬浮抽屉（展开）
        ┌ 抽屉：01—08 ────────┐
        │ 01 基础档案          │  右侧当前模块工作区保持全宽
        │ 02 人格动力结构      │  MODULE 01 / 08
        │ 03 人格运行与防御机制│  标题 / 描述 / 原有表单
        │ 04 现实承载条件      │
        │ 05 个体特征与思想钢印│
        │ 06 生命经历与历史沉积│
        │ 07 人物初始状态      │
        │ 08 运行态与成长      │
        └──────────────────────┘
```

调整：

- 删除桌面端 `character-stepper` 横向 01—08。
- 改为 38px 悬浮球：显示当前模块编号，点击展开 168px 抽屉。
- 抽屉绝对定位悬浮，不改变右侧编辑区宽度；再次点击悬浮球收起。
- 抽屉保留编号、完整名称、顺序、点击切换、当前选中态。
- 支持 Esc 收起；选中模块后抽屉保持展开，便于连续切换。
- 页面标题区保留返回、标题、种子/运行态切换、保存按钮。
- 收起时仅保留悬浮球，不占用编辑区横向空间。

不改：`CHARACTER_MODULES` 数据、`activeModule`、所有表单字段、保存接口、运行态逻辑。

### 4.2 写作辅助

结构：

```text
GLOBAL  CreationCenterTopbar
BUSINESS ProductWorkspaceNav（模拟与写作）
PAGE    sw-phasebar：01 模拟运行 | 02 写作输出（轻量 42px）
BODY    ┌ 手稿库 232px ┬ 写作工作台 flex ┬ AI 辅助 238px ┐
        │ 章节列表     │ 标题 + 状态      │ 推演参照|素材提取 │
        │ 新建/导出    │ 架构师|探险家    │ 当前章节参考      │
        │              │ 工具栏           │                  │
        │              │ 正文编辑器       │                  │
        └──────────────┴──────────────────┴──────────────────┘
```

调整：

- 将 `sw-stagebar` 从玻璃卡片改为 42px 轻量阶段条；保留 01/02 与切换逻辑。
- 写作模式 `架构师 / 探险家` 留在编辑器标题行右侧，作为编辑器模式，不再与阶段条同级。
- 右侧 `推演参照 / 素材提取` 保持在面板顶部，作为面板内部 Tab。
- 删除重复的说明性大段（阶段条内说明改为一行次要文案或移到标题旁），减少垂直占用。
- 正文编辑区域获得更多高度；三栏宽度不变。

不改：`WritingPage` 的编辑器、AI 生成、保存、手稿数据、右侧面板逻辑、`mode` 逻辑。

### 4.3 世界构建

结构：

```text
GLOBAL  CreationCenterTopbar
BUSINESS ProductWorkspaceNav（世界管理上下文）
PAGE    wb-head：世界名称 / 世界 ID / 删除 / 保存
BODY    38px 悬浮球（显示当前阶段编号）
        STAGE 01 · 宏观：世界基底（当前阶段上下文）
        [时代与思想][自然与生态][法则与历史]（当前模块 Subnav）
        当前模块标题 + 原有表单
        抽屉展开：01—04 世界阶段，168px，悬浮覆盖
```

调整：

- 4 个世界阶段从横向卡片改为悬浮球抽屉，保留 01—04 顺序。
- 当前阶段通过悬浮球编号 + 阶段上下文行持续可见。
- 阶段内模块保留为右侧顶部单行 Subnav；压力源无子模块时直接显示内容。
- 悬浮抽屉不改变表单宽度，再次点击悬浮球收起。

不改：世界名称、设定字段、`activeLevel` / `activeSubTab`、保存/删除接口、阶段顺序、压力源组件。

### 4.4 模拟推演

结构：

```text
GLOBAL  CreationCenterTopbar
BUSINESS ProductWorkspaceNav（模拟与写作）
PAGE    sw-phasebar：01 模拟运行 | 02 写作输出（当前：模拟运行）
BODY    ┌ 事件列表 300px ┬ 推演控制台 flex ┬ 结果观察 360px ┐
        │ 事件注入台     │ 运行模式：单事件|连续 │ 结果卡片      │
        │ AI 状态        │ 输入 + 开始推演        │ 写成章节      │
        │ 事件卡片       │ 推演记录               │               │
        └────────────────┴────────────────────────┴───────────────┘
```

调整：

- 阶段条同样改为 42px 轻量条，不再占用大卡片高度。
- `单事件 / 连续推演` 归入中间控制台的“运行模式”行，作为操作参数，不作为顶部导航。
- `开始推演`、`写成章节` 等动作保持在各自面板内，不与阶段导航混排。
- 三栏宽度、事件列表、控制区、结果区结构不变。

不改：`SimulationPage` 数据、AI 调用、推演逻辑、结果、历史记录、`onWriteChapter` 逻辑。

## 5. 计划修改文件

| 文件 | 计划改动 |
|---|---|
| `src/pages/CharacterBuildingPage.tsx` | 横向 Stepper → 38px 悬浮球 + 168px 模块抽屉；仅导航 JSX |
| `src/pages/WritingPage.tsx` | 编辑器标题/模式区域整理；不触碰编辑器与数据 |
| `src/pages/WorldBuildingPage.tsx` | 横向阶段导航 → 悬浮球 + 阶段抽屉；Subnav 保留单行 |
| `src/pages/SimulationPage.tsx` | 运行模式移入控制台标题行；三栏结构保持 |
| `src/pages/SimulationWritingPage.tsx` | 阶段条结构轻量化；保留 mode 切换 |
| `src/styles/product-workspace.css` | 新增悬浮球/抽屉、阶段上下文、紧凑 Phasebar 样式 |
| `src/styles/creation-center.css` | 如需页面级公共导航样式，仅加轻量类 |

明确不改：

- `ProductWorkspaceNav.tsx` 的 Tab 数组与顺序。
- `CreationCenterTopbar` 的任何功能。
- 路由表、`PageKey`、`navigationConfig`、权限逻辑。
- 任何后端接口、数据库、AI 配置。
- 任何表单字段、数据结构、保存机制。
- 云宝悬浮助手。

## 6. 实施后测试清单

1. `character-management` 列表 → 编辑 → 01—08 切换；保存种子 / 运行态；返回列表。
2. `writing` 直接访问；阶段切到模拟再切回；章节切换；正文输入；AI 面板 Tab。
3. `world-building` 直接访问；01—04 阶段切换；各阶段子模块切换；保存世界。
4. `simulation` 直接访问；事件选择；连续推演 / 单步推演；结果生成；写成章节。
5. 刷新、浏览器前进/后退、URL 参数直达。
6. 1024 / 1280 / 1440 / 1920 宽度；悬浮抽屉不越界、不遮挡主要操作。
7. 全局顶栏、AI 状态、后端状态、云宝位置不变。

## 7. 验收对照

- 人物种子编辑器：01—08 完整、顺序不变、左侧 Rail、选中清晰。
- 写作辅助：阶段条轻量、编辑器空间增加、三栏与 AI 面板保留。
- 世界构建：阶段 Rail 与模块 Subnav 分层清晰，4 阶段和全部模块入口保留。
- 模拟推演：阶段条轻量、运行模式归入控制台、三栏不变。
- 四页全局导航一致；无重复导航；未列页面零改动。
