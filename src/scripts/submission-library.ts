import { getCurrentUser, rpc, supabase } from '../lib/supabase';
import { parseBookmarks, readStorage } from '../lib/storage';
import type { Submission } from '../lib/submissions';
import { submissionCard, link, el } from './submission-ui';
const section = document.querySelector<HTMLElement>('[data-submission-library]')!;
const kind = section.dataset.submissionLibrary!,
  state = section.querySelector<HTMLElement>('[data-submission-library-state]')!,
  list = section.querySelector<HTMLElement>('[data-submission-library-list]')!,
  more = section.querySelector<HTMLButtonElement>('[data-submission-library-more]')!;
const user = await getCurrentUser();
let page = 0;
async function load(append = false) {
  const next = append ? page + 1 : 0;
  more.disabled = true;
  try {
    let rows: Submission[];
    let hasMore = false;
    if (user) {
      rows = await rpc<Submission[]>('submission_feed', { p_sort: kind, p_page: next });
      hasMore = rows.length === 20;
    } else {
      const ids = parseBookmarks(
        readStorage(kind === 'bookmarks' ? 'yb_favs' : 'yb_reading_ids'),
      ).filter((id) => /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id));
      const batch = ids.slice(next * 20, (next + 1) * 20);
      if (batch.length) {
        const result = await supabase.from('submission_public').select('*').in('id', batch);
        if (result.error) throw result.error;
        rows = batch.flatMap((id) => result.data.filter((row) => row.id === id)) as Submission[];
      } else rows = [];
      hasMore = ids.length > (next + 1) * 20;
    }
    if (!append) list.replaceChildren();
    rows.forEach((row) => {
      const card = submissionCard(row);
      if (kind === 'history') card.querySelector<HTMLAnchorElement>('h2 a')!.href += '?resume=1';
      list.append(card);
    });
    page = next;
    more.hidden = !hasMore;
    state.textContent = list.childElementCount
      ? '你的来稿' + (kind === 'history' ? '阅读记录' : '收藏')
      : '这里还没有记录，去自由来稿读一篇吧。';
    if (!user)
      state.append(
        link(' 登录后跨设备同步 →', '/auth/?next=' + encodeURIComponent(location.pathname)),
      );
  } catch {
    state.textContent = '来稿记录暂时无法读取。';
    const retry = el('button', '重试');
    retry.addEventListener('click', () => void load(append));
    state.append(retry);
  } finally {
    more.disabled = false;
  }
}
more.addEventListener('click', () => void load(true));
void load();
