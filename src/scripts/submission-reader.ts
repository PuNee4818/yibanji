import { supabase, getCurrentUser, rpc } from '../lib/supabase';
import { announce } from './site';
const reader = document.querySelector<HTMLElement>('[data-submission-reader]');
if (reader) {
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
