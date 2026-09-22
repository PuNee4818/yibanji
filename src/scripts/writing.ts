import { writingStyle, writingHints } from '../lib/submissions';
import { getCurrentUser, supabase, friendlyError } from '../lib/supabase';
import {
  submissionGenres,
  isVerse,
  countWords,
  submissionUrl,
  type WritingDraft,
} from '../lib/submissions';
import { readLocalWriting, storeLocalWriting, removeLocalWriting } from '../lib/writing-storage';
import { renderWriting } from './submission-ui';
const form = document.querySelector<HTMLFormElement>('#writing-form')!;
const field = <T extends HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
  name: string,
) => form.elements.namedItem(name) as T;
const title = field<HTMLInputElement>('title'),
  body = field<HTMLTextAreaElement>('body'),
  genre = field<HTMLSelectElement>('genre'),
  tags = field<HTMLInputElement>('tags'),
  summary = field<HTMLTextAreaElement>('summary'),
  indent = field<HTMLInputElement>('indent');
const state = document.querySelector<HTMLElement>('[data-writing-state]')!;
const alert = document.querySelector<HTMLElement>('[data-writing-alert]')!;
const panel = document.querySelector<HTMLElement>('[data-writing-preview-panel]')!;
const previewButton = document.querySelector<HTMLButtonElement>('[data-writing-preview]')!;
const publishButton = document.querySelector<HTMLButtonElement>('[data-writing-publish]')!;
const dialog = document.querySelector<HTMLDialogElement>('[data-writing-publish-dialog]')!;
const confirm = document.querySelector<HTMLButtonElement>('[data-writing-confirm]')!;
const publishState = document.querySelector<HTMLElement>('[data-writing-publish-state]')!;
const user = await getCurrentUser();
const owner = user?.id || 'guest';
const existingDraft = new URLSearchParams(location.search).get('draft');
let id = existingDraft || crypto.randomUUID();
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
  id = crypto.randomUUID();
let draft: WritingDraft = {
  id,
  title: '',
  body: '',
  genre: 'essay',
  tags: [],
  summary: '',
  indent: true,
  revision: 0,
};
let composing = false;
let ready = false,
  dirty = false,
  conflict = false,
  locked = false,
  localOK = false;
let timer: ReturnType<typeof setTimeout>,
  pending: Promise<boolean> | null = null;
let lastPayload = '',
  requestKey = crypto.randomUUID();
const undo: string[] = [],
  redo: string[] = [];
