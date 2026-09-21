import { parseBookmarks, readStorage, writeStorage } from '../lib/storage';

export function announce(message: string) {
  const status = document.querySelector('#status');
  if (status) status.textContent = message;
}

function legacyRoute() {
  if (!location.hash.startsWith('#/')) return;
  try {
    const parts = location.hash.slice(2).split('/').map(decodeURIComponent);
    if (parts[0] === 'read' && /^[a-zA-Z0-9_-]+$/.test(parts[1] ?? '')) {
      const id = parts[1];
      const chapter = id === 'tianhuaban' ? `${Math.max(1, Math.min(20, Number(parts[2]) || 1))}/` : '';
      const section = parts[2] === 'section' ? `#section-${Number(parts[3]) || 1}` : '';
      location.replace(`/articles/${id}/${chapter}${section}`);
    } else if (parts[0] === 'favorites') location.replace('/me/bookmarks/');
    else if (parts[0] === 'section') location.replace(`/catalog/?volume=${encodeURIComponent(parts[1] ?? '')}`);
    else if (parts[0] === 'home') history.replaceState(null, '', '/');
  } catch { announce('旧链接无法识别，可以从目录重新打开。'); }
}
legacyRoute();
window.addEventListener('hashchange', legacyRoute);

function renderBookmarks() {
  const ids = parseBookmarks(readStorage('yb_favs'));
  document.querySelectorAll<HTMLButtonElement>('[data-bookmark]').forEach(button => {
    const selected = ids.includes(button.dataset.bookmark ?? '');
    button.setAttribute('aria-pressed', String(selected));
    button.textContent = selected ? '已收藏' : '收藏';
  });
  let visible = 0;
  document.querySelectorAll<HTMLElement>('[data-bookmark-item]').forEach(item => {
    item.hidden = !ids.includes(item.dataset.bookmarkItem ?? '');
    if (!item.hidden) visible++;
  });
  const empty = document.querySelector<HTMLElement>('#bookmark-empty');
  if (empty) empty.hidden = visible > 0;
}
document.querySelectorAll<HTMLButtonElement>('[data-bookmark]').forEach(button => {
  button.addEventListener('click', () => {
    const id = button.dataset.bookmark!;
    const ids = parseBookmarks(readStorage('yb_favs'));
    const next = ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id];
    if (!writeStorage('yb_favs', JSON.stringify(next))) { announce('此浏览器无法保存收藏，请检查存储设置。'); return; }
    renderBookmarks(); announce(next.includes(id) ? '书签已夹好。' : '已移除书签。');
  });
});
renderBookmarks();
window.addEventListener('storage', renderBookmarks);
document.querySelector('[data-share]')?.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(location.href); announce('链接已复制，可以分享给书友了。'); }
  catch { announce('请复制地址栏链接进行分享。'); }
});

const reader = document.querySelector<HTMLElement>('[data-article-id]');
if (reader) {
  const id = reader.dataset.articleId!;
  const chapter = Number(reader.dataset.chapter) || 1;
  const key = `yb_scroll_${id}_${chapter}`;
  const saved = Number(readStorage(key));
  if (new URLSearchParams(location.search).has('resume') && saved > 0) window.scrollTo(0, saved);
  writeStorage('yb_last', JSON.stringify({ id, chapter, ts: Date.now() }));
  writeStorage(`yb_visited_${id}`, String(chapter));
  let timer: ReturnType<typeof setTimeout>;
  window.addEventListener('scroll', () => {
    clearTimeout(timer);
    timer = setTimeout(() => writeStorage(key, String(window.scrollY)), 180);
  }, { passive: true });
  window.addEventListener('pagehide', () => writeStorage(key, String(window.scrollY)));
}
let historyCount = 0;
document.querySelectorAll<HTMLElement>('[data-history-item]').forEach(item => {
  const id = item.dataset.historyItem!;
  const chapter = Number(readStorage(`yb_visited_${id}`));
  item.hidden = !chapter;
  if (chapter) {
    historyCount++;
    const link = item.querySelector('a')!;
    link.href = `/articles/${id}/${id === 'tianhuaban' ? `${chapter}/` : ''}?resume=1`;
  }
});
const historyEmpty = document.querySelector<HTMLElement>('#history-empty');
if (historyEmpty) historyEmpty.hidden = historyCount > 0;
