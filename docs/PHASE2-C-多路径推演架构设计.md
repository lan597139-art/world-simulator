# 阶段 C 报告 —— 多路径推演与多结局管理系统 架构设计

> 状态：待评审（阶段 D 门禁）。未经确认不建表、不迁移、不改推演核心。
> 原则：扩展现有架构；主时间线行为完全向后兼容；用户预设与 AI 建议严格区分；分支状态绝对隔离。

## 1. 核心设计决策

| # | 决策 | 理由 |
|---|---|---|
| D1 | **分支 = 沙盒**：所有分支推演只作用于分支沙盒；仅当用户显式「应用分支」时才影响主时间线 | 现有推演直写主时间线是状态污染根源；不用新功能时系统行为与现状 100% 一致 |
| D2 | **Event Sourcing + Branch Snapshot 混合**：分叉点全量快照（不可变）+ 每个推演节点保存当时全量快照 + 事件路径增量记录 | 复用已验证的 `world_lifecycle.dump_world/restore_world`（官方世界 26 表 233 实体 ≈310KB/快照，SQLite 可承受）；任意节点回溯 = 取该节点快照恢复，简单可靠 |
| D3 | **分支事件复用 `events` 表 + `branch_id` 列**（NULL=主时间线） | 因果（event_relations）、事件实体（event_entities）、写作联动、时间线全部自动复用；人物状态（关系/履历/运行态）变化只进快照、不写主表，隔离是绝对的 |
| D4 | **方向独立表**，`source` 字段区分 user / ai / ai_confirmed | 满足"用户预设优先、AI 需确认、AI 不得覆盖"的权限原则 |
| D5 | **引擎数值漂移默认关闭**：推演只记录 AI 建议的主导引擎标签，不改引擎数值；数值漂移公式做成可配置接口，待理论确认后启用 | 任务书最高约束：不得编造未经确认的计算公式 |

## 2. 系统模块结构

```
事件管理(现有)                    多路径推演(新增)
─────────────                    ─────────────────
EventsPage ──┬─ 事件 CRUD        多方向推演编辑器（方向 CRUD / AI 扩展确认）
             │                   分支事件管理器（节点图 / 暂停恢复复制 / 回溯）
SimulationPage ── 推演(主时间线)  分支推演执行器（沙盒内推演 → 节点推进）
                                 多结局管理器（保存/查看/对比/继续推演）
                                 分支状态对比（并排 diff）
全局基建(复用)                    ─────────────────
world_lifecycle.dump/restore（快照引擎）
character_event_perceptions（认知接入 prompt）
ai_engine（统一 AI 层）   trash/archive（分支删除进回收站）
```

## 3. 数据模型（ER）

```
events 1───N simulation_directions          （一个事件多个方向）
events 1───N simulation_branches            （root_event_id）
simulation_directions 1───N simulation_branches   （source_direction_id，可空=自由分叉）
simulation_branches ──self── parent_branch_id / parent_node_id（多层分支）
simulation_branches 1───N simulation_branch_nodes （路径节点，含节点时刻全量快照）
simulation_branches 1───N simulation_endings      （结局锚定到节点）
events 1───N simulation_runs（+branch_id，可空）   （分支内推演记录）
```

## 4. 新增数据表（M015 迁移草案）

### 4.1 `simulation_directions`（发展方向）
| 字段 | 类型 | 说明 |
|---|---|---|
| id / world_id / event_id | str | 归属 |
| name / description | str | 方向名称 / 描述 |
| trigger_conditions | JSON | 触发条件（多条） |
| related_character_ids | JSON | 相关人物 |
| cognition | JSON | `{meaning, attribution, certainty}` 事件认知 |
| engine_activation | JSON | 需求竞争与引擎激活（`{competing:[], dominant:[]}`，标签） |
| behavior_output | str | 可能的行为输出 |
| reality_resistance | str | 现实条件与外部阻力 |
| direct_result / future_impacts | str / JSON | 直接结果 / 后续影响 |
| sort_order / enabled | int / bool | 排序 / 禁用 |
| source | str | `user` / `ai` / `ai_confirmed`（AI 建议确认后置 ai_confirmed） |
| confirmed / note | bool / str | 确认标记 / 备注 |
| created_at / updated_at | datetime | |

