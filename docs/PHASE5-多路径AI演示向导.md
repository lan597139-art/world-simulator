# 多路径推演页「一键 AI 演示向导」实现说明

目标：在 `multipath` 页提供「✨ 观看 AI 演示本页」，点一下即可让全局 AI 助手边解释边真实操作页面（选事件 → 填分支名 → 建分支）。

---

## 1. 页面侧改动（仅一个按钮 + 锚点）

- 顶部标题行新增一个按钮：`✨ 观看 AI 演示本页`（`data-ai-id="ai-demo-trigger"`），未改动任何既有布局。
- 为演示路径上的关键控件加 `data-ai-id` 锚点（纯属性，无样式/结构变化）：
  - 事件按钮：`event-<id>`
  - 分支名称输入框：`branch-name`
  - 新建分支：`create-branch`
  - 方向建分支：`branch-from-direction-<id>`
  - 开始推演：`simulate-branch`
- 点击按钮派发 `ws:assistant-demo` 事件，携带一段**不显示在对话里的隐藏指令**；面板展开后自动发送。

## 2. 助手侧扩展

### 2.1 上下文

请求新增两个字段：

- `demo: true`：启用「新手导师」提示词。
- `dom_targets`：页面可操作锚点清单（最多 40 项，`ai_id / kind / label / tag`）。
  - **排除演示入口自身**，避免 AI 递归触发演示。

### 2.2 新增动作

```json
[
  {"type": "click", "ai_id": "event-<id>", "summary": "第一步：选中事件"},
  {"type": "fill", "id": "branch-name", "value": "演示分支：隐忍", "summary": "第二步：填分支名"},
  {"type": "click", "ai_id": "create-branch", "summary": "第三步：新建分支"}
]
```

兼容写法：`click` 也可用 `text`（精确匹配 `dom_targets` 的 label）或 `selector`（仅允许 `[data-ai-id="已知 id"]`）。

### 2.3 服务端校验（`backend/assistant.py`）

- `click.ai_id` 必须存在于本次 `dom_targets`；`text` 必须匹配某个 label；`selector` 仅接受已知锚点写法。
- `fill.id` 必须是 `dom_targets` 中 `kind=input` 的锚点，值截断 200 字。
- 仍沿用最多 4 个动作 + 丢弃未识别类型；`demo=false` 时不注入导师提示词。

### 2.4 前端执行（`src/api/assistantDom.ts`）

- `collectDemoTargets()`：采集可见锚点。
- `highlightDemoTarget()`：描边 + 光圈高亮 1.6 秒，自动滚动到可视区。
- `executeDemoAction()`：`click` 先高亮再原生点击；`fill` 用原生 value setter + `input/change` 事件写入受控组件。
- 演示模式下按顺序自动执行，每步在气泡里显示「正在执行… → 已点击/已填入」；失败即停止并展示原因。
- 普通对话中的 `click/fill` 仍显示为动作卡片，需用户手动点「点击此处 / 填入此处」。

## 3. 验收

### 3.1 后端（`backend/tests/smoke_assistant.py`，28 项全通过）

新增 7 项：

- 演示模式动作 ≤ 4；
- `click` 使用合法 `ai_id`；
- `fill` 写入输入框且值正确；
- 越权 `ai_id` 被丢弃；
- `fill` 落到按钮上被丢弃；
- 演示 prompt 含导师模式与 `dom_targets`；
- 普通对话不注入演示指令。

### 3.2 浏览器端到端（真实 AI，官方演示世界）

- 按钮存在且可见 → 点击后面板自动展开；
- 用户气泡显示 `✨ 观看 AI 演示本页`（隐藏指令本身不显示）；
- AI 回复含「第 1/2/3 步」，并返回 3 个动作；
- 观察到高亮框（`[data-ai-demo-highlight]`）；
- 分支名称输入框被填入「演示分支：隐忍」；
- 三步依次执行：`已点击「韩立反杀墨居仁」` → `已填入「演示分支：隐忍」` → `已点击「新建分支」`，分支实际创建成功；
- 无控制台异常。测试后已删除该演示分支，官方世界无残留。

### 3.3 回归

`102 + 22 + 14 + 5 + 20 + 29 + 28 = 220` 项全通过；`tsc --noEmit` 与 `vite build` 通过。

## 4. 限制

- 演示能否完整走完仍取决于模型是否一次返回 3 个动作；提示词已强制要求，实测连续 3 次均返回完整三步。
- 动作只允许命中 `data-ai-id` 锚点，避免误点其他控件；不提供删除/覆盖类动作。
- 演示不点击「开始分支推演」，避免误耗 AI 额度；只在回复里指出按钮位置。
