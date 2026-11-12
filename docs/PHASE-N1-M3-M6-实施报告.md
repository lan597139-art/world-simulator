# PHASE-N1-M3–M6 实施报告

> 状态：**M3、M4、M5、M6 已完成并应用本地数据库**
>
> 范围：用户 Journal/用户传记、AI 分级授权与记忆追溯、社区公开层、新旧路径切换。
>
> 上游：`docs/PHASE-N1-用户个人信息源与AI分级授权架构.md`、`docs/PHASE-N1-M2-实施报告.md`
>
> 边界：不实现语音、审核、加密；不迁移或删除 6 条旧 companion 人格；不把 `CharacterBiography` 当用户传记；旧 `Story` 不自动发布。

---

## 1. M3：用户 Journal / 用户传记

### 1.1 新增实体

| 表 | 作用 |
|---|---|
| `journal_people` | 用户自己的个人人物，不是世界 `Character` |
| `journal_relations` | 个人人物之间的关系，与世界 `Relationship` 分离 |
| `journal_entry_people` | 日记/经历与个人人物的多对多关联 |
| `user_biographies` | 用户自己的传记 |
| `user_biography_chapters` | 用户传记章节，保留 `source_entry_ids` |
| `journal_citations` | 日记/章节到 `information_sources` 的引用 |

`diary_entries` 复用 M1 已有字段：`entry_type/info_class/sensitivity/status/date_end`，M3 不改写正文，不移动旧日记。

### 1.2 API

```text
GET/POST/PATCH/DELETE  /api/journal/entries
GET/POST/PATCH/DELETE  /api/journal/people
GET/POST/PATCH/DELETE  /api/journal/relations
GET/POST/PATCH/DELETE  /api/journal/biographies
POST                    /api/journal/biographies/{id}/chapters
POST                    /api/journal/biographies/{id}/chapters/from-entries
PATCH/DELETE            /api/journal/biographies/{id}/chapters/{chapter_id}
GET/POST/DELETE         /api/journal/citations
GET                     /api/journal/presets
GET                     /api/journal/overview
```

旧 `/api/diary/entries` 保留兼容，并复用同一套 owner/类别/引用逻辑。

### 1.3 前端

新增 `JournalPage`，替换原日记页面入口：

- 日记/经历：类别、敏感度、人物关联、来源引用、发布到社区。
- 个人人物：创建/删除，建立个人关系。
- 我的传记：创建传记、从日记生成章节、手动章节、发布传记。
- AI 授权：云宝实例授权、撤销、访问摘要。
- 我的发布：公开作品列表与撤回。

`DiaryPage` 文件保留但不再作为路由入口，避免旧引用断裂。

---

## 2. M4：AI 分级授权与记忆追溯

### 2.1 新增实体

| 表 | 作用 |
|---|---|
| `ai_info_grants` | 授权主表：等级 1–4、用途、有效期、记忆开关、状态 |
| `ai_info_grant_scopes` | category/entry/biography/biography_chapter/collection 范围 |
| `ai_info_requests` | AI 提出的读取请求，用户批准/拒绝 |
| `ai_info_access_logs` | 读取/拒绝/记忆写入审计，只存元数据 |
| `ai_memory_sources` | 派生记忆到日记/章节/来源的映射 |

`persona_memories` 增加 `source_refs`、`invalidated_reason`，沿用 M1 的 owner/instance/source_grant/status。

### 2.2 授权规则

- 授权对象必须是当前用户的 `PersonaInstance`。
- 默认无授权；创建时必须显式选择等级、用途和范围。
- 等级 4 默认 30 天到期，其他等级默认 7 天。
- 读取实时校验：owner、instance、status、expiry、purpose、scope。
- 撤销：`status=revoked`，所有派生记忆 `invalidated` 并清空正文，来源映射标记 revoked。
- 删除日记/传记章节：对应来源记忆立即失效或标记 `needs_recompute`。
- 访问日志不保存正文。

### 2.3 API

```text
GET/POST                        /api/ai-grants
GET                             /api/ai-grants/{id}
POST                            /api/ai-grants/{id}/pause|resume|revoke
POST                            /api/ai-grants/{id}/read
POST                            /api/ai-grants/{id}/memory
GET                             /api/ai-grants/audit/logs
GET/POST                        /api/ai-grants/requests/list
POST                            /api/ai-grants/requests/{id}/approve|deny
```

### 2.4 云宝运行期

