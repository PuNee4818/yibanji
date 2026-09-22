import { getCurrentUser, rpc } from '../lib/supabase';
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
  if (!user) {
    state.textContent =
      '登录后，可在不同设备查看来稿' + (kind === 'history' ? '阅读记录。' : '收藏。');
    state.append(link(' 登录 →', '/auth/?next=' + encodeURIComponent(location.pathname)));
    return;
  }
  const next = append ? page + 1 : 0;
  more.disabled = true;
  try {
    const rows = await rpc<Submission[]>('submission_feed', { p_sort: kind, p_page: next });
    if (!append) list.replaceChildren();
    rows.forEach((row) => {
      const card = submissionCard(row);
      if (kind === 'history') card.querySelector<HTMLAnchorElement>('h2 a')!.href += '?resume=1';
      list.append(card);
    });
    page = next;
    more.hidden = rows.length < 20;
    state.textContent = list.childElementCount
      ? '你的来稿' + (kind === 'history' ? '阅读记录' : '收藏')
      : '这里还没有记录，去自由来稿读一篇吧。';
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
