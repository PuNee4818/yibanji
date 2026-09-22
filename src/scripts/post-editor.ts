import { supabase, getCurrentUser, rpc } from '../lib/supabase';
import { readStorage, writeStorage } from '../lib/storage';
const form = document.querySelector<HTMLFormElement>('#post-form')!;
const title = form.elements.namedItem('title') as HTMLInputElement;
const content = form.elements.namedItem('content') as HTMLTextAreaElement;
const topic = form.elements.namedItem('topic') as HTMLSelectElement;
const article = form.elements.namedItem('article_id') as HTMLSelectElement;
const submit = form.querySelector<HTMLButtonElement>('[data-post-submit]')!;
const status = form.querySelector<HTMLElement>('[data-post-status]')!;
const count = form.querySelector('[data-draft-count]')!;
const draftState = form.querySelector('[data-draft-state]')!;
const preview = document.querySelector<HTMLElement>('[data-post-draft-preview]')!;
const previewButton = form.querySelector<HTMLButtonElement>('[data-post-preview]')!;
const edit = new URLSearchParams(location.search).get('edit');
const user = await getCurrentUser();
let key = crypto.randomUUID(),
  submitted = '',
  loading = false;
const draftKey = 'yb_post_draft_' + (user?.id ?? 'guest') + (edit ? '_' + edit : '');
function renderPreview() {
  preview.replaceChildren();
  const h = document.createElement('h2');
  h.textContent = title.value || '未填写标题';
  const meta = document.createElement('p');
  meta.className = 'eyebrow';
  meta.textContent = topic.value + ' · 发布前预览';
  preview.append(meta, h);
  for (const paragraph of content.value.split(/\n\s*\n/)) {
    const p = document.createElement('p');
    p.textContent = paragraph;
    p.className = 'discussion-content';
    preview.append(p);
  }
}
function saveDraft() {
  count.textContent = content.value.length + ' / 10000';
  if (loading) return;
  const saved = writeStorage(
    draftKey,
    JSON.stringify({
      title: title.value,
      content: content.value,
      topic: topic.value,
      article: article.value,
    }),
  );
  draftState.textContent = saved ? '草稿已保存到当前设备' : '当前设备无法保存草稿';
  if (!preview.hidden) renderPreview();
}
if (edit) {
  loading = true;
  submit.disabled = true;
  document.querySelector('[data-editor-heading]')!.textContent = '编辑帖子';
  submit.textContent = '保存修改';
  if (user && /^[a-f0-9-]{36}$/i.test(edit)) {
    const { data, error } = await supabase
      .from('community_posts')
      .select('*')
      .eq('id', edit)
      .eq('user_id', user.id)
      .eq('status', 'visible')
      .maybeSingle();
    if (data && !error) {
      title.value = data.title;
      content.value = data.content;
      topic.value = data.topic;
      article.value = data.article_id || '';
      submit.disabled = false;
    } else status.textContent = '无法编辑这篇帖子，请确认它仍然可见且由你发布。';
  }
  loading = false;
}
if (!edit || !submit.disabled) {
  try {
    const draft = JSON.parse(readStorage(draftKey) ?? 'null');
    if (draft && typeof draft.content === 'string') {
      title.value = String(draft.title ?? '').slice(0, 80);
      content.value = draft.content.slice(0, 10000);
      topic.value = ['读书', '随笔', '提问', '闲谈'].includes(draft.topic) ? draft.topic : '闲谈';
      article.value = String(draft.article ?? '');
      draftState.textContent = '已恢复上次未发布的草稿';
    }
  } catch {
    /* Invalid drafts never block writing. */
  }
}
count.textContent = content.value.length + ' / 10000';
const referenceSearch = form.querySelector<HTMLInputElement>('[data-reference-search]')!;
const referenceStatus = form.querySelector('[data-reference-status]')!;
referenceSearch.addEventListener('input', () => {
  const query = referenceSearch.value.trim().toLocaleLowerCase();
  let matches = 0;
  for (const option of Array.from(article.options)) {
    const match = option.textContent!.toLocaleLowerCase().includes(query);
    if (option.value && match) matches++;
    option.hidden = Boolean(option.value && !match && !option.selected);
  }
  referenceStatus.textContent = query
    ? '找到 ' + matches + ' 篇作品，已选作品会保留在列表中。'
    : '';
});
form.addEventListener('input', saveDraft);
form.addEventListener('change', saveDraft);
previewButton.addEventListener('click', () => {
  preview.hidden = !preview.hidden;
  previewButton.setAttribute('aria-expanded', String(!preview.hidden));
  previewButton.textContent = preview.hidden ? '预览帖子' : '收起预览';
  if (!preview.hidden) {
    renderPreview();
    preview.scrollIntoView({ block: 'nearest' });
  }
});
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!user) {
    location.href = '/auth/?next=' + encodeURIComponent(location.pathname + location.search);
    return;
  }
  if (submit.disabled) return;
  const fingerprint = JSON.stringify([title.value, content.value, topic.value, article.value]);
  if (fingerprint !== submitted) {
    key = crypto.randomUUID();
    submitted = fingerprint;
  }
  submit.disabled = true;
  status.textContent = edit ? '正在保存…' : '正在发布…';
  try {
    const id = await rpc<string>('save_post', {
      p_title: title.value,
      p_content: content.value,
      p_topic: topic.value,
      p_article: article.value || null,
      p_id: edit || null,
      p_key: key,
    });
    writeStorage(draftKey, 'null');
    location.href = '/community/posts/' + id + '/';
  } catch (error) {
    status.textContent = (error as Error).message;
    submit.disabled = false;
  }
});
