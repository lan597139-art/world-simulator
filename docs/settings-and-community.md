# 设置中心与社区社交

本轮在云宝独立工作台迁移完成后，补齐两个全局能力：账号级「设置中心」与内容社区的社交层。两者共用现有认证、SQLite 数据库和用户身份，不引入第二套账号体系，也不关闭权限验证。

## 1. 设置中心

前端入口：

- 全局侧边栏底部「设置」。
- 全局顶栏设置按钮。
- 用户与身份中心的账户区域。
- 路由参数 `?page=settings`，由 `src/App.tsx` 注册为全局页面。

页面文件：`src/pages/SettingsPage.tsx`；样式：`src/styles/settings.css`；API 客户端：`src/api/settings.ts`。

七个分区：

1. **个人资料与偏好**：显示名称、简介（500 字符）、头像符号；用户名不可修改；开发者身份只读。
2. **账户与安全**：账号创建时间、会话数量、修改密码、登录会话列表、撤销其他设备、退出登录。
3. **隐私与权限**：公开资料、展示动态、允许关注、允许好友申请、允许小组邀请、允许 AI 使用私人背景。
4. **通知与提醒**：讨论回复、好友申请、新增粉丝、小组动态、系统通知、每周摘要。
5. **使用体验**：中文/英文、跟随系统/浅色/深色、紧凑/舒适/宽松、正文大小、减少动效、操作提示、自动保存草稿。
6. **数据与存储**：世界/人物/事件/作品/日记/公开作品统计、数据库大小、JSON 导出、清除本地界面缓存。
7. **关于与帮助**：版本、API 版本、账号身份、数据位置、文档入口、AI 接入设置。

偏好会写入 `user_settings`；主题、密度、正文大小和减少动效通过 `src/utils/experience.ts` 应用到根元素，登录后自动读取并恢复。语言切换立即作用于工作区，保存后持久化。

### 后端接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/settings` | 读取资料、偏好、隐私、通知、统计、存储 |
| PATCH | `/api/settings` | 局部更新三个 JSON 分区，服务端枚举/布尔校验 |
| GET | `/api/settings/sessions` | 当前账号会话，标记当前设备 |
| DELETE | `/api/settings/sessions/{id}` | 撤销指定会话，不能撤销当前会话 |
| GET | `/api/settings/export` | 导出账号元数据 JSON（不含密码、完整私人正文） |
| GET | `/api/settings/about` | 公开版本与文档信息 |
| PATCH | `/api/auth/profile` | 更新昵称、简介、头像 |
| POST | `/api/auth/change-password` | 校验旧密码，更新后撤销其他会话 |

`app_users` 新增 `bio`、`avatar`；`user_settings` 保存 `preferences`、`privacy`、`notifications` 三个 JSON 字段。迁移：`M043_settings_center.py`。

## 2. 社区社交

社区社交是全局一级页面，与「内容社区」并列，不再从内容社区首页进入。

前端入口：

- 全局侧边栏「创作与体验」中的「社区社交」。
- 路由参数 `?page=community-social`。
- 页面：`src/pages/CommunitySocialPage.tsx`；样式：`src/styles/community-social.css`；API 客户端：`src/api/communitySocial.ts`。

五个标签：

1. **社区动态**：关注动态、好友动态、全社区；讨论、组内帖子、公开作品三种真实来源。
2. **讨论交流区**：话题讨论、经验交流、问题求助、观点交流；分类筛选、搜索、发帖、详情、回复。
3. **兴趣小组**：创建公开/私密小组，加入/退出，组长审批，组内帖子与回复。
4. **关注与发现**：用户搜索、关注/取消关注、粉丝/关注数据、好友申请；也会返回相关讨论和小组。
5. **好友**：好友列表、收到的申请（接受/拒绝）、发出的申请（撤回）、删除好友。

通知入口在页面右上角，支持未读计数与全部已读。

### 后端数据模型

| 表 | 用途 |
| --- | --- |
| `community_topics` / `community_topic_replies` | 讨论与回复 |
| `community_groups` / `community_group_members` | 小组与成员/审批状态 |
| `community_group_posts` / `community_group_replies` | 组内帖子与回复 |
| `community_follows` | 关注关系，唯一约束防重复 |
| `community_friend_requests` | 好友申请，支持 incoming/outgoing |
| `community_friendships` | 双向好友关系，唯一约束 |
| `community_notifications` | 站内互动通知 |

迁移：`M044_community_social.py`。旧的 `community_publications`、评论、收藏接口保持兼容，新社交层使用独立表，不改写公开作品数据。

### 权限与隐私

- 除 `/api/community/public*` 与 `/api/settings/about` 外，社交接口均要求登录。
- 被关注者关闭 `allow_follow` 时，关注请求返回 403。
- 被申请者关闭 `allow_friend_requests` 时，好友申请返回 403。
- 私密小组非成员不能读取组内帖子；加入后进入 `pending`，组长审批后成为成员。
- 只有组长可审批成员；只有作者可删除自己的讨论。
- 通知只发给被关注者、被回复者、被申请者与小组成员，不泄露私人日记、记忆或云宝工作台内容。
- 设置与社交逻辑都不依赖 `WS_AUTH_DISABLED`；该变量只用于既有单用户回归套件。

## 3. 验证

- `backend/tests/smoke_settings_community.py`：27 项，覆盖设置读写、非法值、隐私限制、讨论/回复、小组/审批、关注、好友申请、通知、会话、导出与关于。
- 已加入 `backend/tests/run_all.sh`。
- 前端以 `vite build` 为权威构建检查；`tsc -p tsconfig.app.json` 仍有迁移前遗留的类型错误，不在本轮新增范围内。
- 迁移演练：`cd backend && ../venv/bin/python migrations/rehearse.py`。
