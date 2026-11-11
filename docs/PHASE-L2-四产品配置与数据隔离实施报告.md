# PHASE L2：四产品功能配置与数据隔离实施报告

> 范围：本地可运行实现与验收，不代表生产部署完成。
> 统一配置源：`backend/product_config.py`；前端启动时读取 `/api/products/config`，失败时使用 `src/product/products.ts` 同构兜底。

## 1. 目标与结论

在原世界模拟器导航、后端和既有能力上，增加四套产品功能配置：

| 产品 | 定位 | 首页 | 工作空间 |
|---|---|---|---|
| 游戏创作 `game` | 完整世界模拟：世界、NPC、规则、事件、时间线、故事线、多路径与写作 | 世界总览 | 使用用户自己的普通世界 |
| 文学创作 `literature` | 人物、关系、事件与叙事；模拟作为辅助推演 | 世界总览 | 使用用户自己的普通世界 |
| AI 伴侣 `companion` | 多个个人 AI 人格 + AI 伴侣角色 + 独立会话/记忆；不开放世界管理/结构/设定/故事线 | 个人 AI 人格 | 自动隐藏空间「AI 伴侣空间」 |
| 日记与传记 `diary` | 本人/他人人生记录、人物档案、关系、经历、时间线、传记、来源管理；不开放世界管理/结构/设定/模拟/故事线 | 日记与传记 | 自动隐藏空间「人生记录空间」 |

核心结论：

- 四产品共用人物、关系、事件、记忆、AI 调用与底层数据表，但通过产品键、产品世界与 API 过滤实现数据空间隔离。
- 导航、页面入口、模块权限与业务模式由同一份配置驱动，不是单纯改菜单文案。
- 伴侣/日记不创建普通世界；首次进入自动创建隐藏产品工作空间，`worlds.is_product_workspace=1`，不进入世界管理列表。
- AI 推断来源固定以 `inference / 未确认` 保存；只有用户显式调用确认接口后才变为事实。
- 原有官方演示世界与游戏创作能力保留。

## 2. 功能配置矩阵

“开启”表示该模块按该产品默认行为工作；`full/light` 等表示同一模块的业务模式差异；`—` 表示模块不进入该产品导航且前端路由守卫拒绝直接访问。

| 模块 | 游戏创作 | 文学创作 | AI 伴侣 | 日记与传记 |
|---|---|---|---|---|
| overview | 开启 | 开启 | — | — |
| world-management | 开启 | 开启 | — | — |
| world-building | 开启 | 开启 | — | — |
| character-management | full | full | light | light |
| chat | npc | npc | companion | — |
| world-structure | 开启 | 开启 | — | — |
| world-data | 开启 | 开启 | — | — |
| relationships | world | world | relationship | life |
| events | narrative | narrative | interaction | life |
| timeline | world | world | interaction | life |
| simulation | full | auxiliary | — | — |
| storyline | 开启 | 开启 | — | — |
| writing | narrative | narrative | — | biography |
| multipath | 开启 | 开启 | — | — |
| time-machine | 开启 | 开启 | 开启 | 开启 |
| archive | 开启 | 开启 | 开启 | 开启 |
| trash | 开启 | 开启 | 开启 | 开启 |
| personas | — | — | full | — |
| memories | — | — | 开启 | — |
| companion-runtime | — | — | 开启 | — |
| information-sources | — | — | — | 开启 |
| diary | — | — | — | 开启 |

### 2.1 业务模式含义

| 模式 | 实际行为 |
|---|---|
| `character-management=full` | 保留人物成长、运行态、完整档案与关系入口 |
| `character-management=light` | 人物列表隐藏“成长”入口，只保留身份、陪伴/档案资料、聊天、传记、归档 |
| `events=narrative` | 完整事件、因果、选择/结果、分支沙盒 |
| `events=interaction` | “互动事件”：隐藏剧情线、事件层级、因果关系、选择面板与分支沙盒 |
| `events=life` | “人生经历”：隐藏剧情线、因果、选择面板与分支沙盒，保留人物/地点/经历事实 |
| `timeline=world` | 世界/人物/组织/地点/资源范围，事件+状态变化+资源流水 |
| `timeline=interaction/life` | 只展示“全部记录/人物”，事件+状态变化，不展示组织/地点/资源范围与资源流水 |
| `simulation=full` | 完整推演控制台 |
| `simulation=auxiliary` | 标题与提示明确“辅助推演”，不自动改写正文/故事线 |
| `writing=narrative` | 原有写作工作台 |
| `writing=biography` | “传记写作”：提示事实须有来源，AI 推断不能自动写成事实 |
| `chat=npc/companion` | 游戏/文学为 NPC 聊天；伴侣为 AI 伴侣角色，并说明角色与个人人格彼此独立 |
| `relationships=world` | 人物/组织/地点/资源关系 |
| `relationships=relationship/life` | 仅人物之间的关系，隐藏组织/地点/资源范围与表单项 |

