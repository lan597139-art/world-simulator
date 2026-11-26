# 阶段四·主线三：平台原生 AI 助手后端人格管理 —— 现状审计与验收

> 所属任务书：《世界模拟器｜DSH 后续架构升级任务书（完整版）》主线三
> 审计范围：**仅主线三涉及的人格链路**（平台原生人格 / 用户自建 OC / 助手对话），未扩大到其余三条主线
> 执行方式：先审计现状并提交差异清单，再按确认范围实施；完成一条、验收一条

---

## 1. 现状审计

### 1.1 三类 AI 业务的人格边界（严格区分，互不混用）

| 类别 | 人格定义者 | 人格载体 | 后端实现 | 运行时读取 | 模型上下文 |
| --- | --- | --- | --- | --- | --- |
| **平台原生 AI 助手** | 开发者（系统所有者） | 云宝 `PersonalPersona(system_key=yunbao)` | `backend/yunbao.py` + `backend/persona_instances.py` | `ensure_yunbao()` / `profile_prompt()` | `assistant.py` system 消息 |
| **用户自建 OC** | 用户 | `PersonalPersona(owner_user_id=用户)` | `backend/personas.py` | `_persona(db,...)` | `chat.py` `_persona_lines()` |
| **AI 辅助写作** | 任务与上下文驱动，不强制独立人格 | 不使用独立人格身份 | `backend/writing.py` | — | 写作任务上下文 |

三类**共享主线二交付的统一 AI 接入能力**（`X-AI-*` 头 + `ai_engine.get_client()`），但人格数据、权限、业务逻辑相互隔离：平台人格归属系统所有者，OC 人格归属用户本人。

### 1.2 后端正式人格数据结构（L3-2）

已具备完整版本化结构，**模型层面齐备**：

| 模型 | 作用 | 关键字段 |
| --- | --- | --- |
| `PersonaDefinition` | 人格定义与版本/实例的稳定锚点 | `scope(global/private/public)`、`system_key`、`legacy_persona_id` |
| `PersonaVersion` | 不可变人格版本快照 | `payload(JSON 快照)`、`version_no`、`status(draft/published/retired)`、唯一约束 `(definition_id, version_no)` |
| `PersonaInstance` | 用户持有的实例（会话/记忆隔离） | `definition_id`、`version_id`、`owner_user_id`、唯一约束 `(owner_user_id, definition_id)` |

桥接函数 `persona_instances.py` 提供 `ensure_definition / ensure_version / ensure_instance / bind_legacy_records / persona_payload`，由 `yunbao.py` 在 bootstrap 时调用。

**缺口**：模型字段完备，但**此前没有任何版本管理路由**——无法查询版本、保存草稿、发布草稿、回滚；`ensure_version` 只在首次建立 v1 published，之后保存不产生新快照。

### 1.3 保存 / 同步 / 读取链路（L3-1）

- 前端：`src/api/yunbao.ts` `getYunbao / updateYunbao / switchYunbaoState`；`YunbaoProfile.tsx` 读写。
- 后端：`GET /api/yunbao`（读）、`PATCH /api/yunbao`（保存）、`POST /api/yunbao/state`（切态）。
- **缺口**：`update_yunbao` 仅直接写 `PersonalPersona`，**保存不产生版本快照**，保存与版本记录未打通。

### 1.4 运行时读取（L3-3）

✅ 已具备：`ensure_yunbao()` 幂等创建并返回平台人格；`_row()` 输出含定义/实例/版本 id；`profile_prompt()` 读取身份、常态、特征、自传、成长、世界种子与记忆。

### 1.5 人格进入模型请求上下文（L3-4）

✅ 已具备，且运行时验证通过：
- `profile_prompt()` 构建人格上下文 → `assistant.py:_prompt(persona_prompt=...)` → **置于 system 消息开头**（`messages=[{"role":"system","content":system}]`）。
- 所有者视角 `include_private=True`，含完整人物种子与所属世界；普通用户 `include_private=False`，**不含私人种子/世界**。
- OC 人格经 `chat.py:_persona_lines()` 进入角色扮演上下文。

### 1.6 权限（L3-5）

✅ 已具备，服务端强制：
- `PATCH /api/yunbao`、`POST /api/yunbao/state`、`GET /api/yunbao/seed-character`、记忆写操作均校验 `user.is_owner`，非所有者 403。
- `_row()` 返回 `can_edit / is_owner / read_only`，前端据此只读渲染。
- `_clean_profile()` 额外阻断 `states / active_state / system_key / owner_user_id / product_key`，防止通过人格编辑篡改身份与归属。