### 4.2 `simulation_branches`（推演分支）
| 字段 | 类型 | 说明 |
|---|---|---|
| id / world_id | str | |
| root_event_id | str | 起始事件 |
| source_direction_id | str? | 沿哪个方向分叉（可空） |
| parent_branch_id / parent_node_id | str? | 父分支 / 分叉节点（可空=自主时间线） |
| name / note | str | |
| status | str | `active` / `paused` / `archived` |
| base_snapshot | JSON | 分叉点全量状态（不可变） |
| current_snapshot | JSON | 当前沙盒状态（推演推进，覆盖式） |
| created_at / updated_at | datetime | |

### 4.3 `simulation_branch_nodes`（分支路径节点）
| 字段 | 类型 | 说明 |
|---|---|---|
| id / branch_id / world_id | str | |
| seq | int | 路径顺序 |
| kind | str | `fork` / `simulation` / `merge` / `manual_edit` / `ending` |
| event_id | str? | 该节点产生的分支内事件 |
| run_id | str? | 对应推演记录 |
| summary | str | 节点摘要（路径追溯展示用） |
| source | str | `user_preset` / `ai_suggestion` / `simulation` / `manual` |
| snapshot | JSON | **节点时刻全量状态**（回溯锚点） |
| rollback_reason | str? | 从该节点回溯时的可审计原因（BMOS 记忆回滚要求） |
| created_at | datetime | |

### 4.4 `simulation_endings`（结局）
| 字段 | 类型 | 说明 |
|---|---|---|
| id / world_id / branch_id / node_id | str | 结局锚定 |
| name / description / key_reasons | str | |
| path_node_ids | JSON | 完整事件路径（节点链） |
| character_final_states | JSON | 从节点快照提取的人物最终状态（含引擎标签） |
| relationship_changes | JSON | 人物关系变化 |
| resource_changes / world_changes | JSON | 资源 / 世界状态变化 |
| allow_continue | bool | 是否允许继续推演 |
| created_at | datetime | |

### 4.5 现有表加列
- `events.branch_id`（String, nullable, index；NULL=主时间线）
- `simulation_runs.branch_id`（同上）

## 5. 分支状态隔离与历史回溯机制

### 5.1 隔离规则（绝对隔离）
1. 分支创建：`dump_world` → `base_snapshot`（含 26 表 + 全局类型）；`current_snapshot = base_snapshot`；首个 `fork` 节点落库。
2. 分支内推演：AI 结果（关系变化、行动、引擎标签、世界变化）**只写入** `current_snapshot` + 新节点快照 + `simulation_runs(branch_id)`；**绝不写**主时间线的 `relationships / characters.life_history / runtime_state`。
3. 分支内后续事件：写 `events(branch_id=…)`，与主时间线天然隔离；`event_entities` 通过事件归属隔离。
4. 修改分支 A 的任何数据（含删除分支）不触碰分支 B/C —— 各分支状态只存在于各自快照 JSON 中，无共享可变对象。
5. 汇合：**不做自动合并**。提供两种显式操作：a)「应用分支」= 将选定节点快照恢复到主时间线（覆盖式，需二次确认并自动先打一个主时间线快照作为后悔药）；b)「标记汇合」= 多条路径的节点指向同一后续事件（图结构上汇合，状态各自独立）。**状态合并规则理论未定义 → 标记待确认**，未确认前不实现自动合并。

### 5.2 历史与回溯
- 任意节点「从此重新推演」：取该节点 `snapshot` → 覆盖 `current_snapshot` → 追加 `fork` 节点 → 可选 fork 成新分支或原分支继续（原路径保留）。
- 分支复制：新分支 `base_snapshot = 源.current_snapshot`。
- 暂停/恢复/归档：状态位，不删数据；删除分支进全局回收站（快照数据随分支行保存，可恢复）。