## 3. 导航与页面入口方案

### 3.1 游戏创作

- 工作台：01 世界总览
- 世界与人物：02 世界管理、03 人物管理、AI 角色聊天（NPC）、世界结构、世界设定、04 关系与组织、05 事件管理
- 模拟与叙事：06 时间线、07 模拟运行、故事线管理、08 写作辅助
- 数据安全：时光机、归档库、回收站

### 3.2 文学创作

- 工作台：01 世界总览
- 世界与人物：02 世界管理、03 人物管理、AI 角色聊天、世界结构、世界设定、04 关系与组织、05 事件管理
- 人物与叙事：06 时间线、故事线管理、08 写作工作台、07 模拟运行 · 辅助
- 数据安全：时光机、归档库、回收站

### 3.3 AI 伴侣

- 伴侣空间：03 人物管理 · 轻量、个人 AI 人格、AI 伴侣角色
- 长期互动：04 关系管理、05 互动事件、06 互动时间线、07 人格运行、记忆管理
- 数据安全：时光机、归档库、回收站
- 不出现：世界管理、世界结构、世界设定、模拟运行、故事线管理、写作辅助
- 首页：个人 AI 人格页面
- 人格运行页展示后台陪伴状态、独立会话数、长期记忆数与暂停/恢复，不提供完整模拟控制台

### 3.4 日记与传记

- 人生记录：日记与传记、03 人物档案 · 轻量
- 经历与来源：04 人物关系、05 人生经历、06 人生时间线、08 传记写作、信息来源管理
- 数据安全：时光机、归档库、回收站
- 不出现：世界管理、世界结构、世界设定、模拟运行、故事线管理、聊天
- 首页：日记与传记页面

### 3.5 入口与路由守卫

- 顶部/侧栏产品切换器同时展示四产品说明、自动工作空间与功能配置矩阵。
- 切换产品后写入 `localStorage.ws.product`、`sessionStorage.ws.productScene` 与 URL `product` 参数。
- 导航完全由配置 `nav_groups` 生成。
- `allowed_modules` 校验当前页；未开放页面（含手工改 `page` URL）自动回到该产品首页。
- 伴侣/日记自动工作空间创建后，不显示“退出当前世界”，避免用户掉回不允许的世界管理。
- 旧 URL 中的世界若属于其他产品，切换时清除当前世界，防止串数据。

## 4. 配置层设计

### 4.1 后端（权威配置）

`backend/product_config.py`：

- `PRODUCT_KEYS`、产品标签/图标/描述、首页、是否自动工作空间、工作空间名称。
- `MODULES`：稳定模块键 → 页面键/标签/说明。
- `NAV_GROUPS`：每产品导航分组与顺序。
- `NAV_LABEL_OVERRIDES`：同一模块在不同产品下的业务化命名。
- `MODES`：同一模块的业务模式。
- `EXTRA_ALLOWED`：导航外但仍合法的子页面（游戏/文学的 `world-building`、`multipath`）。
- `allowed_modules()`、`module_allowed()`、`require_module()`、`config_for()`、`matrix()`、`normalize_product()`。

新增 API：

| 方法与路径 | 用途 |
|---|---|
| `GET /api/products/config` | 四产品完整矩阵、模块表 |
| `GET /api/products/{product}/config` | 单产品配置 |
| `GET /api/products/{product}/access/{module}` | 模块权限判定 |
| `GET /api/products/{product}/workspace` | 读取自动工作空间 |
| `POST /api/products/{product}/workspace` | 幂等确保自动工作空间存在 |

### 4.2 前端（同构兜底 + 运行时配置）

