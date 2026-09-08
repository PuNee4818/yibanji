# 一班集 · UI / 视觉审计与优化规划

> 审计对象：`D:\GitHub\yibanji`（v5 模块化工程版）
> 审计方式：全量阅读 `main.css`(38KB) / `app.js`(34KB) / `index.html` + 5 张真实渲染截图（首页 1440、文章页 1440、长篇章节页 1440、卷目页 1440、移动端首页 420）
> 结论优先级：P0 = 明显缺陷、建议本轮必做；P1 = 体验增益大、成本可控；P2 = 锦上添花

---

## 一、现状诊断

### 1.1 现有设计资产盘点

| 维度 | 当前实现 | 评价 |
|---|---|---|
| 色彩 | `--paper #f3ecdb` / `--ink #231f18` / `--accent #9d3b26`（砖红）/ `--accent-2 #b3703f`（铜）/ `--muted #6e6252` | 米黄纸 + 墨黑 + 砖红，方向正确，但**层级只有一层强调色**，缺少"次强调/去强调"的细分 |
| 暗色 | `--paper #181510` / `--ink #e9e0cc` / `--accent #d07a5e` | 已做，是反射式取反，未针对暗色重做对比与阴影 |
| 字体 | 衬线 `--serif`(Songti/STSong) 走标题+正文；`--kai`(Kaiti) 走献词/题记；`Georgia italic` 走编号/kicker；`--ui`(PingFang/YaHei) 走界面 | 三套分工清晰，**但正文与 UI 之间缺少"中文屏显"过渡字重** |
| 纹理 | `body:before` 两层 `radial-gradient` 圆点，opacity `.12`，23px/31px 网格 | **规律网点，机械感强**，不是真实纸纹，放大看是"格子布" |
| 装饰 | 封面朱印「一班」52px 旋转 -2.5°；献词 `※` 60px；`6px double` 文武线；章节号 Georgia 60px；小节标题下 40×2px 朱线 | 元素少而精，**但全站只有这 5 个装饰母题，复用过度** |
| 布局 | Hero 1.12/0.88；目录 12 栅格 span4（featured span8）；阅读壳 `264px / 1fr / 190px` | 骨架稳，**但 190px 右栏对内容来说是"浪费的窄条"** |
| 动效 | hover 变色 .15s；箭头 `translateX(3~4px)` .18s；树形箭头 `rotate` .16s；抽屉 `translateX` .25s；遮罩 `opacity` .2s；toast .2s；进度条 width；沉浸 chrome 2.8s 自动隐藏 | **只有"状态切换"动效，几乎没有"进入/滚动/转场"动效** |

### 1.2 做得好的地方（不要动）

1. **排版骨架是对的** — 正文 19px / 1.95 / 760px / 首行缩进 2em / `inter-ideograph` 两端对齐，这是中文长文阅读的正确参数，不要为了"设计感"破坏它。
2. **装饰克制** — 没有滥用渐变、阴影、圆角。全站只有朱红一个强调色，气质统一。
3. **层级靠字号+字重+留白**，不靠颜色堆叠，符合杂志逻辑。
4. **数据/逻辑/样式三层分离**做得干净（`content/` + `data/` + `assets/`），改视觉不会碰到正文。
5. 卷目页 `故园 + 02` 大字配 Georgia 斜体数字，是全站最有记忆点的一屏。

### 1.3 短板清单（按严重度）

