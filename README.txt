一班集 · Community V2（Astro + TypeScript）

直接阅读
--------
npm ci
npm run dev

生产构建：npm run build；构建输出：dist/。
发布前验证：npm run check。
首次运行浏览器测试前：npx playwright install chromium。
不再使用双击 index.html 的旧站启动方式。

目录
----
src/pages/                  Astro 页面与静态路由
src/components/             页面组件
src/layouts/                共享页面框架
src/styles/                 设计样式
src/lib/                    TypeScript 领域模型
src/scripts/                浏览器交互
src/generated/              从原始正文生成，禁止手工编辑或提交
data/book-meta.js           文集元数据、卷目和结构提示
data/content-manifest.js    正文文件清单
content/                     正文源数据，按卷分类
docs/                       维护说明
tools/                      校验工具

设计原则
--------
1. 正文、元数据、运行逻辑、样式分离。
2. 一篇作品一个数据文件；《天花板》进一步按 20 章拆分。
3. 构建时自动验证：重复 ID、目录缺文、卷目错配、长篇章节结构。
4. 目录采用稳定 ASCII 文件夹名，页面展示仍使用中文卷名，避免跨平台部署路径问题。
5. 正文静态输出，无 JavaScript 仍可阅读；交互使用渐进增强。
6. 原文 SHA-256 基线 + 全部页面逐段验证共同保护内容完整性。
7. 本地配置放 .env.local，参照 .env.example；绝不提交真实密钥。
