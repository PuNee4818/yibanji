import { getCurrentUser, rpc } from '../lib/supabase';
import { submissionGenres, submissionUrl, type WritingDraft } from '../lib/submissions';
import { listLocalWriting, removeLocalWriting } from '../lib/writing-storage';
import { el, link, emptySubmissions } from './submission-ui';
const user = await getCurrentUser(),
  owner = user?.id || 'guest';
const list = document.querySelector<HTMLElement>('[data-writing-list]')!,
  state = document.querySelector<HTMLElement>('[data-writing-list-status]')!;
type Row = WritingDraft & { excerpt?: string; localOnly?: boolean; localDirty?: boolean };
let rows: Row[] = [],
  tab = 'draft';
async function load() {
  state.textContent = '正在整理书桌…';
  const local = listLocalWriting(owner);
  let remote: Row[] = [];
  try {
    if (user) remote = await rpc<Row[]>('my_writing');
    state.textContent = user
      ? '草稿仅自己可见。已发布文章的修改会保留为私人草稿。'
      : '当前展示这台设备的草稿，登录后可继续写作并同步云端。';
  } catch {
    state.textContent = '云端暂时不可用，下面保留了本机草稿。';
    const retry = el('button', '重试');
    retry.addEventListener('click', () => void load());
    state.append(retry);
  }
  rows = remote.map((row) => {
    const cached = local.find((x) => x.draft.id === row.id);
    return {
      ...row,
      localDirty: Boolean(cached?.dirty),
      ...(cached?.dirty
        ? { title: cached.draft.title, excerpt: cached.draft.body.slice(0, 140) }
        : {}),
    };
  });
  for (const entry of local)
    if (!rows.some((row) => row.id === entry.draft.id))
      rows.push({
        ...entry.draft,
        status: 'draft',
        localOnly: true,
        updated_at: new Date(entry.savedAt).toISOString(),
        excerpt: entry.draft.body.slice(0, 140),
      });
  render();
}
function render() {
  list.replaceChildren();
  const visible = rows.filter((row) =>
    tab === 'draft'
      ? row.status === 'draft' ||
        row.localDirty ||
        (row.status === 'published' && row.revision !== row.published_revision)
      : row.status === tab,
  );
  for (const row of visible) {
    const card = el('article', '', 'writing-draft-card'),
      copy = el('div'),
      actions = el('div', '', 'writing-draft-actions');
    copy.append(
      el(
        'span',
        (submissionGenres[row.genre] || '作品') +
          ' · ' +
          (row.localOnly
            ? '本机草稿'
            : row.status === 'published' && tab === 'draft'
              ? '未发布的修改'
              : tab === 'draft'
                ? '私人草稿'
                : tab === 'published'
                  ? '已公开'
                  : '已撤回'),
        'eyebrow',
      ),
    );
    const h = el('h2');
    h.append(link(row.title || '未命名的文字', '/write/?draft=' + row.id));
    copy.append(
      h,
      el('p', row.excerpt || row.summary || '第一行，还在等你。'),
      el('small', '上次落笔 · ' + new Date(row.updated_at!).toLocaleString('zh-CN'), 'muted'),
    );
    actions.append(
      link(tab === 'draft' ? '继续写作 →' : '编辑', '/write/?draft=' + row.id, 'button'),
    );
    if (row.status === 'published') {
      actions.append(link('阅读', submissionUrl(row.id)));
      const withdraw = el('button', '撤回', 'quiet-button');
      withdraw.addEventListener('click', async () => {
        if (
          !window.confirm(
            '撤回后，作品将从广场、搜索和公开主页中隐藏。文字仍保留在你的书桌上，确定撤回？',
          )
        )
          return;
        withdraw.disabled = true;
        try {
          await rpc('manage_submission', { p_id: row.id, p_action: 'withdraw' });
          await load();
        } catch (error) {
          state.textContent = (error as Error).message;
        } finally {
          withdraw.disabled = false;
        }
      });
      actions.append(withdraw);
    }
    const remove = el('button', '删除', 'quiet-button');
    remove.addEventListener('click', async () => {
      if (
        !window.confirm(
          '永久删除《' + (row.title || '未命名的文字') + '》及其互动记录？此操作无法撤销。',
        )
      )
        return;
      remove.disabled = true;
      try {
        if (user && !row.localOnly)
          await rpc('manage_submission', { p_id: row.id, p_action: 'delete' });
        removeLocalWriting(owner, row.id);
        await load();
      } catch (error) {
        state.textContent = (error as Error).message;
      } finally {
        remove.disabled = false;
      }
    });
    actions.append(remove);
    card.append(copy, actions);
    list.append(card);
  }
  if (!visible.length) {
    const empty = emptySubmissions(
      tab === 'draft'
        ? '一张空白的稿纸，也是一种开始。'
        : tab === 'published'
          ? '写下第一篇，与读者相见。'
          : '这里还没有撤回的作品。',
      '每一篇文字，都从第一行开始。',
    );
    empty.append(link('开始写作 ↗', '/write/', 'button'));
    list.append(empty);
  }
}
document.querySelectorAll<HTMLButtonElement>('[data-writing-tab]').forEach((button) =>
  button.addEventListener('click', () => {
    tab = button.dataset.writingTab!;
    document
      .querySelectorAll('[data-writing-tab]')
      .forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
    render();
  }),
);
void load();
