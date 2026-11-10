# 阶段 G4 / G5 / G16 / G19：数据清理与聊天增强（已实现）

四项决策均已执行：事件参与者回填、空章节清理、用户世界身份、AI 记忆摘要。

---

## G4 事件参与者回填

- 新增 `M020_event_participants`：从 `event_entities` 中取
  `category='participant' AND entity_type='character'` 的去重人物 ID，
  **只回填 `events.participants` 为空的事件**；地点/组织不写入。
- 幂等：已有参与者的事件不覆盖。
- 结果：官方世界 9 个既有事件全部有参与者（1–2 人），出逃线 3 条事件保持原值。
- 读取口径不变：事件关联仍以 `event_entities` 为完整来源，`participants` 作为统一快捷字段。

## G5 空章节清理

- 删除官方世界 2 篇「第 3 章」（0 字，正文 7 字符，均无草稿引用）。
- 删除前检查 `entity_drafts.story_id`，均为 0；仅删章节行，不动其他数据。
- 官方章节现剩 2 篇「推演 · 韩立通过黄枫谷入门测试」（876 / 997 字）。

## G16 用户世界身份

- 身份存于 `chat_threads.settings.user_identity`（`name / role / background`），按会话隔离，不改世界/人物档案。
- `PATCH /api/chat/threads/{id}` 支持 `settings` 合并（浅合并，避免覆盖其他设置）。
- 私聊与群聊 system prompt 均加入：
  - 已设置：「用户在世界中的身份——称呼：…；身份：…；背景：…」
  - 未设置：「没有设定世界内身份，按外来交谈者处理」
- 页面右栏新增「我的身份」：称呼 + 身份输入、保存。

## G19 AI 摘要记忆

- `POST /api/chat/threads/{id}/memories/summarize`：
  - 至少 6 条消息；
  - 取最近 24 条，要求模型只压缩对话中已有信息、不补设定；
  - 生成 `kind="summary"`、`importance=0.65` 的记忆，记录来源消息 ID；
  - 可选 `character_id`，默认第一位参与者；非会话角色忽略。
- 页面「对话记忆」旁新增「AI 摘要」按钮（不足 6 条禁用）。
- 仍保留规则型情景记忆；摘要为**显式触发**，不自动产生额外调用。

## 实测

- `smoke_chat.py`：**60 项全通过**（新增身份保存、提示词含身份、摘要生成、摘要可列出、消息不足拒绝）。
- `smoke_official_storyline.py`：**13 项全通过**（新增参与者回填、空章节清理）。
- 全量回归：**350 passed / 0 failed**；`tsc`、`vite build` 通过。

## 边界

- 用户身份只影响聊天提示，不创建人物、不改变关系/事件。
- 摘要只写聊天记忆，不自动写入人物经历；需要写经历仍走「写入角色经历」。
- 回填只处理人物实体；事件中的地点/组织仍在 `event_entities`。
