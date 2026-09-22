import { rpc } from '../lib/supabase';
import { refreshUser } from './auth';
import { announce } from './site';
export function setupProfileEditor(root: HTMLElement) {
  const button = root.querySelector<HTMLButtonElement>('[data-profile-edit]')!;
  const dialog = root.querySelector<HTMLDialogElement>('#profile-edit-dialog')!;
  const form = dialog.querySelector<HTMLFormElement>('#profile-form')!;
  const submit = form.querySelector<HTMLButtonElement>('[type="submit"]')!;
  const status = form.querySelector('[data-profile-save-status]')!;
  const field = (key: string) => form.elements.namedItem(key) as HTMLInputElement;
  button.addEventListener('click', () => {
    field('username').value = root.dataset.profileUsername!;
    field('display_name').value = root.dataset.profileName!;
    field('bio').value = root.dataset.profileBio || '';
    status.textContent = '';
    dialog.showModal();
    field('display_name').focus();
  });
  dialog.addEventListener('close', () => button.focus());
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (submit.disabled) return;
    submit.disabled = true;
    status.textContent = '正在保存…';
    const username = field('username').value.trim(),
      name = field('display_name').value.trim(),
      bio = field('bio').value.trim();
    try {
      await rpc('save_profile', { p_username: username, p_display_name: name, p_bio: bio });
      if (username !== root.dataset.profileUsername) {
        location.replace('/u/' + encodeURIComponent(username) + '/');
        return;
      }
      root.dataset.profileName = name;
      root.dataset.profileBio = bio;
      root.querySelector('[data-profile-display-name]')!.textContent = name;
      root.querySelector('[data-profile-bio-text]')!.textContent = bio || '在字里行间，慢慢相识。';
      root.querySelector('.profile-avatar')!.textContent = Array.from(name)[0] || '读';
      document.title = name + ' · 一班集';
      dialog.close();
      announce('个人资料已更新。');
      await refreshUser();
    } catch (error) {
      status.textContent = (error as Error).message;
    } finally {
      submit.disabled = false;
    }
  });
}
