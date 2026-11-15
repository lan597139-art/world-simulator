# 多用户与创作资产建设验收（阶段 A–E）

日期：2026-11-15
范围：`world-simulator` 前端、FastAPI 后端、Fly.io/Vercel 部署配置。

## 结论

- **阶段 A（后端/数据库）**：已部署在 Fly.io，公网域名为 `https://api.psyengine.top`（Fly 应用 `backend-lingering-moonbeam-4274`）。使用持久卷 `/data` 上的 SQLite 数据库 `/data/worlds.db`，上传目录 `/data/uploads`。Let's Encrypt 证书已签发；`/api/health`、`/api/auth/status`、`app.psyengine.top` 的 CORS 预检、生产环境组织写入与图片上传/静态读取均已实测通过。最新代码已 `fly deploy` 到机器 version 4。
- **阶段 B（注册/登录/会话/邀请码）**：已完成并通过 API 与浏览器验收。邀请码由服务端哈希保存、条件更新原子消耗；支持 `off|dev|smtp` 邮箱验证；登录支持用户名/邮箱。
- **阶段 C（前后端连接/数据隔离/IndexedDB）**：核心路径已完成。世界、人物、事件、地点、组织、关系、章节等已接入统一访问守卫；IndexedDB 新增按用户隔离的草稿、备份、媒体索引；写作保存会先落本地再同步后端。
- **阶段 D（资料/头像/媒体/存储）**：部分完成。头像图片上传、创作者媒体库、S3 兼容存储适配器、本地备份/导出已完成；SMTP 与 S3 真实凭据未配置，未做云上回归。
- **阶段 E（液态玻璃视觉）**：已完成。设置中心新增背景图 URL/上传、背景透明度、背景模糊度、玻璃模糊度、玻璃透明度、辉光强度六个即时控件；皮肤与四档玻璃强度保留；所有值写入浏览器本地并全局应用，支持 `prefers-reduced-motion` 降级。

## 已验收项

| 项目 | 结果 | 证据 |
| --- | --- | --- |
| 前端生产构建 | 通过 | `vite build` 退出 0；产物 `dist/assets/index-*.js`（Vercel 产物 `index-CYtd7EIr.js` / CSS `index-BYuilfjf.css`，已包含本轮修复） |
| TypeScript | 通过 | `tsc --noEmit` 退出 0 |
| 现有认证回归 | 13/13 通过 | `backend/tests/smoke_auth.py` |
| 全量后端回归 | 690/690 通过 | `backend/tests/run_all.sh`，25 个套件 |
| 迁移演练 | 51/51 通过 | `backend/migrations/rehearse.py`，重复执行无新增 |
| 未登录访问 `/api/worlds` | 401 | 冒烟测试 |
| 邀请码注册 | 通过 | 真实 API 注册，邀请码 1 次用完后再次注册返回 409 |
| 邀请码并发上限 | 通过 | 条件更新 `used_count < max_uses` |
| 邮箱验证（dev） | 通过 | `WS_EMAIL_MODE=dev`，验证码验证后创建用户；重放返回 404 |
| 登录（用户名/邮箱） | 通过 | API + 无头 Chrome 表单登录 |
| 登出/过期会话 | 通过 | `smoke_auth` |
| 新用户世界隔离 | 通过 | 新账号只看到官方世界；访问他人世界/人物返回 404 |
| 官方世界只读 | 通过 | 新账号写入官方世界事件返回 403 |
| 头像上传 | 通过 | 上传 PNG，`/uploads/...` 返回 200 `image/png`，资料保存成功 |
| 本地草稿隔离 | 通过 | IndexedDB 记录带 `userId`，设置页显示 1 份草稿并可清空 |
| 创作者资产 | 通过（前次验收） | 文件夹树、资产 CRUD、发布、引用保护删除 |
| 跨用户隔离回归 | 通过 | 新账号读取他人会话/故事返回 404；他人回收站条目不可见、不可删；旧 `local` 数据对开发者保留 |
| 上传静态服务 | 通过 | `/uploads/...` 返回 200 `image/png`，并支持 `WS_UPLOAD_DIR` |
| 液态玻璃皮肤 | 通过 | 设置 → 使用体验：皮肤/四档玻璃强度 + 背景图/透明度/模糊/辉光即时控件 |
| 生产静态上传 | 通过 | `api.psyengine.top` 上传 PNG，`/uploads/...` 返回 200 `image/png` |
| 生产最新后端 | 通过 | Fly 机器 version 4；组织创建/删除、认证状态、CORS 均正常 |
| 生产 UI E2E | 通过 | `app.psyengine.top` 测试账号登录：3 个密码框眼睛图标、背景/模糊/透明度/辉光面板均渲染；账号与邀请码已清理 |
| 全局背景图 | 通过 | 真实 `#app-background` 固定层 + `.app-shell/.main-area` 透明；本地红/棋盘背景截图像素采样可见，侧栏 86% 透明 + blur |
| 液态玻璃 | 通过（支持 WebGL2 的浏览器） | 4 个创作场景卡片各挂载 canvas，`data-liquid-glass="webgl"`；无 WebGL2 时保留 CSS 毛玻璃兜底 |
| 头像同步 | 通过 | 顶栏/用户与身份中心优先渲染 `avatar_url`，`AuthUser` 同步写回 `ws.authUser`；测试上传头像后刷新仍显示 |
| 悬浮按钮拖拽 | 通过 | AI 云宝按钮 pointer 拖拽、视口边界限制、`ws.assistant.fab.position.v1` 持久化，拖拽不误触打开 |

