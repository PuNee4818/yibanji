import { supabase, rpc, getCurrentUser } from '../lib/supabase';
import { growthCard } from './rewards';
import { discussionCard } from './discussion-render';
import { submissionCard } from './submission-ui';
import type { Submission } from '../lib/submissions';
import type { Discussion } from '../lib/discussion';
import { setupRelations } from './profile-relations';
import { setupProfileEditor } from './profile-editor';
import { announce } from './site';
import { levelBadge, type Growth } from '../lib/growth';
const profile = document.querySelector<HTMLElement>('[data-profile-id]');
if (profile) {
  const id = profile.dataset.profileId!;
  const user = await getCurrentUser();
  const owner = user?.id === id;
  let preview = owner && new URLSearchParams(location.search).get('view') === 'public';
  const refreshCounts = setupRelations(profile, id);
  const follow = profile.querySelector<HTMLButtonElement>('[data-follow-user]')!;
  const privateSection = profile.querySelector<HTMLElement>('[data-profile-private]')!;
  const ownerActions = profile.querySelector<HTMLElement>('[data-profile-owner]')!;
  const previewButton = profile.querySelector<HTMLButtonElement>('[data-profile-preview]')!;
  let growthLoaded = false;
  document.addEventListener('growth-updated', (event) => {
    if (!owner) return;
    const progress = (event as CustomEvent<Growth>).detail.progress;
    profile!.querySelector('[data-profile-level]')!.replaceChildren(levelBadge(progress.level));
    growthLoaded = false;
    if (!preview) void loadGrowth();
  });
  function displayMode() {
    ownerActions.hidden = !owner || preview;
    profile!.querySelector<HTMLElement>('[data-profile-edit]')!.hidden = preview;
    profile!.querySelector<HTMLElement>('[data-profile-write]')!.hidden = !owner || preview;
    privateSection.hidden = !owner || preview;
    profile!.querySelector<HTMLElement>('[data-profile-preview-notice]')!.hidden = !preview;
    profile!.querySelector<HTMLElement>('[data-profile-public-actions]')!.hidden =
      owner && !preview;
    profile!.querySelector<HTMLElement>('[data-report-profile]')!.hidden = owner;
    previewButton.setAttribute('aria-pressed', String(preview));
    previewButton.textContent = preview ? '返回我的视角' : '预览他人视角';
    if (owner) {
      follow.disabled = true;
      follow.textContent = preview ? '关注（预览）' : '关注';
    }
    if (owner && !preview) void loadGrowth();
  }
  function address() {
    const params = new URLSearchParams({ stream });
    if (preview) params.set('view', 'public');
    return '?' + params;
  }
  function togglePreview(on: boolean) {
    if (!owner) return;
    preview = on;
    history.replaceState(null, '', address());
    displayMode();
    void render();
  }
  previewButton.addEventListener('click', () => togglePreview(!preview));
  profile
    .querySelector('[data-profile-preview-exit]')!
    .addEventListener('click', () => togglePreview(false));
  if (owner) setupProfileEditor(profile);
  else {
    if (user) {
      const { data } = await supabase
        .from('user_follows')
        .select('follower_id')
        .eq('follower_id', user.id)
        .eq('following_id', id);
      follow.setAttribute('aria-pressed', String(Boolean(data?.length)));
      follow.textContent = data?.length ? '已关注' : '关注';
    }
    follow.disabled = false;
    follow.addEventListener('click', async () => {
      if (!user) {
        location.href = '/auth/?next=' + encodeURIComponent(location.pathname);
        return;
      }
      follow.disabled = true;
      try {
        const selected = follow.getAttribute('aria-pressed') !== 'true';
        await rpc('set_follow', { p_user_id: id, p_following: selected });
        follow.setAttribute('aria-pressed', String(selected));
        follow.textContent = selected ? '已关注' : '关注';
        announce(selected ? '已关注这位书友。' : '已取消关注。');
        await refreshCounts();
      } catch (error) {
        announce((error as Error).message);
      } finally {
        follow.disabled = false;
      }
    });
  }

  let page = 0,
    request = 0,
    busy = false;
  let stream = ['comments', 'works'].includes(
    new URLSearchParams(location.search).get('stream') || '',
  )
    ? new URLSearchParams(location.search).get('stream')!
    : 'posts';
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
    activity.classList.toggle('submission-grid', stream === 'works');
    activity.querySelector('.error-state')?.remove();
    try {
      if (stream === 'works') {
        const works = await rpc<Submission[]>('submission_feed', { p_user: id, p_page: nextPage });
        if (version !== request) return;
        if (!append) activity.replaceChildren();
        page = nextPage;
        for (const work of works) activity.append(submissionCard(work));
        if (!works.length && !append) activity.textContent = '还没有公开作品，文字正在酝酿中。';
        more.hidden = works.length < 20;
        return;
      }
      const rows = await rpc<Discussion[]>('community_topics', {
        p_user: id,
        p_stream: stream,
        p_tab: 'latest',
        p_page: nextPage,
      });
      if (version !== request) return;
      if (!append) activity.replaceChildren();
      page = nextPage;
      for (const item of rows) {
        if (activity.querySelector('#comment-' + CSS.escape(item.id))) continue;
        const card = discussionCard(item, preview ? undefined : user?.id, () => render());
        if (preview) {
          card
            .querySelectorAll<HTMLButtonElement>('.discussion-actions button')
            .forEach((b) => (b.disabled = true));
          const menu = card.querySelector<HTMLElement>('.discussion-overflow');
          if (menu) menu.hidden = true;
        }
        activity.append(card);
      }
      if (!rows.length && !append)
        activity.textContent =
          owner && !preview
            ? stream === 'posts'
              ? '你还没有发布帖子，写下想和书友聊的话吧。'
              : '你还没有留下评论，读完一篇后记下感受吧。'
            : stream === 'posts'
              ? '这位书友还没有发布帖子。'
              : '这位书友还没有留下评论。';
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
      history.pushState(null, '', address());
      void render();
    }),
  );
  window.addEventListener('popstate', () => {
    preview = owner && new URLSearchParams(location.search).get('view') === 'public';
    displayMode();
    stream = ['comments', 'works'].includes(
      new URLSearchParams(location.search).get('stream') || '',
    )
      ? new URLSearchParams(location.search).get('stream')!
      : 'posts';
    void render();
  });
  more.addEventListener('click', () => void render(true));
  displayMode();
  void render();
  async function loadGrowth() {
    if (!owner || preview || growthLoaded) return;
    growthLoaded = true;
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
      growthLoaded = false;
      const growth = document.querySelector('#profile-growth')!;
      growth.textContent = '成长记录暂时无法加载。';
      const retry = document.createElement('button');
      retry.textContent = '重新加载成长记录';
      retry.addEventListener('click', () => void loadGrowth());
      growth.append(retry);
    }
  }
}