`assistant.py` 的云宝分支会在授权范围内读取最多 3 条日记作为聊天背景；没有授权时为空。授权读取会写审计日志，不把正文写入日志。

---

## 3. M5：社区公开层

### 3.1 新增实体

| 表 | 作用 |
|---|---|
| `community_publications` | 公开作品元数据、匿名、公开 ID、状态 |
| `community_publication_versions` | 不可变内容快照、来源引用、内容哈希 |
| `community_comments` | 公开评论 |
| `community_favorites` | 收藏，唯一约束 |

### 3.2 发布与撤回

- 日记条目、用户传记、传记章节、旧 Story 可显式发布。
- 发布生成独立快照；私人原稿后续编辑不改变公开版本。
- 新版本递增 `version_no`，旧版本 `superseded`。
- 公开 DTO 不含 `owner_user_id`、私人条目 ID、`source_refs`。
- 匿名作品公开作者显示“匿名用户”。
- 撤回只把 publication/current version 标为 withdrawn，公开链接 404，私人原稿和 AI 授权不受影响。
- 公开读取 `GET /api/community/public*` 不要求登录；评论/收藏/作者接口要求登录。

### 3.3 前端

- `CommunityPublicWorks` 展示真实公开作品。
- `CommunityPage` 发布按钮改为创建公开快照；草稿仍进入旧写作库。
- 旧 Story 区域重命名为“我的写作库”，不再冒充社区公开作品。
- `JournalPage` 提供日记/传记发布与我的发布撤回。

---

## 4. M6：切换与兼容

- Journal、AI 授权、社区公开 API 已默认注册并接入前端。
- 旧 `/api/diary`、`/api/writings`、`/api/information-sources` 保留兼容。
- 旧 Story 只作为写作库；`stories.community_publication_id` 为可选关联，不自动发布。
- `CharacterBiography`、6 条旧 companion 人格、旧会话/记忆未迁移、未删除。
- feature flags 继续保留为回滚开关：未配置时新路径默认启用，显式设为 `0/false/off` 时关闭对应路由并返回 404。

---

## 5. 迁移与数据

### 5.1 迁移

| 版本 | 内容 |
|---|---|
| M038 | Journal/个人人物/用户传记/引用索引 |
| M039 | AI 授权/访问日志/记忆来源索引，`persona_memories` 来源字段 |
| M040 | 社区公开作品/版本/评论/收藏索引 |
| M041 | Story 公开作品可选关联与 owner 索引 |

迁移副本演练：**41 / 41**，90 张表；重复执行无新增。
正式库 `PRAGMA integrity_check=ok`，`foreign_key_check` 无异常。
迁移前备份：`/tmp/ws-m3-m6-pre-1794456519.db`

### 5.2 数据

| 数据 | 状态 |
|---|---|
| 旧日记 / 信息来源 | 保留，未改写正文 |
| `CharacterBiography` | 3 条保留为世界人物资产 |
| 旧 companion 人格 | 6 条保留 |
| 旧 companion 会话/记忆 | 保留，未绑定新实例 |
| Journal/用户传记/授权/公开作品 | 初始为空，不使用演示假数据 |
| 测试残留 | 0 |

---

## 6. 验证

| 检查 | 结果 |
|---|---|
| 后端全量 | **628 passed / 23 suites / 0 failed** |
| M3–M6 专项 | **18 passed / 0 failed** |
| 迁移演练 | 41/41，90 表 |
| `tsc --noEmit` | 通过 |
| `npm run lint` | 0 errors，119 条 warnings（无 error） |
| `npm run build` | 通过；仅既有 chunk 提示 |

专项覆盖：个人人物、日记类别/敏感度/人物关联、引用、传记章节、授权读取、记忆来源、撤销清空正文、公开匿名、公开评论/收藏、撤回不可见。

---

## 7. 回滚

- 代码回滚：恢复前端旧 `DiaryPage` 入口；后端新路由可单独下线。
- 数据回滚：恢复 `/tmp/ws-m3-m6-pre-1794456519.db`。
- 不要删除旧日记、旧信息来源、`CharacterBiography`、旧 companion 数据。
- 新表可独立删除；旧表新增列保留不影响旧查询。

---

## 8. 后续产品打磨

1. 多用户权限从硬编码 `local` 全面切到真实 owner；当前旧世界 API 仍部分单用户。
2. 授权 UI 增加按传记章节/类别选择、待处理 AI 请求。
3. 公开作品详情页、评论区、收藏列表 UI。
4. 统一人格编辑器的 Draft→Version→Publication 流程。