| # | 问题 | 位置 | 严重度 |
|---|---|---|---|
| A1 | **全站零入场动效**。首屏、目录卡片、文章头、章节头全部"啪"地出现，静态得像一张 PDF | 全局 | P0 |
| A2 | **弹层没有过渡**。`.modal.open{display:grid}`、`.popover.open{display:block}` — `display` 不可动画，搜索面板和设置面板是**硬闪**出现 | main.css 262/283 | P0 |
| A3 | **卡片 hover 只有标题变色**，无位移/无阴影/无下划线，`195px` 高的卡片交互反馈太弱 | main.css 110 | P0 |
| A4 | **首页 Hero 与目录之间断开**。Hero 结束到"目录"标题有 100+px 空白带，读者不知道下面还有内容 | main.css 66/105 | P1 |
| A5 | **纸纹是规律网点**，不是纸纹。放大是格子，与"复古"诉求相悖 | main.css 30 | P1 |
| A6 | **目录栅格用 `margin-right:20px` + `:nth-child(3n)` 手工拼分隔线**，最后一列右侧留白不一致，窄屏下会漏线 | main.css 110-111 | P1 |
| A7 | **右栏 190px 太窄**。"950 字 / 字数"大字 + 4 个通栏按钮挤在一条竖列里，视觉上像"被剩下的空间" | main.css 143/174 | P1 |
| A8 | **文章头信息过载**：作者 / 卷名 / 字数 / 收藏 / 导出 PDF / 沉浸 / 复制链接 挤在同一行 | app.js 286 | P1 |
| A9 | **卡片无图形资产**。全部是纯文字块，靠 01/08 编号撑结构，长目录容易视觉疲劳 | app.js 174 | P1 |
| A10 | **装饰母题只有 5 个**，封面朱印、※、文武线、章节号、小节朱线在全站反复出现，缺少"篇章级"的差异化 | 全局 | P2 |
| A11 | 暗色是亮色的机械取反，`--shadow` 在暗色下几乎不可见，卡片浮不起来 | main.css 24 | P2 |
| A12 | 无 `prefers-reduced-motion` 兜底，未来加了动效会有无障碍风险 | 缺失 | P0（补动效时同步加） |
| A13 | 焦点样式只有 `outline:2px`，没有给键盘用户提供"当前在哪"的连续导航感 | main.css 33 | P2 |
| A14 | 74 个 content JS 全量同步加载，首屏白屏时间偏长（视觉层面表现为"先空白再炸出来"） | index.html 53-126 | P1 |

---

## 二、优化方向

### A. 美术层（视觉资产）

**A-1 重做纸纹（治 A5）**
- 用 SVG `feTurbulence` 分形噪声替代规律网点，生成一次性 base64 内联（约 1~2KB，无需外部请求）。
- 叠加两层：粗颗粒（低频，`baseFrequency .8`）做纤维，细颗粒（高频，`baseFrequency .04`）做斑驳。
- 暗色下把噪声 opacity 从 `.12` 降到 `.06`，并改用 `mix-blend-mode: overlay`，避免暗色发灰。

**A-2 建立"朱印"装饰系统（治 A10）**
把现在孤立的 `cover-seal` 抽象成一套可复用母题：

| 母题 | 用法 | 规格 |
|---|---|---|
| `seal-square` 方印 | 封面「一班」、卷目页序号、文章落款 | 52px / 旋转 -2.5° / 朱红底反白字 |
| `seal-tally` 骑缝章 | 卷与卷之间的分隔 | 半圆 + 齿状边，跨在分隔线中间 |
| `seal-oval` 椭圆引首章 | 题记、自评段落左侧 | 24×36px，竖排 2 字 |
| `seal-name` 名章 | 落款署名下方 | 32px 方形，白底朱字（阴阳交替） |

这样卷首 / 诗笺 / 志异 / 长篇四类内容可以有各自的印色微调（朱砂 `#9d3b26` → 胭脂 `#8f2f3f` → 赭石 `#96543a` → 墨 `#2b261d`）。

**A-3 给目录卡片加"篇章图形"（治 A9）**
不引入图片（保持零资源依赖），用**纯 CSS/SVG 生成的抽象图形**做卡片背景水印：
- 每卷一个几何母题：故园=窗棂格、笑谈=回纹、诗笺=竖线笺条、志异=云雷纹、迷梦=同心圆、天外=星轨、剪刀=交叉线。
- 以 `opacity:.05` 的 SVG pattern 铺在卡片右下角，hover 时 `opacity:.12` + 轻微位移。
- 这样卡片从"文字块"变成"有性格的版面"。

**A-4 首页 Hero 与目录之间加"桥梁"（治 A4）**
在 `.hero` 与 `.section-index` 之间插入一条"刊头规则带"：
`本刊目录 · CONTENTS · 全 X 篇 · Y 卷` + 文武线 + 骑缝章，把两段缝合成一本杂志的连续版面。

### B. 排版层

**B-1 建立排版 token 阶梯**
现在字号是散写的 `clamp(...)`。建议收敛成 `--step--1 … --step-6` 的模块化比例（1.25 ratio），让封面 / 卷名 / 文章标题 / 小节标题 / 正文 / 注释形成可推导的节奏，而不是各自 clamp。

**B-2 中文标点与悬挂**
- 正文加 `hanging-punctuation: allow-end;`（Safari/Chrome 已支持），引号、书名号悬挂到版心外，右边缘会明显更整齐。
- 章节号、编号改用 `font-variant-numeric: lining-nums tabular-nums;`，`01 / 08` 不再跳动。

**B-3 首字下沉（可选，P2）**
散文类（非 verse、非 novel）首段加 3 行高的楷体首字下沉，是最能立"杂志感"的单一改动。但**必须可关闭**——放进阅读设置。

