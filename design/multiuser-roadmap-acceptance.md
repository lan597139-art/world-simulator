# 多用户与创作资产建设验收（阶段 A–E）

日期：2026-11-15
范围：`world-simulator` 前端、FastAPI 后端、Render/Vercel 部署配置。

## 结论

- **阶段 A（后端/数据库）**：配置已完成，实际云部署未执行。当前环境没有 `render`/`vercel`/`railway`/`flyctl`/`gh` CLI，也没有可用账号凭据，因此不能替用户创建云资源。仓库已改为 Render PostgreSQL + 持久上传盘 + 可选 S3；上传盘与付费 Web Service 档位绑定，免费档需改用 S3 或接受临时磁盘。
- **阶段 B（注册/登录/会话/邀请码）**：已完成并通过 API 与浏览器验收。邀请码由服务端哈希保存、条件更新原子消耗；支持 `off|dev|smtp` 邮箱验证；登录支持用户名/邮箱。
- **阶段 C（前后端连接/数据隔离/IndexedDB）**：核心路径已完成。世界、人物、事件、地点、组织、关系、章节等已接入统一访问守卫；IndexedDB 新增按用户隔离的草稿、备份、媒体索引；写作保存会先落本地再同步后端。
- **阶段 D（资料/头像/媒体/存储）**：部分完成。头像图片上传、创作者媒体库、S3 兼容存储适配器、本地备份/导出已完成；SMTP 与 S3 真实凭据未配置，未做云上回归。
- **阶段 E（液态玻璃视觉）**：基础设施已落地。玻璃模糊/透明度/饱和度/辉光/圆角变量化，提供极简、极光、暖砂、单色皮肤与低/标准/高/实色玻璃档位，以及 `prefers-reduced-motion` 降级。

## 已验收项

| 项目 | 结果 | 证据 |
| --- | --- | --- |
| 前端生产构建 | 通过 | `vite build` 退出 0；产物 `dist/assets/index-D8ugd5Ar.js` |
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
| 液态玻璃皮肤 | 通过（构建） | 设置 → 使用体验：皮肤/玻璃强度控件 |

## 尚未完成 / 需要账号或凭据

1. **实际部署**：需要 Render 账号（创建 PostgreSQL、Web Service）与 Vercel 项目权限；需要把 `VITE_API_BASE_URL` 指向新后端并重新部署前端。
2. **真实邮件**：`WS_EMAIL_MODE=smtp` 需要 SMTP 主机、账号、发件人；当前默认 `off`，`dev` 仅日志验证码。
3. **对象存储**：`WS_STORAGE_BACKEND=s3` 需要 bucket、endpoint、AK/SK、公开域名；未配置时使用 `/data/uploads` 本地磁盘。
4. **预发回归**：本地 `run_all.sh` 已 690/690 通过；上线后仍建议在 Render 预发环境对 PostgreSQL 与真实静态文件服务再跑一轮。
5. **社区/账单等模块的跨用户边界**：已由统一守卫覆盖世界与实体 ID 路径；仍建议对导出、搜索、归档等低频接口做一次人工抽查（见隔离审计）。

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
- `render.yaml`：PostgreSQL + 上传盘 + 环境变量。
