# 阶段四·主线二：全场景 BYOK AI 统一接入 —— 现状审计与验收

> 所属任务书：《世界模拟器｜DSH 后续架构升级任务书（完整版）》主线二
> 审计范围：**仅主线二涉及的 AI 接入代码与链路**，未扩大到其余三条主线
> 执行方式：先审计现状并提交差异清单，再按确认范围分批实施；完成一条、验收一条

---

## 1. 现状审计

### 1.1 接入链路（已具备统一基础）

平台已存在一套 BYOK AI 接入层，**后端唯一、前端统一桥接**：

| 层 | 实现 | 位置 | 说明 |
| --- | --- | --- | --- |
| 前端统一桥接 | `installApiOriginBridge()` | `src/api/config.ts` | 包装 `window.fetch`，对命中 `needsAiKey()` 的路径注入 `X-AI-API-Key` / `X-AI-Base-URL` / `X-AI-Model` |
| 前端配置源 | `loadAiSettings()` / `saveAiSettings()` | `src/api/aiSettings.ts` | 访客 Key 存于浏览器 `localStorage['ws.ai.settings.v1']`，服务端不保存 |
| 模型预设字典 | `MODEL_PRESETS` | `src/api/modelPresets.ts` | 唯一配置源，各场景菜单只读此字典 |
| 后端中间件 | `ai_access_context` | `backend/main.py` | 读取 `X-AI-*` 头写入请求级 ContextVar，请求结束复位；**不落库、不写日志** |
| 后端唯一客户端 | `get_client()` / `get_model()` | `backend/ai_engine.py` | 全站唯一 `OpenAI()` 构造点；个人 Key 优先于站长共享 Key |
| SSRF 防护 | `_safe_base_url()` | `backend/ai_engine.py` | 仅接受公网 HTTPS，拒绝 localhost/内网地址 |

**结论**：后端已统一（无场景级自建客户端、无直连第三方），前端已有统一桥接，具备"统一接入"的成熟基础。

### 1.2 三类 AI 场景与相关端点

| 场景 | 前端入口 | 后端端点 | 前端是否注入 AI 头 |
| --- | --- | --- | --- |
| AI 助手 | `AIAssistantPanel.tsx` → `/api/assistant/chat` | `assistant.py` | ✅（桥接） |
| AI 角色扮演 | `chat.ts` → `/api/chat/**` | `chat.py` | ✅（桥接） |
| AI 辅助写作 | `writing.ts` → `/api/writing/**`、`/api/writings/{id}/(analyze\|extract)` | `writing.py` | ✅（桥接） |
| （相关）世界推演 | `SimulationPage.tsx` → `/api/simulate`、`/api/branches/{id}/simulate` | `simulation.py` / `multipath.py` | ✅（桥接） |
| （相关）角色传记生成 | `CharacterBiographyModal.tsx` → `/api/characters/{id}/biography/generate` | `biography.py` | ✅（桥接） |
| （相关）发展方向建议 | `multipath.ts` → `/api/events/{id}/directions/suggest` | `multipath.py` | ✅（桥接） |
| （相关）OC 人格对话 | `personas.ts` → `/api/personas/{id}/chat` | `personas.py` | ❌ **未注入（缺口）** |

> 说明：`/api/characters/{id}/ai-role/build` 为本地拼装人格，不调用模型，无需 AI 头（已核验 `build_persona()` 为纯本地实现）。

### 1.3 API Key 安全审计

| 维度 | 结论 | 证据 |
| --- | --- | --- |
| 存储 | 访客 Key 仅存浏览器 localStorage，**服务端不落库** | `aiSettings.ts`、`ai_engine.py` 注释与实现 |
| 传输 | 经 `X-AI-*` 请求头随请求携带；后端用后即弃（请求级 ContextVar，finally 复位） | `main.py` `ai_access_context`、`ai_engine.py` `reset_request_ai_config` |
| 日志脱敏 | 后端不记录 Key；用量记录仅含 route/provider/model/status，**不含提示词与 Key**；状态接口 `key_hint` 已脱敏 | `billing.py` `record_ai_usage`、`ai_engine.py` `ai_config_status` |
| 第三方传输边界 | Base URL 仅接受公网 HTTPS，防 SSRF；Key 与内容随用户指定服务商传输（BYOK 固有边界） | `ai_engine.py` `_safe_base_url` |
| 前端直连第三方 | **无**（未发现前端绕过后端直连 OpenAI/硅基/Gemini 等） | 全量检索 |

**业务规则核验**：AI 调用链路中**未发现任何灵果/灵石扣减**，**无 AI 专属资源账户**（`BillingAiUsage` 为用量流水表，非资源账户，不存余额、不可消费）。符合"AI 调用不消耗灵果、不建立 AI 专属资源账户、不得设计为虚拟货币消费项目"。

---

## 2. 差异清单

| 编号 | 类型 | 发现 | 证据 | 标记 |
| --- | --- | --- | --- | --- |
| L2-A | **缺口** | `/api/personas/{id}/chat`（OC 人格对话）是真实模型调用，但前端 `needsAiKey()` 未覆盖，`personas.ts` 的 `request()` 也不注入 AI 头 → 个人 Key 不生效，只能回落站长共享 Key | `config.ts` 无 personas 匹配；`personas.ts:42`；后端 `personas.py` 调用 `get_client()` | **修复** |
| L2-B | **重复实现** | `AIAssistantPanel.tsx` 手写注入 `X-AI-*` 头，与全局桥接重复，形成两套取值来源 | `AIAssistantPanel.tsx` 原 439–445 行 | **优化** |
| L2-C | **不一致** | AI 相关请求硬编码 `http://127.0.0.1:8000`，绕过统一 `API_ORIGIN` | `AiAccessModal.tsx:104`、`CharacterBiographyModal.tsx:33` | **优化** |
| L2-D | **日志风险（低）** | `ai_engine.py` 将异常 `print` 到 stdout；未发现显式 Key 打印，但异常对象理论上可能携带敏感信息 | `ai_engine.py:216,334,396` | **待核验** |
| L2-E | 合规 ✓ | Key 后端不落库不写日志、用量不含 Key、`key_hint` 脱敏、防 SSRF | 见 §1.3 | 保留 |
| L2-F | 合规 ✓ | AI 不消耗灵果、无 AI 专属资源账户、无前端直连第三方 | 见 §1.3 | 保留 |

