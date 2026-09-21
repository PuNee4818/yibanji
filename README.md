# 一班集 · Community V2

Astro + TypeScript 中文阅读社区。原有 54 篇作品、9 卷和《天花板》20 章的正文、注释、署名及日期保持完整；文章静态生成，社区数据来自 Supabase。个人主页和动态详情使用 Node 服务端路由。

## 本地运行

需要 Node.js 24。执行 `npm ci`，复制 `.env.example` 为 `.env.local`，配置项目 URL 与 publishable key，然后 `npm run dev`。

只支持 `PUBLIC_SUPABASE_URL` 与 `PUBLIC_SUPABASE_PUBLISHABLE_KEY`。不需要 secret key；任何服务端凭据都不能使用 `PUBLIC_` 前缀。`.env.local`、其他环境文件和 secret 文件均被 Git 排除。

## 数据库与验证

```sh
npx supabase login
npx supabase link --project-ref ytunoluschycqiscufea
npm run db:migrate
npm run check
npm run test:db
npm run test:deploy
```

浏览器测试和数据库测试使用真实远程 Supabase，需网络可用以及已登录的 CLI。生成的测试账号和内容在测试结束时清理；密码和 token 不进入仓库。不要将测试指向未经授权的其他项目。

`check` 包括 build、Astro/TypeScript 检查、ESLint、单元测试、原始内容 SHA-256 完整性校验、桌面和移动端 Playwright 回归及自动 WCAG AA 检查。`test:db` 验证真实 RLS、权限、签到、奖励、流水、并发消费、幂等、评论、关注、动态、通知和管理操作。网络或断言失败均会使命令失败。

## 部署

Vercel 使用仓库根目录和 `main` 生产分支；`vercel.json` 固定 Astro 框架、`npm ci` 安装与 `npm run build:vercel` 构建。不要将根目录或旧 `index.html` 作为静态站点发布。Vercel 构建自动使用官方 Vercel adapter，生成静态页面和个人主页、动态详情所需的服务端函数。

在 Vercel 项目的 Environment Variables 中配置 `PUBLIC_SUPABASE_URL` 和 `PUBLIC_SUPABASE_PUBLISHABLE_KEY`，应用到 Production（预览部署也使用时同时选择 Preview），再重新部署。值来自本地 `.env.local`；该文件被 Git 排除，不会自动同步到 Vercel。不要添加 secret key 或旧的 anon key 变量。Vercel 使用 Node.js 24；本地构建继续支持 Node standalone。

执行 `npm run build`，在 Node 主机设置 `HOST=0.0.0.0`、`PORT=4321` 后执行 `npm start`。部署需要包含 `dist/client` 和 `dist/server`；不能只上传静态 HTML。公开 Supabase 配置在构建时注入，切换项目后需要重新构建。

在 Supabase Auth 的 URL Configuration 中设置实际生产站点 URL 和允许的回调地址；生产域名未确定前不要填写猜测地址。邮箱确认使用 Supabase Auth，正式运营应配置自己的 SMTP 并检查邮件送达。数据库日历默认 `Asia/Shanghai`；修改 `.env.local` 的 `SITE_TIMEZONE` 后运行 `npm run db:migrate` 同步。

## 管理员

先正常注册管理员本人账号，再用已认证 CLI 的操作者在本机运行 `npm run admin -- grant <准确用户名>`；撤销使用 `revoke`。此命令通过受信任数据库权限授予角色并写审计记录，不通过用户 metadata 授权。没有默认管理员，也没有默认密码。管理员使用 `/admin/moderation/` 处理举报、内容和账号状态，或进行带理由与流水的资产调整。

更多事务规则、日历边界和操作说明见 [数据库说明](docs/DATABASE.md) 与 [验收记录](docs/ACCEPTANCE.md)。

## 文学阅读界面与 PDF

首页包含三篇序言、续读、真实热文和收藏入口；目录可按诗歌、散文、短篇小说、长篇小说筛选。文体与篇首序规则集中在 `src/lib/presentation.ts`，不修改原始正文。搜索支持全局快捷浮层、命中预览、章节定位，以及公开讨论和书友检索。

`npm run build` 和 `npm run build:vercel` 会生成 54 篇整篇 PDF 与 20 份小说分章 PDF。`npm run pdf` 可单独生成，输出在被 Git 忽略的 `public/pdf/`；首次生成需要数分钟，后续按正文、生成器和字体指纹复用。PDF 使用嵌入式中文字体、A4 页边距、章节分页、页眉和页码，普通构建只需要 Node.js，不依赖系统中文字体或 Python。

字体来自 [Noto Serif CJK](https://github.com/notofonts/noto-cjk/tree/main/Serif)，完整源字体与 SIL OFL 许可位于 `tools/fonts/`，网页仅加载 `public/fonts/ReadingSerif.woff2` 字符子集。新增正文后可安装 `fonttools`、`brotli` 并运行 `python tools/subset-reading-font.py` 更新子集；缺少的网页字符仍会回退到系统宋体，不影响原文或 PDF。

可选 PDF 验收：安装 PyMuPDF 后运行 `python tools/verify-pdfs.py --render`，逐段核验正文、注释、落款、字体嵌入和空白页，并在 `tmp/ux-review/pdf/` 输出检查结果与抽样页面。`npm run audit:styles` 使用 CSS 解析器检查重复规则、属性、跨文件同条件覆盖和不合理的强制优先级。

本轮范围、历史功能恢复及验证结果见 [重构验收记录](docs/UX_REFACTOR_ACCEPTANCE_2026-09-21.md)。
