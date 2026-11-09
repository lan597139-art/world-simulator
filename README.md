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
2. 在 Vercel 项目 Settings → Environment Variables 设置：

```env
VITE_API_BASE_URL=https://你的后端域名
```

3. 重新部署前端。入口的 API 桥接会把代码里默认的
   `http://127.0.0.1:8000` 自动改写为 `VITE_API_BASE_URL`。
4. 后端 CORS 已允许 `https://world-simulator-elht.vercel.app` 及本项目 Vercel 预览域名。

没有设置 `VITE_API_BASE_URL` 时，线上页面会尝试访问访客自己的 `127.0.0.1:8000`，只能用于“本机后端 + 线上前端”的开发调试。

## AI 配置

`backend/.env`：

```env
DEEPSEEK_API_KEY=你的密钥
DEEPSEEK_BASE_URL=https://api.siliconflow.cn/v1
DEEPSEEK_MODEL=deepseek-ai/DeepSeek-V4.1-Flash
```

Key、Base URL、模型都会在每次调用前重新读取，修改后无需重启后端。

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