### 5.3 BMOS 记忆机制在分支中的处理
- 分支内的行动沉积写入**快照内**的 `life_history` 并标记 `source='branch_simulation'`，与主时间线履历区分；应用分支时随快照落库。
- BMOS 的记忆污染/回滚理论机制尚无代码实现；分支的节点快照天然提供"人物记忆状态回滚点"。理论映射详见阶段 B 报告。

## 6. 人格动力系统接入方式（结构层；数值规则待确认）

推演 prompt 升级（`run_simulation` 的分支版）：

```
输入 = 事件(现有字段)
     + 方向结构化字段（触发条件/认知/归因/需求竞争/阻力 ← simulation_directions）
     + 人物：engines + runtime 主导 + reality_conditions 摘要
     + 事件认知：character_event_perceptions（意义/极性/强度/归因对象/确定度/信息源）
     + 六轴压强 + negentropy（世界条件 → 个体压强的统一入口，0–1）
     + C_profile 阈值摘要（C.1 六组阈值中最低者所对应的行为倾向）
     + （可选）world_rules 摘要（仅启用的）
输出 JSON 增加：
     character_actions[].cognition_reason（认知如何导向行动）
     character_actions[].engine_label（建议主导引擎标签）
     character_actions[].memory_deposit（建议沉积的记忆条目，可带 distortion_meta 最小字段）
```

- **认知接入**：把已存在的 `character_event_perceptions` 数据喂给 AI，这是"同一事件不同人物不同反应"的最小理论闭环。
- **六轴接入**（WEP-A §A.5 = WEP-D §D.1 同名六轴）：稀缺/威胁/地位/声誉/依恋/调节 + 负熵。分支快照必须保存其当前值；由世界参数计算六轴的公式理论未给 → 第一版允许用户直接填写六轴值（`world_settings` JSON 扩展），公式待确认。
- **C 阈值接入**（唯一"给定数值"的机制）：C.1 六组阈值 JSON 可直接作为人物种子扩展字段；判定规则文档已明确——"比对阈值，最低者优先执行对应动作"。第一版实现为：推演 prompt 注入阈值摘要 + 由 AI 按该规则输出行为倾向；不在后端硬编码行为树（避免编造）。
- **引擎演化**：AI 返回的 `engine_label` 仅作为标签记录进快照/结局；**不改 O/V/D/E/T 数值**。数值漂移实现为 `engine_drift_policy` 可配置接口（默认 no-op），待用户确认公式后启用。
- **BMOS 状态语义**：第一版**不实现** S/D/Dec 状态机、Need Vector、J(a)、熔断/降频。仅允许记录"建议状态标签"（如 `state_hint`），且明确标注为标签而非工况计算。`runtime_state.main_color/version` 不得被解释为 BMOS 工况。
- **L5 记忆**：现有 `life_history` 只视为 L5-S 雏形。分支内记忆写入沿用 `life_history.events` 结构，但每条追加 `source='branch_simulation'` 与最小 `distortion_meta`（来源/状态/是否旁路）；L5-F/S/D/M 分层、污染判定、回滚指针不实现（理论机制未给数值）。
- **短期/长期区分**：短期=节点快照中的行动与标签；长期轨迹=结局表中的 `character_final_states`（多次节点累积），两者分字段存储。
- **渲染层（WEP-E）**：结局叙述可选用 E 的渲染规范（禁系统词/禁报后台数据/PAL 折损），但 E 不写任何状态；第一版结局页先做结构化展示，叙述生成作为可选增强。

## 7. 推演模式实现

| 模式 | 实现 |
|---|---|
| A 用户预设 | 用户在编辑器创建方向（source=user）；分支推演按所选方向执行；系统不增删改 |
| B AI 扩展 | 「AI 扩展方向」→ `POST /api/events/{id}/directions/suggest` → AI 生成建议列表 → 前端确认卡片逐条采纳/编辑/拒绝；采纳才入库（source=ai_confirmed） |
| C 混合（默认） | 用户预设存在时，AI 仅做补充建议；AI 建议永远只 INSERT，不 UPDATE/DELETE 用户行 |

