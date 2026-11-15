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

前端部署在 Vercel；FastAPI 后端实际部署在 **Fly.io**：

- 后端地址：`https://backend-lingering-moonbeam-4274.fly.dev`
- Fly 配置：`backend/fly.toml`，应用 `backend-lingering-moonbeam-4274`，区域 `nrt`
- 持久卷：`world_sim_data` 挂载到 `/data`
- 数据库：SQLite `/data/worlds.db`（`DB_PATH`）
- 上传文件：`/data/uploads`（`WS_UPLOAD_DIR`）
- 部署命令（在 `backend/` 下）：

```bash
fly deploy
```

Fly secrets 至少需要：`DEEPSEEK_API_KEY`。如果使用 S3/R2，再设置
`WS_STORAGE_BACKEND=s3`、`WS_S3_BUCKET`、`WS_S3_ENDPOINT`、`WS_S3_REGION`、
`WS_S3_ACCESS_KEY`、`WS_S3_SECRET_KEY`、`WS_S3_PUBLIC_BASE`。

2. 在 Vercel 项目 Settings → Environment Variables 设置：

```env
VITE_API_BASE_URL=https://backend-lingering-moonbeam-4274.fly.dev
```

3. 重新部署前端。入口的 API 桥接会把代码里默认的
   `http://127.0.0.1:8000` 自动改写为 `VITE_API_BASE_URL`。
4. 后端 CORS 已允许 `https://app.psyengine.top`、`https://world-simulator-elht.vercel.app` 及本项目 Vercel 预览域名；
   额外域名写入 `WS_CORS_ORIGINS`（逗号分隔）。
5. 首次上线后访问前端，会进入开发者账号初始化；初始化完成后在
   **设置 → 账户与安全 → 邀请码与公开注册** 生成邀请码。注册必须由服务端校验并消耗邀请码。
6. 公开注册相关环境变量：

```env
WS_REGISTRATION_ENABLED=1      # 0 关闭公开注册
WS_INVITE_REQUIRED=1           # 1 必须邀请码
WS_EMAIL_MODE=off              # off | dev | smtp
WS_SETUP_TOKEN=                # 可选：初始化开发者账号的额外令牌
```

`off` 表示不发邮件；`dev` 只在后端日志输出验证码，适合内测；`smtp` 需要配置
`WS_SMTP_HOST/PORT/USER/PASSWORD/FROM`（SSL/TLS 分别用 `WS_SMTP_SSL`、`WS_SMTP_TLS`）。

媒体存储可在本地磁盘与 S3 兼容对象存储之间切换：

```env
WS_STORAGE_BACKEND=local       # local | s3
WS_S3_BUCKET=
WS_S3_ENDPOINT=                # R2/MinIO 等自定义端点
WS_S3_REGION=auto
WS_S3_ACCESS_KEY=
WS_S3_SECRET_KEY=
WS_S3_PUBLIC_BASE=             # 可选 CDN/公开访问域名
```

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

## 数据安全与人物档案

- **人物传记**：人物卡片「传记」聚合生平事件、推演行动、成长记录，一键生成自传；无 AI 时回退本地整理版。
- **全局归档**：旧世界、退场人物、旧章节封存，不参与当前推演，可随时解除。
- **全局回收站**：人物/世界/章节/地点/事件/组织/关系删除前保存快照，可恢复或彻底丢弃。
- **时光机**：对整个世界所有业务表打快照，一键回滚到任意快照。
- **官方演示世界**：首次启动内置并锁定《凡人修仙传》，不可删除，可一键重置为初始数据。

详细说明见 `docs/T100-归档回收站时光机与传记.md`。

## 构建与检查

```bash
npm run build
npm run lint
python backend/tests/smoke_flow.py
python backend/tests/smoke_writing.py
python backend/tests/smoke_character_runtime.py
python backend/tests/smoke_ai_access.py
python backend/tests/smoke_workspace.py
```

## Git / Vercel

- 主分支：`main`
- GitHub：`https://github.com/lan597139-art/world-simulator`
- Vercel：`https://world-simulator-elht.vercel.app`

推送到 `main` 后，Vercel 的 Git 集成会自动构建并发布 `dist/`。

当前仓库的改动已提交到 `main` 并推送到 GitHub；Vercel 会按 Git 集成自动构建。
Fly 后端需要单独执行 `fly deploy` 才能带上最新代码。部署后在 Vercel 确认
`VITE_API_BASE_URL` 指向 `https://backend-lingering-moonbeam-4274.fly.dev`，
并完成一次真实注册/登录回归。

`render.yaml` 仅作为备用部署方案保留，不是当前线上环境。
