import { tt as __exportAll } from "./errors_0dR6m3_b.mjs";
import { S as createAstro, d as maybeRenderHead, i as renderComponent, p as addAttribute, u as renderTemplate } from "./server_Pzyg4nIJ.mjs";
import { t as createComponent } from "./compiler_CUdIgYt6.mjs";
import { n as $$Layout, r as renderScript, t as supabase } from "./supabase_B6HD0_-y.mjs";
//#region src/components/Discussion.astro
createAstro("https://astro.build");
var $$Discussion = createComponent(($$result, $$props, $$slots) => {
	const Astro = $$result.createAstro($$props, $$slots);
	Astro.self = $$Discussion;
	const { kind, target } = Astro.props;
	return renderTemplate`${maybeRenderHead($$result)}<section id="comments" class="discussion-section"${addAttribute(kind, "data-discussion-kind")}${addAttribute(target, "data-discussion-target")}><div class="section-heading"><h2>在这里，聊两句</h2><label>评论排序<select data-comment-sort><option value="hot">最热</option><option value="newest">最新</option><option value="oldest">最早</option></select></label></div><p data-guest-only><a${addAttribute(`/auth/?next=${encodeURIComponent(Astro.url.pathname + "#comments")}`, "href")}>登录后参与讨论 →</a></p><form class="form-stack" data-comment-form data-auth-only hidden><label>留下你的感想<textarea name="content" maxlength="2000" required placeholder="说说你读到了什么，也给不同的观点留一点空间。"></textarea></label><p data-reply-hint hidden></p><div><button>发表讨论</button><button type="button" data-cancel-reply hidden>取消回复</button></div></form><div data-comments-list aria-live="polite"><p class="muted">正在翻开讨论…</p></div><button data-more-comments hidden>查看更多讨论</button></section>${renderScript($$result, "D:/GitHub/yibanji/src/components/Discussion.astro?astro&type=script&index=0&lang.ts")}`;
}, "D:/GitHub/yibanji/src/components/Discussion.astro", void 0);
//#endregion
//#region src/pages/community/posts/[id].astro
var _id__exports = /* @__PURE__ */ __exportAll({
	default: () => $$Id,
	file: () => $$file,
	prerender: () => false,
	url: () => $$url
});
createAstro("https://astro.build");
var $$Id = createComponent(async ($$result, $$props, $$slots) => {
	const Astro = $$result.createAstro($$props, $$slots);
	Astro.self = $$Id;
	const { data: post } = await supabase.from("community_posts").select("*").eq("id", Astro.params.id ?? "").eq("status", "visible").maybeSingle();
	if (!post) Astro.response.status = 404;
	return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": "书友动态" }, { "default": ($$result) => renderTemplate`${post ? renderTemplate`${maybeRenderHead($$result)}<section class="narrow-page"${addAttribute(post.id, "data-post-id")}><p><a href="/community/">← 回到社区</a></p><h1>书友动态</h1><div data-post-body><p>${post.content}</p></div>${post.article_id && renderTemplate`<p><a${addAttribute(`/articles/${post.article_id}/`, "href")}>阅读引用的文章 →</a></p>`}${renderComponent($$result, "Discussion", $$Discussion, {
		"kind": "post_comment",
		"target": post.id
	})}</section>` : renderTemplate`<section class="empty-state"><h1>这条动态暂时无法查看</h1><a href="/community/">回到社区</a></section>`}${renderScript($$result, "D:/GitHub/yibanji/src/pages/community/posts/[id].astro?astro&type=script&index=0&lang.ts")}` })}`;
}, "D:/GitHub/yibanji/src/pages/community/posts/[id].astro", void 0);
var $$file = "D:/GitHub/yibanji/src/pages/community/posts/[id].astro";
var $$url = "/community/posts/[id]/";
//#endregion
//#region \0virtual:astro:page:src/pages/community/posts/[id]@_@astro
var page = () => _id__exports;
//#endregion
export { page };
