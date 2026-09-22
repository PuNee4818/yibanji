import { supabase, friendlyError } from '../lib/supabase';
type Person = { id: string; username: string; display_name: string; bio: string };
export function setupRelations(root: HTMLElement, id: string) {
  const dialog = root.querySelector<HTMLDialogElement>('#profile-relations-dialog')!;
  const list = dialog.querySelector<HTMLElement>('[data-relations-list]')!;
  const more = dialog.querySelector<HTMLButtonElement>('[data-relations-more]')!;
  let kind: 'following' | 'followers' = 'following',
    page = 0,
    version = 0,
    busy = false;
  let opener: HTMLElement | null = null;
  async function refreshCounts() {
    const { data } = await supabase
      .from('profile_summaries')
      .select('following_count,follower_count')
      .eq('id', id)
      .maybeSingle();
    if (data) {
      root.querySelector('[data-following-count]')!.textContent = String(data.following_count);
      root.querySelector('[data-follower-count]')!.textContent = String(data.follower_count);
    }
  }
  async function load(append = false) {
    if (append && busy) return;
    const token = ++version,
      target = append ? page + 1 : 0;
    busy = true;
    more.disabled = true;
    list.setAttribute('aria-busy', 'true');
    list.querySelector('.error-state')?.remove();
    if (!append)
      list.replaceChildren(
        Object.assign(document.createElement('p'), {
          textContent: '正在寻找书友…',
          className: 'muted',
        }),
      );
    dialog
      .querySelectorAll<HTMLButtonElement>('[data-relations-tab]')
      .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.relationsTab === kind)));
    dialog.querySelector('h2')!.textContent =
      kind === 'following' ? '关注的书友' : '关注这里的书友';
    try {
      const relation = kind === 'following' ? 'following_id' : 'follower_id';
      const filter = kind === 'following' ? 'follower_id' : 'following_id';
      const { data, error } = await supabase
        .from('user_follows')
        .select(
          'created_at,person:profiles!user_follows_' +
            relation +
            '_fkey(id,username,display_name,bio)',
        )
        .eq(filter, id)
        .order('created_at', { ascending: false })
        .order(relation)
        .range(target * 20, target * 20 + 19);
      if (error) throw new Error(friendlyError(error));
      if (token !== version) return;
      if (!append) list.replaceChildren();
      const rows = data as unknown as { person: Person }[];
      for (const { person } of rows) {
        if (!person || list.querySelector('[data-person="' + CSS.escape(person.id) + '"]'))
          continue;
        const a = document.createElement('a');
        a.className = 'profile-person';
        a.href = '/u/' + encodeURIComponent(person.username) + '/';
        a.dataset.person = person.id;
        const avatar = document.createElement('span');
        avatar.className = 'profile-person-avatar';
        avatar.textContent = Array.from(person.display_name)[0] || '读';
        avatar.setAttribute('aria-hidden', 'true');
        const detail = document.createElement('span');
        const name = document.createElement('strong');
        name.textContent = person.display_name;
        const bio = document.createElement('small');
        bio.textContent = person.bio || '@' + person.username;
        detail.append(name, bio);
        a.append(avatar, detail);
        list.append(a);
      }
      if (!rows.length && !append)
        list.textContent = kind === 'following' ? '还没有关注书友。' : '还没有书友关注这里。';
      page = target;
      more.hidden = rows.length < 20;
    } catch (error) {
      if (token !== version) return;
      if (!append) list.replaceChildren();
      const box = document.createElement('div');
      box.className = 'error-state';
      const p = document.createElement('p');
      p.textContent = (error as Error).message;
      const retry = document.createElement('button');
      retry.textContent = '重新加载';
      retry.addEventListener('click', () => void load(append));
      box.append(p, retry);
      list.append(box);
    } finally {
      if (token === version) {
        busy = false;
        more.disabled = false;
        list.setAttribute('aria-busy', 'false');
      }
    }
  }
  root.querySelectorAll<HTMLButtonElement>('[data-profile-relations]').forEach((b) =>
    b.addEventListener('click', () => {
      opener = b;
      kind = b.dataset.profileRelations as typeof kind;
      dialog.showModal();
      void load();
    }),
  );
  dialog.querySelectorAll<HTMLButtonElement>('[data-relations-tab]').forEach((b) =>
    b.addEventListener('click', () => {
      kind = b.dataset.relationsTab as typeof kind;
      void load();
    }),
  );
  more.addEventListener('click', () => void load(true));
  dialog.addEventListener('close', () => {
    version++;
    busy = false;
    opener?.focus();
  });
  return refreshCounts;
}
