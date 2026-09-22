import { supabase, getCurrentUser } from '../lib/supabase';
import { announce } from './site';
import { parseBookmarks, readStorage } from '../lib/storage';
function renderLocal() {
  const ids = parseBookmarks(readStorage('yb_favs'));
  let bookmarks = 0,
    history = 0;
  document.querySelectorAll<HTMLElement>('[data-bookmark-item]').forEach((item) => {
    item.hidden = !ids.includes(item.dataset.bookmarkItem!);
    if (!item.hidden) bookmarks++;
  });
  document.querySelectorAll<HTMLElement>('[data-history-item]').forEach((item) => {
    const id = item.dataset.historyItem!;
    const chapter = Number(readStorage(`yb_visited_${id}`));
    item.hidden = !chapter;
    if (chapter) {
      history++;
      item.querySelector('a')!.href =
        `/articles/${id}/${id === 'tianhuaban' ? `${chapter}/` : ''}?resume=1`;
    }
  });
  const bookmarkEmpty = document.querySelector<HTMLElement>('#bookmark-empty');
  const historyEmpty = document.querySelector<HTMLElement>('#history-empty');
  if (bookmarkEmpty) bookmarkEmpty.hidden = bookmarks > 0;
  if (historyEmpty) historyEmpty.hidden = history > 0;
}
const loading = document.querySelector<HTMLElement>('[data-library-loading]')!;
try {
  const user = await getCurrentUser();
  if (user) {
    if (document.querySelector('[data-bookmark-item]')) {
      const refresh = async () => {
        const { data, error } = await supabase
          .from('bookmarks')
          .select('article_id')
          .eq('user_id', user.id);
        if (error) {
          loading.textContent = '收藏暂时无法同步，请刷新重试。';
          return;
        }
        const ids = new Set(data.map((row) => row.article_id));
        document
          .querySelectorAll<HTMLElement>('[data-bookmark-item]')
          .forEach((el) => (el.hidden = !ids.has(el.dataset.bookmarkItem!)));
        document.querySelector<HTMLElement>('#bookmark-empty')!.hidden = Array.from(
          document.querySelectorAll<HTMLElement>('[data-bookmark-item]'),
        ).some((el) => !el.hidden);
        loading.hidden = true;
      };
      await refresh();
    }
    if (document.querySelector('[data-history-item]')) {
      const { data, error } = await supabase
        .from('reading_progress')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });
      if (error) {
        renderLocal();
        loading.hidden = true;
        announce('阅读历史暂时无法同步，当前显示此设备记录。');
      } else {
        document
          .querySelectorAll<HTMLElement>('[data-history-item]')
          .forEach((el) => (el.hidden = true));
        for (const row of data) {
          const item = document.querySelector<HTMLElement>(
            `[data-history-item="${CSS.escape(row.article_id)}"]`,
          );
          if (item) {
            item.hidden = false;
            const a = item.querySelector('a')!;
            a.href = `/articles/${encodeURIComponent(row.article_id)}/${row.article_id === 'tianhuaban' ? `${row.chapter}/` : ''}?resume=1`;
            const progress = document.createElement('small');
            progress.textContent = ` 读至 ${Math.round(row.position * 100)}%`;
            a.append(progress);
            item.parentElement!.append(item);
          }
        }
        document.querySelector<HTMLElement>('#history-empty')!.hidden = Array.from(
          document.querySelectorAll<HTMLElement>('[data-history-item]'),
        ).some((el) => !el.hidden);
        loading.hidden = true;
      }
    }
  } else {
    renderLocal();
    loading.hidden = true;
    window.addEventListener('storage', () => {
      if (document.documentElement.dataset.authState === 'guest') renderLocal();
    });
  }
} catch {
  loading.textContent = '记录暂时无法读取，请刷新重试。';
}
