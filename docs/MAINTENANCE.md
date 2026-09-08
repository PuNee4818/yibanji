# 新增作品

1. 在对应 `content/<卷目录>/` 新建一个 `.js` 文件。
2. 文件内容使用：`window.YB_CONTENT.register({...});`。
3. 在 `data/book-meta.js` 对应卷的 `articles` 中加入文章 ID。
4. 在 `data/content-manifest.js` 的 `files` 中加入文件路径。
5. 打开 `index.html`；启动校验会检查 ID、卷目和清单一致性。

长篇作品可以参考 `content/06-tianwai/tianhuaban/`：元数据与章节独立维护。

## 收藏系统（v6）

收藏状态由 `assets/js/core/favorites-store.js` 单独负责，使用浏览器 `localStorage` 的 `yb_favs` 键持久化。UI 层只通过 `YB_FAVORITES` 的公开接口读取或修改，不要在文章数据文件里写收藏状态。

首页、收藏夹页、卷目列表、抽屉目录、阅读页和搜索结果共享同一收藏状态。新增文章后，启动时会自动清理已经不存在的旧收藏 ID。

## 沉浸模式与导出 PDF

沉浸模式由 `app.js` 内的 `setImmersive / refreshImmersiveUI` 管理：给 `body` 加 `immersive` 类，隐藏顶栏与两侧栏，并注入右上角悬浮按钮（`#imx-bar`）和底部章节导航（`#imx-nav`）。控件在无操作 2.8 秒后自动隐藏（`chrome-hidden` 类），移动端同样适用；`Esc` 或 ✕ 退出。

“导出 PDF”复用正文渲染函数，把整篇（长篇为全部章节）写入隐藏的 `#print-root`，加 `body.printing` 后调用 `window.print()`，由浏览器打印面板“另存为 PDF”生成文件。A4 版式、段缩进、行距、章节分页等规则集中在 `main.css` 的 `@media print` 区块。文章数据文件无需任何改动。
