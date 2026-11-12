# PHASE-N1-M2 实施报告

> 状态：**M2 已完成并应用于本地数据库**
>
> 范围：Phase N1-M2「人格定义 / 版本 / 实例 + 云宝实例化 + 会话与记忆隔离」
>
> 配套：`docs/PHASE-N1-用户个人信息源与AI分级授权架构.md`、`docs/PHASE-N1-M1-实施报告.md`
>
> 边界：只实例化云宝；6 条旧 companion 人格、旧 companion 会话/记忆不迁移；运行时仍保留 `PersonalPersona` 兼容适配器。

---

## 1. 本阶段完成内容

1. 新增 `PersonaDefinition`、`PersonaVersion`、`PersonaInstance` 三张表与索引。
2. 为云宝建立唯一全局定义和 v1 人格快照。
3. 为当前所有者 `local` 建立云宝实例。
4. 普通用户首次访问云宝时建立自己的实例，与所有者共享定义/版本，不共享实例。
5. 云宝会话创建、列表、消息读取、删除全部按 `owner_user_id + instance_id` 过滤。
6. 云宝记忆创建、列表、删除全部按 `owner_user_id + instance_id` 过滤；旧记忆不参与新实例召回。
7. 旧 companion 会话/记忆保持未绑定、只读；`AiRole` 世界 NPC 路径不改。
8. 新增 M2 验收套件并接入全量后端验收。

---

## 2. 新增数据模型

### 2.1 `persona_definitions`

| 字段 | 说明 |
|---|---|
| `id` | 主键 |
| `owner_user_id` | 全局人格为系统所有者 |
| `scope` | `global/private/public` |
| `system_key` | 云宝固定 `yunbao` |
| `product_key` | 云宝为 `global` |
| `name` | 定义名称 |
| `status` | active/archived |
| `legacy_persona_id` | 兼容 `PersonalPersona` 的桥 |
| `created_at/updated_at` | 审计 |

约束：`system_key` 唯一；`(owner_user_id, scope)` 索引。

### 2.2 `persona_versions`

| 字段 | 说明 |
|---|---|
| `id` | 主键 |
| `definition_id` | 归属定义 |
| `version_no` | 从 1 递增 |
| `payload` | 完整人格配置快照 |
| `status` | draft/published/retired |
| `created_by` | 创建者 |
| `created_at` | 创建时间 |

约束：`(definition_id, version_no)` 唯一。

M2 只创建 v1；后续编辑器产生的版本、草稿、发布流程在 N 方案中实现。

### 2.3 `persona_instances`

| 字段 | 说明 |
|---|---|
| `id` | 主键 |
| `definition_id` | 定义 |
| `version_id` | 当前 pin 的版本 |
| `owner_user_id` | 实例所有者 |
| `kind` | `yunbao/private_companion/public_companion/npc` |
| `legacy_persona_id` | 兼容旧人格 ID |
| `status` | active/paused/archived |
| `created_at/updated_at` | 审计 |

约束：`(owner_user_id, definition_id)` 唯一；`(owner_user_id, kind)` 索引。

---

## 3. 云宝实例引导

文件：`backend/persona_instances.py`、`backend/yunbao.py`

幂等流程：

```text
ensure_yunbao(db)
  → 查/建云宝 PersonalPersona
  → ensure_definition(scope=global, system_key=yunbao)
  → ensure_version(v1, payload=当前人格快照)
  → ensure_instance(owner=local, kind=yunbao)
  → bind_legacy_records(persona_id, owner, instance)
  → commit

ensure_yunbao_instance(db, user)
  → ensure_yunbao(db)
  → 复用 Definition/Version
  → 按 user.id 建/取自己的 PersonaInstance
  → 绑定该用户尚未绑定的旧云宝会话/记忆
```

绑定范围严格限定为：

```text
persona_id = 云宝 PersonalPersona.id
owner_user_id = 当前用户
instance_id IS NULL
```

因此不会把 6 条旧 companion 的会话/记忆绑定到云宝实例。

---

## 4. 会话与记忆隔离

### 4.1 会话

| 操作 | 过滤条件 |
|---|---|
| 创建 | `persona_id + owner_user_id + instance_id` |
| 列表 | `persona_id + owner_user_id + instance_id + status != archived` |
| 读取消息 | 先校验 thread 属于当前 `instance_id` |
| 删除 | 先校验 thread 属于当前 `instance_id` |

### 4.2 记忆

| 操作 | 过滤条件 |
|---|---|
| 创建 | 写入 `owner_user_id`、`persona_instance_id=active`，可选 thread 必须属于当前实例 |
| 列表 | `persona_id + owner_user_id + instance_id + status=active` |
| 删除 | `persona_id + owner_user_id + instance_id` |

