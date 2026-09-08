# UI 重构说明 · 2026-09-08

本轮四项改动：删除骑缝章、全站悬停系统重构、首页字号调整、CSS/JS 模块化拆分。

## 1. 删去骑缝章（刊头带红框）

- 截图中的朱红方框是刊头规则带上的 `.seal-tally`（骑缝章），已按要求整体删除：
  - `render/home.js`：masthead 只保留「本刊目录 …… 凡 54 篇 · 9 卷」；
  - `seals.css`：`.seal-tally` 样式与印泥纹理规则全部移除；
  - 顺带清掉了已无引用的死代码 `.seal-square`（封面方印，第三轮已删 markup）。
- 保留在用的印章：卷目页引首章（`.seal-oval`）、落款名章（`.seal-name`）。

## 2. 悬停系统重构：从"高光框"到"墨晕着纸"

**旧问题**：悬停在文字容器上铺一层 `background` 高光——形成可见方框边界；
卡片 padding 左 0 右 4px，框边直接切到文字；收藏卡甚至常驻一块对角渐变底色。
`padding-left` 跳移也显得生硬。

**新规范**（写在 `motion.css` 顶部，全站悬停必须遵守）：

1. 禁止给文字容器铺背景高光框；统一用 `::before` 伪元素铺"墨晕"：
   - 卡片类：`radial-gradient(105% 150% at 0% 100%)`，墨自左下角洇开；
   - 列表行类：`linear-gradient(90deg … transparent 58%)`，自左侧洇开、向右淡出；
   - `mix-blend-mode:multiply` + opacity 过渡，无可见边界，文字永不贴框。
2. 辅助表达不变：标题转印色、序号字距舒展、箭头前移、底部朱线从左长出。
3. 不用 box-shadow、不用 scale（纸不会浮起来）。
4. 控件（按钮/图标钮）允许保留边框+微底色悬停，它们不是文字容器。

应用范围：`.work-card`、`.favorite-mini-card`（径向墨晕）；`.section-list a`、
`.favorite-list-row`、`.search-item`、`.chapter-nav a`（线性墨晕）。
同时删除了所有行容器的 `padding-left` 跳移（列表行、搜索项、收藏行）。
实测：卡片墨晕使背景加深约 12/255，行墨晕左端约 12–19/255，向右淡出，
逐像素扫描无任何 >8/255 的非纹理跳变（即无硬边）。

## 3. 首页字号调整（可读性）

| 元素 | 旧 | 新 |
|---|---|---|
| `.cover-meta` 封面统计 | 12px | 13px |
| `.masthead-rule` 刊头文字/统计 | 14px | 15px |
| `.favorites-kicker` | 11.5px | 12.5px |
| `.favorites-home-head>a` | 12.5px | 13.5px |
| `.favorite-mini-card p` | 10.5px | 12px |
| `.favorites-empty-home p` | 14px | 15px |
| `.section-heading .count` | 12.5px | 13.5px |
| `.card-no` 序号 | 11px | 12px |
| `.card-by` 作者 | 12px | 13px |
| `.card-meta` 字数 | 11px | 12px |
| `.page-breadcrumb` | 12px | 13px |
| `.section-list .auth/.len` | 12px | 13px |
| `.favorite-list-copy small` / `.favorite-remove` | 11px | 12px |
| `.search-item .smeta` | 10.5px | 11px |

收藏夹页头 `BOOKMARKS` 拉丁全大写按既定方向改为中文（「收藏夹 / 我的收藏」）。

## 4. 模块化拆分（不允许单文件过大）

**CSS**：`main.css`（640 行 / 54KB）拆为 13 个按组件的模块，
每个 ≤110 行，加载顺序即层叠顺序：

```
base → motion → header → home → catalog → section → reader
→ overlays → favorites → immersive → seals → print → responsive
```

**JS**：`app.js`（628 行）拆为共享上下文 + 渲染 + 交互 + 启动四层，
通过 `window.YB` 命名空间通信；跨模块引用一律调用时经 `YB.*` 解析，
加载顺序只要求 context 最先（在 bootstrap 组装 BOOK_DATA 之后）、app.js 最后：

```
content/… → bootstrap.js（组装 BOOK_DATA）
→ core/context.js（状态/收藏/工具/动效观察器）
→ render/content.js · home.js · section.js · reader.js · favorites.js
→ ui/drawer.js · search.js · settings.js · immersive.js · export-print.js
→ app.js（路由/全局动作/键盘/滚动）
```

现在最大的单文件是 `render/reader.js`（114 行）和 `core/context.js`（157 行）。

## 验证

- `node --check` 全部 12 个新 JS 文件通过；`tools/check-content.js` 通过（9 卷 54 篇）。
- 无头 Edge 真实渲染 + 控制台零报错：首页（骑缝章已消失、刊头带干净）、
  志异卷目页（引首章、列表正常）、天花板阅读页（左栏树/竖排书口/章节地图正常）。
- 墨晕悬停测试页 + Pillow 逐像素扫描确认软边、无框。
- 截图存于 `.workbuddy/screenshots/v5-*.png`。

## 注意（未来改动必读）

- 悬停新规范见 `motion.css` 顶部注释，新增组件禁止再铺背景高光框。
- 脚本顺序：`bootstrap.js` 必须在 `context.js` 之前（它负责组装 `window.BOOK_DATA`）。
- `--wash` token 定义在 `base.css`，印章作用域内被 `--seal-ink` 覆盖。
