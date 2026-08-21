# 一班集网页工程结构

## 分层

- `index.html`：壳层，仅负责页面容器和核心资源入口。
- `assets/`：UI 与运行时代码。
- `data/`：目录、卷目、结构提示和内容清单，不保存正文。
- `content/`：作品正文，按卷分类。
- `docs/`：维护文档。
- `tools/`：静态校验。

## 正文目录

- `00-front-matter` 卷首
- `01-guyuan` 故园
- `02-xiaotan` 笑谈
- `03-shijian` 诗笺
- `04-zhiyi` 志异
- `05-mimeng` 迷梦
- `06-tianwai` 天外
- `07-jiandao` 剪刀
- `99-back-matter` 卷末

每篇文章独立注册到 `YB_CONTENT`。长篇《天花板》采用 `meta.js + chapters/01.js...20.js`，后续增加或修改章节不需要触碰其他作品。

## 启动流程

1. `content-registry.js` 初始化内容注册表。
2. `book-meta.js` 提供文集目录。
3. `content-manifest.js` 提供需要加载的正文文件。
4. `bootstrap.js` 加载正文并执行结构校验。
5. 校验成功后才启动 `app.js`。

这使“正文缺文件 / ID 重复 / 文章放错卷”在页面启动阶段就能被明确发现，而不是悄悄产生错误目录。