### 1.7 版本 / 草稿 / 发布 / 回滚（L3-6）

❌ **完全缺失**（模型有字段、无逻辑、前端无入口），为本次核心缺口。

---

## 2. 差异清单

| 编号 | 类型 | 发现 | 证据 | 标记 |
| --- | --- | --- | --- | --- |
| L3-1 | **联动缺口** | 保存人格只写生效行，**不产生版本快照**，保存与版本记录脱节 | `yunbao.py:update_yunbao` | **修复** |
| L3-2 | **缺口** | 人格库无版本管理路由，无法查询/管理版本 | 全量路由清单无 versions 端点 | **新增** |
| L3-3 | 合规 ✓ | 运行时正确读取 | `ensure_yunbao` / `profile_prompt` | 保留 |
| L3-3 | 合规 ✓ | 人格进入模型请求上下文（system 消息） | `assistant.py` 接线 + 运行时验证 | 保留/验证 |
| L3-5 | 合规 ✓ | 开发者编辑 / 普通用户只读，服务端强制 403 | `is_owner` 校验 + 接口验证 | 保留/验证 |
| L3-6 | **完全缺失** | 草稿、发布、版本记录、回滚无后端能力、无前端入口 | `PersonaVersion.status` 字段无使用 | **新增** |

**范围说明**：OC 人格（`personas.py`）与 AI 辅助写作**不在本线改造范围内**，保持原样；平台原生人格即云宝，版本能力只作用于云宝全局定义。

---

## 3. 已实施修复（代码变更记录）

### 3.1 后端 `backend/yunbao.py`（+154 行）

**版本管理辅助函数**：
- `_definition()`：按 `system_key` 幂等获取云宝全局定义。
- `_next_version_no()`：版本号自增（唯一约束 `(definition_id, version_no)` 保证不冲突）。
- `_version_row()` / `_version()`：版本序列化与按定义查询。
- `_merged_payload()`：在当前人格快照上合并待保存字段，形成完整快照。
- `_apply_payload()`：版本快照回写生效人格，**身份与归属字段（`system_key/owner_user_id/product_key`）受保护不回写**。

**保存即版本（L3-1 联动）**：`update_yunbao` 保存成功后自动创建一份 `status=published` 的不可变快照，版本号自增。

**新增路由（L3-2 / L3-6，全部服务端校验 `is_owner`）**：

| 路由 | 方法 | 作用 | 权限 |
| --- | --- | --- | --- |
| `/api/yunbao/versions` | GET | 版本历史列表（按版本号倒序） | 登录用户可读 |
| `/api/yunbao/versions/draft` | POST | 保存为草稿（仅记录快照，不改变生效人格） | 仅所有者 |
| `/api/yunbao/versions/{id}/publish` | POST | 发布草稿（写回生效人格，标记已发布） | 仅所有者 |
| `/api/yunbao/versions/{id}/rollback` | POST | 回滚到指定版本（写回生效人格并记录新版本） | 仅所有者 |

### 3.2 前端 `src/api/yunbao.ts`（+28 行）

新增类型 `YunbaoVersion` 与 `listYunbaoVersions / createYunbaoDraft / publishYunbaoVersion / rollbackYunbaoVersion`，统一走 `API_ORIGIN`。

### 3.3 前端 `src/components/YunbaoProfile.tsx`（+179/−31 行）

- 抽取 `buildPayload()` 复用于保存与存草稿。
- 面板新增 `versions` 状态与 `loadVersions()`，读取后自动加载版本列表。
- 编辑体新增「存为草稿（不生效）」按钮；只读体新增「版本记录」区（版本号、状态、时间、发布/回滚按钮），**所有者可见可操作，普通用户只读**。
- 保存/发布/回滚成功后刷新人格与版本列表。

**合计 3 文件，+330/−31 行。** 未改动 OC 人格与 AI 辅助写作相关代码，未改动任何既有业务规则。

---

## 4. 验证结果

### 4.1 静态检查

| 检查 | 结果 |
| --- | --- |
| `tsc -b tsconfig.app.json` | **35 个错误，与基线一致，无新增** |
| `vite build` | **通过（exit 0）** |
| 后端 `yunbao.py` 语法/导入 | **通过**，15 条云宝路由（新增 4 条版本路由已注册） |