let previousBody = '';
function notice(message: string) {
  alert.textContent = message;
  alert.hidden = !message;
}
function address() {
  history.replaceState(null, '', '/write/?draft=' + id);
  document.querySelector<HTMLAnchorElement>('[data-writing-login]')!.href =
    '/auth/?next=' + encodeURIComponent('/write/?draft=' + id);
}
function values(): WritingDraft {
  return {
    ...draft,
    id,
    title: title.value,
    body: body.value,
    genre: genre.value,
    tags: [
      ...new Set(
        tags.value
          .split(/[,，、\n]/)
          .map((t) => t.trim())
          .filter(Boolean),
      ),
    ],
    summary: summary.value,
    indent: indent.checked,
  };
}
function locally() {
  draft = values();
  localOK = storeLocalWriting({ draft, owner, dirty, savedAt: Date.now() });
  return localOK;
}
function refresh() {
  const n = countWords(body.value);
  document.querySelector('[data-writing-count]')!.textContent =
    `${n.toLocaleString()} 字 · 约 ${Math.max(1, Math.ceil(n / 450))} 分钟`;
  document.querySelector('[data-writing-hint]')!.textContent =
    writingHints[writingStyle(genre.value).variant]!;
  indent.disabled = isVerse(genre.value);
  body.style.height = 'auto';
  body.style.height = Math.max(400, body.scrollHeight) + 'px';
  const selected = values().tags;
  form
    .querySelectorAll<HTMLButtonElement>('[data-writing-tag]')
    .forEach((button) =>
      button.setAttribute('aria-pressed', String(selected.includes(button.dataset.writingTag!))),
    );
  if (!panel.hidden) preview();
}
function populate() {
  title.value = draft.title;
  body.value = draft.body;
  genre.value = draft.genre;
  tags.value = draft.tags.join('，');
  summary.value = draft.summary;
  indent.checked = draft.indent;
  previousBody = body.value;
  refresh();
}
function preview() {
  document.querySelector('[data-writing-preview-title]')!.textContent = title.value || '未命名草稿';
  document.querySelector('[data-writing-preview-meta]')!.textContent =
    submissionGenres[genre.value] + ' · ' + countWords(body.value).toLocaleString() + ' 字';
  renderWriting(
    document.querySelector<HTMLElement>('[data-writing-preview-body]')!,
    body.value,
    genre.value,
    indent.checked,
  );
}
function setConflict() {
  conflict = true;
  document.querySelector<HTMLElement>('[data-writing-conflict]')!.hidden = false;
  state.textContent = '有另一份更新 · 本机文字已保留';
  publishButton.disabled = true;
  // Keep this tab's version separately, even when another tab writes the shared local key.
  const recovery = {
    ...values(),
    id: crypto.randomUUID(),
    revision: 0,
    title: title.value + '（冲突备份）',
  };
  storeLocalWriting({ draft: recovery, owner, dirty: true, savedAt: Date.now() });
}
function changed() {
  if (!ready || locked) return;
  if (body.value !== previousBody) {
    undo.push(previousBody);
    if (undo.length > 100) undo.shift();
    redo.length = 0;
    previousBody = body.value;
  }
  dirty = true;
  refresh();
  state.textContent = locally()
    ? user
      ? '已保存到本机 · 等待同步'
      : '已保存到这台设备'
    : '本机无法保存 · 请导出备份';
  clearTimeout(timer);
  if (user && !conflict && !composing) timer = setTimeout(() => void save(), 1600);
}
async function save(): Promise<boolean> {
  clearTimeout(timer);
  if (!ready || conflict || locked) return false;
  if (pending) {
    await pending;
    return dirty && !conflict ? save() : !dirty;
  }
  locally();
  if (!user) {
    state.textContent = localOK ? '已保存到这台设备' : '本机无法保存 · 请导出备份';
    return localOK;
  }
  if (!dirty && draft.revision > 0) return true;
  if (draft.tags.length > 5 || draft.tags.some((tag) => Array.from(tag).length > 16)) {
    notice('最多选择 5 个标签，每个标签不超过 16 个字。');
    return false;
  }
  const snapshot = { ...draft };
  const payload = JSON.stringify([
    snapshot.title,
    snapshot.body,
    snapshot.genre,
    snapshot.tags,
    snapshot.summary,
    snapshot.indent,
    snapshot.revision,
  ]);
  if (payload !== lastPayload) {
    requestKey = crypto.randomUUID();
    lastPayload = payload;
  }
  snapshot.last_key = requestKey;
  draft.last_key = requestKey;
  locally();
  state.textContent = '正在同步云端…';
  pending = (async () => {
    const { data, error } = await supabase.rpc('save_submission_draft', {
      p_id: id,
      p_revision: snapshot.revision,
      p_key: requestKey,
      p_title: snapshot.title,
      p_body: snapshot.body,
      p_genre: snapshot.genre,
      p_tags: snapshot.tags,
      p_summary: snapshot.summary,
      p_indent: snapshot.indent,
    });
    if (error) {
      if (/DRAFT_CONFLICT|NOT_OWNER/.test(error.message)) setConflict();
      else {
        state.textContent = localOK ? '已保存到本机 · 云端未同步' : '尚未保存 · 请导出备份';
        notice(
          '云端保存未完成。' +
            friendlyError(error) +
            (localOK
              ? ' 本机草稿已保留，可点击保存重试同步。'
              : ' 本机也未能保存，请先导出备份，再重试。'),
        );
      }
      return false;
    }
    draft.revision = data.revision;
    draft.last_key = data.last_key;
    const current = values();
    dirty =
      JSON.stringify([
        current.title,
        current.body,
        current.genre,
        current.tags,
        current.summary,
        current.indent,
      ]) !==
      JSON.stringify([
        snapshot.title,
        snapshot.body,
        snapshot.genre,
        snapshot.tags,
        snapshot.summary,
        snapshot.indent,
      ]);
    locally();
    notice('');
    state.textContent = dirty
      ? localOK
        ? '新修改已保存到本机 · 等待同步'
        : '新修改尚未保存 · 请导出备份'
      : '已保存到云端 · ' +
        new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    return true;
  })().catch(() => {
    state.textContent = localOK ? '已保存到本机 · 云端未同步' : '尚未保存';
    notice('网络暂时不可用，文字仍保留在编辑器中，请重试保存或导出备份。');
    return false;
  });
  const success = await pending;
  pending = null;
  if (success && dirty) return save();
  return success;
}
async function initialize() {
  address();
  form.inert = true;
  publishButton.disabled = true;
  let local = readLocalWriting(owner, id);
  const guest = user && !local ? readLocalWriting('guest', id) : null;
  if (guest) {
    local = guest;
    draft = { ...guest.draft, revision: 0 };
    dirty = true;
  } else if (local) {
    draft = local.draft;
    dirty = local.dirty;
  }
  if (user && !guest && (existingDraft || draft.revision > 0)) {
    const { data, error } = await supabase
      .from('submission_drafts')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (error && !local) {
      notice('暂时无法读取云端草稿，请刷新重试。为避免覆盖原稿，编辑暂未开启。');
      state.textContent = '草稿读取失败';
      return;
    }
    if (data) {
      const published = await supabase
        .from('submissions')
        .select('status')
        .eq('id', id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (published.data?.status === 'published') {
        publishButton.textContent = '更新发布';
        confirm.textContent = '确认更新';
      }
      if (!local || !local.dirty) {
        draft = data;
        dirty = false;
      } else if (data.revision !== local.draft.revision) {
        if (data.last_key === local.draft.last_key) draft.revision = data.revision;
        else {
          populate();
          setConflict();
        }
      }
    } else if (!error && draft.revision > 0) {
      populate();
      setConflict();
    }
    if (error) notice('暂时无法读取云端，已恢复本机文字。联网后点击保存重试。');
  }
  populate();
  form.inert = false;
  document.querySelector<HTMLFieldSetElement>('[data-writing-fields]')!.disabled = false;
  ready = true;
  publishButton.disabled = conflict;
  document.querySelector<HTMLElement>('[data-writing-guest]')!.hidden = Boolean(user);
  if (!conflict)
    state.textContent = local
      ? dirty
        ? user
          ? '已恢复本机草稿 · 等待同步'
          : '已恢复这台设备的草稿'
        : '已恢复上次的草稿'
      : draft.revision
        ? '云端草稿已打开'
        : '输入后自动保存草稿';
  if (guest) {
    locally();
    if (await save()) removeLocalWriting('guest', id);
  } else if (dirty && user && !conflict) void save();
  if (matchMedia('(max-width: 640px)').matches)
    document.querySelector<HTMLDetailsElement>('.writing-sidebar details')!.open = false;
}
form.addEventListener('submit', (event) => event.preventDefault());
form.addEventListener('input', changed);
form.addEventListener('change', changed);
body.addEventListener('compositionstart', () => {
  composing = true;
  clearTimeout(timer);
});
body.addEventListener('compositionend', () => {
  composing = false;
  changed();
});
document.querySelector('[data-writing-save]')!.addEventListener('click', () => void save());
document.querySelector('[data-writing-focus]')!.addEventListener('click', (event) => {
  const enabled = document.body.classList.toggle('writing-focus');
  (event.currentTarget as HTMLButtonElement).setAttribute('aria-pressed', String(enabled));
  (event.currentTarget as HTMLButtonElement).textContent = enabled ? '退出专注' : '专注';
  refresh();
});
previewButton.addEventListener('click', () => {
  panel.hidden = !panel.hidden;
  form.hidden = !panel.hidden;
  previewButton.setAttribute('aria-expanded', String(!panel.hidden));
  previewButton.textContent = panel.hidden ? '预览' : '返回写作';
  if (!panel.hidden) preview();
  else refresh();
});
form.querySelectorAll<HTMLButtonElement>('[data-writing-tag]').forEach((button) =>
  button.addEventListener('click', () => {
    const selected = values().tags,
      tag = button.dataset.writingTag!;
    if (!selected.includes(tag) && selected.length >= 5) {
      notice('已经选了 5 个主题，点击已选主题可以取消。');
      return;
    }
    tags.value = (
      selected.includes(tag) ? selected.filter((t) => t !== tag) : [...selected, tag]
    ).join('，');
    changed();
  }),
);
form.querySelectorAll<HTMLButtonElement>('[data-writing-insert]').forEach((button) =>
  button.addEventListener('click', () => {
    const start = body.selectionStart,
      end = body.selectionEnd,
      selected = body.value.slice(start, end);
    const type = button.dataset.writingInsert;
    const text =
      type === 'bold'
        ? '**' + (selected || '加粗文字') + '**'
        : '\n\n' +
          (type === 'heading'
            ? '## ' + (selected || '小标题')
            : type === 'quote'
              ? '> ' + (selected || '引用文字')
              : '---') +
          '\n\n';
    body.setRangeText(text, start, end, 'end');
    body.focus();
    changed();
  }),
);
function travelHistory(back: boolean) {
  const from = back ? undo : redo,
    to = back ? redo : undo;
  const value = from.pop();
  if (value === undefined) return;
  to.push(body.value);
  body.value = value;
  previousBody = value;
  dirty = true;
  refresh();
  locally();
  clearTimeout(timer);
  timer = setTimeout(() => void save(), 1600);
}
document.querySelector('[data-writing-undo]')!.addEventListener('click', () => travelHistory(true));
document
  .querySelector('[data-writing-redo]')!
  .addEventListener('click', () => travelHistory(false));
document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault();
    void save();
  }
  if (event.key === 'Escape' && !dialog.open) {
    document.body.classList.remove('writing-focus');
    const focus = document.querySelector('[data-writing-focus]')!;
    focus.setAttribute('aria-pressed', 'false');
    focus.textContent = '专注';
  }
});
document.querySelector('[data-writing-copy]')!.addEventListener('click', async () => {
  id = crypto.randomUUID();
  draft = { ...values(), id, revision: 0, last_key: undefined };
  lastPayload = '';
  conflict = false;
  dirty = true;
  document.querySelector<HTMLElement>('[data-writing-conflict]')!.hidden = true;
  publishButton.disabled = false;
  address();
  locally();
  await save();
});
document.querySelector('[data-writing-export]')!.addEventListener('click', () => {
  const blob = new Blob([title.value + '\n\n' + body.value], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (title.value || '未命名草稿').replace(/[<>:"/\\|?*]/g, '_').slice(0, 80) + '.txt';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
publishButton.addEventListener('click', async () => {
  if (!ready) return;
  if (!title.value.trim() || !countWords(body.value)) {
    notice('请先写下标题和正文，再与读者见面。');
    form.hidden = false;
    panel.hidden = true;
    (title.value.trim() ? body : title).focus();
    return;
  }
  if (!user) {
    locally();
    location.href = '/auth/?next=' + encodeURIComponent('/write/?draft=' + id);
    return;
  }
  publishButton.disabled = true;
  if (await save()) {
    document.querySelector('[data-writing-publish-summary]')!.textContent =
      `《${title.value}》 · ${submissionGenres[genre.value]} · ${countWords(body.value)} 字`;
    publishState.textContent = '';
    dialog.showModal();
  }
  publishButton.disabled = conflict;
});
document.querySelector('[data-writing-back]')!.addEventListener('click', () => {
  dialog.close();
  if (panel.hidden) previewButton.click();
});
confirm.addEventListener('click', async () => {
  confirm.disabled = true;
  publishState.textContent = '正在发布…';
  try {
    if (!(await save())) {
      publishState.textContent = '草稿尚未同步，请关闭此窗口后重试保存。';
      return;
    }
    locked = true;
    const { data, error } = await supabase.rpc('publish_submission', {
      p_id: id,
      p_revision: draft.revision,
    });
    if (error) {
      if (/DRAFT_CONFLICT|NOT_OWNER/.test(error.message)) setConflict();
      throw new Error(friendlyError(error));
    }
    dirty = false;
    locally();
    location.href = submissionUrl(data);
  } catch (error) {
    publishState.textContent = '发布未完成。' + (error as Error).message + ' 草稿已保留。';
  } finally {
    locked = false;
    confirm.disabled = false;
  }
});
window.addEventListener('beforeunload', (event) => {
  if (ready && dirty) {
    locally();
    if (!localOK) {
      event.preventDefault();
    }
  }
});
window.addEventListener('online', () => {
  if (dirty) void save();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && ready && dirty) {
    locally();
    void save();
  }
});
window.addEventListener('storage', (event) => {
  if (event.key === 'yb_writing_' + owner + '_' + id && ready && dirty && !conflict) {
    const other = readLocalWriting(owner, id);
    if (other && other.draft.body !== body.value) setConflict();
  }
});
supabase.auth.onAuthStateChange((_event, session) => {
  if (ready && (session?.user.id || 'guest') !== owner) {
    locally();
    locked = true;
    form.inert = true;
    publishButton.disabled = true;
    notice('登录账号已变化。文字已保留在原账号的本机草稿中，请刷新后继续。');
  }
});
void initialize().catch(() => {
  notice('草稿暂时无法打开，请刷新重试。本机备份会保留。');
  state.textContent = '读取失败';
});
