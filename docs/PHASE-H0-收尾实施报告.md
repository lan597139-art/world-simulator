# H0 收尾实施报告

日期：2026-11-11  
范围：第一阶段验收缺陷修复 + CI 入口。  
结论：G-01、G-02、G-08 已关闭；G-05（部署复测）仍待环境。

---

## 1. 修复项

| ID | 问题 | 修复 | 验证 |
| --- | --- | --- | --- |
| G-01 | 仅传 `X-AI-Model`、共享 Key 时模型被忽略 | `ai_engine.set_request_ai_config` 允许"只有 model"；`_read_config` 在无个人 Key 时仍采用请求模型，Base URL 仍只随个人 Key 生效 | `smoke_ai_access`「共享 Key 下模型头生效」 |
| G-02 | 聊天 AI 端点未注入个人 Key | `src/api/config.ts` 白名单新增 `/api/chat/` | 代码检查；`tsc`/build |
| G-08 | 测试未接 CI | 新增 `.github/workflows/backend.yml`：启动 API + 10 套件 + 迁移演练；`requirements.txt` 补 `httpx` | 工作流文件；本机同命令通过 |

安全边界：

- 无个人 Key 时**不接受**请求 Base URL，避免把共享 Key 发往任意地址；
- 模型名仍限制 120 字符；
- 个人 Key 逻辑不变，仍不落库、不写日志。

---

## 2. 自动化结果

- `backend/tests/run_all.sh`：**357 passed / 0 failed / 10 suites**。
- 迁移副本演练：M001–M020 全通过，56 表。
- `tsc`、`vite build` 通过。

新增断言：

- `共享 Key 下模型头生效`：`using_personal_key=false` 且 `model=请求模型`。

---

## 3. 真实调用复核

两模型真实矩阵沿用 `backend/tests/live_ai_matrix.py`；本次修复不改变个人 Key 路径，矩阵结果仍为 10/10（见 `docs/evidence/PHASE-H-live-ai-matrix.json`）。

建议在部署复测时补一次"共享 Key + 仅模型头"的真实生成调用，确认路由到目标模型。

---

## 4. 仍未关闭

- **G-05 部署复测**：缺部署地址/凭据；本地不能替代。
- CI 工作流需在 GitHub 实际跑一次（本环境无法访问 GitHub Actions）。

---

## 5. 结论

第一阶段的两项代码缺陷已修复并有回归断言；CI 入口已建立。待部署地址后完成 G-05，即可把第一阶段从"有条件通过"更新为"通过"。