### 4.2 版本链路与权限（真实后端接口，17/17 通过）

脚本 `.verify/verify_persona_versions.py`，分别用**所有者 token** 与**普通用户 token** 触发真实请求：

```
✓ 所有者读取云宝人格  status=200
✓ 所有者保存人格  status=200
✓ 版本列表可读  count=...
✓ 保存产生已发布版本快照  vN published
✓ 再次保存版本号递增  vN -> vN+1
✓ 保存草稿成功  status=200 草稿
✓ 草稿不改变生效人格  description=（保持原值）
✓ 发布草稿成功  status=200
✓ 发布后版本状态为已发布  published
✓ 回滚到 v1 成功  status=200
✓ 回滚记录为新版本
✓ 普通用户可读云宝  can_edit=False read_only=True
✓ 普通用户可读版本列表  status=200
✓ 普通用户编辑人格被 403  status=403
✓ 普通用户存草稿被 403  status=403
✓ 普通用户发布被 403  status=403
✓ 普通用户回滚被 403  status=403
RESULT=PASS
```

**关键行为**：草稿仅记录不生效；发布后生效；回滚后生效人格恢复且新增一条版本记录；普通用户**读可见、写全 403**，权限在服务端强制生效。

### 4.3 人格进入模型请求上下文（运行时，10/10 通过）

脚本 `.verify/verify_persona_context.py`，从真实库读取云宝人格，调用 `profile_prompt` 与 `assistant._prompt`：

```
✓ profile_prompt 构建出人格上下文（长度 2233）
✓ 人格上下文含身份定位 / 当前常态 / 自传字段
✓ 所有者上下文含世界种子/私人背景
✓ 人格进入 system 消息开头（system.startswith(persona_prompt)）
✓ system 消息含人格名 + 助手角色约束
✓ 普通用户提示仍含身份
✓ 普通用户提示不含私人种子/世界
RESULT=PASS
```

证明人格设定**确实进入模型请求上下文**，而非仅存于前端。

### 4.4 浏览器端真实渲染（3/3 通过）

脚本 `.verify/verify_persona_ui.py`，Chrome CDP 打开 `?product=yunbao&page=personas` 并携带认证：

```
✓ 页面渲染云宝人格
✓ 版本记录区已渲染
✓ 显示版本号条目（vN 已发布 / 回滚到此版本）
RESULT=PASS
```

### 4.5 既有回归

- 后端冒烟 `tests/smoke_yunbao.py`：HEAD 原代码与新代码结果**一致**（8 passed / 35 failed），失败项全部为鉴权 401，属**既有问题**，与本次改动无关（已通过回退对比确认）。

---

## 5. 验收结论

| 验收项 | 结果 |
| --- | --- |
| 平台原生 AI 助手从后端读取正式人格 | ✅ `GET /api/yunbao` 返回完整人格与定义/实例/版本 id |
| 人格设定实际用于模型调用（进入请求上下文） | ✅ 运行时验证 `profile_prompt` 进入 system 消息开头 |
| 普通用户不能通过后端接口修改平台人格 | ✅ 编辑/草稿/发布/回滚全部服务端 403 |
| 草稿、发布、版本记录、回滚可用 | ✅ 四条路由 + 前端入口，17/17 接口验证通过 |
| 三类 AI 业务人格数据、权限、逻辑相互隔离 | ✅ 平台人格归所有者、OC 归用户、写作不强制人格，未混用 |
| 不破坏现有业务、不扩大范围 | ✅ 仅云宝版本链路；OC 与写作代码未改动；tsc/build 无新增错误 |
| 关键流程实际运行验证 | ✅ 后端接口 + 模型上下文 + 浏览器渲染三重验证 |

**主线三判定：✅ 完成并验收通过。**

---

## 6. 未完成与依赖

| 项 | 状态 | 说明 |
| --- | --- | --- |
| 既有冒烟测试鉴权失败 | 既有问题 | `smoke_yunbao.py` 的 35 项 401 在改动前即存在（测试未配置有效令牌/鉴权关闭），非本次引入，未在本次范围内修复 |
| 版本"退休（retired）"状态 | 未启用 | `PersonaVersion.status` 支持 `retired`，当前未使用；按任务书"补齐草稿/发布/版本记录/回滚"，未扩展至退休语义，留待后续确认 |

**下一步**：按任务书顺序进入**主线四（纯虚拟货币与创作体验服务体系）**，包含取消现金商业体系与灵果/灵植规则落实。
