# 第一阶段最终验收报告（07 / 08 与统一 AI 接入）

日期：2026-11-11  
范围：08 写作辅助、07 模拟运行、统一 API 客户端、请求级 AI 配置、安全与自动化测试  
结论：**有条件通过**。功能代码与真实调用均通过；但"共享 Key 下模型切换"存在缺陷，线上部署尚未复测，因此不能宣布无条件验收。

---

## 1. 验收方法与证据分级

| 级别 | 含义 | 本报告证据 |
| --- | --- | --- |
| E1 代码完成 | 代码存在且路径可查 | 文件 + 行号/接口 |
| E2 自动化通过 | 脚本执行、断言通过 | `run_all.sh` 输出 |
| E3 真实调用通过 | 真实模型、真实接口、非桩 | 两模型 10 次调用记录 |
| E4 生产验证 | 部署环境复测 | **未完成** |

本报告不使用"已完成"替代 E3/E4；每项单独标注。

---

## 2. 08 写作辅助：AI 调用入口清单

| # | 入口 | 前端位置 | 后端 | 是否统一客户端 | 状态 |
| --- | --- | --- | --- | --- | --- |
| 08-1 | 生成正文（流式） | `WritingPage.generateStory` → `writingApi.streamGenerate` | `POST /api/writing/generate` | 是（`/api/writing/*` 白名单） | E1+E2+E3 |
| 08-2 | 选中文字辅助（流式） | `WritingPage` → `streamAssist` | `POST /api/writing/assist` | 是 | E1+E2+E3 |
| 08-3 | 章节素材解析 | `WritingPage.analyze` | `POST /api/writings/{id}/analyze` | 是（含 `analyze/extract` 白名单） | E1+E2（AI 可选，规则兜底） |
| 08-4 | 选中片段抽取 | 同上 → `extract` | `POST /api/writing/extract` | 是 | E1+E2 |
| 08-5 | 人物传记生成 | `CharacterBiographyModal` | `POST /api/characters/{id}/biography/generate` | 是（白名单） | E1+E2 |

08 的 AI 调用均经 `src/api/config.ts` 的 fetch 桥注入 `X-AI-API-Key / X-AI-Base-URL / X-AI-Model`，后端统一走 `ai_engine.get_client()/get_model()`；未发现 08 内绕过 AI 客户端直连模型 SDK 的代码。

**非 AI 的遗留直连**：`WritingPage.tsx:649` 归档请求硬编码 `http://127.0.0.1:8000/api/archive/story/{id}`，不经 `API_ORIGIN`。由于全局 fetch 桥会改写该前缀，线上仍可用；但属于技术债（桥未安装/第三方调用即失效）。全项目仍有 **54 处**此类字面量，统一客户端目前是"桥接兼容"，不是"全量重构"；列为 G-03（低风险）。

---

## 3. 07 模拟运行：AI 调用入口清单

| # | 入口 | 前端位置 | 后端 | 统一客户端 | 状态 |
| --- | --- | --- | --- | --- | --- |
| 07-1 | 普通事件推演 | `SimulationPage` → `fetch(API_ORIGIN + /api/simulate)` | `POST /api/simulate` | 是（`/api/simulate` 白名单） | E1+E2+E3 |
| 07-2 | 分支推演 | `SimulationPage` → `simulateBranch` | `POST /api/branches/{id}/simulate` | 是（`/api/branches/*`） | E1+E2+E3 |
| 07-3 | AI 方向建议 | `MultiPathPage` → `suggestDirections` | `POST /api/events/{id}/directions/suggest` | 是（正则白名单） | E1+E2+E3 |
| 07-4 | 结局生成 | `MultiPathPage` | `POST /api/branches/{id}/endings` | 无 AI（快照汇总） | E1+E2 |

07 的三类 AI 入口均携带请求级配置；`SimulationPage` 的两处 `fetch` 使用 `API_ORIGIN`，未硬编码本机地址。

---

## 4. 统一客户端覆盖情况

### 4.1 前端

- `src/api/config.ts`：全局 fetch 桥 + `VITE_API_BASE_URL` 改写 + 白名单注入 AI 头。
- Key 仅存浏览器；服务端不落库、不写日志。
- `needsAiKey` 覆盖：`/api/ai/status`、`/api/simulate`、`/api/writing/*`、`/api/branches/*`、方向建议、`/api/assistant/chat`、写作解析、传记生成。

### 4.2 后端

- `ai_engine.py`：`ContextVar` 请求级配置，个人 Key 优先于 `.env`；`get_model()/get_client()` 每次重读。
- 统一错误映射：402/401/429/超时/连接 → 中文可操作提示；07/08 统一 502。
- `_safe_base_url`：仅 HTTPS 公网，拒绝 localhost/环回/私网/`.local`。

### 4.3 覆盖结论与缺口

| 项 | 结论 |
| --- | --- |
| 08 全部 AI 入口走统一客户端 | **是** |
| 07 全部 AI 入口走统一客户端 | **是** |
| 重复的模型连接配置 | 未发现业务模块自建 SDK 客户端；全部经 `ai_engine` |
| 模型切换真实生效 | **有条件**：带个人 Key 时生效；仅带 `X-AI-Model`、使用站长共享 Key 时被忽略（G-01） |
| 聊天类 AI 入口的个人 Key 注入 | **否**：`needsAiKey` 未覆盖 `/api/chat/*`（G-02） |

---

## 5. 真实模型调用结果（E3）

脚本：`backend/tests/live_ai_matrix.py`  
证据：`docs/evidence/PHASE-H-live-ai-matrix.json`  
模型：`deepseek-ai/DeepSeek-V3.2`、`deepseek-ai/DeepSeek-V4-Flash`  
方式：真实 HTTP、临时世界、真实事件；调用后清理，未留测试世界。

