# 阶段 A：第一阶段收尾验收报告（统一 AI API 接入）

结论：**代码接入完成、自动化测试通过、真实模型调用已验证；生产环境未验证**（原因见 §5）。
发现 6 项遗留问题，其中 1 项会直接影响后续「07 多路径入口」，需在阶段 B 一并修复。

---

## 1. 验收方法

- 代码审计：全仓检索 AI 客户端实例化、Key 读取、模型解析路径。
- 自动化：既有 7 套冒烟测试（共 220 项）。
- 真实调用：使用访客 Key 请求头（`X-AI-API-Key` / `X-AI-Base-URL` / `X-AI-Model`），对 07、08 各发起真实模型请求，并用「非法模型」做负向对照。
- 未做：生产域名验证（见 §5）。

## 2. 统一客户端接入情况

### 2.1 代码事实

- 全仓 `OpenAI(` 实例化只出现在 `backend/ai_engine.py`；其余模块一律 `from ai_engine import ...`：
  `simulation.py`、`multipath.py`、`writing.py`、`biography.py`、`assistant.py`、`main.py`。
- 无任何模块自行读取 `DEEPSEEK_API_KEY` 或自建 Base URL（检索结果为空）。
- 请求级配置：`main.py` 中间件把 `X-AI-API-Key/-Base-URL/-Model` 写入 ContextVar，请求结束 `reset`；Key 不落库、不写日志。
- 访客 Key 优先于站长 Key；未携带 Key 时回落到 `.env`（受 `AI_SERVER_KEY_ENABLED` 控制）。
- 关键设计事实：**只带 `X-AI-Model` 而不带 Key 时，模型覆盖被忽略**（`set_request_ai_config` 在无 Key 时直接返回 `None`）。这是安全设计，不是缺陷，但 UI 需说明。

### 2.2 07 模拟运行

| 项 | 结论 | 证据 |
| --- | --- | --- |
| 唯一 AI 入口 | ✅ | `POST /api/simulate` → `run_simulation()` → `get_client()/get_model()` |
| 使用统一客户端 | ✅ | `simulation.py:7` 仅导入 `run_simulation` |
| 模型选择生效 | ✅（带访客 Key） | 负向对照：`X-AI-Model=definitely-not-a-model` → HTTP 500，错误 "Model does not exist" |
| 请求级隔离 | ✅ | ContextVar + 中间件 reset；`tests/smoke_ai_access.py` 5/5 |
| 错误处理 | ⚠️ 不完整 | AI 失败返回 **HTTP 500**（应为 502），且无统一错误码 |
| 原模拟功能 | ✅ | 真实调用成功：Qwen 模型 4.6s 返回 `world_changes` |

真实调用（临时世界 + 单人物事件，测后已删除）：
- `Qwen/Qwen2.5-7B-Instruct`：HTTP 200 / 4.6s / 返回世界变化文本。

### 2.3 08 写作辅助

| 项 | 结论 | 证据 |
| --- | --- | --- |
| AI 入口清单 | ✅ | `/api/writing/generate`（流式）、`/api/writings/{id}/analyze`、`/api/writing/extract`、`/api/writing/assist`（流式）、`/api/ai/status` |
| 统一客户端 | ✅ | `writing.py:17` 导入 `ai_config_status/ai_error_message/get_client/get_model` |
| 旧独立模型配置 | ✅ 不存在 | 全仓无第二个客户端/Key 读取点 |
| 业务参数保留 | ✅ | `direction/perspective/event_ids/action/text/context` 均保留 |
| 模型选择生效 | ✅（带访客 Key） | 同一段文字用两种模型输出风格明显不同（见下） |
| 错误处理 | ⚠️ 语义不一致 | 流式接口 AI 失败仍返回 **HTTP 200**，错误以 `[AI 辅助中断: ...]` 文本混在正文里 |

真实调用（`/api/writing/assist`，action=polish）：

