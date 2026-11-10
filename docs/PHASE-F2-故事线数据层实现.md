# 阶段 F2：故事线数据层与页面（已实现）

依据 `PHASE-D-故事线管理设计.md` 落地。**纯新增：8 张表、25 条接口、1 个页面；未修改任何既有表字段。**

---

## 1. 数据层

### 1.1 新增表（40 → 48）

| 表 | 用途 |
| --- | --- |
| `story_projects` | 故事总览 |
| `story_spaces` | 平行空间（`branch_id` 绑定推演分支；正史空间为空） |
| `story_units` | 主线/支线/副本/阶段（属于空间） |
| `story_unit_events` | 单元与既有事件挂接（`is_shared` 标记正史共享） |
| `story_choices` | 选择节点 |
| `story_choice_options` | 选项（可自定义；AI 建议默认未确认） |
| `story_endings` | 结局（final/stage/open；可导入推演结局） |
| `story_rejoins` | 空间汇合记录（v1 仅建表，不做状态合并） |

### 1.2 迁移与隔离

- `M016_storyline` 只补索引（新表由 `create_all` 建出，沿用既有迁移约定）。
- 故事线结构**不进入世界快照**：`world_lifecycle._STORY_TABLES` 排除；删除/重置世界时显式级联清理。
- 分叉空间创建时复用 `multipath.create_branch`：正史分叉以主时间线快照为底，分支分叉以父分支快照为底；**没有第二套状态引擎**。

## 2. 接口（25 条）

```
故事：POST /api/stories；GET /api/worlds/{wid}/stories；GET/PATCH /api/stories/{id}
空间：POST/GET /api/stories/{id}/spaces；PATCH /api/spaces/{id}；POST /api/spaces/{id}/rollback
单元：GET/POST /api/spaces/{id}/units；PATCH/DELETE /api/units/{id}
挂接：GET/POST /api/units/{id}/events；DELETE /api/units/{id}/events/{event_id}
选择：GET/POST /api/spaces/{id}/choices；PATCH /api/choices/{id}；
      POST /api/choices/{id}/options；POST /api/choices/{id}/resolve
结局：GET/POST /api/spaces/{id}/endings；POST /api/spaces/{id}/import-ending
导入：POST /api/stories/{id}/import-branch（按 branch_id 幂等）
对比：POST /api/stories/compare-spaces
```

### 关键规则

- 正史空间只能挂主时间线事件；分叉空间挂本分支事件。
- 正史事件放入分叉空间必须显式 `is_shared=true`，避免「看似分支专属」。
- 选择节点 `resolve` 才产生空间；AI 建议选项未确认不可采用。
- 空间归档会同步归档其分支。
- 导入分支/结局不复制快照，只存指针，避免双份数据。

## 3. 页面

- 新导航项「故事线管理」（`storyline`），三栏：
  - 左：故事选择/新建、空间列表（正史/分叉）、对比与回溯；
  - 中：结构单元、单元事件、事件挂接（含「正史共享」勾选）；
  - 右：选择节点与选项（可「进入」生成空间）、结局。
- 无布局改动到既有页面；`App.tsx` 仅新增路由项与分支。

## 4. 实测证据

- `smoke_storyline.py`：**41 项全通过**，覆盖故事 CRUD、原始/分叉空间、选择→空间、事件作用域、共享标记、结局与导入幂等、对比、回溯、归档同步、级联删除口径。
- 全量回归：102 + 29 + 14 + 7 + 20 + 41 + 29 + 28 = **270 passed / 0 failed**。
- `tsc --noEmit`、`npm run build` 通过。
- 浏览器端到端（临时世界，非官方）：新建故事「七玄门外传」→ 正史空间 → 单元「开篇」→ 挂事件 → 选择「是否离开」→ 选项「离开」→ 进入生成分叉空间 → 结局「远走他乡」→ 对比正史，全部成功；测试世界与数据已清理（未污染官方世界）。

## 5. 未实现（属于后续阶段）

- AI 选择建议接口（`/choices/{id}/suggest`）与故事线 AI 辅助：留到 F3 之后。
- 空间汇合只建表不执行；`allow_rejoin` 仅记录。
- 章节（`stories` 表）与故事线的关联：待 G6 决策。
- 官方演示导入（正史 + 分叉空间 + 结局）：F3，需 G2/G3 确认。
- 页面暂不含：导入分支按钮、结局导入按钮、单元删除/排序、空间重命名（接口已具备，UI 后续补齐）。
