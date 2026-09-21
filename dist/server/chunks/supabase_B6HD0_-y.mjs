import { S as createAstro, d as maybeRenderHead, f as renderHead, i as renderComponent, m as createRenderInstruction, p as addAttribute, s as renderSlot, u as renderTemplate } from "./server_Pzyg4nIJ.mjs";
import { t as createComponent } from "./compiler_CUdIgYt6.mjs";
import { createClient } from "@supabase/supabase-js";
//#region node_modules/astro/dist/runtime/server/render/script.js
async function renderScript(result, id) {
	const inlined = result.inlinedScripts.get(id);
	let content = "";
	if (inlined != null) {
		if (inlined) content = `<script type="module">${inlined}<\/script>`;
	} else {
		const resolved = await result.resolve(id);
		content = `<script type="module" src="${result.userAssetsBase ? (result.base === "/" ? "" : result.base) + result.userAssetsBase : ""}${resolved}"><\/script>`;
	}
	return createRenderInstruction({
		type: "script",
		id,
		content
	});
}
//#endregion
//#region src/components/Checkin.astro
var $$Checkin = createComponent(($$result, $$props, $$slots) => {
	return renderTemplate`${maybeRenderHead($$result)}<dialog id="checkin-dialog" aria-labelledby="checkin-title"><form method="dialog"><button class="dialog-close" aria-label="关闭签到面板">关闭</button></form><p class="eyebrow">每天见一面</p><h2 id="checkin-title">每日签到</h2><p id="checkin-summary">正在打开签到簿…</p><ol id="checkin-tiers" class="reward-tiers"></ol><button id="checkin-submit">签到，领取今日奖励</button><p id="checkin-result" role="status"></p><p class="muted">不必赶时间。读书与交流，总有下一次相遇。</p></dialog>${renderScript($$result, "D:/GitHub/yibanji/src/components/Checkin.astro?astro&type=script&index=0&lang.ts")}`;
}, "D:/GitHub/yibanji/src/components/Checkin.astro", void 0);
//#endregion
//#region src/components/Report.astro
var $$Report = createComponent(($$result, $$props, $$slots) => {
	return renderTemplate`${maybeRenderHead($$result)}<dialog id="report-dialog" aria-labelledby="report-title"><div class="dialog-heading"><h2 id="report-title">举报内容</h2><form method="dialog"><button aria-label="关闭举报面板">关闭</button></form></div><p>请说明具体问题。举报仅管理员可见。</p><form id="report-form" class="form-stack"><label>举报原因<textarea name="reason" minlength="5" maxlength="1000" required placeholder="例如：垃圾广告、骚扰或泄露个人隐私。"></textarea></label><button>提交举报</button><p data-report-result role="status"></p></form></dialog>${renderScript($$result, "D:/GitHub/yibanji/src/components/Report.astro?astro&type=script&index=0&lang.ts")}`;
}, "D:/GitHub/yibanji/src/components/Report.astro", void 0);
//#endregion
//#region src/layouts/Layout.astro
createAstro("https://astro.build");
var $$Layout = createComponent(($$result, $$props, $$slots) => {
	const Astro = $$result.createAstro($$props, $$slots);
	Astro.self = $$Layout;
	const { title = "一班集", description = "一班集，一间安静、克制、适合阅读的中文数字刊物。" } = Astro.props;
	const path = Astro.url.pathname;
	return renderTemplate`<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description"${addAttribute(description, "content")}><meta name="color-scheme" content="light dark"><meta name="theme-color" content="#f8f4eb"><title>${title === "一班集" ? title : `${title} · 一班集`}</title><script>
      (() => {
        let theme = 'system';
        try { theme = localStorage.getItem('yb_theme') || 'system'; } catch { /* Reading stays available without storage. */ }
        document.documentElement.dataset.theme = theme === 'dark' || (theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
      })();
    <\/script>${renderHead($$result)}</head><body><a class="skip-link" href="#main">跳到正文</a><header class="site-header"><a class="brand" href="/" aria-label="一班集首页">一班集<span>文字留住时光</span></a><nav aria-label="主导航"><a href="/"${addAttribute(path === "/" ? "page" : void 0, "aria-current")}>首页</a><a href="/catalog/"${addAttribute(path.startsWith("/catalog") ? "page" : void 0, "aria-current")}>目录</a><a href="/community/"${addAttribute(path.startsWith("/community") ? "page" : void 0, "aria-current")}>社区</a></nav><div class="header-actions"><a class="search-link" href="/search/" aria-label="搜索文集"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"></circle><path d="m16 16 5 5"></path></svg><span>搜索</span></a><button id="theme-toggle" class="icon-button" aria-label="切换到夜间模式"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="12" r="8"></circle><path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor"></path></svg></button><details class="user-menu"><summary aria-label="打开个人菜单"><span class="avatar" aria-hidden="true">读</span></summary><nav aria-label="个人菜单"><p class="menu-caption">我的书房</p><a href="/auth/" data-guest-only>登录 / 注册</a><a href="/me/settings/" data-my-profile data-auth-only hidden>我的主页</a><a href="/me/bookmarks/">我的收藏</a><a href="/me/history/">阅读历史</a><a href="/notifications/" data-auth-only hidden>消息<span data-notification-count></span></a><button data-open-checkin data-auth-only hidden>每日签到</button><a href="/me/rewards/">奖励与任务</a><a href="/me/settings/">阅读设置</a><a href="/community/guidelines/">社区规范</a><a href="/admin/moderation/" data-admin-only hidden>社区管理</a><button data-signout data-auth-only hidden>退出登录</button></nav></details></div></header><main id="main" tabindex="-1">${renderSlot($$result, $$slots["default"])}</main><footer class="site-footer"><div><a class="footer-brand" href="/">一班集</a><p>有些时光，值得写下来。</p></div><div class="footer-links"><a href="/catalog/">文集目录</a><a href="/community/guidelines/">社区规范</a><span>第二版 · 九卷五十四篇</span></div></footer><div id="status" role="status" aria-live="polite"></div>${renderComponent($$result, "Checkin", $$Checkin, {})}${renderComponent($$result, "Report", $$Report, {})}${renderScript($$result, "D:/GitHub/yibanji/src/layouts/Layout.astro?astro&type=script&index=0&lang.ts")}${renderScript($$result, "D:/GitHub/yibanji/src/layouts/Layout.astro?astro&type=script&index=1&lang.ts")}</body></html>`;
}, "D:/GitHub/yibanji/src/layouts/Layout.astro", void 0);
//#endregion
//#region src/lib/supabase.ts
var url = "https://ytunoluschycqiscufea.supabase.co";
var key = "sb_publishable_iKA3oF6-0DvjyVugWUgHrA_qVsYeI9M";
if (!key.startsWith("sb_publishable_")) throw new Error("Supabase public configuration is missing");
var supabase = createClient(url, key, {
	auth: {
		persistSession: typeof window !== "undefined",
		autoRefreshToken: typeof window !== "undefined",
		detectSessionInUrl: typeof window !== "undefined"
	},
	global: { fetch: (input, init) => fetch(input, {
		...init,
		signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(3e4)]) : AbortSignal.timeout(3e4)
	}) }
});
//#endregion
export { $$Layout as n, renderScript as r, supabase as t };