| 模型 | HTTP | 耗时 | 输出（截断） |
| --- | --- | --- | --- |
| `Qwen/Qwen2.5-7B-Instruct` | 200 | 4.4s | 「韩立伫立于山门之前，浓厚的雾气缭绕四周，他紧握着手中的药锄，指尖微微颤抖。」 |
| `deepseek-ai/DeepSeek-V3.2` | 200 | 11.2s | 「韩立立在山门前。雾气浓得化不开，湿漉漉地缠在衣襟上。他指节微微发白，攥紧了掌中那柄药锄。」 |

负向对照：`X-AI-Model=definitely-not-a-model` → HTTP 200，正文为 `[AI 辅助中断: AI 调用失败：Error code: 400 - Model does not exist...]`。

### 2.4 `/api/ai/status?probe=true`

- 带访客 Key + 两个合法模型 → `probe_ok=True`，`model` 正确回显请求头值。
- 非法模型 → 仍 `probe_ok=True`：**probe 只验证 Key/Base 可达，不校验模型是否存在**。
- 结论：probe 不能作为「模型可用」的验收依据，只能作为「Key/网络可用」的依据。

## 3. 前端请求头覆盖

`src/api/config.ts` 安装全局 fetch 桥：把 `http://127.0.0.1:8000` 改写为 `VITE_API_BASE_URL`，并对白名单路径自动附加 `X-AI-*`。

白名单（`needsAiKey`）：
- `/api/ai/status`
- `/api/simulate` ✅ 07
- `/api/writing/*` ✅ 08（generate/assist/extract）
- `/api/writings/{id}/(analyze|extract)` ✅ 08
- `/api/characters/{id}/biography/generate` ✅ 传记

**未覆盖**：
- `/api/branches/{id}/simulate`、`/api/events/{id}/directions/suggest`（多路径）
- `/api/assistant/chat`

后果：07/08 主流程能拿到访客 Key 与模型选择；但**多路径入口在浏览器里不会带访客 Key**，只能用站长 Key，模型选择也不生效。这直接阻塞阶段 B 的「07 可选多路径入口」。

## 4. 自动化测试基线

| 套件 | 结果 |
| --- | --- |
| smoke_flow | 102 |
| smoke_writing | 22 |
| smoke_character_runtime | 14 |
| smoke_ai_access | 5 |
| smoke_workspace | 20 |
| smoke_multipath | 29 |
| smoke_assistant | 28 |
| 合计 | **220 passed / 0 failed** |

## 5. 未完成与风险

| # | 问题 | 影响 | 建议 |
| --- | --- | --- | --- |
| A1 | 多路径接口不在 AI 请求头白名单 | 07 多路径入口无法使用访客 Key/模型 | 阶段 B 修复（1 行路径规则） |
| A2 | 07 AI 错误返回 500 | 前端错误文案不统一 | 阶段 B 统一为 502 + 错误码 |
| A3 | 08 流式错误 HTTP 200 | 调用方无法区分成功/失败 | 阶段 B 在流首帧加错误标记或事件 |
| A4 | probe 不校验模型 | 误判「模型可用」 | 文档标注；或改为可选 models 校验 |
| A5 | 只传模型不带 Key 被忽略 | 用户以为切换了模型 | 「AI 接入」说明 + 模型选择依赖 Key |
| A6 | `SimulationPage`/`api/writing.ts` 硬编码 `127.0.0.1:8000` | 依赖全局 fetch 桥；桥未安装时线上失效 | 阶段 B 改为统一 `API_ORIGIN` |
| A7 | 生产环境未验证 | 无法确认 Render/Vercel 上的真实行为 | 需部署后复测（本环境无法访问外网 GitHub/Vercel） |

## 6. 阶段 A 结论

- 第一阶段的「统一 AI API 接入」在**代码层面完整**，07、08 均未保留独立连接配置。
- 「模型选择生效」成立的前提是：**请求携带访客 Key**；仅换模型不换 Key 时按设计忽略。
- 真实调用证据充分（两种模型、07/08 各自成功 + 负向对照）。
- 阶段 B 必须先修 A1/A2/A3/A6，再谈 07/08 的多路径入口，否则入口会绕过统一接入。
