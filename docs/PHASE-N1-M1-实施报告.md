# PHASE-N1-M1 实施报告

> 状态：**M1 已完成并应用于本地数据库**
>
> 范围：Phase N1-M1「加法列 + owner 回填 + feature flag」
>
> 配套：`docs/PHASE-N1-用户个人信息源与AI分级授权架构.md`
>
> 边界：本阶段不改 API 行为、不新增用户传记/授权/社区表、不迁移 6 条旧 companion 人格、不删除旧数据。

---

## 1. 本阶段完成内容

1. 新增 `M036` 迁移，只增加 nullable / 带默认值字段与索引。
2. 对现有记录回填 `owner_user_id=local`。
3. 将无实例的旧记忆标记为 `legacy_unscoped`，不删除正文。
4. 为会话、记忆、日记、写作、人物传记补后续鉴权所需字段。
5. 新增 feature flags；M1 阶段默认关闭，M6 起未配置时默认开启以启用新路径。
6. 新增 M1 验收套件，并接入全量后端验收。
7. 迁移副本演练、正式库迁移、幂等复跑、数据库完整性检查均通过。

---

## 2. 迁移 M036

文件：`backend/migrations/m036_phase_n1_m1_ownership.py`

版本：`M036`

### 2.1 新增字段

| 表 | 新增字段 |
|---|---|
| `diary_entries` | `entry_type`、`info_class`、`sensitivity`、`status`、`date_end` |
| `stories` | `owner_user_id` |
| `character_biographies` | `owner_user_id`（创建者，不代表用户传记） |
| `ai_roles` | `persona_instance_id` |
| `chat_threads` | `owner_user_id`、`persona_instance_id` |
| `character_memories` | `owner_user_id`、`persona_instance_id`、`status` |
| `persona_threads` | `instance_id`、`version_id`、`kind` |
| `persona_memories` | `owner_user_id`、`persona_instance_id`、`source_grant_id`、`source_kind`、`status`、`invalidated_at`、`deleted_at`、`content_hash` |

### 2.2 新增索引

- `ix_diary_entries_owner_type`
- `ix_stories_owner_user_id`
- `ix_character_biographies_owner_user_id`
- `ix_persona_threads_owner_instance`
- `ix_chat_threads_owner_instance`
- `ix_persona_memories_owner_instance`
- `ix_persona_memories_status`
- `ix_character_memories_owner_instance`
- `ix_ai_roles_persona_instance`

### 2.3 回填规则

| 数据 | 回填 |
|---|---|
| `diary_entries` | `entry_type=diary`、`info_class=basic`、`sensitivity=normal`、`status=active` |
| `stories` | `owner_user_id=local` |
| `character_biographies` | `owner_user_id=local` |
| `chat_threads` | `owner_user_id=local` |
| `persona_threads` | `kind=chat`，`instance_id/version_id` 保持 NULL |
| `persona_memories` | owner 从所属 `personal_personas.owner_user_id` 推导，失败回退 `local`；无实例行标记 `legacy_unscoped` |
| `character_memories` | `owner_user_id=local`；无实例行标记 `legacy_unscoped` |

**没有做的事情：**

- 没有把旧记忆挂到任何新实例。
- 没有把 6 条旧 companion 人格迁成版本。
- 没有把 `character_biographies` 改成用户传记。
- 没有把旧 `Story` 自动发布到社区。
- 没有新增 `user_biographies`、`ai_info_grants`、`community_publications` 等 M3/M4/M5 表。

---

## 3. Feature flags

文件：`backend/feature_flags.py`

| flag | 环境变量 | 默认 |
|---|---|---|
| `persona_instances` | `WS_PERSONA_INSTANCES` | M1 关闭；M6 起未配置时开启 |
| `user_journal_v2` | `WS_USER_JOURNAL_V2` | M1 关闭；M6 起未配置时开启 |
| `ai_info_grants` | `WS_AI_INFO_GRANTS` | M1 关闭；M6 起未配置时开启 |
| `community_publications` | `WS_COMMUNITY_PUBLICATIONS` | M1 关闭；M6 起未配置时开启 |

