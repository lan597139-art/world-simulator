# 世界模拟器 World Simulator

一个面向长篇小说创作的世界模拟与写作工作台：世界建设、人物种子/运行态、关系与组织、事件推演、时间线与 08 双轨写作。

## 技术栈

- 前端：React 19 + TypeScript + Vite
- 后端：FastAPI + SQLAlchemy + SQLite
- AI：OpenAI 兼容接口（当前使用硅基流动）

## 本地开发

```bash
# 1. 后端
cd backend
cp .env.example .env        # 填入自己的 DEEPSEEK_API_KEY
../venv/bin/uvicorn main:app --reload --port 8000

# 2. 前端（仓库根目录）
npm install
npm run dev                 # http://localhost:5173
```

`backend/.env`、SQLite 数据库、`__pycache__`、`venv` 都是本地文件，不会进入 Git。

## 部署结构

前端可以部署在 Vercel，但 **FastAPI 后端不能只靠 Vercel 静态站点**。线上需要：

1. 一个可公网访问的 FastAPI 后端，并给 SQLite 配持久磁盘（Render / Railway / Fly.io 等）。
   仓库已包含 `backend/Dockerfile`、`backend/requirements.txt` 和 `render.yaml`：
   Render 新建 Blueprint 指向本仓库即可，挂载 `/data`，数据库地址为
   `sqlite:////data/world_simulator.db`。把 `DEEPSEEK_API_KEY` 填在 Render 环境变量里。
2. 在 Vercel 项目 Settings → Environment Variables 设置：

```env
VITE_API_BASE_URL=https://你的后端域名
```

3. 重新部署前端。入口的 API 桥接会把代码里默认的
   `http://127.0.0.1:8000` 自动改写为 `VITE_API_BASE_URL`。
4. 后端 CORS 已允许 `https://world-simulator-elht.vercel.app` 及本项目 Vercel 预览域名。

没有设置 `VITE_API_BASE_URL` 时，线上页面会尝试访问访客自己的 `127.0.0.1:8000`，只能用于“本机后端 + 线上前端”的开发调试。

## 访客自带 API Key（BYOK）

公开网站不应让所有访客消耗站长额度。现在支持两种模式：

- 访客点击顶栏 **AI 接入**，填写自己的 API Key / Base URL / 模型。
- Key 只保存在访客浏览器 `localStorage`，只在 AI 请求中通过
  `X-AI-API-Key`、`X-AI-Base-URL`、`X-AI-Model` 请求头发送，服务端不落库、不写日志。
- 站长共享 Key 由 `AI_SERVER_KEY_ENABLED` 控制：
  - 本地默认 `true`，方便自己开发；
  - 公开部署建议 `false`，未填写 Key 的访客不能调用 AI。
  - `render.yaml` 已默认设置为 `false`。
- 后端只接受 HTTPS 公网 Base URL，并阻止 localhost/内网地址，避免 SSRF。

## AI 配置（站长共享 Key）

`backend/.env`：

```env
DEEPSEEK_API_KEY=你的密钥
DEEPSEEK_BASE_URL=https://api.siliconflow.cn/v1
DEEPSEEK_MODEL=deepseek-ai/DeepSeek-V4.1-Flash
```

Key、Base URL、模型都会在每次调用前重新读取，修改后无需重启后端。
使用访客 Key 时，访客配置优先于 `.env`，且不同访客的客户端不会串用。

## 构建与检查

```bash
npm run build
npm run lint
python backend/tests/smoke_flow.py
python backend/tests/smoke_writing.py
python backend/tests/smoke_character_runtime.py
```

## Git / Vercel

- 主分支：`main`
- GitHub：`https://github.com/lan597139-art/world-simulator`
- Vercel：`https://world-simulator-elht.vercel.app`

推送到 `main` 后，Vercel 的 Git 集成会自动构建并发布 `dist/`。
