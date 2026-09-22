import { supabase, rpc, friendlyError, getCurrentUser } from '../lib/supabase';
import { announce } from './site';
const user = await getCurrentUser();
const badges = document.querySelectorAll('[data-notification-count]');
async function unread() {
  if (!user) return;
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null);
  badges.forEach((b) => (b.textContent = count ? ' · ' + count + ' 条未读' : ''));
}
if (user) void unread();
const list = document.querySelector('#notification-list');
if (list && user) {
  let page = 0;
  const filter = document.querySelector<HTMLSelectElement>('#notification-filter')!;
  const more = document.querySelector<HTMLButtonElement>('#notification-more')!;
  async function render(append = false) {
    let query = supabase
      .from('notifications')
      .select('*')
      .order('updated_at', { ascending: false })
      .order('id', { ascending: false })
      .range(page * 20, page * 20 + 19);
    if (filter.value !== 'all') query = query.eq('kind', filter.value);
    const { data, error } = await query;
    if (error) {
      announce(friendlyError(error));
      return;
    }
    if (!append) list!.replaceChildren();
    if (!data.length && !append)
      list!.textContent =
        filter.value === 'all'
          ? '还没有消息。有新的回复、点赞或关注，会在这里通知你。'
          : '这一类消息暂时为空。';
    for (const n of data) {
      const card = document.createElement('article');
      card.className = 'notification-card';
      card.dataset.unread = String(!n.read_at);
      const link = document.createElement('a');
      link.href = /^\/(?!\/)/.test(n.href) ? n.href : '/notifications/';
      link.textContent = (n.kind === 'system' ? '' : `${n.actor_count} 位书友`) + n.title;
      const time = document.createElement('small');
      time.textContent = new Date(n.updated_at).toLocaleString('zh-CN');
      link.addEventListener('click', (event) => {
        event.preventDefault();
        void rpc('mark_notifications_read', { p_ids: [n.id] })
          .then(() => (location.href = link.href))
          .catch((error) => announce((error as Error).message));
      });
      card.append(link, time);
      if (!n.read_at) {
        const b = document.createElement('button');
        b.textContent = '标为已读';
        b.addEventListener('click', async () => {
          try {
            await rpc('mark_notifications_read', { p_ids: [n.id] });
            await render();
            await unread();
          } catch (error) {
            announce((error as Error).message);
          }
        });
        card.append(b);
      }
      list!.append(card);
    }
    more.hidden = data.length < 20;
  }
  document.querySelector('#read-all')?.addEventListener('click', async () => {
    try {
      await rpc('mark_notifications_read');
      page = 0;
      await render();
      await unread();
    } catch (error) {
      announce((error as Error).message);
    }
  });
  filter.addEventListener('change', () => {
    page = 0;
    void render();
  });
  more.addEventListener('click', () => {
    page++;
    void render(true);
  });
  await render();
}
const dialog = document.querySelector<HTMLDialogElement>('#report-dialog');
const form = document.querySelector<HTMLFormElement>('#report-form');
let target: { kind: string; id: string } | undefined;
document.addEventListener('report-content', (event) => {
  if (!user) {
    location.href = `/auth/?next=${encodeURIComponent(location.pathname)}`;
    return;
  }
  target = (event as CustomEvent).detail;
  form?.reset();
  document.querySelector('[data-report-result]')!.textContent = '';
  dialog?.showModal();
});
document.querySelectorAll<HTMLElement>('[data-report-profile]').forEach((b) =>
  b.addEventListener('click', () =>
    document.dispatchEvent(
      new CustomEvent('report-content', {
        detail: { kind: 'profile', id: b.dataset.reportProfile },
      }),
    ),
  ),
);
form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!target) return;
  const b = form.querySelector('button')!;
  b.disabled = true;
  try {
    await rpc('submit_report', {
      p_kind: target.kind,
      p_id: target.id,
      p_reason: new FormData(form).get('reason'),
    });
    dialog?.close();
    announce('举报已提交，将由管理员处理。');
  } catch (error) {
    document.querySelector('[data-report-result]')!.textContent = (error as Error).message;
  } finally {
    b.disabled = false;
  }
});
