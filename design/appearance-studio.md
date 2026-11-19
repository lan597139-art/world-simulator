# 玻璃与文字悬浮调节器

## 入口

- 每个页面右上角有一个悬浮滑杆按钮，固定在 `top: 74px; right: 16px`，不遮挡底部 AI 助手。
- 设置 → 使用体验 → 背景与玻璃细节中也有「打开悬浮调节器」按钮。
- 打开后立即实时预览；关闭（X、Esc 或点击遮罩）会恢复上次保存的配置，避免未保存的预览留在页面上。

## 主题切换

- 面板顶部提供「浅色 / 深色 / 跟随系统」三个按钮，当前模式高亮。
- 点击后立即更新 `html[data-theme]`，并同步保存到当前账号的设置偏好。
- 选择「跟随系统」时由 `prefers-color-scheme` 决定实际明暗；自动文字颜色也会随主题实时切换，不需要重新打开面板。
- 主题切换不会覆盖字体、玻璃或页面独立外观配置。

## 调节范围

每个滑杆右侧都配有一个**数字输入框**，既能拖动也能直接输入精确数值（如 `24`、`0.5`），输入框与滑杆双向同步。这解决了拖动精度不足、难以精确复现的问题。

### 毛玻璃

- 模糊度 Blur：0–50px。
- 底色透明度 Opacity：0–100%。
- 边框高光 Border：0–100%。
- 着色层 Tint：0–100%，以主题主色叠加染色。
- 颜色渐变 Gradient：0–100%，以页面环境色叠加渐变。
- 玻璃厚度：0–80，控制内高光与边缘厚度。
- **圆角 Radius**：0–60px，统一控制该目标下卡片、面板、弹窗的圆角。
- **外阴影 Shadow**：0–100，统一控制该目标的投影强度。
- 可读性保护：默认开启。开启时文字容器保留最低 78% 底色，避免浅色/彩色背景下文字消失；需要更透明的效果时可以关闭。
- 目标多选：导航栏、卡片、弹窗/面板、输入/按钮、液态场景卡，支持全选、清空、仅导航、仅卡片。
- **编辑目标**：在五个目标之间切换「正在单独调节哪一个」。关闭「同步到全部已选目标」时，滑杆只写入当前编辑目标，用于对单个 UI 做精准微调；打开时写入所有已选目标（未选则写入全部）。
- **拾取聚焦**：点击「拾取」后在页面上点任意玻璃表面，控制台会自动把该目标设为编辑目标并切换到单独微调，随后直接用滑杆/数字框调整。
- 预设：清透、磨砂、液态、高对比。

### 工作区玻璃统一

