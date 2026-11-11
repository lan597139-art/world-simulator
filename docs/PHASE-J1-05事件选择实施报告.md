# J1 实施报告：05 事件选择 / 结果 / 后续事件

日期：2026-11-11  
结论：**已实现事件层的选择与沙盒生成**；旧故事线选择保留并存，未做迁移。

---

## 1. 数据层

新增 2 表（57 → 59）：

`event_choices`

| 字段 | 说明 |
| --- | --- |
| `event_id` | 所属事件 |
| `title/description` | 选择点 |
| `precondition` | 前置条件 JSON（预留） |
| `status` | open/closed |

`event_choice_options`

| 字段 | 说明 |
| --- | --- |
| `choice_id` | 所属选择点 |
| `label` | 决策 |
| `consequence` | 直接结果文本 |
| `outcome_event_id` | 后续事件（可空，同世界/同分支校验） |
| `target_branch_id` | 生成后的沙盒 |
| `source/confirmed` | AI 建议须确认 |
| `order_index` | 排序 |

迁移 `M022` 只补索引；表由模型创建。事件/选项随世界快照，不属于多路径/故事线排除表。

## 2. 接口

```
GET    /api/events/{id}/choices
POST   /api/events/{id}/choices
PATCH  /api/event-choices/{id}
DELETE /api/event-choices/{id}
POST   /api/event-choices/{id}/options
PATCH  /api/event-choice-options/{id}
DELETE /api/event-choice-options/{id}
POST   /api/event-choice-options/{id}/sandbox
```

规则：

- 后续事件必须同世界；事件在分支内时，后续事件不得属于其他分支；
- 未确认的 AI 选项不能生成沙盒（与故事线规则一致）；
- 同一选项重复生成沙盒返回已有分支，不重复建；
- 生成沙盒复用 `POST /api/branches` 的快照/节点能力，不改原事件；
- 删除事件级联删除选择/选项。

## 3. 页面

事件编辑状态下新增「多剧情选择」面板：

- 新建选择点；
- 每个选择点添加选项：文案、结果、后续事件下拉；
- 选项行显示后续事件与"生成沙盒/查看沙盒"；
- 删除选择点/选项；
- 不改变原事件表单布局，追加在表单下方。

## 4. 实测

- `smoke_event_choices.py`：**8 项通过**（创建、绑定后续、列表、跨世界拒绝、沙盒、复用、不改原事件、级联删除）。
- 全量：**371 passed / 0 failed / 12 suites**。
- 迁移演练：22/22，59 表。
- `tsc`、`vite build` 通过。

## 5. 边界与未做

- 旧 `story_choices/options` 未迁移；两套选择短期并存（符合设计 A 路线）。
- 选项只有结果文本，尚无结构化 `state_delta`。
- 未做 AI 生成事件选项；现有 AI 建议仍只服务故事线。
- 沙盒生成后面向 07/08 的选择入口仍复用现有分支页。
- 未做"一个选项触发多个后续事件"。

## 6. 兼容性

- 不改 `events` 既有字段；
- 旧事件无选择时行为不变；
- 故事线页仍用自己的选择；事件页选择不会自动出现在故事线；
- 世界备份/恢复包含新表（带 `world_id`），快照体积小幅增加。