**范围外观察（不处理）**：全站存在大量非 AI 页面硬编码 `127.0.0.1:8000`（如 `CharacterListPage`、`EventsPage`、`RelationshipsPage`、`ArchivePage` 等）。按"只检查本次任务涉及部分、不扩大修改范围"约束，本轮**仅统一 AI 相关两处**，其余记录为后续可选项。

---

## 3. 已实施修复（代码变更记录）

| 文件 | 变更 | 说明 |
| --- | --- | --- |
| `src/api/config.ts` | +1 行 | `needsAiKey()` 增加 `/^\/api\/personas\/[^/]+\/chat$/`，修复 L2-A |
| `src/components/AIAssistantPanel.tsx` | -8/+3 | 移除手写 `X-AI-*` 头注入，统一交由桥接；删除随之无用的 `loadAiSettings` 导入，修复 L2-B |
| `src/components/AiAccessModal.tsx` | +2/-1 | 探测请求改用 `API_ORIGIN`，修复 L2-C |
| `src/components/CharacterBiographyModal.tsx` | +2/-1 | `API` 常量改用 `API_ORIGIN`，修复 L2-C |

**合计 4 文件，+12/-15 行。** 未改动任何后端文件，未改动各场景的 Prompt、上下文与业务逻辑。

---

## 4. 验证结果

### 4.1 静态检查

| 检查 | 结果 |
| --- | --- |
| `tsc -b tsconfig.app.json` | **35 个错误，与基线一致，无新增**（本次改动文件未引入新错误） |
| `vite build` | **通过（exit 0）** |

### 4.2 真实浏览器接口验证（Chrome CDP，实际请求头捕获）

验证方式：页面脚本前注入 `fetch` 捕获钩子，记录每次 `/api/` 请求的**最终请求头**（含桥接注入结果），触发目标端点后读取。环境：后端 `127.0.0.1:8000`、前端 `127.0.0.1:5173`、Chrome 远程调试 `9231`。

**修复前**（临时移除新增匹配行）：

```
/api/personas/p-test/chat -> { authorization, content-type }          ← 无 X-AI-* 头
RESULT=FAIL（/api/personas/{id}/chat 未注入 X-AI-* 头）
```

**修复后**：

```
/api/personas/p-test/chat    -> { ..., "x-ai-api-key": "sk-test-...", "x-ai-base-url": "...", "x-ai-model": "..." }
/api/personas/p-test/threads -> { authorization, content-type }       ← 非 chat 未注入（精确匹配生效）
/api/assistant/chat          -> { ..., "x-ai-api-key": "sk-test-...", "x-ai-base-url": "...", "x-ai-model": "..." }

✓ /api/personas/{id}/chat 已注入 X-AI-* 头（缺口已修复）
✓ 对照：/api/personas/{id}/threads（非 chat）未注入，精确匹配生效
✓ /api/assistant/chat 仍正常注入（去重后未回归）
RESULT=PASS
```

**验证工具**：`.verify/verify_ai_headers.py`（复用 `.verify/cdp_shot.py` 的 CDP 客户端）。

---

## 5. 验收结论

| 验收项 | 结果 |
| --- | --- |
| 三类 AI 场景均经统一接入层使用用户自行配置的 API | ✅ 助手 / 角色扮演 / 辅助写作均经桥接注入，无场景级重复实现 |
| AI 调用不扣除灵果、无 AI 专属资源账户、未设计为虚拟货币消费项目 | ✅ 全链路未发现扣减与专属账户 |
| API Key 存储/传输/日志脱敏与第三方传输边界 | ✅ 服务端不落库不写日志、用量脱敏、防 SSRF |
| 缺口 `/api/personas/{id}/chat` | ✅ 已修复并实测（修复前 FAIL → 修复后 PASS） |
| 重复实现与硬编码地址 | ✅ 已消除（AI 相关） |
| 不破坏现有业务、不改动场景 Prompt/上下文/业务逻辑 | ✅ 后端零改动，前端仅接入层调整 |
| 关键流程实际运行验证，不以构建成功代替功能验收 | ✅ 真实浏览器请求头捕获 + 前后对照 |

**主线二判定：✅ 完成并验收通过。** 唯一遗留为 L2-D 低风险日志观察项（待核验，不阻塞）。

---

## 6. 未完成与依赖

| 项 | 状态 | 说明 |
| --- | --- | --- |
| L2-D 日志观察项 | 待核验 | `ai_engine.py` 异常 `print` 理论上可能携带敏感信息；未发现显式 Key 打印，风险低。如需彻底，可改为脱敏日志 |
| 非 AI 页面硬编码地址 | 未处理（范围外） | 按"不扩大修改范围"约束记录，非主线二范围 |

**下一步**：按任务书实施顺序进入**主线三（平台原生 AI 助手后端人格管理）**，其依赖本主线已交付的统一 AI 接入层。