旧 `legacy_unscoped` 记忆没有实例，不进入云宝新实例列表/召回。

### 4.3 助手聊天

`backend/assistant.py` 的云宝分支：

- 使用 `ensure_yunbao_instance` 获取当前用户实例。
- 会话查询/创建加 `instance_id`。
- 记忆召回加 `owner_user_id + instance_id + status=active`。
- 返回 `yunbao.instance_id`。

### 4.4 当前限制

- 云宝三态 `active_state` 仍在 `PersonalPersona`，M2 不改为实例级；三态共享不会影响会话/记忆隔离。
- 运行时仍从 `PersonalPersona` 兼容适配器读取人格内容；`PersonaVersion.payload` 已保存快照，但尚未切换为运行时唯一源，待统一人格编辑器阶段处理。
- 关系状态表、AI 信息授权表、记忆来源映射表尚未建立，属于后续 M4/M5。

---

## 5. 兼容性

| 对象 | 处理 |
|---|---|
| 6 条旧 companion 人格 | 不建定义/版本/实例，不迁移、不删除 |
| 旧 companion 会话（2 条） | `instance_id` 保持 NULL |
| 旧 companion 记忆（1 条） | 保持 `legacy_unscoped` |
| `PersonalPersona` | 保留为运行时兼容源 |
| `AiRole` | 不改；世界 NPC 聊天继续走原路径 |
| `persona_threads` / `persona_memories` | 仅云宝的指定 owner 记录绑定实例 |
| 现有云宝 API | 返回新增 `definition_id/version_id/instance_id`，旧字段不变 |

---

## 6. 迁移与数据结果

### 6.1 迁移

- `M037` 已登记；新表由 `models.Base.metadata.create_all` 创建，迁移补索引。
- 迁移副本演练：37 / 37 通过，75 张表。
- 正式库 M037 已应用；`PRAGMA integrity_check=ok`，`foreign_key_check` 无输出。
- 执行前备份：`/tmp/ws-m2-pre-m037-1794453996.db`

### 6.2 当前数据

| 数据 | 结果 |
|---|---|
| `persona_definitions` | 1（云宝全局） |
| `persona_versions` | 1（v1） |
| `persona_instances` | 1（`local` 云宝实例） |
| 旧 companion 人格 | 6，未迁移 |
| 旧 companion 会话 | 2，`instance_id` 为 NULL |
| 旧 companion 记忆 | 1，`legacy_unscoped` |
| 测试用户/测试实例 | 0（已清理） |

---

## 7. 测试结果

### 7.1 后端

```text
22 suites
609 passed
0 failed
```

新增 `smoke_persona_instances`：20 项，覆盖：

- 云宝定义/版本/实例存在且幂等；
- 所有者与普通用户实例不同、共享定义/版本；
- 普通用户会话不出现在所有者列表；
- 普通用户只读自己的记忆，不能写云宝记忆；
- 所有者列表不返回普通用户记忆；
- 旧 companion 会话/记忆不绑定；
- 云宝 legacy 记忆不被实例绑定或激活；
- `/api/yunbao` 返回 `instance_id`。

### 7.2 前端

| 检查 | 结果 |
|---|---|
| `tsc --noEmit` | 通过 |
| `npm run lint` | 0 errors，112 条既有 warnings |
| `npm run build` | 通过；仅既有 chunk > 500 kB 提示 |

前端只增加了 `YunbaoProfile` 的可选实例字段类型，未改页面行为。

---

## 8. 回滚策略

- 行为回滚：保持 `WS_PERSONA_INSTANCES` 关闭；M2 尚未把开关接入代码路径，当前通过实例字段实际隔离。
- 数据回滚：恢复 `/tmp/ws-m2-pre-m037-1794453996.db`，同时恢复 `schema_migrations` 的 M036/M037 记录。
- 新表独立，可单独删除 `persona_instances/persona_versions/persona_definitions`；不要删除旧人格、旧会话、旧记忆。
- 不建议通过删除旧 companion 数据回滚。

---

## 9. 下一步：M3

M3 进入用户个人内容域：

1. 扩展 `diary_entries` 为 JournalEntry 的使用面（类别、经历、事件、思想）。
2. 新增 `journal_people/journal_relations`。
3. 新增 `user_biographies/user_biography_chapters`。
4. 新增 `journal_citations`，把 `InformationSource` 关联到条目/章节。
5. 保持 `CharacterBiography` 为世界人物资产，不混用。
6. M3 不自动开放 AI 授权，也不发布社区。

M3 开始前建议先跑 `smoke_persona_instances`、`smoke_yunbao` 和 `migrations/rehearse.py`。


---

## 后续状态（更新）

M3–M6 已完成并应用本地数据库；当前全量 **628 passed / 23 suites**，详见 `docs/PHASE-N1-M3-M6-实施报告.md`。
