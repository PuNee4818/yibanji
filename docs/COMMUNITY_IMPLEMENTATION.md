# Community V2 实施记录

基线：`40fb7b3`；工作分支：`codex/community-v2`。
原始内容：54 篇、9 卷、《天花板》20 章。`tests/fixtures/content-baseline.json` 固定每篇完整数据的 SHA-256，禁止为迁移更新基线。

阶段依次执行：
1. chore: clean repository and repair tooling
2. refactor: migrate site foundation to Astro
3. refactor: rebuild design system and navigation
4. feat: add Supabase auth profiles and social graph
5. feat: add community growth and reward economy
6. feat: add article interactions and egg throwing
7. feat: add comments community posts and feeds
8. feat: add notifications moderation and reward center
9. test: harden accessibility security concurrency and regression

每阶段 `npm run check`：build / strict TypeScript / lint / unit / content integrity / Playwright desktop + mobile。
阶段 1 的 build 是旧站的真实静态构建，阶段 2 切换 Astro。保留旧站测试作为迁移验收起点。

安全约定：仅 URL 和 publishable key 可带 PUBLIC_ 前缀；不读取、生成或提交任何服务端 secret。
数据库由 `supabase/migrations/` 管理，经济写操作必须由带权限检查的事务 RPC 完成。
用户原文只读，正文、注释和落款全部保留；去掉的是打印 UI 与装饰印章。

远程验收必须使用真实 Supabase。CLI 浏览器授权或数据库密码阻塞时，停止远程阶段并说明，不以 mock 替代通过。
