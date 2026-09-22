import { supabase, rpc, getCurrentUser } from '../lib/supabase';
import type { Discussion } from '../lib/discussion';
import { discussionCard } from './discussion-render';
const user = await getCurrentUser();
const list = document.querySelector<HTMLElement>('[data-feed]');
if (list) {
  const validTab = (value: string | null) =>
    ['hot', 'latest', 'following'].includes(value ?? '') ? value! : 'latest';
  const stream =
    document.querySelector<HTMLElement>('[data-community-stream]')!.dataset.communityStream!;
  const topicSelect = document.querySelector<HTMLSelectElement>('[data-feed-topic]');
  let topic = new URLSearchParams(location.search).get('topic') ?? '';
  if (topicSelect) {
    topicSelect.value = topic;
    topic = topicSelect.value;
  }
  function address() {
    const params = new URLSearchParams({ tab });
    if (topic) params.set('topic', topic);
    return '?' + params;
  }
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
        ? '最近七天，受到关注的' + (stream === 'posts' ? '帖子。' : '文章评论。')
        : tab === 'latest'
          ? stream === 'posts'
            ? '独立帖子，按发布时间排列。'
            : '作品下的评论，按时间排列。'
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
    a.href =
      tab === 'latest' ? (stream === 'posts' ? '/community/new/' : '/catalog/') : '?tab=latest';
    a.className = 'button';
    a.textContent =
      tab === 'latest'
        ? stream === 'posts'
          ? '发布第一篇帖子 →'
          : '挑一篇文章来读 →'
        : '看看最新内容 →';
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
      a.href = '/auth/?next=' + encodeURIComponent(location.pathname + '?tab=following');
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
          rpc<Discussion[]>('community_topics', {
            p_stream: stream,
            p_tab: tab,
            p_topic: topic || null,
            p_page: p,
          }),
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
      history.pushState(null, '', address());
      void refresh();
    }),
  );
  window.addEventListener('popstate', () => {
    tab = validTab(new URLSearchParams(location.search).get('tab'));
    topic = new URLSearchParams(location.search).get('topic') ?? '';
    if (topicSelect) {
      topicSelect.value = topic;
      topic = topicSelect.value;
    }
    page = 0;
    void refresh();
  });
  more.addEventListener('click', () => void refresh(true));
  topicSelect?.addEventListener('change', () => {
    topic = topicSelect.value;
    page = 0;
    history.pushState(null, '', address());
    void refresh();
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
    const rows = await rpc<Discussion[]>('community_topics', {
      p_stream: 'posts',
      p_tab: 'latest',
      p_page: 0,
    });
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
    const { data, error } = await supabase
      .from('discussion_items')
      .select('*')
      .eq('kind', 'post')
      .eq('id', id)
      .maybeSingle();
    if (!error && (!data || data.status !== 'visible')) {
      location.replace('/community/');
      return;
    }
    if (data) {
      const heading = document.querySelector('[data-post-title]');
      if (heading) heading.textContent = data.title || '书友帖子';
      const target = document.querySelector('[data-post-body]')!;
      target.replaceChildren(discussionCard(data as Discussion, user?.id, render, undefined, true));
    }
  };
  await render();
  if (user) void rpc('visit_community', { p_post: id }).catch(() => {});
}