- 设计系统的 `--workspace-glass-bg / -blur / -border / -shadow` 全部改由外观控制台的 `--ws-g-card-*` 令牌派生，并带原值兜底，确保专业模块（世界观、关系、写作、时间线等）的玻璃与卡片目标始终一致。
- `--ws-readability-floor` 与设计系统的 `--glass-readability-floor` 共用同一份值，自定义/高饱和背景在两套玻璃系统下提升一致的可读性下限。
- 所有玻璃表面必须通过 `.glass-card`、`.glass-panel`、`.ws-glass-surface`、`.app-sidebar` 等类/属性接收令牌，**不得在行内样式里写死** `backdrop-filter` / 不透明 `background`（行内样式优先级高于 CSS，会让控制台失效）。
- 创作中心导航（`.cc-nav-item`、`.sidebar-nav-item`）以及侧栏/顶栏控件（`.cc-status-chip`、`.cc-icon-button`、`.cc-profile`、`.cc-back`、`.cc-world-trigger`、`.cc-workspace-icon`）原先用 `rgba(255,255,255,...)` 写死，已改为读取 `--ws-nav-item-*` 派生令牌。这些令牌同时取「导航」与「卡片」档位的均值，因此调节导航或卡片玻璃都会同步到导航条目与控件的悬停/选中态。
- `.cc-search input` 改为读取控制档位令牌，不再用 `!important` 写死 rgba，控制台的「控制」调节可以生效。
- `.cc-tool`、`.cc-asset`、`.cc-recent-work`、`.cc-scene-card` 属于**液态**档位（液态规则在卡片规则之后），由控制台的「液态」调节控制，不受「卡片」档位直接影响。
- 各页面卡片面（AI 中心、社区、用户中心、游戏中心、内容商店、工作区外壳等）此前各自写死 `rgba(255,255,255,0.10~0.24)`，透明度、圆角、描边互不一致。现已把 `.ct-stats`、`.ai-*-card`、`.gx-*-card`、`.st-*-card`、`.cm-*-card`、`.uc-*-card`、`.pw-tabs-wrap`、`.pwh-world-visual`、`.relx-panel-head` 等，以及卡片内的统计小格（`.ai-stat-pair > div`、`.cm-follow-counts > div` 等）统一接入「卡片」档；搜索框、幽灵按钮、筛选标签、图标控件（`.ct-search`、`.cm-ghost`、`.cm-type`、`.uc-ghost-button`、`.relx-search` 等）接入「控制」档。现在拖动卡片或控制档位，所有页面的对应表面同步变化，不再出现“导航能调、卡片调不动”的情况。
- **全站表面底色令牌派生（系统性联动）**：`--card-bg` / `--sidebar-bg` / `--field-bg` 是主题令牌，本身与控制台无关，而全站有 200+ 处 `background` 声明（含 TSX 行内样式）直接引用它们，导致大量面板、按钮、侧栏“写死”、无法随调节器变化。设计系统在 `html` 上新增三个派生令牌：`--ws-surface-bg`（读「卡片」档透明度）、`--ws-nav-bg`（读「导航」档）、`--ws-control-bg`（读「控制」档），均叠加 `--ws-readability-floor` 可读性下限。随后把全站 `background` / `background-color` 声明里的 `var(--card-bg)`、`var(--sidebar-bg)`、`var(--field-bg)` 统一替换为对应派生令牌。默认值下与原值等价（浅色约 `rgba(255,255,255,.84)`、深色约 `rgba(28,28,30,.84)`），因此默认观感不变，只有拖动调节器时才联动。`--card-bg` 仍保留为实心主题色，专供反色按钮的文字色与 SVG `fill` 使用，避免被透明度污染。
- **弹窗遮罩统一**：各页面写死的 `rgba(0,0,0,.3~.6)` 深色遮罩（`.bc-modal-backdrop`、`.cm-lightbox`、`.swl-overlay`、`.sc-sheet-backdrop`、`.ca-modal-mask`、`.official-assets-overlay`、`.wr-overlay`、`.fb-overlay`、`.ws-stats-overlay`、`.ol-overlay`、`.slx-picker-overlay` 等 15 类）新增统一的「弹窗遮罩」规则，背景浓度与模糊由弹窗档的透明度/模糊驱动。此前误入「卡片」档的遮罩类已移出，避免浅色模式下被覆盖成白色而失去遮罩作用。
- **滚动链修复**：`.main-area-body` / `.main-area-body-inner` 补充 `display:flex; flex-direction:column`，使 `.cc-page-scroll` 获得受限高度，灵果资源中心等长内容页面恢复上下滚动（此前 `flex:1; min-height:0` 因父级非 flex 而不生效）。
- **选中 / 激活态接入控制台**：此前多个页面的选中按钮、标签用**实心** `var(--text-main)` 做背景（`.spirit-tabs button.active`、`.settings-focus-grid button.is-active`、`.cs-tab.is-active`、`.cw-scene-pill.is-active`、`.cw-status-filter button.is-active`、`.ct-filter.active`、`.pw-tab.active`、`.nav-orb-item.is-active` 等），选中态发实且完全不随调节器变化。设计系统新增 `--ws-active-bg`（由「卡片」档透明度派生并叠加可读性下限）、`--ws-active-fg`、`--ws-active-border` 三个令牌；控制台新增「选中态」规则，把这些状态统一改为**半透明玻璃**，文字改用正文色、描边用强调色，拖动卡片档即可同步。侧栏品牌标 `W` 同样由实心 `var(--sidebar-text)` 改为 `--ws-surface-bg` + `--text-main`，不再发实。
- **补齐五页卡片档覆盖**：社区社交（`.cs-feed-card`、`.cs-side-card`、`.cs-person-card`、`.cs-group-card`、`.cs-tabs`、`.cs-stat-row` 等）、我的作品（`.cw-scene-pill`、`.cw-status-filter`、`.cw-toolbar`、`.cw-create-card`、`.cw-form`、`.cw-modal` 等）、灵果资源中心（`.spirit-panel`、`.spirit-balance`、`.spirit-stat`、`.spirit-shop-card`、`.spirit-inventory`、`.spirit-note-card` 等）、商业服务中心（`.bc-balance-card`、`.bc-hero-card`、`.bc-order-card`、`.bc-modal`、`.bc-panel` 等）、设置中心（`.settings-focus-grid`、`.settings-stat-grid`、`.settings-kv-grid`、`.settings-session-list` 等）此前只统一了透明度、玻璃特效（模糊 / 描边 / 圆角 / 阴影）不同步。现已全部加入控制台「卡片」档 `:is()` 列表，透明度、模糊、描边、圆角、阴影一并跟随调节。
- **预设体系（系统 1/2 + 用户自定义 3+）**：`appearance.ts` 只保留**系统预设**：预设1 经典浅色、预设2 经典深色（经典黑白主题，一键应用并同步切换主题父级）。预设 3 起与「➕」均为**用户自定义**：首次打开会生成预设 3/4/5 三个空位（存于 `ws.ui.preset.v1.*`），每个预设保存**整套外观对象**（各档玻璃、文字、**背景照片 URL/位置/缩放/模糊/透明度**），因此自定义预设连同上传的照片背景一并保存。共享组件 `PresetPicker` 在控制台与设置中心提供带玻璃缩略预览的预设按钮：系统 1/2 **一键写入全站默认并立即生效**（控制台套用时会清除当前页独立配置）；点击用户预设**载入到当前草稿进行调节**，调节后点「保存预设」即写入该预设并应用，名称可自定义、悬停可删除；「➕」按编号递增新增空位。控制台与设置中心通过 `ws:user-presets-change` 事件同步自定义预设列表，不会两处各写各的。
- **一键清除全部自定义调节**：新增 `clearAllAppearance()`，一次移除全站默认（`ws.ui.appearance`）与所有页面独立配置（`ws.ui.appearance.page.v1.*`），恢复出厂默认并立即生效。控制台与设置中心均有「一键清除全部」入口。用户自定义预设独立保存，不在此列，可单独删除。
- **主题父子级关系**：界面主题是设置中心主题中心的全局**父级**，控制台与预设作为**子级**读取并联动同一 `data-theme` / 账号偏好；控制台主题行标注「全局父级」，切换即时同步到设置中心，预设1/2 套用时一并设置父级主题，避免两处各写各的。