**B-4 文章头重组（治 A8）**
把 `article-meta` 拆两行：
- 第一行：作者 · 卷名 · 字数（左）
- 第二行：工具条（右对齐，图标化，间距拉到 20px）
移动端已经换行了，桌面端反而挤。

### C. 动效层（本轮重点）

**C-1 建立动效 token**
```css
--ease-out:cubic-bezier(.22,.61,.36,1);      /* 位移类 */
--ease-soft:cubic-bezier(.4,0,.2,1);         /* 显隐类 */
--ease-back:cubic-bezier(.34,1.56,.64,1);    /* 弹性类（收藏星标） */
--dur-fast:160ms; --dur:260ms; --dur-slow:520ms;
--rise:14px;  /* 入场位移基准 */
```
现在全站 `.15s / .18s / .2s / .25s` 四个值各写各的，统一后节奏会明显变"整"。

**C-2 入场动效（治 A1）**
用 `IntersectionObserver` + `data-reveal` 属性统一驱动，不引入库：

| 触发对象 | 动效 | 参数 |
|---|---|---|
| Hero：kicker → 朱印 → 主标题 → 献词 → 续读条 | `fade + translateY(var(--rise))`，stagger | 每级 +80ms |
| 目录：卷分隔 + 该卷卡片 | `fade + rise`，stagger | 每卡 +45ms，上限 8 个 |
| 卷目页：大标题 → 序号 → 列表行 | `fade + rise`，stagger | 每行 +35ms |
| 文章头：kicker → 标题 → 副题 → meta | `fade + rise` | 每级 +70ms |
| 正文小节标题 | 进入视口时 rise | 单例 |
| 章节头（长篇翻章） | `fade + 轻微 x 位移`，方向随翻页方向 | 320ms |

翻章方向：从"下一章"进入 → 内容从右侧 +18px 淡入；从"上一章"进入 → 从左侧。这是低成本高回报的一处。

**C-3 修掉硬闪（治 A2）**
`.modal` / `.popover` 改用 `opacity + visibility + transform` 三件套替代 `display`：
```css
.modal{opacity:0;visibility:hidden;transition:opacity var(--dur) var(--ease-soft),visibility 0s linear var(--dur)}
.modal.open{opacity:1;visibility:visible;transition-delay:0s}
.modal-card{transform:translateY(-12px) scale(.985);transition:transform var(--dur) var(--ease-out)}
.modal.open .modal-card{transform:none}
```
搜索结果列表再做 30ms 阶梯淡入。

**C-4 卡片 hover 升级（治 A3）**
```css
.work-card{transition:background var(--dur) var(--ease-soft)}
.work-card::after{ /* 底部朱线，hover 时从左长出 */ }
.work-card:hover{background:color-mix(in srgb,var(--accent) 3%,transparent)}
.work-card:hover h3{color:var(--accent)}
.work-card:hover .card-no{letter-spacing:.2em}  /* 编号微张 */
.work-card:hover .pattern{opacity:.12;transform:translate(-4px,-4px)} /* 水印微动 */
.work-card:hover .card-meta{color:var(--accent-2)}
```
**不要加 `transform:scale` 和 `box-shadow`** —— 会和"纸质感"打架，纸不会浮起来。用底色 + 朱线 + 水印位移表达"被点亮"，更符合材质。

**C-5 微交互补强**
- 收藏星标：点击时 `scale(1) → 1.35 → 1` + `rotate(-12deg)`，用 `--ease-back`，同时 toast 同步。
- 朱印：hover 时 `rotate(-2.5deg) → rotate(-1.5deg)` 极轻微"被扶正"，传递"印章被触碰"。
- 进度条：到达章节边界时朱线短暂加粗 + 发光 200ms。
- 抽屉/章节树箭头：现有 `rotate` 补上 `color` 与 `aria-expanded` 同步（已有）。
- 沉浸模式 chrome：现在 2.8s 后 `opacity:0`。建议补一个"接近边缘时提前唤回"——指针进入屏幕底部 80px 区域立即显示，比等 `pointermove` 更跟手。

**C-6 无障碍兜底（治 A12，动效上线必备）**
```css
@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}
  [data-reveal]{opacity:1!important;transform:none!important}
}
```

### D. 组件与信息架构

**D-1 右栏重构（治 A7）**
190px 现在装了"字数大字 + 4 个按钮"。两个方案二选一：
- **方案甲（推荐）**：右栏收窄为 96px 的"竖排工具条"——把 4 个按钮改成竖排中文（收藏 / 导出 / 沉浸 / 分享），去掉"字数"大字（移到文章头 meta）。视觉上变成杂志的"书口"。
- **方案乙**：右栏加宽到 240px，把"本卷其他作品"或"阅读进度 + 章节跳转"放进去，变成真正有用的侧栏。

