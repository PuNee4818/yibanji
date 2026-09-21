import { tt as __exportAll } from "./errors_0dR6m3_b.mjs";
import { S as createAstro, d as maybeRenderHead, i as renderComponent, p as addAttribute, u as renderTemplate } from "./server_Pzyg4nIJ.mjs";
import { t as createComponent } from "./compiler_CUdIgYt6.mjs";
import { n as $$Layout, r as renderScript, t as supabase } from "./supabase_B6HD0_-y.mjs";
//#region src/pages/u/[username].astro
var _username__exports = /* @__PURE__ */ __exportAll({
	default: () => $$Username,
	file: () => $$file,
	prerender: () => false,
	url: () => $$url
});
createAstro("https://astro.build");
var $$Username = createComponent(async ($$result, $$props, $$slots) => {
	const Astro = $$result.createAstro($$props, $$slots);
	Astro.self = $$Username;
	const { data: profile, error } = await supabase.from("profile_summaries").select("*").eq("username", Astro.params.username ?? "").maybeSingle();
	if (!profile) Astro.response.status = error ? 503 : 404;
	return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": profile?.display_name ?? "书友主页" }, { "default": ($$result) => renderTemplate`${profile ? renderTemplate`${maybeRenderHead($$result)}<section class="narrow-page"${addAttribute(profile.id, "data-profile-id")}><header class="page-head"><p class="eyebrow">书友 / @${profile.username}</p><h1>${profile.display_name}</h1><p>${profile.bio || "这位书友还没有留下简介。"}</p><p>${profile.following_count} 关注 · ${profile.follower_count} 粉丝 · 加入于 ${new Date(profile.created_at).toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" })}</p><button${addAttribute(profile.id, "data-follow-user")} aria-pressed="false" disabled>关注</button> <button${addAttribute(profile.id, "data-report-profile")}>举报用户</button></header><div id="profile-growth"></div><section id="profile-activity"><h2>公开活动</h2><div data-profile-activity>正在翻开公开讨论…</div><button data-profile-more hidden>查看更多活动</button></section></section>` : renderTemplate`<section class="empty-state"><h1>${error ? "暂时无法打开主页" : "没有找到这位书友"}</h1><a href="/community/">回到社区</a></section>`}${renderScript($$result, "D:/GitHub/yibanji/src/pages/u/[username].astro?astro&type=script&index=0&lang.ts")}` })}`;
}, "D:/GitHub/yibanji/src/pages/u/[username].astro", void 0);
var $$file = "D:/GitHub/yibanji/src/pages/u/[username].astro";
var $$url = "/u/[username]/";
//#endregion
//#region \0virtual:astro:page:src/pages/u/[username]@_@astro
var page = () => _username__exports;
//#endregion
export { page };
