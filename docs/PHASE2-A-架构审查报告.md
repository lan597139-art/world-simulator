# 阶段 A 报告 —— 现有系统架构审查

> 审查对象：当前工作区代码（前端 React 19 + Vite，后端 FastAPI + SQLAlchemy + SQLite）。
> 方法：逐模块核对代码与数据库实际实现，不依赖理论文件推测。
> 基线：回归 163 项全部通过（smoke_flow 102 / writing 22 / character_runtime 14 / ai_access 5 / workspace 20）。

## 1. 数据库实际表结构（36 张）

| 域 | 表 |
|---|---|
| 世界 | `worlds`（含 archived_at/deleted_at/is_official/official_key）、`world_settings`、`world_nodes`、`world_rules`、`rule_scopes`、`world_snapshots` |
| 时间 | `time_settings`、`eras` |
| 地理 | `locations`、`location_types` |
| 社会 | `societies`、`social_groups`、`group_memberships`、`organizations`、`organization_units`、`organization_positions`、`character_appointments`、`cultural_profiles` |
| 人物 | `characters`（basic_profile/engines/defense_mechanisms/reality_conditions/thought_imprints/life_history/initial_state/runtime_state）、`relationships`、`relationship_types` |
| 事件 | `events`（domain/polarity/intensity/participants/affected/story_time/location_id/organization_id/storyline/scale/caused_by）、`event_entities`、`event_relations`（因果）、`character_event_perceptions`（事件认知） |
| 推演 | `simulation_runs`（direction/perspective/world_changes/character_actions）、`state_histories`（字段级历史，含 source/actor_id） |
| 写作 | `stories`、`entity_drafts` |
| 资源 | `resources`、`resource_types`、`resource_holdings`、`resource_transactions` |
| 扩展功能 | `trash_entries`、`character_biographies` |
| 迁移 | `schema_migrations`（当前 M014） |

## 2. 各模块实际实现

### 2.1 世界管理
- 世界 CRUD、归档/回收站（软删）、官方演示世界（内置《凡人修仙传》，锁定 + 一键重置）。
- 整世界快照与一键回滚：`world_lifecycle.py` 按 `world_id` 导出/重建全部 25 张业务表 + `rule_scopes` + 全局类型表（location/resource/relationship types），已在时光机页面使用。
- 制度：`world_rules` + 作用域 `rule_scopes`，CRUD 完整，有 `conditions/consequences` 文本字段但**无运行时结算引擎**。
- 资源：类型/资源/持有/流水四层 CRUD 完整，**无自动消耗/产出结算**。
- 时间：`time_settings` + `eras`，手动模式。

### 2.2 人物管理
- 人物种子八模块完整落库（basic_profile、五引擎 engines、防御机制、现实承载、思想钢印、生命经历、初始状态）。
- 运行态 `runtime_state`：main_color、version、engines 等；运行态与种子分离。
- 成长：`update_character_runtime` 支持引擎/机制/承载/钢印四层运行态更新 + 版本递增。
- 事件认知：`character_event_perceptions` 表 + 完整 CRUD（perceived_content/polarity/intensity/attribution_target/certainty/information_source），**字段设计与理论中的"事件认知"高度对应**。
- 履历沉积：推演产生的行动以追加方式写入 `life_history.events`。
- 字段级历史：`record_history` 写入 `state_histories`（old/new value、source、actor）。
- 传记：聚合事件/行动/成长/关系生成自传（AI 优先、本地回退）。

### 2.3 事件管理与推演链路（现有唯一推演路径）
```
POST /api/simulate {event_id, direction, perspective}
  → 校验事件/世界（归档、删除拦截）
  → 取 participants 人物 → 组装 engines（runtime_state 优先，回退种子）
  → run_simulation()（AI，JSON 模式，prompt 含事件字段+人物引擎+方向/视角）
  → 返回 {relationship_changes[], world_changes, actions[]}
  → 关系变化写入 relationships（新增状态行，保留旧象限字段）
  → actions 按名字模糊匹配写入人物 life_history
  → SimulationRun 落库
```
- **方向（direction）目前只是自由文本**（≤2000 字符）+ 视角（≤200 字符），无结构化多方向、无触发条件/认知/归因/阻力等字段。
- **`character_event_perceptions` 未接入推演**：`run_simulation` 的 prompt 不包含任何认知数据。
- 推演结果直接写主时间线（无分支概念），且 relationship_changes 每次新增行、不做幂等。