| 能力 | V3.2 | V4-Flash |
| --- | --- | --- |
| 07 `/api/simulate` | 200 / 11.14s / 354 字 | 200 / 3.80s / 283 字 |
| 07 方向建议 | 200 / 63.30s / 2461 字 | 200 / 14.88s / 2021 字 |
| 08 生成 | 200 / 75.84s / 1310 字 | 200 / 146.53s / 1099 字 |
| 08 辅助 | 200 / 4.36s / 92 字 | 200 / 3.61s / 140 字 |

**10/10 通过**。模型切换经 `/api/ai/status` 校验：带个人 Key 时分别回显 `DeepSeek-V3.2` 与 `DeepSeek-V4-Flash`。

补充记录：曾以 `Qwen/Qwen3.5-9B` 作为第二模型，4 个接口返回 502「AI 网络连接失败」，直接 SDK 调用同模型可通；判断为当时服务端连接/供应商波动，未列为代码缺陷，但说明真实调用存在供应商稳定性风险。

---

## 6. 自动化测试（E2）

| 套件 | 项数 | 覆盖 |
| --- | ---: | --- |
| smoke_flow | 102 | 世界/人物/事件/关系/基础流程 |
| smoke_writing | 29 | 08 章节、草稿、解析、版本 |
| smoke_character_runtime | 14 | 人物运行态、引擎、成长 |
| smoke_ai_access | 7 | 请求级 Key、模型回显、07/08 502 |
| smoke_workspace | 20 | 归档/回收站/时光机/传记/官方 |
| smoke_storyline | 50 | 故事线、空间、单元、选择、结局、章节 |
| smoke_official_storyline | 13 | 官方演示数据完整性 |
| smoke_chat | 64 | 角色转换、私聊/群聊、记忆、影响 |
| smoke_multipath | 29 | 方向、分支、快照、回溯、结局 |
| smoke_assistant | 28 | 全局助手、多路径跳转 |
| **合计** | **356** | `backend/tests/run_all.sh` |

迁移演练：`backend/migrations/rehearse.py`，副本库 20/20 迁移、56 表、重复执行无新增。

**未接入 CI**：脚本为手动入口；无 GitHub Actions/流水线绑定。

---

## 7. 安全测试证据

| 项 | 结果 | 证据 |
| --- | --- | --- |
| 请求级 Key 隔离 | 通过 | `smoke_ai_access`：默认不用访客 Key；带 Key 时 `using_personal_key=true` |
| 模型回显 | 通过 | 访客模型 `DeepSeek-V4.1-Flash` 回显一致 |
| Key 不回传 | 通过 | 仅返回 `sk-v…7890` 掩码 |
| SSRF 防护 | 通过（手工） | `http://127.0.0.1`、`https://localhost`、`https://192.168.1.5` 均回落为服务端 Base URL |
| 错误码 | 通过 | 07/08 错误统一 502，无堆栈外泄 |
| `.env` 不入库 | 通过 | `.gitignore` 明确忽略 `backend/.env` |
| CORS | 有限白名单 | 本地 + 官方 Vercel + 预览正则 |
| 身份认证/租户隔离 | **未实现** | 无 users/owner/auth 表与中间件；见架构报告 |
| 速率限制 | **未实现** | 无请求配额/防滥用层 |

---

## 8. 已知问题与风险

| ID | 问题 | 影响 | 级别 | 建议 |
| --- | --- | --- | --- | --- |
| G-01 | 仅带 `X-AI-Model` 且使用共享 Key 时模型被忽略 | "模型切换生效"不完整 | 高 | 中间件允许无 Key 时也应用 model（仍不落库） |
| G-02 | `/api/chat/*` 不在 `needsAiKey` 白名单 | 个人 Key 用户聊天走共享 Key 或 503 | 高 | 补白名单并测试 |
| G-03 | 54 处 API 字面量依赖全局桥（含 08 归档） | 桥失效即断；可维护性差 | 低 | 逐步改用 `API_ORIGIN`/统一 request |
| G-04 | 无认证/租户 | 四类产品无法做用户级隐私隔离 | 高 | 第二阶段先立账号与 owner_id |
| G-05 | 未做部署环境复测 | 不能宣称生产验证 | 高 | 提供 Vercel 地址后复测 |
| G-06 | 供应商连接波动 | 真实调用偶发 502 | 中 | 重试/超时/降级提示 |
| G-07 | 流式错误可能在文本尾部出现中断标记 | 08 流式体验 | 低 | 首帧预检 + 结构化错误事件 |
| G-08 | 测试未接 CI | 回归依赖人工 | 中 | 绑定流水线 |

---

## 9. 第一阶段验收结论

1. **08 是否完整接入统一 API 客户端？**  
   是（调用层）。生成、辅助、解析、抽取、传记均走请求级配置；未发现业务模块自建模型连接。遗留 G-03 为非 AI 地址问题。
2. **07 是否完整使用统一 API 客户端？**  
   是。普通推演、分支推演、方向建议均走统一配置与错误映射。
3. **代码完成、自动化通过、真实调用通过、生产验证**：前三项通过；第四项未完成。
4. **验收判定**：**有条件通过**。关闭 G-01、G-02 并提供部署地址复测后，可转为通过；G-03 为技术债，不阻塞。

---

## 10. 建议的关闭顺序

1. 修 G-01（模型头独立生效）与 G-02（聊天白名单），补自动化断言。
2. 接入 CI（至少 10 套件 + 迁移演练）。
3. 逐步替换 54 处 API 字面量（低优先级）。
4. 部署复测 07/08 各一次真实调用，记录 URL、模型、耗时、结果。
5. 重跑本报告第 5、6 节并更新结论。
