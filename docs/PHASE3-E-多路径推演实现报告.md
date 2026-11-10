# 阶段 E 开发报告：多路径推演（方向 / 分支沙盒 / 回溯 / 结局 / 对比）

依据：`docs/PHASE2-C-多路径推演架构设计.md` 与阶段 C 四项确认结论。
状态：**已实现并通过验收**（新用例 29/29；既有回归 163/163 全绿）。

---

## 1. 交付范围

### 1.1 数据层

| 变更 | 文件 | 说明 |
| --- | --- | --- |
| `events.branch_id`、`simulation_runs.branch_id` | `backend/models.py` | NULL = 主时间线；非空 = 该分支专属 |
| 4 张新表 | `backend/models.py` | `simulation_directions`、`simulation_branches`、`simulation_branch_nodes`、`simulation_endings` |
| 迁移 M015 | `backend/migrations/m015_multipath.py` | 只加列与索引；新表由 `create_all` 建 |
| 快照作用域 | `backend/world_lifecycle.py` | `dump_world(db, world_id, branch_id=None)`：主时间线只导 `branch_id IS NULL`，分支导「主时间线 + 本分支」；多路径表不进世界快照（避免快照递归膨胀）；删世界时显式级联清理多路径行 |

### 1.2 AI 层

`backend/ai_engine.py` 新增两个入口，全部走请求级 `X-AI-*` 配置，不读全局：

- `run_branch_simulation(payload)`：事件 + 方向 + 六轴 + 分支快照内人物（含 `c_profile`、`character_event_perceptions` 感知、世界规则）→ 关系变化 / 世界变化 / 行动（engine_label、cognition_reason）/ 记忆沉积 / 状态标签。
- `run_direction_suggestions(payload)`：生成 2–6 条方向建议。

### 1.3 接口层（`backend/multipath.py`）

| 能力 | 接口 |
| --- | --- |
| 方向 | `GET/POST /api/events/{id}/directions`、`POST .../suggest`、`PATCH/DELETE /api/directions/{id}`、`POST .../duplicate`、`POST .../toggle`、`PATCH /api/events/{id}/directions/reorder` |
| 分支 | `POST/GET /api/branches`、`GET /api/worlds/{id}/branches`、`GET/PATCH/DELETE /api/branches/{id}`、`pause`/`resume`/`duplicate` |
| 节点 | `GET /api/branches/{id}/nodes`、`GET .../nodes/{node_id}`（含快照） |
| 沙盒推演 | `POST /api/branches/{id}/simulate` |
| 回溯 / 应用 | `POST /api/branches/{id}/rollback`、`POST /api/branches/{id}/apply` |
| 结局 | `POST /api/branches/{id}/endings`、`GET /api/worlds/{id}/endings`、`GET/DELETE /api/endings/{id}`、`POST /api/endings/{id}/continue` |
| 对比 | `POST /api/branches/compare`、`POST /api/endings/compare` |
| 六轴 | `GET/PUT /api/worlds/{id}/six-axis`（0–1，写入 `world.settings.six_axis`，附 `negentropy`） |
| C_profile | `GET/PUT /api/characters/{id}/c-profile`（写入 `basic_profile.c_profile`，数值裁剪到 0–1） |

隔离语义：
- 推演只改 `SimulationBranch.current_snapshot`，不写主时间线实体表。
- 分支内事件通过 `POST /api/events` 携带 `branch_id` 创建；主时间线视图（`/api/events`、`/api/events/unprocessed`、传记、统一时间线、写作素材、`/api/simulate`）默认排除分支事件，主时间线推演遇到分支事件返回 409。
- `suggest` 只返回建议不落库；采纳时才创建，`source` 直接记为 `ai_confirmed`。

### 1.4 前端

