import { supabase, getCurrentUser } from '../lib/supabase';
import { announce } from './site';
const user = await getCurrentUser();
if (user) {
  if (document.querySelector('[data-bookmark-item]')) {
    const refresh = async () => {
      const { data, error } = await supabase
        .from('bookmarks')
        .select('article_id')
        .eq('user_id', user.id);
      if (error) {
        announce('收藏暂时无法同步，请稍后重试。');
        return;
      }
      const ids = new Set(data.map((row) => row.article_id));
      document
        .querySelectorAll<HTMLElement>('[data-bookmark-item]')
        .forEach((el) => (el.hidden = !ids.has(el.dataset.bookmarkItem!)));
      document.querySelector<HTMLElement>('#bookmark-empty')!.hidden = ids.size > 0;
    };
    await refresh();
  }
  if (document.querySelector('[data-history-item]')) {
    const { data, error } = await supabase
      .from('reading_progress')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });
    if (error) announce('阅读历史暂时无法同步，当前显示此设备记录。');
    else {
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
      document.querySelector<HTMLElement>('#history-empty')!.hidden = data.length > 0;
    }
  }
}
