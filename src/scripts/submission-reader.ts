import { supabase, getCurrentUser, rpc } from '../lib/supabase';
import { announce } from './site';
import { submissionCard, el } from './submission-ui';
import type { Submission } from '../lib/submissions';
const reader = document.querySelector<HTMLElement>('[data-submission-reader]');
if (reader) {
  const related = document.querySelector<HTMLElement>('[data-related-works]')!;
  async function loadRelated() {
    try {
      const rows = await rpc<Submission[]>('submission_feed', {
        p_genre: reader!.dataset.submissionGenre,
      });
      const works = rows.filter((row) => row.id !== reader!.dataset.submissionReader).slice(0, 2);
      related.replaceChildren(...works.map(submissionCard));
      if (!works.length) related.append(el('p', '暂时没有同类新作，可以去投稿页逛逛。', 'muted'));
    } catch {
      const retry = el('button', '重新加载推荐', 'quiet-button');
      retry.addEventListener('click', () => {
        retry.disabled = true;
        void loadRelated();
      });
      related.replaceChildren(el('p', '推荐暂时无法加载，仍可继续阅读其他作品。', 'muted'), retry);
    }
  }
  const relatedObserver = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        relatedObserver.disconnect();
        void loadRelated();
      }
    },
    { rootMargin: '200px' },
  );
  relatedObserver.observe(related);
  const author = reader.dataset.submissionAuthor!;
  const user = await getCurrentUser();
  const login = () => {
    location.href = '/auth/?next=' + encodeURIComponent(location.pathname + location.search);
  };
  document.querySelector<HTMLElement>('[data-submission-edit]')!.hidden = user?.id !== author;
  const follow = document.querySelector<HTMLButtonElement>('[data-submission-follow]')!;
  follow.hidden = user?.id === author;
  if (user) {
    const { data, error } = await supabase
      .from('user_follows')
      .select('following_id')
      .eq('follower_id', user.id)
      .eq('following_id', author);
    follow.disabled = Boolean(error);
    if (data?.length) {
      follow.textContent = '已关注作者';
      follow.setAttribute('aria-pressed', 'true');
    }
  } else follow.disabled = false;
  follow.addEventListener('click', async () => {
    if (!user) {
      login();
      return;
    }
    follow.disabled = true;
    try {
      const value = follow.getAttribute('aria-pressed') !== 'true';
      await rpc('set_follow', { p_user_id: author, p_following: value });
      follow.setAttribute('aria-pressed', String(value));
      follow.textContent = value ? '已关注作者' : '关注作者';
    } catch (error) {
      announce((error as Error).message);
    } finally {
      follow.disabled = false;
    }
  });
}
