# 阶段 B：现有系统审查报告

本报告只描述**代码与数据里真实存在的东西**，不按页面名称推测功能。

---

## 1. 总体架构

| 层 | 实现 |
| --- | --- |
| 前端 | React 19 + TypeScript + Vite；单页 `src/App.tsx` 按 `activePage` 切换页面；页面间通过 props 传 `worldId` |
| 后端 | FastAPI + SQLAlchemy + SQLite；`backend/main.py` 启动时 `create_all` + 迁移 `run_migrations()` |
| 数据 | **40 张表**（见 §2），SQLite 单文件 |
| AI | 单一客户端 `backend/ai_engine.py`，OpenAI 兼容协议，请求级 `X-AI-*` 配置 |
| 官方演示 | `backend/seed/fanren.json`，首次启动导入；`is_official` 锁定删除 |
| 数据安全 | 归档/回收站（软删除）、世界快照、时光机（`world_lifecycle.py`）、多路径分支快照 |

路由规模（`@router.*` 计数）：multipath 32、writing 19、orgs 18、society 12、resources 11、event_causality 11、geography 10、characters 8、nodes 8、events 7、relationships 7、biography 3、simulation 3。

## 2. 数据库现状（40 张表）

```
worlds, world_settings, world_nodes, world_rules, rule_scopes, time_settings, eras,
locations, location_types, organizations, organization_units, organization_positions,
character_appointments, societies, social_groups, group_memberships, cultural_profiles,
characters, relationships, relationship_types, events, event_entities, event_relations,
resources, resource_types, resource_holdings, resource_transactions,
stories, entity_drafts, state_histories, character_biographies,
character_event_perceptions, simulation_runs,
simulation_directions, simulation_branches, simulation_branch_nodes, simulation_endings,
world_snapshots, trash_entries, schema_migrations
```

### 2.1 与本次任务直接相关的表

| 表 | 真实用途 | 关键字段 |
| --- | --- | --- |
| `characters` | 人物档案 + 人格数据 | `basic_profile`、`engines`、`defense_mechanisms`、`reality_conditions`、`thought_imprints`、`life_history`、`initial_state`、`runtime_state`、`archived_at` |
| `events` | 世界事件 | `name/description/polarity/intensity/occurred_at/story_time/participants/affected/domain/storyline/scale`、`branch_id`、`location_id`、`organization_id` |
| `event_entities` | 事件与实体的多对多 | `event_id/entity_type/entity_id/role` |
| `event_relations` | 事件因果链 | `source_event_id/target_event_id/relation_type`（官方演示 8 条 `contributes_to`） |
| `stories` | **小说章节**（不是故事线） | `title/content/plain_text/mode(architect/explorer)/status/source_event_ids/source_simulation_ids` |
| `state_histories` | 字段级变更历史 | `entity_type/entity_id/field/old_value/new_value/event_id/source` |
| `simulation_runs` | 单次推演记录 | `event_id/direction/perspective/world_changes/character_actions`、`branch_id` |
| `simulation_directions` | 发展方向（用户/AI） | `event_id/name/cognition/behavior_output/direct_result/future_impacts/source/confirmed` |
| `simulation_branches` | 分支沙盒 | `base_snapshot/current_snapshot/parent_branch_id/parent_node_id/status` |
| `simulation_branch_nodes` | 带全量快照的路径节点 | `seq/kind/event_id/run_id/snapshot/rollback_reason` |
| `simulation_endings` | 分支结局 | `branch_id/node_id/path_node_ids/character_final_states/relationship_changes` |

## 3. 03 人物管理现状

- 页面：`src/pages/CharacterBuildingPage.tsx`，分区含「人格动力结构」（OVTDE 引擎与主导关系）、个体特征、思想钢印、人生经历、初始状态等。
- 接口：`characters.py` 共 8 条路由（列表/详情/新建/更新/删除/归档等）。
- 关键结构事实（**后续 AI 角色转换必须按此解析**）：

`engines` 不是 `{V:50,O:50,...}` 的扁平数值，而是：

```json
{
  "ovtde": {
    "O": {"val": 85, "definition": "...", "desire": "...", "threat": "...",
          "resources": "...", "needs": "...", "impact": "...", "behavior": "...",
          "over": "...", "under": "...", "custom": ""},
    "V": {...}, "D": {...}, "E": {...}, "T": {...}
  },
  "dominance": {
    "mode": ["主引擎", "辅助引擎"],
    "engines": ["D", "T"],
    "description": "..."
  }
}
```

而 `characters.engines` 的默认值是扁平 `{"V":50,"O":50,"D":50,"E":50,"T":50}`。
**两种结构并存**：种子人物与页面保存的为嵌套结构；部分旧/简化数据可能是扁平结构。
多路径 `_char_ai_payload` 目前直接 `engines.get("dominance")`，对嵌套结构取不到值——这是既有实现里的兼容缺口（见 §6）。

- `韩立` 实测：`basic_profile` 有 17 个键（name/code/avatar/species/age/gender/world/nation/org/socialClass/profession/role/appearance/education/degree/intro/background）；`runtime_state` 为空；`life_history` 为 dict（含 `events`）；`engines` 为嵌套结构。
- `character_event_perceptions`：官方演示 5 条，字段含 `perceived_content/perceived_polarity/perceived_intensity/attribution_target/certainty/information_source`。
- `character_biographies`：官方演示 2 条。

## 4. 07 模拟运行现状

