import { rpc } from '../lib/supabase';
import { announce } from './site';
interface Entry {
  id: string;
  username?: string;
  display_name?: string;
  is_admin?: boolean;
  kind?: string;
  content?: string;
  target_content?: string;
  status: string;
  target_kind?: string;
  target_id?: string;
  reason?: string;
  resolution?: string;
}
const status = document.querySelector('#admin-status')!;
const panel = document.querySelector<HTMLElement>('#admin-panel')!;
try {
  const cap = await rpc<{ is_admin: boolean } | null>('account_capabilities');
  if (!cap?.is_admin) {
    status.textContent = '此页面仅对社区管理员开放。';
  } else {
    status.textContent = '管理权限已核验。';
    panel.hidden = false;
    let tab = 'pending';
    let page = 0;
    const more = document.querySelector<HTMLButtonElement>('#admin-more')!;
    async function render() {
      const rows = await rpc<Entry[]>('moderation_queue', { p_tab: tab, p_page: page });
      const list = document.querySelector('#moderation-list')!;
      list.replaceChildren();
      if (!rows.length) list.textContent = '这一页没有待查看的记录。';
      for (const r of rows) {
        const card = document.createElement('article');
        card.className = 'discussion-card';
        const text = document.createElement('p');
        text.textContent = r.display_name
          ? `${r.display_name} · @${r.username} · ${r.id}`
          : (r.target_content ?? r.content ?? '内容已不存在');
        const state = document.createElement('p');
        state.className = 'muted';
        state.textContent = `状态：${r.status}${r.reason ? ' · 举报原因：' + r.reason : ''}${r.resolution ? ' · 处理说明：' + r.resolution : ''}`;
        card.append(text, state);
        if (tab !== 'resolved' && !r.is_admin) {
          const form = document.createElement('form');
          form.className = 'form-stack';
          const label = document.createElement('label');
          label.textContent = '处理方式';
          const select = document.createElement('select');
          const kind =
            r.target_kind ??
            (tab === 'users'
              ? 'profile'
              : r.kind === 'article'
                ? 'comment'
                : r.kind === 'post'
                  ? 'community_post'
                  : 'community_post_comment');
          const choices =
            kind === 'profile'
              ? [
                  ['restricted', '限制互动'],
                  ['suspended', '暂停账号互动'],
                  ['normal', '恢复正常'],
                ]
              : [
                  ['hidden', '隐藏内容'],
                  ['spam', '标记垃圾内容'],
                  ['visible', '恢复显示'],
                ];
          if (r.target_kind) choices.push(['dismiss', '驳回举报']);
          for (const [value, name] of choices) {
            const o = document.createElement('option');
            o.value = value!;
            o.textContent = name!;
            select.append(o);
          }
          label.append(select);
          const reason = document.createElement('label');
          reason.textContent = '处理原因';
          const area = document.createElement('textarea');
          area.required = true;
          area.minLength = 5;
          area.maxLength = 1000;
          reason.append(area);
          const submit = document.createElement('button');
          submit.textContent = '执行处理';
          form.append(label, reason, submit);
          form.addEventListener('submit', async (event) => {
            event.preventDefault();
            submit.disabled = true;
            try {
              await rpc('moderate', {
                p_kind: kind,
                p_id: r.target_id ?? r.id,
                p_action: select.value,
                p_reason: area.value,
                p_report: r.target_kind ? r.id : null,
              });
              await render();
              announce('处理已记录。');
            } catch (error) {
              announce((error as Error).message);
            } finally {
              submit.disabled = false;
            }
          });
          card.append(form);
        }
        list.append(card);
      }
      more.hidden = rows.length < 30;
    }
    document.querySelectorAll<HTMLButtonElement>('[data-admin-tab]').forEach((b) =>
      b.addEventListener('click', () => {
        tab = b.dataset.adminTab!;
        page = 0;
        document
          .querySelectorAll('[data-admin-tab]')
          .forEach((el) => el.setAttribute('aria-pressed', String(el === b)));
        void render().catch((error) => announce((error as Error).message));
      }),
    );
    more.addEventListener('click', () => {
      page++;
      void render().catch((error) => announce((error as Error).message));
    });
    await render();
    const form = document.querySelector<HTMLFormElement>('#adjust-form')!;
    let fingerprint = '';
    let key = crypto.randomUUID();
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const d = new FormData(form);
      const payload = {
        p_user: String(d.get('user')),
        p_eggs: Number(d.get('eggs')),
        p_exp: Number(d.get('exp')),
        p_reason: String(d.get('reason')),
      };
      const value = JSON.stringify(payload);
      if (value !== fingerprint) {
        key = crypto.randomUUID();
        fingerprint = value;
      }
      const b = form.querySelector('button')!;
      b.disabled = true;
      try {
        await rpc('admin_adjust_economy', { ...payload, p_key: key });
        form.reset();
        fingerprint = '';
        announce('调整已入账并记录审计日志。');
      } catch (error) {
        announce((error as Error).message);
      } finally {
        b.disabled = false;
      }
    });
  }
} catch (error) {
  status.textContent = (error as Error).message;
}

const verification = document.querySelector<HTMLFormElement>('#author-verification-form');
let verificationKey = crypto.randomUUID(),
  verificationPayload = '';
verification?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = new FormData(verification);
  const payload = {
    p_username: String(data.get('username')).trim(),
    p_verified: data.get('verified') === 'true',
    p_reason: String(data.get('reason')).trim(),
    p_author: String(data.get('author')),
  };
  if (JSON.stringify(payload) !== verificationPayload) {
    verificationPayload = JSON.stringify(payload);
    verificationKey = crypto.randomUUID();
  }
  const button = verification.querySelector('button')!;
  button.disabled = true;
  const status = verification.querySelector('[data-author-verification-status]')!;
  try {
    await rpc('set_author_verification', { ...payload, p_key: verificationKey });
    status.textContent = '作者认证已更新，公开主页与作品署名同步生效。';
    verificationKey = crypto.randomUUID();
  } catch (error) {
    status.textContent = (error as Error).message;
  } finally {
    button.disabled = false;
  }
});
