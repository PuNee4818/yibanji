# 数据库操作与验收

远程 ref：`ytunoluschycqiscufea`。只从 `.env.local` 加载公开 URL 与 publishable key；CLI 登录凭据由 Supabase CLI 自己保存。

本机已通过浏览器完成 `supabase login` 和 `supabase link`。`supabase db push` 的直接 Postgres 连接失败，而 `supabase db query --linked` 的 Management API 通道可用。因此 `npm run db:migrate` 调用已认证 CLI 的此通道，每个迁移与 `supabase_migrations.schema_migrations` 记录、SHA-256 校验记录在同一事务内提交。迁移源码仍只在 `supabase/migrations/`；已应用文件禁止修改，变更必须新增迁移。

`npm run test:db` 创建随机的真实 Supabase Auth 测试账号，通过实际密码登录后以普通用户客户端调用 RPC，验证 RLS、事务和并发；测试结束删除本次创建的账号。测试密码仅在进程内存与忽略提交的短期 SQL 文件中使用，不打印，也不写到 PUBLIC 环境变量。

所有客户端数据库写入走 RPC。RPC 固定空 search_path，内部表不暴露给 Data API，普通用户无直接表写权限。用户身份仅由 auth.uid() 确定；受限状态由数据库强制执行。

运行：`npm run db:migrate`、`npm run check`、`npm run test:db`。远程验收需要已登录的 CLI 和配置正确的 `.env.local`，失败应修复原因而非跳过检查。

页面的个人主页采用 Astro Node 服务端路由，部署需启动 Node adapter 输出；不能仅把静态 HTML 上传到不支持服务端路由的空间。

本地 Auth 站点与允许回调已通过 `supabase config diff` 审查后推送到 4321 端口，密码最低长度为 8，邮箱确认保持启用。配置文件仅声明有意管理的设置，避免将 `supabase init` 的本地默认值覆盖远程设置。生产部署前需改成真实 HTTPS 域名并再次审查 diff；不要把本地地址配置推送到已经正式运营的项目。