- `src/product/types.ts`：产品/导航/矩阵类型。
- `src/product/products.ts`：四产品兜底配置、存储/URL 规范化、允许页判定。
- `src/api/productConfig.ts`：读取后端矩阵、确保工作空间、权限查询。
- `src/components/ProductSwitcher.tsx`：产品卡片 + 配置矩阵 + 切换。
- `src/App.tsx`：产品状态、动态导航、路由守卫、自动工作空间初始化、按产品向页面传业务模式。
- 页面适配：`WorldsPage`、`WorldBuildingPage`、`CharacterListPage`、`DiaryPage`、`EventsPage`、`SimulationPage`、`UnifiedTimelinePage`、`RelationshipsPage`、`WritingPage`、`ChatPage`、`AIAssistantPanel`。
- 新增页面：`PersonaPage`（内嵌人格管理）、`MemoryPage`、`CompanionRuntimePage`、`InformationSourcesPage`。

## 5. 数据隔离与权限设计

### 5.1 产品数据空间

- `worlds.product_scene`：`game/literature/companion/diary`，世界列表按产品过滤。
- `worlds.is_product_workspace`：伴侣/日记自动隐藏空间标记；`GET /api/worlds` 默认不返回隐藏空间，`include_workspace=true` 时才返回（前端 App 读取产品工作空间时显式启用）。
- 游戏/文学：普通世界，用户自己创建；世界管理只显示本产品世界。
- 伴侣/日记：不开放普通世界创建（后端 `POST /api/worlds` 对这两种产品返回 403），首次进入 `POST /api/products/{product}/workspace` 幂等创建隐藏空间；底层人物、事件、关系、时间线仍需要 `world_id`，但用户不需要配置世界。
- 伴侣工作空间首次创建会内置一个普通 AI 伴侣角色“小满”，与个人 AI 人格分开；不复制人格记忆。

### 5.2 产品键隔离

| 数据 | 字段/规则 | API 行为 |
|---|---|---|
| 个人 AI 人格 | `personal_personas.product_key='companion'` | `GET/POST /api/personas` 仅 `companion` 可用；`product=game` 返回 403 |
| 日记 | `diary_entries.product_key='diary'` | 列表/创建仅日记产品；其他产品返回 403 |
| 信息来源 | `information_sources.product_key='diary'` | 仅日记产品；按人物/事件/类型/状态筛选 |
| 会话/记忆 | 仍按 `persona_id/thread_id` 隔离 | 不变 |
| AI 助手聊天缓存 | `ws.assistant.chat.v2.{product}` | 切换产品不串会话 |
| 人物/关系/事件 | 按 `world_id` 隔离 | 伴侣/日记只读写自己的隐藏空间 |

### 5.3 权限边界

- 前端：配置驱动导航 + `allowed_modules` 路由守卫 + 产品切换器。
- 后端：`require_module()` 用于产品专属 API；伴侣/日记普通世界创建被拒绝；人格/日记/信息来源跨产品请求返回 403。
- 未开放模块不出现在导航，也不能通过 URL 手工进入。
- 产品工作空间不出现在世界管理；伴侣/日记无“退出当前世界”。

### 5.4 AI 推断不自动成为事实

`information_sources`：

- 来源类型：本人回忆 `self_memory`、他人叙述 `other_account`、资料文献 `document`、实物/记录证据 `evidence`、AI 推断 `ai_inference`。
- 状态：`confirmed / unconfirmed / inference`。
- `source_type=ai_inference` 创建时强制 `status=inference`，忽略客户端传入的 confirmed。
- 普通 PATCH 把 AI 推断改为 `confirmed` 返回 409。
- 唯一提升入口：`POST /api/information-sources/{id}/confirm`，由用户显式确认。
- UI 对 AI 推断显示“AI 推断 · 未确认”，提供“确认推断”按钮并二次确认；确认不会改写来源原文。

## 6. 数据库迁移

`M033_product_spaces`：

