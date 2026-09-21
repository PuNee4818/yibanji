import { supabase, rpc, getCurrentUser } from '../lib/supabase';
import { announce } from './site';
import { readStorage, writeStorage } from '../lib/storage';
import type { Discussion } from '../lib/discussion';
import { discussionCard } from './discussion-render';
const user = await getCurrentUser();
const list = document.querySelector<HTMLElement>('[data-feed]');
if (list) {
  const validTab = (value: string | null) =>
    ['hot', 'latest', 'following'].includes(value ?? '') ? value! : 'hot';
  let tab = validTab(new URLSearchParams(location.search).get('tab'));
  let page = 0;
  let request = 0;
  let loading = false;
  const more = document.querySelector<HTMLButtonElement>('[data-more-feed]')!;
  const description = document.querySelector('[data-feed-description]')!;
  function selected() {
    document.querySelectorAll<HTMLAnchorElement>('[data-feed-tab]').forEach((a) => {
      if (a.dataset.feedTab === tab) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    description.textContent =
      tab === 'hot'
        ? '最近七天，书友正在聊的事。'
        : tab === 'latest'
          ? '新写下的话，按时间排列。'
          : '只看你关注的书友。';
  }
  function empty() {
    const box = document.createElement('div');
    box.className = 'empty-state';
    const p = document.createElement('p');
    p.textContent =
      tab === 'hot'
        ? '最近七天还没有热门讨论。'
        : tab === 'following'
          ? '这里还没有关注的书友动态。'
          : '还没有新的讨论，第一段感想可以由你写下。';
    const a = document.createElement('a');
    a.href = tab === 'latest' ? '#compose' : '?tab=latest';
    a.className = 'button';
    a.textContent = tab === 'latest' ? '写点感想 →' : '看看最新讨论 →';
    box.append(p, a);
    return box;
  }
  async function refresh(append = false) {
    if (append && loading) return;
    const version = ++request;
    const targetPage = append ? page + 1 : page;
    loading = true;
    more.disabled = true;
    selected();
    list!.querySelector('.error-state')?.remove();
    if (tab === 'following' && !user) {
      list!.replaceChildren();
      const p = document.createElement('p');
      p.className = 'empty-state';
      p.textContent = '登录后，看看你关注的书友最近聊了什么。';
      const a = document.createElement('a');
      a.href = '/auth/?next=' + encodeURIComponent('/community/?tab=following');
      a.textContent = '登录并发现书友 →';
      p.append(document.createElement('br'), a);
      list!.append(p);
      more.hidden = true;
      loading = false;
      more.disabled = false;
      return;
    }
    try {
      const groups = await Promise.all(
        (append ? [targetPage] : Array.from({ length: targetPage + 1 }, (_, i) => i)).map((p) =>
          rpc<Discussion[]>('community_feed', { p_tab: tab, p_page: p }),
        ),
      );
      if (version !== request) return;
      if (!append) list!.replaceChildren();
      page = targetPage;
      const rows = groups.flat();
      if (!rows.length && !append) list!.append(empty());
      for (const row of rows) {
        if (list!.querySelector('#comment-' + CSS.escape(row.id))) continue;
        list!.append(discussionCard(row, user?.id, () => refresh()));
      }
      more.hidden = groups[groups.length - 1]!.length < 20;
    } catch (error) {
      if (version !== request) return;
      list!.querySelector('.skeleton')?.remove();
      const box = document.createElement('div');
      box.className = 'error-state';
      const p = document.createElement('p');
      p.textContent = (error as Error).message;
      const retry = document.createElement('button');
      retry.textContent = '重新加载';
      retry.addEventListener('click', () => void refresh(append));
      box.append(p, retry);
      list!.append(box);
    } finally {
      if (version === request) {
        loading = false;
        more.disabled = false;
      }
    }
  }
  document.querySelectorAll<HTMLAnchorElement>('[data-feed-tab]').forEach((a) =>
    a.addEventListener('click', (event) => {
      event.preventDefault();
      tab = validTab(a.dataset.feedTab ?? null);
      page = 0;
      history.pushState(null, '', '?tab=' + tab);
      void refresh();
    }),
  );
  window.addEventListener('popstate', () => {
    tab = validTab(new URLSearchParams(location.search).get('tab'));
    page = 0;
    void refresh();
  });
  more.addEventListener('click', () => void refresh(true));
  const form = document.querySelector<HTMLFormElement>('#post-form')!;
  const area = form.elements.namedItem('content') as HTMLTextAreaElement;
  const reference = form.elements.namedItem('article_id') as HTMLSelectElement;
  const draftKey = 'yb_post_draft_' + (user?.id ?? 'guest');
  const count = document.querySelector('[data-draft-count]')!;
  const status = document.querySelector('[data-post-status]')!;
  let key = crypto.randomUUID();
  let submitted = '';
  try {
    const draft = JSON.parse(readStorage(draftKey) ?? 'null');
    if (draft && typeof draft.content === 'string') {
      area.value = draft.content.slice(0, 500);
      reference.value = String(draft.article ?? '');
      status.textContent = '上次未发出的文字已保留。';
    }
  } catch {
    /* Invalid drafts never block posting. */
  }
  function saveDraft() {
    count.textContent = area.value.length + ' / 500';
    writeStorage(draftKey, JSON.stringify({ content: area.value, article: reference.value }));
  }
  count.textContent = area.value.length + ' / 500';
  area.addEventListener('input', saveDraft);
  reference.addEventListener('change', saveDraft);
  form
    .querySelector<HTMLInputElement>('[data-reference-search]')
    ?.addEventListener('input', (e) => {
      const q = (e.target as HTMLInputElement).value.toLowerCase();
      for (const option of reference.options)
        option.hidden =
          !!option.value &&
          !((option.textContent ?? '') + ' ' + option.dataset.author).toLowerCase().includes(q);
    });
  document.querySelector('[data-compose-open]')?.addEventListener('click', () => {
    if (user) requestAnimationFrame(() => area.focus());
  });
  if (location.hash === '#compose' && user) area.focus();
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!user) {
      location.href = '/auth/?next=' + encodeURIComponent('/community/#compose');
      return;
    }
    const body = area.value;
    const target = reference.value || null;
    const fingerprint = JSON.stringify([body, target]);
    if (submitted !== fingerprint) {
      key = crypto.randomUUID();
      submitted = fingerprint;
    }
    const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    button.disabled = true;
    status.textContent = '正在发布…';
    try {
      await rpc('save_discussion', {
        p_kind: 'post',
        p_target: target,
        p_content: body,
        p_key: key,
      });
      form.reset();
      submitted = '';
      saveDraft();
      tab = 'latest';
      page = 0;
      history.replaceState(null, '', '?tab=latest');
      await refresh();
      status.textContent = '已发布，新动态就在下方。';
      announce('新动态已经写下。');
    } catch (error) {
      status.textContent = (error as Error).message;
    } finally {
      button.disabled = false;
    }
  });
  void refresh();
}
const highlights = document.querySelector('[data-highlights]');
if (highlights) {
  try {
    const data = await rpc<{
      hot: { id: string; title: string; author: string; discussions: number }[];
      eggs: { id: string; title: string; eggs: number }[];
    }>('community_highlights');
    const { data: discussed, error } = await supabase
      .from('article_stats')
      .select('comment_count,article:articles!inner(id,title,active)')
      .eq('article.active', true)
      .gt('comment_count', 0)
      .order('comment_count', { ascending: false })
      .limit(5)
      .overrideTypes<
        { comment_count: number; article: { id: string; title: string; active: boolean } }[],
        { merge: false }
      >();
    if (error) throw error;
    const most = (discussed ?? []).map((row) => ({
      ...row.article,
      discussions: row.comment_count,
    }));
    highlights.replaceChildren();
    for (const [label, rows] of [
      ['本周热文', data.hot],
      ['讨论最多', most],
      ['鸡蛋横飞', data.eggs],
    ] as const) {
      const h = document.createElement('h2');
      h.textContent = label;
      highlights.append(h);
      if (!rows.length) {
        const p = document.createElement('p');
        p.className = 'muted';
        p.textContent = '本周还没有足够的互动，先翻开一篇吧。';
        highlights.append(p);
      }
      for (const row of rows) {
        const p = document.createElement('p');
        const a = document.createElement('a');
        a.href = `/articles/${row.id}/`;
        a.textContent = row.title;
        p.append(a);
        highlights.append(p);
      }
    }
  } catch {
    highlights.textContent = '社区热点暂时无法加载。';
  }
}
const recent = document.querySelector('[data-recent-discussions]');
if (recent) {
  try {
    const rows = await rpc<Discussion[]>('community_feed', { p_tab: 'latest', p_page: 0 });
    recent.replaceChildren();
    for (const row of rows.slice(0, 3))
      recent.append(discussionCard(row, user?.id, async () => location.reload()));
    if (!rows.length) recent.textContent = '还没有新的讨论，读完一篇来聊两句吧。';
  } catch {
    recent.textContent = '最近讨论暂时无法加载。';
  }
}
const post = document.querySelector<HTMLElement>('[data-post-id]');
if (post) {
  const id = post.dataset.postId!;
  const render = async () => {
    const { data } = await supabase
      .from('discussion_items')
      .select('*')
      .eq('kind', 'post')
      .eq('id', id)
      .single();
    if (data) {
      const target = document.querySelector('[data-post-body]')!;
      target.replaceChildren(discussionCard(data as Discussion, user?.id, render));
    }
  };
  await render();
  if (user) void rpc('visit_community', { p_post: id }).catch(() => {});
}