## 8. API 设计（阶段 E 实施清单）

```
方向：GET/POST /api/events/{id}/directions
     PATCH/DELETE /api/directions/{id}
     POST /api/directions/{id}/duplicate | toggle
     PATCH /api/events/{id}/directions/reorder
     POST /api/events/{id}/directions/suggest        （AI 建议，需确认）
分支：POST /api/branches {root_event_id, direction_id?}
     GET /api/worlds/{wid}/branches?tree=1
     PATCH/DELETE /api/branches/{id}   POST .../duplicate | pause | resume
推演：POST /api/branches/{id}/simulate {direction_id, perspective?}
     POST /api/branches/{id}/rollback {node_id}
     POST /api/branches/{id}/apply {node_id?}        （显式合并到主时间线，二次确认）
结局：POST /api/branches/{id}/endings {node_id}
     GET /api/worlds/{wid}/endings   GET /api/endings/{id}
     POST /api/endings/compare {ending_ids: []}
对比：POST /api/branches/compare {branch_ids: []}   （快照字段级 diff）
```

## 9. 页面与交互

1. **多方向推演编辑器**（事件管理内新 Tab）：左=事件基础信息；中=方向卡片列表（来源徽标 用户/AI待确认、启用开关、排序）；右=选中方向编辑面板（折叠分组：基础 / 认知与归因 / 动力 / 行为与结果）。AI 建议以独立"待确认"区块展示。
2. **分支事件图**（新页面，入口在模拟运行）：SVG 分层树 + 汇合边；节点=事件/方向；支持选中查看、从节点继续分支、回溯、暂停/恢复/复制/删除；第一版无第三方图库依赖。
3. **多结局管理器**（分支图侧栏或新页）：结局列表 + 详情（路径时间线、人物终态、关系/资源/世界变化）；「对比」多选并排表。
4. **分支状态对比**：选 2-3 分支 → 人物/关系/资源/世界四个区块 diff。

## 10. 兼容性与审计点（阶段 E 必查）

现有按 `world_id` 全量查询、未过滤 `branch_id` 的位置需补过滤（否则分支事件泄漏到主时间线视图）：
- `biography.py` timeline（event_entities / events 查询）
- `event_causality.py`（事件列表与因果图）
- `writing.py` 可选事件列表
- `timeline.py` / `UnifiedTimelinePage` 数据源
- `simulation.py` 事件下拉与推演列表
- `world_lifecycle.world_tables()` 自动包含新表（需验证 SQLAlchemy sorted_tables 顺序：directions→branches→nodes→endings 无环，天然有序）

## 11. 迁移与升级方案

- M015 单迁移：4 张新表 + 2 列；全量默认值向后兼容（branch_id=NULL）。
- 新表纳入 `dump_world/restore_world`（分支快照体积随分支数增长，官方世界每分支 ≈310KB×节点数，预估 20 节点 ≈6MB，SQLite 可行；后续版本可改差分快照）。
- 分支删除接 `trash_service`（world_id 归属，整行含快照可恢复）。

## 12. 验收测试方案（对应任务书场景）

《凡人修仙传》韩立发现好友（张铁/厉飞雨）长期欺骗：
1. 建事件 → 5 个用户方向（对抗/隐忍/绝交/修复/观望）→ 各方向设独立认知/归因/行为/结果 ✅ 编辑器
2. 每方向建分支 → 各产生 ≥2 分支内后续事件 → 继续分叉 ✅ 节点图
3. ≥3 个结局（分锚定到不同分支节点）✅ 结局管理器
4. 路径追溯 = 节点链；从任意节点回溯重推 ✅ rollback
5. 修改分支 A 后 B/C 快照与节点不变 ✅ 隔离测试（后端断言）
6. AI 建议（suggest）只新增且需确认，不覆盖用户行 ✅ 后端断言
7. 认知接入：同一事件、韩立 vs 对方不同 perceptions → prompt 含认知 ✅ 单测 mock AI
8. 世界条件：分支内 world_changes 记录并进快照 ✅