### 2.4 AI 接口
- `ai_engine.py`：请求级 ContextVar（个人 Key > `.env`），`get_client()/get_model()` 每次重读配置；`_safe_base_url` SSRF 校验。
- 前端 `config.ts` fetch 桥接：对 `/api/ai/status`、`/api/simulate`、`/api/writing/*`、writings analyze/extract、biography generate 附加 `X-AI-*` 头；`AiAccessModal` 场景化预设（见第一阶段报告）。

### 2.5 前端页面（15 个）
Worlds / WorldBuilding / WorldData / WorldStructure / CharacterList(+Building) / Relationships / Events(+因果面板) / Timeline / UnifiedTimeline / Simulation / Writing / Archive / Trash / TimeMachine；全局 AI 助手面板（App 级停靠侧栏）。

## 3. 理论定义 vs 代码实现对照（预览，阶段 B 详述）

| 理论机制 | 代码状态 |
|---|---|
| 五引擎 O/V/D/E/T 数值与主导 | ✅ 已实现（种子 + 运行态 + dominance） |
| 引擎轮值/代偿/冲突干涉 | ❌ 未实现（理论亦未给公式 → 待确认） |
| 事件认知（意义/归因/确定度） | 🟡 数据模型 + CRUD 已实现，**未接入推演 prompt** |
| 推演行为输出 → 关系/履历 | ✅ 已实现（简单版） |
| 记忆沉积 | 🟡 仅 life_history 追加；无污染/回滚机制 |
| L0-L7 状态机 / Need Vector / 熔断降频 | ❌ 未实现 |
| 世界规则/制度 | 🟡 数据模型 + CRUD 有，无结算引擎 |
| 六轴环境压强 / 后果清算 / 不可逆损伤 | ❌ 未实现 |
| 文化档案（语言/宗教/习俗/禁忌） | 🟡 表存在，静态存储，无运行时影响 |
| 多方向结构化编辑 / 分支 / 多结局 | ❌ 完全未实现（本次核心目标） |
| 字段级历史 + 整世界快照回滚 | ✅ 已实现（可作为分支机制的基础设施） |

## 4. 对本次开发的关键结论

1. **可复用的基础设施已具备**：整世界快照/恢复（world_lifecycle）、字段级历史（state_histories）、运行态与种子分离、回收站/归档、事件认知表。多路径推演应基于这些扩展，而非另起炉灶。
2. **最大缺口**：方向无结构、无分支概念、推演结果直写主时间线。这是"分支状态污染"风险的根源，也是新架构必须解决的第一问题。
3. **认知数据已就位但断线**：把 `character_event_perceptions` 接入推演 prompt 是低成本高价值的理论对齐点。
4. **理论数值缺口**：轮值/代偿/状态转移阈值等理论未给出公式，代码不得自行编造（任务书最高约束），须以"可配置接口 + 待确认标记"实现。
5. **资料缺口**：任务书提到的《多结局推演设计.txt》《降级人格模型.txt》、人物种子设计资料未随附件提供；《WEP.md》主文档未提供（仅 A–E 五篇分册）。已列入风险清单。

## 5. 现有风险

- `simulation.py` 中人物匹配用 `name LIKE %x%` 模糊匹配，重名世界会误写履历（现网未发生，多分支下风险放大，需在分支设计中改为 ID 直连）。
- 推演直接 commit 主时间线且无"撤销"，用户试错成本高——分支机制将天然解决。
- SQLite 单文件库，分支快照若采用整世界 JSON 方案，需注意体积（现有官方世界全量快照约 310KB，可接受）。
