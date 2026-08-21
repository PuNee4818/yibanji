一班集 · 网页阅读版 v5（模块化工程版）

直接阅读
--------
双击 index.html 即可。部署到 Vercel / CloudBase / Cloudflare Pages 时，上传整个目录。
不要只上传 index.html：正文已按卷目拆分到 content/。

目录
----
index.html                  唯一页面入口
assets/css/main.css         全站样式
assets/js/app.js            阅读器应用逻辑
assets/js/bootstrap.js      启动与内容加载
assets/js/core/             核心基础设施
data/book-meta.js           文集元数据、卷目和结构提示
data/content-manifest.js    正文文件清单
content/                     正文源数据，按卷分类
docs/                       维护说明
tools/                      校验工具

设计原则
--------
1. 正文、元数据、运行逻辑、样式分离。
2. 一篇作品一个数据文件；《天花板》进一步按 20 章拆分。
3. 启动时自动验证：重复 ID、目录缺文、卷目错配、长篇章节结构。
4. 目录采用稳定 ASCII 文件夹名，页面展示仍使用中文卷名，避免跨平台部署路径问题。
5. 搜索区、左栏等需要滚动的区域保留滚动能力，但隐藏浏览器原生滚动条。