M1 **只建立开关，不接入任何业务路径**。M2–M6 已接入；未配置环境变量时默认开启，显式设为 `0/false/off` 时关闭并保留回滚。

`is_enabled()` 对未知 flag 直接抛 `KeyError`，避免拼写错误静默关闭。

---

## 4. 迁移与数据验证

### 4.1 迁移副本演练

```text
迁移记录：36 / 预期 36
表数量：72
✅ 迁移副本演练通过（重复执行无新增）
```

### 4.2 正式库应用

- 执行前备份：`/tmp/ws-m1-pre-m036-1794452926.db`
- `M036` 已登记到 `schema_migrations`
- 复跑 `run_migrations()` 无新增，幂等通过
- `PRAGMA integrity_check` 返回 `ok`
- `PRAGMA foreign_key_check` 无输出

### 4.3 当前数据结果

| 数据 | 结果 |
|---|---|
| `app_users` | 1 |
| `characters` | 6 |
| `personal_personas` | 7 |
| 旧 companion（`product_key=companion` 且 `system_key IS NULL`） | 6 |
| `diary_entries` | 1：`diary / basic / normal / active` |
| `information_sources` | 1 |
| `character_biographies` | 3，owner 均为 `local` |
| `stories` | 3，owner 均为 `local` |
| `chat_threads` | 8，owner 均为 `local`，实例为空 |
| `persona_threads` | 2，`kind=chat`，实例为空 |
| `character_memories` | 10，owner `local`，全部 `legacy_unscoped` |
| `persona_memories` | 1，owner `local`，`legacy_unscoped` |

---

## 5. 测试结果

### 5.1 后端

```text
21 suites
589 passed
0 failed
```

新增 `smoke_phase_n1_m1`：25 项，覆盖迁移记录、字段、owner 回填、legacy 标记、旧 companion 保留、feature flags 默认开启/显式关闭/显式开启/未知名称报错。

### 5.2 前端

| 检查 | 结果 |
|---|---|
| `tsc --noEmit` | 通过 |
| `npm run lint` | 0 errors，112 条既有 warnings |
| `npm run build` | 通过；仅有既有的 chunk > 500 kB 提示 |

M1 未修改前端代码。

---

## 6. 回滚策略

1. **行为回滚**：显式将四个 feature flags 设为 `0/false/off` 即可关闭对应新路由。
2. **数据回滚**：恢复执行前备份 `/tmp/ws-m1-pre-m036-1794452926.db`，同时恢复 `schema_migrations` 中的 M036 记录。
3. **列级回滚**：SQLite 对已有表删列支持有限，不建议逐列 DROP；新增列均为 nullable/有默认值，保留不影响旧代码。
4. **不要**通过删除旧记忆、旧人格、旧传记来“回滚”；这些数据在 M1 中未被删除或改写正文。

---

## 7. 本阶段明确未做

- 未新增 `PersonaInstance` 表，也未把云宝/伴侣实例化。
- 未新增 `AIInfoGrant`、`AIMemorySource`、`UserBiography`、`CommunityPublication` 等表。
- 未改日记、云宝、聊天、社区 API。
- 未按当前用户过滤旧 API；当前仍是单用户 `local` 语境。
- 未将 6 条旧 companion 人格接回任何入口。
- 未把 `CharacterBiography` 与用户传记混用。
- 未把旧 `Story` 自动公开。

---

## 8. M2（已完成）

M2 已完成“人格实例引导与隔离”：

1. 建立 `PersonaDefinition` / `PersonaVersion` / `PersonaInstance` 目标表。
2. 为云宝创建全局 Definition/Version，为当前 `local` 创建第一个 Instance。
3. 让 `persona_threads` / `persona_memories` 绑定实例；旧 `legacy_unscoped` 不参与新实例召回。
4. 旧 `AiRole` 继续服务世界 NPC 聊天，不改。
5. 验收云宝会话/记忆只出现在当前实例。

M2 实施详情见 `docs/PHASE-N1-M2-实施报告.md`。
