# K2 实施报告：独立日记与来源标签

日期：2026-11-11  
结论：**已实现独立日记、来源标签、聊天转日记与四宫格入口**；传记生成留待 K3。

---

## 1. 数据层（62 → 63 表）

`diary_entries`：

| 字段 | 说明 |
| --- | --- |
| `owner_user_id` | 当前 `local` |
| `world_id` | **可空**；日记不依赖世界 |
| `character_id` | 可空，关联人物 |
| `entry_date/title/content` | 正文 |
| `mood/tags` | 心情、标签 |
| `source_type` | user/chat/event/branch/import/ai_draft |
| `source_ref` | 来源引用 JSON（如 thread_id） |
| `visibility` | private |

M025 仅补索引。

**独立性**：`diary_entries` 被排除出世界快照和世界级联清理；删除世界不会删除日记，日记也不会随世界备份复制。

## 2. 接口

```
GET    /api/diary/entries?source_type=&world_id=
POST   /api/diary/entries
PATCH  /api/diary/entries/{id}
DELETE /api/diary/entries/{id}
```

校验：内容非空、日期 `YYYY-MM-DD`、来源枚举、关联世界/人物一致性。当前所有权固定 `local`。

## 3. 前端

- 新增「日记与传记」页面，可从四宫格和无世界/有世界侧栏进入；
- 日记列表 + 编辑器：日期、标题、心情、标签、正文、可选关联世界；
- 来源徽章：手写/聊天摘录/事件/分支/导入/AI 草案；
- 聊天页新增「最近对话存为日记」，写入 `source_type=chat`、`source_ref.thread_id`；
- 四宫格"日记与传记"卡启用；
- 传记区域标注"待 K3"，不伪造生成结果。

## 4. 实测

- `smoke_diary.py`：**7 项通过**（无世界、关联来源、非法来源/日期、筛选、编辑、删世界保留日记）；
- 全量：**393 passed / 0 failed / 15 suites**；
- 迁移演练：25/25，63 表；
- 浏览器：无世界进入日记页、写日记并保存成功、来源为"手写"、清理测试记录；
- `tsc`、`vite build` 通过。

## 5. 未做 / 边界

- 传记生成与引用（K3）；
- 日记加密/导出/多用户隔离；
- 聊天摘录为最近 6 条，未做逐条选择；
- 删除为硬删除，未进回收站；
- 未做日记→人物经历/世界事件的自动写入（避免污染正史）。

## 6. 兼容性

- 新表独立，不影响旧世界/快照；
- 日记可选世界关联，但世界删除后保留，`world_id` 成为历史引用；
- 现有 API 客户端无需改动。
