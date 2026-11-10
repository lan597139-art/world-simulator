# 全局 AI 助手接入完成报告（补 `/api/assistant/chat`）

背景：全局 AI 助手面板（`src/components/AIAssistantPanel.tsx`）此前已挂载，但后端 `POST /api/assistant/chat` 缺失，发送必 404。
本阶段补齐该接口，并加入上下文压缩与受控动作校验。

---

## 1. 接口契约

`POST /api/assistant/chat`

请求：
```json
{
  "messages": [{"role": "user|assistant", "content": "..."}],
  "context": {
    "page": "events",
    "page_label": "事件管理",
    "world_id": "...",
    "entity_type": "event",
    "entity_id": "...",
    "form": {"title": "...", "fields": [{"label": "事件名称", "name": "name", "type": "text", "value": "..."}]},
    "selection": "用户选中文本"
  }
}
```

响应：
```json
{
  "reply": "中文回答",
  "actions": [],
  "context_label": "世界：凡人修仙传 · 页面：事件管理 · 对象：欺骗暴露"
}
```

- AI 配置走既有请求级中间件（`X-AI-API-Key` / `X-AI-Base-URL` / `X-AI-Model`），访客 Key 与站长 Key 互不串用。
- 未配置 Key → `503` + 中文提示；上游异常经 `ai_error_message` 转译为额度/鉴权/限流/超时/网络等中文文案，返回 `502`。

## 2. 上下文注入（只读）

服务端只读取必要摘要，不整库外发：

- 世界：名称、类型、背景（≤700 字）、六轴、人物数、最近 6 条主时间线事件。
- 当前对象：按 `entity_type` 读取人物/事件/章节/世界/地点/组织摘要（字段截断）。
- 表单：最多 40 个字段，标签/名称/类型/值（值 ≤300 字）。
- 选中文本：≤500 字。
- 历史：最近 18 条，仅 `user` / `assistant`，单条 ≤3000 字。

## 3. 动作白名单（前端二次确认后执行）

| type | 约束 |
| --- | --- |
| `fill_form` | `fields` 的键必须命中当前表单可见字段 label；值必须是标量 |
| `update_entity` | `entity_type` ∈ 六类；`entity_id` 必须等于当前上下文对象 ID；`fields` 键按类型白名单（world/character/event/story/location/organization） |
| `navigate` | `page` 必须是已注册页面 key |

- 其他类型（如 `delete_entity`）一律丢弃；单次最多 4 个动作；文本字段截断。
- 提示词明确禁止删除/清空/归档/覆盖主时间线等不可逆操作。

## 4. 验收

### 4.1 后端用例 `backend/tests/smoke_assistant.py`（17 项，全通过）

- 空消息 422；正常对话返回 reply；`context_label` 正确拼接。
- prompt 注入世界、对象、表单字段、选中文本、动作白名单；历史角色过滤。
- 动作清洗：数量上限、危险动作丢弃、`fill_form` 非可见字段丢弃、`update_entity` 越权 ID 与非法字段丢弃、`navigate` 非法页面丢弃。
- 无上下文可用；空回复兜底；无 Key → 503；额度不足 → 502 中文提示。

### 4.2 全量回归（209 项，全通过）

```
smoke_flow              102 passed
smoke_writing            22 passed
smoke_character_runtime  14 passed
smoke_ai_access           5 passed
smoke_workspace          20 passed
smoke_multipath          29 passed
smoke_assistant          17 passed
```

### 4.3 浏览器实测（真实 Key）

Headless Chrome，官方演示世界，打开面板 → 输入「用一句话说明你能做什么」→ 收到真实回复：

> 我是世界模拟器的全局操作助手，能帮你查看和修改这个世界的信息，比如背景、角色、事件等，也可以帮你跳转到不同页面。

并显示上下文标签「世界：凡人修仙传 · 页面：01 世界总览」；无 404、无控制台异常。

## 5. 未做 / 限制

- 单轮请求-响应，无流式输出；历史仅保存在前端 localStorage（当前未持久化到后端）。
- 动作仅 3 类，且执行完全在前端（含 `window.confirm`），后端不代执行写操作。
- 上下文未包含关系网络、分支快照等大对象；如需「按分支提问」，后续可在 `context` 增加 `branch_id` 并复用 `dump_world`。
