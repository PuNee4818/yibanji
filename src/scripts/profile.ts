import { rpc, getCurrentUser } from '../lib/supabase';
import { growthCard } from './rewards';
import { discussionCard } from './discussion-render';
import type { Discussion } from '../lib/discussion';
const profile = document.querySelector<HTMLElement>('[data-profile-id]');
if (profile) {
  const id = profile.dataset.profileId!;
  const user = await getCurrentUser();
  let page = 0,
    request = 0,
    busy = false;
  let stream =
    new URLSearchParams(location.search).get('stream') === 'comments' ? 'comments' : 'posts';
  const more = document.querySelector<HTMLButtonElement>('[data-profile-more]')!;
  const activity = document.querySelector('[data-profile-activity]')!;
  async function render(append = false) {
    if (append && busy) return;
    const version = ++request;
    const nextPage = append ? page + 1 : 0;
    busy = true;
    more.disabled = true;
    document.querySelectorAll<HTMLAnchorElement>('[data-profile-stream]').forEach((a) => {
      if (a.dataset.profileStream === stream) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    activity.querySelector('.error-state')?.remove();
    try {
      const rows = await rpc<Discussion[]>('community_topics', {
        p_user: id,
        p_stream: stream,
        p_tab: 'latest',
        p_page: nextPage,
      });
      if (version !== request) return;
      if (!append) activity.replaceChildren();
      page = nextPage;
      for (const item of rows)
        if (!activity.querySelector('#comment-' + CSS.escape(item.id)))
          activity.append(discussionCard(item, user?.id, () => render()));
      if (!rows.length && !append)
        activity.textContent =
          stream === 'posts' ? '这位书友还没有发布帖子。' : '这位书友还没有留下评论。';
      more.hidden = rows.length < 20;
    } catch {
      if (version !== request) return;
      const message = document.createElement('p');
      message.className = 'error-state';
      message.textContent = '暂时无法读取公开活动。';
      const retry = document.createElement('button');
      retry.textContent = '重试';
      retry.addEventListener('click', () => void render(append));
      message.append(retry);
      activity.append(message);
    } finally {
      if (version === request) {
        busy = false;
        more.disabled = false;
      }
    }
  }
  document.querySelectorAll<HTMLAnchorElement>('[data-profile-stream]').forEach((a) =>
    a.addEventListener('click', (e) => {
      e.preventDefault();
      stream = a.dataset.profileStream!;
      history.pushState(null, '', '?stream=' + stream);
      void render();
    }),
  );
  window.addEventListener('popstate', () => {
    stream =
      new URLSearchParams(location.search).get('stream') === 'comments' ? 'comments' : 'posts';
    void render();
  });
  more.addEventListener('click', () => void render(true));
  void render();
  try {
    const data = await rpc<{
      progress: { exp: number; level: number };
      featured: string | null;
      badges: { id: string; name: string; description: string }[];
    }>('profile_community', { p_user: id, p_page: 0 });
    const growth = document.querySelector('#profile-growth')!;
    growth.replaceChildren(growthCard(data.progress));
    const wall = document.createElement('div');
    wall.className = 'badge-wall';
    for (const b of data.badges) {
      const span = document.createElement('span');
      span.title = b.description;
      span.className = 'badge';
      span.textContent = (b.id === data.featured ? '★ ' : '') + b.name;
      wall.append(span);
    }
    growth.append(wall);
  } catch {
    document.querySelector('#profile-growth')!.textContent = '成长记录暂时无法加载。';
  }
}