- 页面 `SimulationPage.tsx`：拉取 `/api/events`、`/api/simulations`、`/api/ai/status`；输入「作者方向」「视角」；调用 `POST /api/simulate`；展示日志与结果；可跳转 08 写作。
- 后端 `simulation.py` 仅 3 条路由；`/api/simulate` 组装事件、参与者、地点、组织、世界六轴等，调用 `run_simulation()`，写入 `simulation_runs`。
- 分支事件防护：若 `event.branch_id` 非空 → 409，要求到分支中推演。
- 现状**没有**「启用多路径」开关；多路径是独立页面（`multipath`），与 07 无入口关联。

## 5. 08 写作辅助现状

- 页面 `WritingPage.tsx`：章节列表、两种模式（架构师 architect / 探险家 explorer）、流式生成、草稿（entity_drafts）提取与采纳、AI 辅助改写。
- 后端 `writing.py` 19 条路由：
  - `POST /api/writing/generate`（SSE 流式生成正文）
  - `POST /api/writings/{id}/analyze`、`POST /api/writing/extract`
  - `POST /api/writing/assist`（流式润色/改写）
  - 章节 CRUD、草稿 approve/ignore/undo、世界草稿列表
- 素材来源：`stories` 章节表 + `events`（主时间线，`branch_id IS NULL`）+ `simulation_runs`（主时间线）。
- 现状**没有**「多路径创作」开关，也没有按分支/空间取素材的参数。

## 6. 多路径能力现状（已完成，可复用）

- 页面：`src/pages/MultiPathPage.tsx`（事件→方向→分支→节点→回溯→结局→对比→六轴→C_profile）。
- 接口 32 条（`backend/multipath.py`），核心语义：
  - 分支 = 沙盒；推演只改 `current_snapshot`；
  - 分支事件（`events.branch_id`）默认不进主时间线视图；
  - 应用分支 = 覆盖主时间线实体表 + 先写主时间线备份快照；
  - 节点回溯 = 取节点快照恢复；
  - 结局 = 绑定 branch + node，含人物终态/关系/资源/世界变化。
- 快照：`world_lifecycle.dump_world(db, world_id, branch_id)`，多路径表不进世界快照，避免递归膨胀。
- 测试：`smoke_multipath.py` 29 项通过。
- 已知缺口：
  1. `engines` 嵌套结构兼容（§3）；
  2. `/api/branches/{id}/simulate`、`directions/suggest` 未纳入前端 AI 请求头白名单；
  3. 分支推演读取快照人物，不读 DB 最新人物（沙盒语义正确，但需在 UI 说明）；
  4. 每个节点全量快照，规模大时体积增长快。

## 7. 官方演示资料盘点（《凡人修仙传》）

世界 ID `a89474b6-8301-4f35-b819-aa14a8943af0`，实测：

| 资产 | 数量 | 备注 |
| --- | --- | --- |
| 人物 | 5 | 韩立、南宫婉、厉飞雨、张铁、墨居仁 |
| 事件 | 9 | 均为 `branch_id NULL`，`participants` 为空数组，人物关联在 `event_entities`（46 条） |
| 事件关系 | 8 | 全部 `contributes_to` |
| 人物关系 | 15 | 含四象限与强度 |
| 章节 | 4 | 2 篇真实推演章节 + 2 篇空「第 3 章」 |
| 事件感知 | 5 | `character_event_perceptions` |
| 人生传记 | 2 | `character_biographies` |
| 世界结构 | 31 节点 / 16 地点 / 3 组织 / 5 规则 / 2 纪元 | — |
| 资源 | 5 / 5 持有 / 2 交易 | — |
| 六轴 | **未填写** | `world.settings.six_axis` 为空 |
| 平行空间（分支） | **0** | 数据中不存在已准备的平行空间 |
| 结局 | **0** | — |
| 发展方向 | **0** | — |

事件（按 `occurred_at`）：韩立入七玄门 → 墨居仁收韩立为记名弟子 → 韩立初得掌天瓶 → 南宫婉筑基成功 → 墨居仁毒害张铁 → 墨居仁图谋夺舍 → 韩立反杀墨居仁 → 韩立离开七玄门 → 韩立通过黄枫谷入门测试。

**结论**：任务书设想的「已经准备的平行空间」在现有数据中并不存在。官方演示若要展示平行空间，必须**新建**演示空间；这属于缺失资料，需按任务书 5.6 明确列出，不能声称复用既有空间。

## 8. 当前问题清单（按影响排序）

| # | 问题 | 影响 |
| --- | --- | --- |
| B1 | 官方演示缺平行空间/结局/方向/六轴 | 故事线官方演示需要新增数据或降级展示 |
| B2 | `engines` 双结构（嵌套 vs 扁平） | AI 角色转换、分支推演取值可能为空 |
| B3 | 多路径接口无访客 AI 请求头 | 07/08 多路径入口无法用访客 Key |
| B4 | 07 AI 错误 500 / 08 流式错误 200 | 错误处理不统一 |
| B5 | `stories` 表是「章节」，与「故事线」同名易混 | 新系统必须另立表并改页面用词 |
| B6 | 事件 `participants` 为空（官方演示） | 按 participants 取参与者会空；应改用 `event_entities` |
| B7 | `SimulationPage`/`writing.ts` 硬编码后端地址 | 依赖全局 fetch 桥，桥缺失即失效 |
| B8 | 每节点全量快照 | 故事线空间多时存储膨胀 |
| B9 | 无「故事」概念、无角色运行层、无聊天数据 | 两个新系统均为从零新增（但不改旧表） |