- `src/pages/MultiPathPage.tsx`（新页面，三栏工作台）：事件与方向编辑 / AI 建议采纳 / 从方向建分支 / 分支节点树与回溯 / 分支内推演与分支事件 / 结局生成与继续 / 分支与结局对比 / 世界六轴 / 人物 C_profile 编辑。
- `src/api/multipath.ts`（新）：全部多路径接口的类型化封装。
- `src/App.tsx`：仅新增 `multipath` 路由、侧栏入口与页面挂载（+4 行，未改动任何既有页面布局）。

---

## 2. 验收证据

### 2.1 新增用例 `backend/tests/smoke_multipath.py`（29 项）

进程内 `TestClient` + AI stub，覆盖：
- 方向：创建/列表/复制/禁用/更新/AI 建议不落库/采纳确认入库/删除。
- 分支：创建（自动分叉节点）/ 第二分支。
- 沙盒：推演返回、节点推进、**主时间线关系未被污染**。
- 隔离：两分支关系不同（敌对 vs 漠视）。
- 回溯：回到分叉节点后 A 恢复初始关系（亲密）。
- 分支事件：创建成功、主时间线不可见、分支视图可见、主时间线推演 409。
- 结局：创建、列表、对比、从结局继续推演。
- 应用：主时间线被覆盖（漠视）、应用前自动写备份快照。
- 六轴：越界裁剪到 1.0、读取一致。
- C_profile：越界裁剪、读取一致。

结果：`===== 29 passed, 0 failed`

### 2.2 回归

| 套件 | 结果 |
| --- | --- |
| smoke_flow | 102 passed / 0 failed |
| smoke_writing | 22 passed / 0 failed |
| smoke_character_runtime | 14 passed / 0 failed |
| smoke_ai_access | 5 passed / 0 failed |
| smoke_workspace | 20 passed / 0 failed |

### 2.3 前端

- `tsc -p tsconfig.app.json --noEmit`：0 错误。
- `npm run build`：成功。
- Headless Chrome 实测（临时世界，测后删除）：页面加载、事件选择、创建方向（API 1 条 + 卡片渲染）、从方向建分支（`node_count=1`）、六轴保存（`scarcity=0.8`）、C_profile 保存（6 组落库），无运行时异常。

---

## 3. 按确认结论的降级实现

| 确认项 | 落地方式 |
| --- | --- |
| BMOS 第一版只记状态标签 | 推演结果 `state_hint` 校验为 `S0/S1/S2/D0/…/Dec2` 后只写入节点摘要与响应，不建运行时状态机 |
| L5 第一版只做 L5-S | 未引入 L5 引擎；叙事渲染仍走既有写作链路（本阶段不扩） |
| 六轴由用户在世界设置填写 | 提供六轴读写接口与页面表单，值域 0–1，AI 只作为 prompt 输入 |
| `basic_profile.c_profile` JSON 扩展 | 读写该 JSON 子键，不新增表、不改人物页布局 |

---

## 4. 未实现 / 后续

1. **应用分支 = 覆盖式替换**：不做实体级合并与冲突取舍；已用「应用前自动快照」兜底。
2. **分支权限与协作**：单用户模型，无分支级 ACL。
3. **结局自动判定**：结局需手动保存；未做「条件触发自动结局」。
4. **L5 渲染层、BMOS 运行时**：按确认结论留到后续阶段。
5. **`/api/assistant/chat` 仍缺失**（`backend/assistant.py` 未创建）：与多路径无关的既有遗留，全局 AI 助手面板目前只有本地上下文/页面操作能力。
6. **分支事件对写作/传记的显式引用**：默认全部排除；若将来要「用分支素材写作」，需加 `branch_id` 作用域参数。

---

## 5. 风险提示

- `dump_world` 全量快照随世界规模线性增长；每个节点都存全量快照，节点多时 `simulation_branch_nodes.snapshot` 体积显著。后续可改为「增量 + 定期全量」。
- `apply` 覆盖主时间线实体表，若其他会话正编辑同一世界，可能覆盖其未提交内容（单机单用户场景可接受）。
- 分支推演读取的是快照而非 DB，人物在分支外被修改不会自动同步进已有分支（符合沙盒预期，但需在产品文案中说明）。