### 液态玻璃

- 折射 Refraction、色散 Dispersion、磨砂 Frost 会实时传给 WebGL 材质（`refraction` 映射到 0–110，`dispersion` 映射到 0–7）。
- WebGL 不可用时自动回退到 CSS 毛玻璃，并保留可用的 CSS 边缘色散近似。
- 液态场景卡的 Tint/Gradient 通过 Canvas 之上的 DOM 渐变层实现，文字仍在 Canvas 之上保持清晰。

### 字体与文字

- 字体：系统默认、仿宋、黑体、楷体、行楷、宋体、等宽。
- 字号大小、字重/粗体、斜体、字色透明度、色相滑动、文字描边、文字阴影、字距/弯曲、垂直偏移、行高。
- 字色：自动（跟随明暗主题的高对比文字色）或自定义取色；自定义可用色相滑动快速换色。
- 文字背景：开关、跟随主题/自定义颜色、透明度、厚度、模糊、圆角；文字背景本身也是一块可模糊的液态玻璃。
- 文字范围多选：导航文字、卡片文字、页面正文。

## 保存规则

- **仅当前页面**：写入 `ws.ui.appearance.page.v1.{产品}:{页面}:{世界或 root}`，只影响当前页面。
- **全站默认**：写入 `ws.ui.appearance`，作为没有页面覆盖时的默认外观。
- 两套配置互不覆盖；切换页面时 `App` 会重新读取该页配置。
- 悬浮按钮出现数字角标表示当前页有独立配置；面板底部可以「清除本页独立配置」回到全站默认。
- 保存范围在切换页面或重新打开面板时自动回到「仅当前页面」，避免误保存成全站。

## 可读性

- 自动字色使用 CSS 主题变量：浅色主题黑字，深色主题白字，`system` 跟随 `prefers-color-scheme`，切换主题不需要重新应用外观。
- 背景模糊透明度受可读性最低值保护；高对比预设会同时打开文字背景。
- 正文、卡片、导航分别设置，文字背景通过 `box-decoration-break: clone` 保持多行文本的圆角与厚度。

## 首屏性能

- 生产环境曾把所有页面打进单个 3.85MB JS 包，且 Vercel 对该包的传输速度约 10–13KB/s，浏览器在 `interactive` 状态长时间阻塞、`#root` 一直为空，表现为 Safari 打不开、白屏超时。
- 修复：`App.tsx` 将全部页面组件改为 `React.lazy(() => import(...))` + `Suspense`（外层仍由 `ErrorBoundary` 包裹，并加 `PageLoading` 占位）。首屏只加载外壳 `index-*.js`（约 405KB / gzip 124KB），重型依赖（`three`、`3d-force-graph`、`@tiptap`、`react-zoom-pan-pinch`、`@dnd-kit` 等）随对应页面按需加载。
- 结果：首屏 JS 体积降低约 87%，生产入口首屏在数秒内完成解析并渲染，Safari 可正常打开。

## 验收

- `tsc --noEmit`、`vite build` 通过。
- 本地浏览器验证：面板打开/关闭、Esc/遮罩关闭、实时预览、关闭恢复、页面独立保存、全站默认保存、数字角标、移动端 390×844 布局、WebGL Canvas 与 CSS 回退。
- 控制台精度验证：数字输入框与滑杆双向同步；拾取聚焦后单目标微调生效；切换「同步到全部已选目标」时所有已选目标同步更新。
- 玻璃覆盖验证：逐个页面核对 `.glass-card`、`.glass-panel`、`.ws-glass-surface`、`.app-sidebar` 等表面，修改 `--ws-g-card-*` 令牌后其 `backdrop-filter / border-radius / box-shadow` 随之变化，且无行内写死的 `backdrop-filter`。
- 生产入口：<https://app.psyengine.top>。
