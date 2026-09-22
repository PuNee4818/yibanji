import { supabase, friendlyError, rpc, getCurrentUser } from '../lib/supabase';
import { announce } from './site';
import { levelBadge, type Growth } from '../lib/growth';
import { safeLocalPath } from '../lib/navigation';

export async function refreshUser() {
  const user = await getCurrentUser();
  document.querySelectorAll<HTMLElement>('[data-auth-only]').forEach((el) => {
    el.hidden = !user;
  });
  document.querySelectorAll<HTMLElement>('[data-guest-only]').forEach((el) => (el.hidden = !!user));
  if (user) {
    void supabase
      .from('user_progress')
      .select('level')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        const caption = document.querySelector('.menu-caption');
        if (data && caption) {
          caption.replaceChildren('我的书房 ', levelBadge(data.level));
        }
      });
    void rpc<{ is_admin: boolean }>('account_capabilities')
      .then((c) =>
        document
          .querySelectorAll<HTMLElement>('[data-admin-only]')
          .forEach((el) => (el.hidden = !c?.is_admin)),
      )
      .catch(() => {});
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    if (profile) {
      document
        .querySelectorAll<HTMLAnchorElement>('[data-my-profile]')
        .forEach((link) => (link.href = `/u/${profile.username}/`));
      const avatar = document.querySelector('.avatar');
      if (avatar) avatar.textContent = profile.display_name.slice(0, 1);
    }
  }
  return user;
}
void refreshUser();
document.addEventListener('growth-updated', (event) => {
  const level = (event as CustomEvent<Growth>).detail.progress.level;
  document.querySelector('.menu-caption')?.replaceChildren('我的书房 ', levelBadge(level));
});
supabase.auth.onAuthStateChange((event) => {
  if (event !== 'INITIAL_SESSION') setTimeout(() => void refreshUser(), 0);
});
document.querySelector('[data-signout]')?.addEventListener('click', async () => {
  const { error } = await supabase.auth.signOut();
  if (error) announce(friendlyError(error));
  else location.href = '/';
});
const authForm = document.querySelector<HTMLFormElement>('#auth-form');
if (authForm) {
  authForm.querySelector('button')!.disabled = false;
  document.querySelector('#auth-message')!.textContent = '';
}
authForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = new FormData(authForm);
  const button = authForm.querySelector('button')!;
  button.disabled = true;
  const email = String(data.get('email'));
  const password = String(data.get('password'));
  const message = document.querySelector('#auth-message')!;
  message.textContent = '正在连接书房…';
  try {
    const signup = data.get('mode') === 'signup';
    const response = signup
      ? await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: new URL('/auth/', location.origin).href },
        })
      : await supabase.auth.signInWithPassword({ email, password });
    if (response.error) {
      message.textContent = friendlyError(response.error);
      return;
    }
    if (signup && !response.data.session) {
      message.textContent = '请检查邮箱，确认注册后即可登录。';
      return;
    }
    const next = new URLSearchParams(location.search).get('next');
    location.href = safeLocalPath(next, location.origin);
  } catch {
    message.textContent = '网络暂时不可用，请稍后再试。';
  } finally {
    button.disabled = false;
  }
});