## 尚未完成 / 需要账号或凭据

1. **Vercel 冗余项目清理**：最新提交在 GitHub 上只显示一个 `Vercel` 检查，`app.psyengine.top` 已更新到本轮产物；若 Vercel 控制台仍保留 `world-simulator-czq2`、`world-simulator-j9gr`、`world-simulator`，请删除，只保留 `world-simulator-elht`。本环境没有 Vercel 登录凭据，无法代为删除。
2. **Fly 不休眠限制**：`fly.toml` 已改为 `auto_stop_machines = "off"`、`min_machines_running = 1`，机器当前为 started。若 Fly 账户未绑卡，平台仍可能强制停机；彻底消除 5 分钟休眠需要绑定付款方式或换常在线托管。
3. **真实邮件**：`WS_EMAIL_MODE=smtp` 需要 SMTP 主机、账号、发件人；当前线上为 `off`，`dev` 仅日志验证码。
4. **对象存储**：当前线上使用 `/data/uploads` 持久卷；如迁移到 S3/R2，需要 bucket、endpoint、AK/SK、公开域名。
5. **线上回归**：本地 `run_all.sh` 已 690/690 通过；生产已实测健康、CORS、认证、组织写入与上传。真实邀请码注册/登录仍建议用一次性测试账号走一遍后清理。
6. **社区/账单等模块的跨用户边界**：已由统一守卫覆盖世界与实体 ID 路径；仍建议对导出、搜索、归档等低频接口做一次人工抽查（见隔离审计）。

## 关键实现位置

- `backend/auth.py`：注册、验证、登录、会话、邀请码、限速。
- `backend/access.py`：世界/实体访问守卫与中间件拦截。
- `backend/storage.py`：本地/S3 对象存储适配。
- `backend/migrations/m049_auth_multiuser.py`、`m050_avatar_url.py`、`m051_trash_owner.py`。
- `src/components/AuthGate.tsx`：登录/邀请码注册/邮箱验证/开发者初始化。
- `src/components/settings/InviteCodesPanel.tsx`：邀请码管理。
- `src/components/settings/LocalWorkspacePanel.tsx`：本地草稿/备份/导出。
- `src/services/localContent.ts`：按用户隔离的 IndexedDB 服务。
- `src/index.css`：液态玻璃变量与皮肤。
- `backend/fly.toml`：Fly.io 持久卷、SQLite `DB_PATH`、上传目录与 CORS。
- `render.yaml`：备用 Render PostgreSQL 配置。
