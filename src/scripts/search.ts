import { searchHits, type SearchArticle } from '../lib/search';
import { parseBookmarks, readStorage, writeStorage } from '../lib/storage';
import { discussionUrl, type Discussion } from '../lib/discussion';
let accountBookmarks: string[] | null = null;
let bookmarkRequest: Promise<void> | undefined;
function loadBookmarks() {
  return (bookmarkRequest ??= (async () => {
    const { getCurrentUser, supabase } = await import('../lib/supabase');
    const user = await getCurrentUser();
    if (!user) return;
    const { data, error } = await supabase
      .from('bookmarks')
      .select('article_id')
      .eq('user_id', user.id)
      .abortSignal(AbortSignal.timeout(5000));
    if (!error) accountBookmarks = data.map((row) => row.article_id);
    else bookmarkRequest = undefined;
  })().catch(() => {
    bookmarkRequest = undefined;
  }));
}
document.addEventListener('bookmarks-changed', () => {
  accountBookmarks = null;
  bookmarkRequest = undefined;
});
let indexPromise: Promise<SearchArticle[]> | undefined;
function index() {
  return (indexPromise ??= fetch('/search-index.json')
    .then((r) => {
      if (!r.ok) throw new Error('文集索引暂时无法加载');
      return r.json();
    })
    .catch((e) => {
      indexPromise = undefined;
      throw e;
    }));
}
interface Result {
  key: string;
  title: string;
  meta: string;
  text: string;
  href: string;
  preview: string[];
  articleId?: string;
}
const genres: Record<string, string> = {
  poetry: '诗歌',
  essay: '散文',
  story: '短篇小说',
  novel: '长篇小说',
};
function highlight(el: Element, text: string, query: string) {
  const words = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  let position = 0;
  const lower = text.toLocaleLowerCase();
  while (position < text.length) {
    let start = -1;
    let word = '';
    for (const w of words) {
      const i = lower.indexOf(w, position);
      if (i >= 0 && (start < 0 || i < start)) {
        start = i;
        word = w;
      }
    }
    if (start < 0) {
      el.append(document.createTextNode(text.slice(position)));
      break;
    }
    el.append(document.createTextNode(text.slice(position, start)));
    const mark = document.createElement('mark');
    mark.textContent = text.slice(start, start + word.length);
    el.append(mark);
    position = start + word.length;
  }
}
function recentQueries(): string[] {
  try {
    const values = JSON.parse(readStorage('yb_search_history') ?? '[]');
    return Array.isArray(values) ? values.filter((v) => typeof v === 'string').slice(0, 6) : [];
  } catch {
    return [];
  }
}
function pattern(query: string) {
  return '%' + query.replace(/[\\%_]/g, (c) => '\\' + c) + '%';
}
document.querySelectorAll<HTMLElement>('[data-search-panel]').forEach((panel) => {
  const form = panel.querySelector<HTMLFormElement>('form')!;
  const input = panel.querySelector<HTMLInputElement>('[data-query]')!;
  const source = panel.querySelector<HTMLSelectElement>('[data-search-source]')!;
  const genre = panel.querySelector<HTMLSelectElement>('[data-search-genre]')!;
  const list = panel.querySelector<HTMLElement>('[data-search-results]')!;
  const state = panel.querySelector<HTMLElement>('[data-search-state]')!;
  const more = panel.querySelector<HTMLButtonElement>('[data-search-more]')!;
  const preview = panel.querySelector<HTMLElement>('[data-search-preview]')!;
  const previewBody = panel.querySelector<HTMLElement>('[data-preview-body]')!;
  const historyBox = panel.querySelector<HTMLElement>('[data-search-history]')!;
  const full = panel.dataset.full === 'true';
  let version = 0;
  let controller: AbortController | undefined;
  let debounce: ReturnType<typeof setTimeout>;
  let results: Result[] = [];
  let remotePage = 0;
  let localLimit = 30;
  let remoteMore = false;
  let selectedTrigger: HTMLElement | undefined;
  let errors: string[] = [];
  function closePreview() {
    preview.hidden = true;
    selectedTrigger?.focus();
  }
  panel.querySelector('[data-preview-close]')?.addEventListener('click', closePreview);
  function history() {
    historyBox.replaceChildren();
    for (const query of recentQueries()) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = query;
      button.addEventListener('click', () => {
        input.value = query;
        void search();
      });
      historyBox.append(button);
    }
    if (historyBox.childElementCount) {
      const clear = document.createElement('button');
      clear.type = 'button';
      clear.className = 'quiet-button';
      clear.textContent = '清空记录';
      clear.addEventListener('click', () => {
        writeStorage('yb_search_history', '[]');
        history();
      });
      historyBox.append(clear);
    }
  }
  function remember() {
    const q = input.value.trim();
    if (q) {
      writeStorage(
        'yb_search_history',
        JSON.stringify([q, ...recentQueries().filter((v) => v !== q)].slice(0, 6)),
      );
      history();
    }
  }
  function render() {
    list.replaceChildren();
    const query = input.value.trim();
    const bookmarks = accountBookmarks ?? parseBookmarks(readStorage('yb_favs'));
    for (const result of results) {
      const li = document.createElement('li');
      li.className = 'search-result';
      const a = document.createElement('a');
      a.href = result.href;
      highlight(a, result.title, query);
      a.addEventListener('click', remember);
      const meta = document.createElement('small');
      meta.textContent =
        result.meta +
        (result.articleId && bookmarks.includes(result.articleId)
          ? accountBookmarks
            ? ' · 账号已收藏'
            : ' · 本机已收藏'
          : '');
      const p = document.createElement('p');
      highlight(p, result.text, query);
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = '预览 ↗';
      button.setAttribute('aria-label', '预览 ' + result.title);
      button.addEventListener('click', () => {
        selectedTrigger = button;
        previewBody.replaceChildren();
        const title = document.createElement('h3');
        title.textContent = result.title;
        const info = document.createElement('small');
        info.textContent = result.meta;
        previewBody.append(title, info);
        for (const text of result.preview) {
          const p = document.createElement('p');
          highlight(p, text, query);
          previewBody.append(p);
        }
        const open = document.createElement('a');
        open.href = result.href;
        open.className = 'button';
        open.textContent = '打开命中位置 →';
        open.addEventListener('click', remember);
        previewBody.append(open);
        preview.hidden = false;
        preview.scrollTop = 0;
        preview.querySelector<HTMLButtonElement>('[data-preview-close]')?.focus();
      });
      li.append(a, meta, p, button);
      list.append(li);
    }
    state.textContent = results.length
      ? '找到 ' + results.length + ' 条结果' + (errors.length ? ' · ' + errors.join('；') : '')
      : errors.length
        ? errors.join('；')
        : '没有找到，试试篇名、作者或一句原文。';
    if (errors.length) {
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.textContent = '重试未完成的搜索';
      retry.addEventListener('click', () => void search());
      const li = document.createElement('li');
      li.append(retry);
      list.append(li);
    }
    const all = document.querySelector<HTMLAnchorElement>('[data-all-search]');
    if (all)
      all.href =
        '/search/?' + new URLSearchParams({ q: query, source: source.value, genre: genre.value });
  }
  async function search(append = false) {
    const pageBefore = remotePage;
    const request = ++version;
    controller?.abort();
    controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]);
    const query = input.value.trim();
    if (!append) {
      results = [];
      remotePage = 0;
      localLimit = 30;
      list.replaceChildren();
      preview.hidden = true;
    }
    void loadBookmarks().then(() => {
      if (request === version && results.length) render();
    });
    errors = [];
    remoteMore = false;
    more.hidden = true;
    genre.disabled = !['works', 'all'].includes(source.value);
    if (!query) {
      state.textContent = '输入几个字，从这里找起。';
      if (full) historyReplace();
      return;
    }
    state.textContent = '正在寻找…';
    if (full) historyReplace();
    function current() {
      return request === version;
    }
    if (['works', 'all'].includes(source.value)) {
      try {
        const data = await index();
        if (!current()) return;
        const hits = searchHits(data, query).filter(
          (h) => !genre.value || h.article.genre === genre.value,
        );
        const local = hits.slice(0, localLimit).map((h) => ({
          key: 'work:' + h.article.id,
          title: h.article.title,
          meta:
            h.article.author +
            ' · ' +
            h.article.category +
            ' · ' +
            genres[h.article.genre ?? 'essay'] +
            ' · ' +
            h.label,
          text: h.snippet,
          href: h.href,
          articleId: h.article.id,
          preview: h.article.units?.some((u) => u.href === h.href)
            ? h.article.units.filter((u) => u.href === h.href).map((u) => u.text)
            : [h.snippet],
        }));
        results = [...local, ...results.filter((r) => !r.key.startsWith('work:'))];
        render();
        more.hidden = hits.length <= localLimit;
      } catch {
        if (current()) errors.push('文集暂时无法加载，请重试');
      }
    }
    if (source.value !== 'works') {
      try {
        const { supabase } = await import('../lib/supabase');
        if (!current()) return;
        const pending: Promise<void>[] = [];
        const start = remotePage * 20;
        if (['all', 'community'].includes(source.value))
          pending.push(
            (async () => {
              const active = await supabase
                .from('articles')
                .select('id')
                .eq('active', true)
                .abortSignal(signal);
              if (active.error) throw new Error('社区讨论暂时不可用');
              const ids = active.data
                .map((a) => String(a.id))
                .filter((id) => /^[a-zA-Z0-9_-]+$/.test(id));
              let req = supabase
                .from('discussion_items')
                .select('kind,id,target,content,display_name,username,created_at')
                .eq('status', 'visible')
                .in('kind', ['article', 'post']);
              req = ids.length
                ? req.or('target.is.null,target.in.(' + ids.join(',') + ')')
                : req.is('target', null);
              for (const word of query.split(/\s+/)) req = req.ilike('content', pattern(word));
              const { data, error } = await req
                .order('created_at', { ascending: false })
                .order('id')
                .range(start, start + 19)
                .abortSignal(signal);
              if (error) throw new Error('社区讨论暂时不可用');
              if (!current()) return;
              remoteMore ||= data.length === 20;
              for (const row of data) {
                const value = row as Discussion;
                results.push({
                  key: row.kind + ':' + row.id,
                  title: row.display_name + '的' + (row.kind === 'article' ? '文章评论' : '动态'),
                  meta: '社区 · ' + new Date(row.created_at).toLocaleDateString('zh-CN'),
                  text: row.content.slice(0, 160),
                  href: discussionUrl(value),
                  preview: [row.content],
                });
              }
            })(),
          );
        if (['all', 'people'].includes(source.value))
          pending.push(
            (async () => {
              const output = await Promise.all(
                ['display_name', 'username'].map((field) =>
                  supabase
                    .from('profiles')
                    .select('username,display_name,bio')
                    .ilike(field, pattern(query))
                    .order('username')
                    .range(start, start + 19)
                    .abortSignal(signal),
                ),
              );
              if (output.every((r) => r.error)) throw new Error('书友资料暂时不可用');
              if (!current()) return;
              for (const r of output) {
                if (r.error) {
                  errors.push('部分书友资料暂时不可用');
                  continue;
                }
                remoteMore ||= r.data.length === 20;
                for (const row of r.data)
                  results.push({
                    key: 'person:' + row.username,
                    title: row.display_name,
                    meta: '书友 · @' + row.username,
                    text: row.bio || '这位书友还没有写下简介。',
                    href: '/u/' + encodeURIComponent(row.username) + '/',
                    preview: [row.bio || '这位书友还没有写下简介。'],
                  });
              }
            })(),
          );
        const settled = await Promise.allSettled(pending);
        if (!current()) return;
        for (const item of settled)
          if (item.status === 'rejected')
            errors.push(item.reason instanceof Error ? item.reason.message : '部分来源暂时不可用');
      } catch {
        if (current()) errors.push('社区来源暂时不可用，文集仍可搜索');
      }
    }
    if (!current()) return;
    results = [...new Map(results.map((r) => [r.key, r])).values()];
    render();
    more.hidden = more.hidden && !remoteMore;
    if (append && errors.length) remotePage = Math.max(0, pageBefore - 1);
  }
  function historyReplace() {
    const params = new URLSearchParams();
    if (input.value.trim()) params.set('q', input.value.trim());
    if (source.value !== 'works') params.set('source', source.value);
    if (genre.value) params.set('genre', genre.value);
    window.history.replaceState(null, '', location.pathname + (params.size ? '?' + params : ''));
  }
  input.addEventListener('input', () => {
    clearTimeout(debounce);
    version++;
    controller?.abort();
    debounce = setTimeout(() => void search(), 180);
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    clearTimeout(debounce);
    remember();
    void search();
  });
  for (const select of [source, genre]) select.addEventListener('change', () => void search());
  more.addEventListener('click', () => {
    remotePage++;
    localLimit += 30;
    void search(true);
  });
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !preview.hidden) {
      e.preventDefault();
      e.stopPropagation();
      closePreview();
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (e.target instanceof HTMLSelectElement) return;
      const links = [...list.querySelectorAll<HTMLAnchorElement>('.search-result > a')];
      const position = links.indexOf(document.activeElement as HTMLAnchorElement);
      const next =
        e.key === 'ArrowDown'
          ? Math.min(links.length - 1, position + 1)
          : Math.max(0, position - 1);
      if (links[next]) {
        e.preventDefault();
        links[next].focus();
      }
    }
  });
  panel.addEventListener('search-opened', () => {
    if (input.value.trim()) void search();
    else history();
  });
  panel.addEventListener('search-reset', () => {
    version++;
    controller?.abort();
  });
  panel.closest('dialog')?.addEventListener('cancel', (event) => {
    if (!preview.hidden) {
      event.preventDefault();
      closePreview();
    }
  });
  if (full) {
    const p = new URLSearchParams(location.search);
    input.value = (p.get('q') ?? '').slice(0, 100);
    source.value = ['all', 'community', 'people'].includes(p.get('source') ?? '')
      ? p.get('source')!
      : 'works';
    genre.value = p.get('genre') ?? '';
    if (input.value) void search();
  }
  history();
});
const dialog = document.querySelector<HTMLDialogElement>('#search-dialog')!;
let opener: HTMLElement | null = null;
function open() {
  opener = document.activeElement as HTMLElement;
  dialog.showModal();
  dialog.querySelector('[data-search-panel]')?.dispatchEvent(new Event('search-opened'));
  dialog.querySelector<HTMLInputElement>('[data-query]')?.focus();
}
document.querySelectorAll('[data-search-open]').forEach((a) =>
  a.addEventListener('click', (e) => {
    e.preventDefault();
    open();
  }),
);
document.addEventListener('open-search', open);
dialog.addEventListener('click', (e) => {
  if (e.target === dialog) {
    const r = dialog.getBoundingClientRect();
    const p = e as MouseEvent;
    if (p.clientX < r.left || p.clientX > r.right || p.clientY < r.top || p.clientY > r.bottom)
      dialog.close();
  }
});
dialog.addEventListener('close', () => {
  dialog.querySelector('[data-search-panel]')?.dispatchEvent(new Event('search-reset'));
  opener?.focus();
});