**D-2 阅读设置扩容**
现在只有 字号 / 行距 / 版心 / 沉浸。建议加：
- 字体切换（宋 / 黑 / 楷）
- 纸色切换（米白 / 宣白 / 夜读 / 暗夜）— 现在只有亮暗二选一
- 首字下沉开关（配合 B-3）

**D-3 长篇《天花板》加"篇章地图"**
20 章是全书最长内容，建议在卷目页或章节页加一个横向的 20 格进度点阵，已读/未读/当前三态。成本低，对长文读者价值高。

**D-4 首屏加载（治 A14）**
74 个 content `<script>` 是同步阻塞的。视觉上表现为"白屏 → 内容炸出"。两个改法：
- 低成本：给 `<body>` 加一个骨架态（封面轮廓 + 文武线），内容就绪后交叉淡出，掩盖加载。
- 彻底改：content 改为 `defer` + 按需 fetch。

### E. 性能与可访问性

- 所有新装饰用 SVG / CSS 生成，**不引入图片、不引入动效库**（保持零依赖，符合现有工程哲学）。
- 新增动效只用 `transform` / `opacity`，不碰 `width/height/top/left`。
- 对比度复核：`--muted #6e6252` on `--paper #f3ecdb` ≈ **5.4:1**（AA 通过）；`--soft #a3947d` ≈ **2.9:1**（只可用于装饰和非文本，现状合规，但新增信息不能再用 `--soft`）。
- 暗色 `--muted #ab9f88` on `#181510` ≈ **7.3:1**（通过）。

---

## 三、落地路线

### P0 — 本轮必做（约改动 200 行 CSS + 60 行 JS）
1. 建立动效 token（`--ease-*` / `--dur-*` / `--rise`），替换全站散写的 `.15s~.25s`
2. 修复 `.modal` / `.popover` 的 `display` 硬闪
3. 加 `IntersectionObserver` 入场动效（Hero / 目录 / 卷目页 / 文章头 / 小节标题）
4. 目录卡片 hover 升级（底色 + 朱线 + 水印位移，不加阴影不加缩放）
5. 加 `prefers-reduced-motion` 兜底

### P1 — 建议同轮
6. SVG 分形噪声替换规律网点纸纹
7. 目录栅格改 `gap` + 伪元素分隔线，去掉 `margin-right` / `nth-child` hack
8. 文章头 meta 与工具条拆两行
9. 右栏方案甲（96px 竖排工具条）
10. 首屏骨架态

### P2 — 视反馈再定
11. 印章母题系统（方印 / 骑缝 / 引首 / 名章）+ 分卷印色
12. 目录卡片几何水印（每卷一母题）
13. Hero 与目录之间的刊头规则带
14. 首字下沉（可关闭）
15. 长篇篇章地图
16. 阅读设置扩容（字体 / 纸色）
17. 排版 token 阶梯 + `hanging-punctuation`

---

## 四、验收标准

| 项 | 标准 |
|---|---|
| 动效一致性 | 全站 transition 时长只剩 token 里定义的 3 个值 |
| 入场 | 首屏 5 段元素有 stagger，总时长 ≤ 700ms，不拖沓 |
| 硬闪 | 搜索 / 设置面板打开有 ≥200ms 的淡入 + 位移 |
| 无障碍 | 系统开启"减弱动态效果"后，所有动效关闭且内容完全可见 |
| 无障碍 | 键盘 Tab 全程可见焦点，抽屉/弹层可 Esc 关闭（现状已满足，回归验证） |
| 对比度 | 所有正文文本 ≥ 4.5:1；`--soft` 不承载信息 |
| 回归 | 打印导出 PDF、沉浸模式、收藏、搜索、章节跳转全部功能不变 |
| 性能 | 不新增任何外部请求，首屏渲染耗时不劣化 |

---

## 五、需要你拍板的 3 件事

1. **右栏走方案甲（96px 竖排书口）还是方案乙（240px 功能侧栏）？** 我倾向甲——更贴杂志气质，且改动小。
2. **首字下沉要不要做？** 杂志感最强，但会动到正文排版，属于"有主张"的改动。
3. **装饰母题（印章系统 + 分卷水印）现在做还是放到 P2？** 如果这本集子后续还会加内容，早做母题系统更省事；如果已定稿，P2 足够。
