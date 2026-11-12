# 创作中心首页 · 方案 B（玻璃 Bento）

已选定 **B · 玻璃 Bento**，并落回现有 React 首页。A/C 原型保留在本目录，仅作为视觉记录，不再用于生产。

## 最终实现

- 实际页面截图：`screenshots/implementation-home-1440.png`、`screenshots/implementation-home-1280.png`
- 生产页面：`src/pages/CreationCenterPage.tsx`
- 全局侧栏：`src/components/creation-center/CreationCenterSidebar.tsx`
- 顶部栏：`src/components/creation-center/CreationCenterTopbar.tsx`
- 首页样式：`src/styles/creation-center.css`
- 首页装配与导航映射：`src/App.tsx`

生产入口仍为 `/`；产品工作台、云宝、AI 接入状态、语言机制和后端保持不变。

## 视觉记录

- `gallery.html`：三套方案同屏对比
- `screenshots/scheme-a.png`：A · 编辑纸感
- `screenshots/scheme-b.png`：B · 玻璃 Bento（已落地）
- `screenshots/scheme-c.png`：C · 工作室网格

原型支持：

```text
index.html?variant=a
index.html?variant=b
index.html?variant=c
index.html?lang=en
index.html?variant=b&lang=en
index.html?variant=a&bare=1          # 隐藏切换器，用于截图
index.html?variant=a&audit=1         # 输出隐藏的布局测量结果
```

## 三套方案的差异

| 方案 | 视觉主张 | 场景卡 | 专业工具 | 资产 |
|---|---|---|---|---|
| A · 编辑纸感 | 留白、细线、作品集气质 | 圆形图标、大号衬线数字水印、弱阴影 | 一张双列目录面板 | 一条连续资产带 |
| B · 玻璃 Bento | 现有毛玻璃体系强化 | 图标底座、渐变玻璃、明确层次 | 四列小卡，扫读最快 | 三张独立资产卡 |
| C · 工作室网格 | 克制、结构化、工具感 | 扁平卡片、左侧强调线 | 两列表格，密度最高 | 深色数据带 |

## 数据与顺序

- 资产数字使用现有接口实时读取，不硬编码。截图时本地库为：`1` 个普通世界、`6` 个人物、`3` 篇作品。
- 四场景顺序：游戏创作、文学创作、AI 伴侣制作与体验、日记与传记。
- 八工具顺序：`02 世界管理`、`03 人物管理`、`04 关系与组织`、`05 事件管理`、`06 时间线`、`07 模拟运行`、`故事线管理`、`08 写作辅助`。
- 没有增加第二套分组或第二套编号。

## 全局导航的实际映射

首页、用户与身份中心、内容社区、AI 互动中心、游戏体验中心、内容商城均已有独立页面；只有「商业与服务中心」仍映射到现有真实页面：

| 入口 | 当前落地 |
|---|---|
| 用户与身份中心 | `?page=user-center` 用户与身份中心独立页面 |
| 内容社区 | `?page=community` 内容社区独立页面 |
| AI 互动中心 | `?page=ai-center` AI 互动中心独立页面 |
| 游戏体验中心 | `?page=game-center` 游戏体验中心独立页面 |
| 内容商城 | `?page=content-store` 内容商城独立页面 |
| 商业与服务中心 | 游戏 · 归档库 |
| 设置 | 现有 AI 接入设置弹层 |

所有入口都是可点击的现有页面，没有死按钮。

## 保留项与边界

- 现有配色、字体、深色侧栏、卡片、中英文状态和切换机制保留；语言按钮仍在侧栏底部。
- `AI 接入 · 已配置` / `后端已连接` 保留，AI 入口仍打开现有设置弹层。
- 右下角云宝组件未修改，仍全局可用。
- 顶部搜索与提醒铃铛为视觉入口：搜索不新增全局检索后端；铃铛显示“暂无新提醒”。没有新增业务数据。
- 未修改后端、数据库、API 或数据结构。
