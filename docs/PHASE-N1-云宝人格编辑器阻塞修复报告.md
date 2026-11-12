# PHASE-N1 云宝人格编辑器阻塞修复报告

> 后续结构变更：云宝已迁出 AI 伴侣，成为首页侧边栏底部的独立工作台。最新结构见 `docs/PHASE-N1-云宝独立工作台迁移报告.md`。

> 状态：**已定位并修复前端入口路由**
>
> 账号：本地开发者 `兰哆哆`（`app_users.id=local`、`is_owner=1`）
>
> 原则：不关闭鉴权、不绕过登录；使用真实登录会话验证读取与保存。

---

## 1. 现象

已登录开发者点击「打开云宝 / 云宝人格设计」后没有进入编辑器，表现为无响应或跳回世界管理。

## 2. 根因

### 2.1 入口路由错误（主因）

`src/App.tsx` 的 `openYunbao` 原先跳转到：

```text
character-management
```

人物管理属于世界页面。若当前没有选中世界，`App` 的产品路由守卫会把它重定向到 `world-management`。因此从「AI 互动中心」点击「打开云宝」时，实际落到游戏产品的世界管理页，看起来像点击没有反应。

云宝人格编辑器本身是伴侣产品的独立页：

```text
product=companion
page=personas
```

它属于 `WORLD_FREE_PAGES`，不需要世界即可打开。

### 2.2 人物管理入口不明确

人物管理页只有「全局 AI 人格」卡片和「查看 AI 人格」按钮；按钮打开的是弹窗，不是独立的人格编辑器页面。入口语义与「云宝人格设计」不一致。

### 2.3 运行中的旧后端

诊断时发现 8000 端口上运行的是旧进程：

```text
GET /api/yunbao -> 404
GET /api/auth/me -> 缺少 is_owner
```

当前代码已包含 `/api/yunbao` 与 `is_owner`。因此部署/本地重启后必须重启后端进程，否则即使前端路由修复，编辑器也只会显示 404。

---

## 3. 修复

### 3.1 统一云宝入口路由

`src/App.tsx`：

```text
openYunbao()
  -> openProductPage('companion', 'personas')
```

不再经过 `character-management`，不会被世界路由守卫拦截。

### 3.2 人物管理页增加明确入口

`src/pages/CharacterListPage.tsx`：

- 区块标题改为「云宝人格设计」。
- 卡片按钮改为「进入人格编辑器」。
- 点击调用 `onOpenYunbaoEditor`，由 `App` 打开伴侣产品的 `personas` 页面。
- 保留旧弹窗作为未传入口时的兼容回退。

`src/components/YunbaoProfile.tsx`：

- `YunbaoCard` 支持 `actionLabel`，默认「云宝人格设计」。

### 3.3 权限保持原样

- `can_edit` 继续由 `user.is_owner` 决定。
- 普通用户仍为只读，后端 PATCH 返回 403。
- 不新增任何绕过鉴权的入口。
- 开发者登录后直接编辑，不需要退出账号。

---

## 4. 验证

使用真实登录会话（`Authorization: Bearer`，未关闭鉴权）验证：

| 检查 | 结果 |
|---|---|
| `/api/auth/status` 识别 `兰哆哆` | 通过，`is_owner=true` |
| `/api/yunbao` 读取 | 200，`can_edit=true` |
| 人物管理页显示「云宝人格设计」 | 通过 |
| 点击「进入人格编辑器」 | 进入 `?product=companion&page=personas` |
| 点击「编辑人格」 | 出现编辑表单与「保存云宝人格」 |
| `PATCH /api/yunbao` | 200，字段保持不变 |
| 后端 Yunbao 套件 | 42 passed / 0 failed |
| `tsc --noEmit` | 通过 |
| `npm run build` | 通过 |

> 验证完成后已删除临时登录会话与临时页面，未留下测试账号或测试数据。

---

## 5. 运行要求

1. 重启后端，确保 `/api/yunbao` 存在。
2. 已登录的 `兰哆哆` 直接进入「AI 伴侣 → 人物管理」，点击「云宝人格设计 → 进入人格编辑器」。
3. 也可直接访问：

```text
/?product=companion&page=personas
```

若重启后仍无法打开，先检查 `GET /api/yunbao` 是否返回 200，而不是继续修改路由。
