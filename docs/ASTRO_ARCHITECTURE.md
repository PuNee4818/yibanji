# 当前站点架构

## 内容

`content/` 和 `data/` 为只读原始内容。构建前 `tools/generate-content.mjs` 使用隔离的 VM 执行本地注册数据，生成忽略提交的 `src/generated/book.json`。原始注册器已从浏览器运行时代码移到 `tools/content-registry.cjs`。

Astro 在构建时生成每篇文章及每章的 HTML，正文不依赖浏览器 JavaScript。`tests/fixtures/content-baseline.json` 固定迁移前各篇作品的 SHA-256；Playwright 另对生成的 HTML 逐段比对正文、注释、落款。

## 页面与浏览器交互

页面在 `src/pages/`，共享框架在 `src/layouts/`，阅读组件在 `src/components/`。主题和排版使用 `src/styles/global.css` 语义变量，刊物组件在 `publication.css`。深色主题不靠反色滤镜。

`src/scripts/site.ts` 处理旧 hash 路由、旧 `yb_favs` 收藏、分享和设备阅读记录；`preferences.ts` 处理可持久化阅读设置、系统外观变化、键盘操作和专注阅读。搜索索引只在用户搜索时下载。正文与用户输入使用文本节点呈现。

旧 SPA 的 `index.html`、`assets/` 运行时、打印导出 UI、印章与重复工具栏已经移除。Git 历史中仍保留完整旧版本。

## 验收

`npm run check` 是阶段门禁：真实 Astro build、严格 Astro/TypeScript 检查、ESLint、Node 单测、内容完整性、Playwright。浏览器测试覆盖桌面和移动端、浅色和深色、禁用 JavaScript、WCAG AA 自动扫描、横向溢出、键盘菜单、旧链接与旧收藏。

开发：`npm run dev`。预览：`npm run preview`。这两个命令在前台启动，便于测试统一管理进程。

## 社区迁移边界

阶段 3 的社区页仅是明确标记尚未开放的入口，不生成假用户、假评论或假统计。后续必须以真实数据库联调替换此状态。
Supabase 只允许 URL 与 publishable key 公开；所有结构通过版本化 migrations 管理，经济资产由数据库事务和 RLS 管理。

其他 `UI_*`、`ARCHITECTURE.md` 和 `MAINTENANCE.md` 是旧版审计记录，当前命令和入口以此文及根目录 README 为准。
