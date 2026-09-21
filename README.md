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
