import { supabase, friendlyError, rpc, getCurrentUser } from '../lib/supabase';
import { announce } from './site';
import { levelBadge, type Growth } from '../lib/growth';
import { safeLocalPath } from '../lib/navigation';

interface HeaderIdentity {
  id: string;
  username: string;
  display_name: string;
  level: number | null;
  at: number;
}
const headerKey = 'yb_header_identity_v1';
let refreshVersion = 0;
let activeUser: string | null = null;
let capabilityVersion = 0;
const menu = document.querySelector<HTMLDetailsElement>('.user-menu');
function readIdentity(id: string): HeaderIdentity | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(headerKey) || 'null');
    return value?.id === id &&
      typeof value.username === 'string' &&
      typeof value.display_name === 'string' &&
      Number.isInteger(value.level) &&
      Date.now() >= value.at &&
      Date.now() - value.at < 300000
      ? value
      : null;
  } catch {
    return null;
  }
}
function showIdentity(profile: HeaderIdentity) {
  document
    .querySelectorAll<HTMLAnchorElement>('[data-my-profile]')
    .forEach((link) => (link.href = '/u/' + encodeURIComponent(profile.username) + '/'));
  const avatar = document.querySelector('.avatar');
  if (avatar) avatar.textContent = Array.from(profile.display_name)[0] || '读';
  document
    .querySelector('.menu-caption')
    ?.replaceChildren('我的书房 ', ...(profile.level ? [levelBadge(profile.level)] : []));
}
async function loadCapabilities() {
  const id = activeUser;
  const version = ++capabilityVersion;
  if (!id) return;
  try {
    const c = await rpc<{ is_admin: boolean }>('account_capabilities');
    if (id !== activeUser || version !== capabilityVersion) return;
    document
      .querySelectorAll<HTMLElement>('[data-admin-only]')
      .forEach((el) => (el.hidden = !c?.is_admin));
  } catch {
    /* Keep management hidden when permission cannot be checked. */
  }
}
menu?.addEventListener('toggle', () => {
  if (menu.open) void loadCapabilities();
});

export async function refreshUser(force = false) {
  const version = ++refreshVersion;
  const user = await getCurrentUser();
  if (version !== refreshVersion) return user;
  const changed = activeUser !== (user?.id ?? null);
  activeUser = user?.id ?? null;
  document.documentElement.dataset.authState = user ? 'authenticated' : 'guest';
  document.querySelector<HTMLElement>('[data-auth-retry]')!.hidden = true;
  document.querySelectorAll<HTMLElement>('[data-auth-only]').forEach((el) => {
    el.hidden = !user;
  });
  document.querySelectorAll<HTMLElement>('[data-guest-only]').forEach((el) => (el.hidden = !!user));
  if (changed || !user) {
    capabilityVersion++;
    document.querySelectorAll<HTMLElement>('[data-admin-only]').forEach((el) => (el.hidden = true));
    document.querySelector('.avatar')?.replaceChildren('读');
    document.querySelector('.menu-caption')?.replaceChildren('我的书房');
    document
      .querySelectorAll<HTMLAnchorElement>('[data-my-profile]')
      .forEach((link) => (link.href = '/me/'));
  }
  if (user) {
    if (menu?.open && changed) void loadCapabilities();
    const cached = !force && readIdentity(user.id);
    if (cached) {
      showIdentity(cached);
      return user;
    }
    const [{ data: profile }, { data: progress }] = await Promise.all([
      supabase.from('profiles').select('username,display_name').eq('id', user.id).single(),
      supabase.from('user_progress').select('level').eq('user_id', user.id).single(),
    ]);
    if (profile && version === refreshVersion) {
      const identity = { ...profile, id: user.id, level: progress?.level ?? null, at: Date.now() };
      showIdentity(identity);
      if (progress)
        try {
          sessionStorage.setItem(headerKey, JSON.stringify(identity));
        } catch {
          /* Optional display cache. */
        }
    }
  } else {
    try {
      sessionStorage.removeItem(headerKey);
    } catch {
      /* Storage may be unavailable. */
    }
  }
  return user;
}
function refreshPresentation() {
  void refreshUser().catch(() => {
    document.documentElement.dataset.authState = 'unavailable';
    document.querySelector<HTMLElement>('[data-auth-retry]')!.hidden = false;
  });
}
refreshPresentation();
document.querySelector('[data-auth-retry]')?.addEventListener('click', () => location.reload());
window.addEventListener('pageshow', (event) => {
  if (event.persisted) refreshPresentation();
});
window.addEventListener('pagehide', () => {
  // A history restore must resolve the current account before showing its controls.
  document.documentElement.dataset.authState = 'pending';
});
document.addEventListener('growth-updated', (event) => {
  const level = (event as CustomEvent<Growth>).detail.progress.level;
  document.querySelector('.menu-caption')?.replaceChildren('我的书房 ', levelBadge(level));
  const cached = activeUser && readIdentity(activeUser);
  if (cached)
    try {
      sessionStorage.setItem(headerKey, JSON.stringify({ ...cached, level }));
    } catch {
      /* Optional display cache. */
    }
});
supabase.auth.onAuthStateChange((event) => {
  if (event !== 'INITIAL_SESSION' && event !== 'TOKEN_REFRESHED')
    setTimeout(refreshPresentation, 0);
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
  message.textContent = '正在验证账号…';
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
