import { rpc, getCurrentUser } from '../lib/supabase';
import { announce } from './site';
import { parseBookmarks, readStorage, writeStorage } from '../lib/storage';
interface Context {
  liked: boolean;
  bookmarked: boolean;
  my_eggs: number;
  balance: number | null;
  stats: {
    view_count: number;
    like_count: number;
    egg_count: number;
    comment_count: number;
    bookmark_count: number;
  } | null;
}
const root = document.querySelector<HTMLElement>('[data-interactions]');
if (root) {
  const id = root.dataset.interactions!;
  const like = root.querySelector<HTMLButtonElement>('[data-like]')!;
  const bookmark = root.querySelector<HTMLButtonElement>('[data-article-bookmark]')!;
  const dialog = root.querySelector<HTMLDialogElement>('#egg-dialog')!;
  const form = root.querySelector<HTMLFormElement>('#egg-form')!;
  const localMarked = parseBookmarks(readStorage('yb_favs')).includes(id);
  bookmark.setAttribute('aria-pressed', String(localMarked));
  bookmark.querySelector('[data-action-label]')!.textContent = localMarked ? '已收藏' : '收藏';
  const user = await getCurrentUser();
  let context: Context | undefined;
  async function refresh() {
    context = await rpc<Context>('article_context', { p_article: id });
    const s = context.stats;
    like.setAttribute('aria-pressed', String(context.liked));
    like.querySelector('[data-action-label]')!.textContent = context.liked ? '已点赞' : '点赞';
    const marked = user ? context.bookmarked : parseBookmarks(readStorage('yb_favs')).includes(id);
    bookmark.setAttribute('aria-pressed', String(marked));
    bookmark.querySelector('[data-action-label]')!.textContent = marked ? '已收藏' : '收藏';
    const stats = root!.querySelector('[data-article-stats]')!;
    stats.replaceChildren();
    if (s) {
      for (const [value, label] of [
        [s.view_count, '次阅读'],
        [s.like_count, '人点赞'],
        [s.egg_count, '枚臭鸡蛋'],
        [s.comment_count, '条评论'],
      ] as const) {
        const row = document.createElement('span');
        row.className = 'article-stat';
        const count = document.createElement('strong');
        count.textContent = String(value);
        const caption = document.createElement('span');
        caption.textContent = label;
        row.append(count, document.createTextNode(' '), caption);
        stats.append(row);
      }
    } else stats.textContent = '互动暂时不可用';
    root!.querySelector('[data-egg-wallet]')!.textContent =
      `你有 ${context.balance ?? 0} 枚臭鸡蛋 · 已向本文投出 ${context.my_eggs} 枚`;
  }
  const login = () => {
    location.href = `/auth/?next=${encodeURIComponent(location.pathname)}`;
  };
  document.addEventListener('discussion-mutated', () => void refresh().catch(() => {}));
  async function change(kind: string, button: HTMLButtonElement) {
    if (!user) {
      if (kind === 'like') {
        login();
        return;
      }
      const ids = parseBookmarks(readStorage('yb_favs'));
      const marked = ids.includes(id);
      const next = marked ? ids.filter((x) => x !== id) : [...ids, id];
      if (!writeStorage('yb_favs', JSON.stringify(next))) {
        announce('此浏览器无法保存收藏。');
        return;
      }
      button.setAttribute('aria-pressed', String(!marked));
      button.querySelector('[data-action-label]')!.textContent = marked ? '收藏' : '已收藏';
      announce(marked ? '已移除书签。' : '书签已夹好。');
      document.dispatchEvent(new Event('bookmarks-changed'));
      return;
    }
    button.disabled = true;
    try {
      await rpc('set_article_state', {
        p_article: id,
        p_kind: kind,
        p_active: button.getAttribute('aria-pressed') !== 'true',
      });
      await refresh();
      if (kind === 'bookmark') document.dispatchEvent(new Event('bookmarks-changed'));
    } catch (error) {
      announce((error as Error).message);
    } finally {
      button.disabled = false;
    }
  }
  like.addEventListener('click', () => void change('like', like));
  bookmark.addEventListener('click', () => void change('bookmark', bookmark));
  root.querySelector('[data-egg-open]')!.addEventListener('click', () => {
    if (!user) {
      login();
      return;
    }
    dialog.showModal();
    void refresh().catch((e) => announce(e.message));
  });
  let pending: { key: string; quantity: number } | null = null;
  form.querySelectorAll<HTMLButtonElement>('[data-quantity]').forEach((button) =>
    button.addEventListener('click', () => {
      (form.elements.namedItem('quantity') as HTMLInputElement).value = button.dataset.quantity!;
      form.requestSubmit();
    }),
  );
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!user) return;
    const quantity = Number(new FormData(form).get('quantity'));
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) return;
    if (!pending || pending.quantity !== quantity) pending = { key: crypto.randomUUID(), quantity };
    const current = pending;
    form.querySelectorAll('button').forEach((b) => (b.disabled = true));
    try {
      const result = await rpc<{ balance: number; quantity: number }>('throw_eggs', {
        p_article: id,
        p_quantity: quantity,
        p_idempotency_key: current.key,
      });
      pending = null;
      root!.querySelector('[data-egg-result]')!.textContent =
        `砰——${result.quantity} 枚臭鸡蛋已经飞过去了。剩余 ${result.balance} 枚。`;
      await refresh();
    } catch (error) {
      root!.querySelector('[data-egg-result]')!.textContent = (error as Error).message;
    } finally {
      form.querySelectorAll('button').forEach((b) => (b.disabled = false));
    }
  });
  try {
    await rpc('track_view', { p_article: id });
    await refresh();
  } catch {
    root.querySelector('[data-article-stats]')!.textContent = '互动暂时无法加载，正文仍可阅读。';
  }
  if (user) {
    try {
      const token = await rpc<string>('begin_read', { p_article: id });
      const article = document.querySelector<HTMLElement>('[data-article-id]')!;
      const chapter = Number(article.dataset.chapter) || 1;

      const timer = setInterval(async () => {
        if (document.visibilityState !== 'visible') return;
        const body = document.querySelector('.prose')!.getBoundingClientRect();
        const depth = Math.max(0, Math.min(1, (innerHeight - body.top) / Math.max(body.height, 1)));
        const position = Math.max(
          0,
          Math.min(1, scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight)),
        );
        try {
          await rpc('sync_reading', {
            p_session: token,
            p_depth: depth,
            p_chapter: chapter,
            p_position: position,
          });
        } catch {
          clearInterval(timer);
        }
      }, 10000);
      window.addEventListener('pagehide', () => clearInterval(timer), { once: true });
    } catch {
      announce('阅读进度暂时无法同步，此设备仍会保存位置。');
    }
  }
}