- `worlds.is_product_workspace BOOLEAN DEFAULT 0` + 索引。
- `personal_personas.product_key TEXT DEFAULT 'companion'` + 索引。
- `diary_entries.product_key TEXT DEFAULT 'diary'` + 索引。
- 回填：旧世界/空 `product_scene` → `game`；旧人格 → `companion`；旧日记 → `diary`。
- 新表 `information_sources` + owner/product/character/event 索引。
- `M034_product_workspace_unique`：部分唯一索引 `ux_worlds_product_workspace(owner_id, product_scene) WHERE is_product_workspace=1`，避免并发创建重复自动空间。
- 已注册到 `backend/migrations/runner.py`；迁移副本演练通过。

结果：34 个迁移、72 张表（新增信息来源表）。

## 7. 实际页面与截图

截图位于 `docs/screenshots/`：

| 截图 | 内容 |
|---|---|
| `01-product-matrix.png` | 产品切换器 + 四产品卡片 + 功能配置矩阵 |
| `02-game-overview.png` | 游戏创作工作台（原官方世界数据） |
| `03-game-events.png` | 游戏创作事件管理（完整叙事模式） |
| `04-literature-overview.png` | 文学创作导航/工作台（模拟为辅助模式） |
| `05-companion-personas.png` | AI 伴侣首页：个人 AI 人格独立身份/会话/记忆 |
| `06-companion-runtime.png` | 07 人格运行：后台状态、独立会话、记忆 |
| `07-companion-memory.png` | 记忆管理：按人格隔离，展示真实记忆 |
| `08-companion-events.png` | 互动事件模式：无剧情线/因果/分支沙盒 |
| `09-diary-main.png` | 日记与传记：独立日记、来源标签 |
| `10-diary-sources.png` | 信息来源管理：AI 推断未确认/已确认、出处 |

浏览器实际验证记录：

- 产品切换后 URL、导航分组、首页与自动工作空间同步变化。
- AI 伴侣手工访问 `page=world-management` 被路由守卫弹回人物/人格首页；导航无世界管理/结构/设定/故事线/模拟。
- 伴侣工作空间自动创建且幂等；世界管理只显示游戏产品世界，隐藏空间不出现。
- 日记产品自动空间、日记写入、来源创建（AI 推断默认未确认）、显式确认、状态刷新均通过 UI 完成。
- 游戏切回后原官方世界仍可进入，原事件/人物数据未受影响。
- 文学创作导航显示“07 模拟运行 · 辅助”，模拟页有辅助模式提示。

## 8. 自动化验收

新增 `backend/tests/smoke_product_spaces.py`，覆盖：

- 四产品配置矩阵、导航/模块权限、文学辅助模式。
- 伴侣/日记禁止世界管理、禁止世界结构/设定/模拟/故事线。
- 产品工作空间幂等、隐藏空间不出现在普通世界列表、游戏/文学不创建隐藏空间。
- 人格跨产品创建/读取被拒；日记跨产品写入/读取被拒。
- 信息来源四类来源、AI 推断默认未确认、直接改 confirmed 被拒、显式确认成功。
- 测试清理只删自己创建的临时数据，不删除已有伴侣/日记空间。

已加入 `backend/tests/run_all.sh`。

最终全量回归（19 个套件）：**516 passed / 0 failed**，迁移副本演练 **34 / 34** 个迁移、**72** 张表通过；新增产品套件单独复跑 **44 passed / 0 failed**。前端 `tsc --noEmit` 与 `vite build` 通过。

## 9. 复现命令

```bash
cd backend
PYTHONPATH=. ../venv/bin/python migrations/rehearse.py
bash tests/run_all.sh

cd ..
PATH=/usr/local/bin:$PATH ./node_modules/.bin/tsc --noEmit
PATH=/usr/local/bin:$PATH npm run build
```

本地服务：

- 后端 `127.0.0.1:8000`
- Vite `localhost:5173`
- 浏览器验证使用现有登录会话；截图取自实际运行页面。

## 10. 已知边界

- 本报告只证明本地实现与验证，不代表已部署生产。
- AI 伴侣“后台运行”当前是产品状态与独立会话/记忆的运行入口；“暂停/恢复”更新人格运行标记，不是常驻定时器。若后续要在无用户操作时自动发起对话，需要单独增加调度器与配额/审计。
- 产品级 API 权限主要落在产品专属接口与数据过滤；底层世界结构接口仍依赖登录和 `world_id` 数据隔离。后续若要将所有底层接口按模块做硬网关，可在路由层增加“world.product_scene → allowed_modules”统一依赖。
