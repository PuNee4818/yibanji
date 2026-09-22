import { rpc, getCurrentUser } from '../lib/supabase';
import { authorBadge } from '../lib/author';
import { levelBadge } from '../lib/growth';
import { submissionUrl, type Submission } from '../lib/submissions';
import { submissionCard, emptySubmissions, el, link } from './submission-ui';
const form = document.querySelector<HTMLFormElement>('#submission-filters')!;
const query = form.elements.namedItem('q') as HTMLInputElement;
const genre = form.elements.namedItem('genre') as HTMLSelectElement;
const tag = form.elements.namedItem('tag') as HTMLSelectElement;
const sort = form.elements.namedItem('sort') as HTMLSelectElement;
const short = form.elements.namedItem('short') as HTMLInputElement;
const list = document.querySelector<HTMLElement>('[data-submission-list]')!;
const state = document.querySelector<HTMLElement>('[data-submission-status]')!;
const more = document.querySelector<HTMLButtonElement>('[data-submission-more]')!;
const reset = document.querySelector<HTMLButtonElement>('[data-submission-reset]')!;
let page = 0,
  version = 0,
  busy = false;
function readUrl() {
  const params = new URLSearchParams(location.search);
  query.value = (params.get('q') || '').slice(0, 100);
  genre.value = params.get('genre') || '';
  if (!genre.value) genre.value = '';
  const topic = params.get('tag') || '';
  if (topic && !Array.from(tag.options).some((o) => o.value === topic))
    tag.add(new Option(topic, topic));
  tag.value = topic;
  sort.value = params.get('sort') || 'latest';
  if (!sort.value) sort.value = 'latest';
  short.checked = params.get('short') === '1';
}
function address() {
  const params = new URLSearchParams();
  if (query.value.trim()) params.set('q', query.value.trim());
  if (genre.value) params.set('genre', genre.value);
  if (tag.value) params.set('tag', tag.value);
  if (sort.value !== 'latest') params.set('sort', sort.value);
  if (short.checked) params.set('short', '1');
  history.replaceState(null, '', '/submissions/' + (params.size ? '?' + params : ''));
  reset.hidden = !params.size;
}
async function load(append = false) {
  if (append && busy) return;
  const request = ++version,
    next = append ? page + 1 : 0;
  busy = true;
  more.disabled = true;
  list.setAttribute('aria-busy', 'true');
  address();
  document
    .querySelectorAll<HTMLButtonElement>('[data-feed-tab]')
    .forEach((button) =>
      button.setAttribute('aria-pressed', String(button.dataset.feedTab === sort.value)),
    );
  document.querySelector('#submission-feed-title')!.textContent =
    sort.value === 'popular'
      ? '被读者珍藏的文字'
      : sort.value === 'following'
        ? '关注作者的新篇章'
        : '新落在纸上的文字';
  state.textContent = '正在寻找文字…';
  if (!append) list.replaceChildren();
  try {
    if (sort.value === 'following' && !(await getCurrentUser())) {
      if (request !== version) return;
      const empty = emptySubmissions('关注喜欢的作者', '登录后，在这里阅读你关注的作者的新作。');
      empty.append(
        link(
          '登录并继续 →',
          '/auth/?next=' + encodeURIComponent(location.pathname + location.search),
          'button',
        ),
      );
      list.replaceChildren(empty);
      state.textContent = '我关注的';
      more.hidden = true;
      return;
    }
    const rows = await rpc<Submission[]>('submission_feed', {
      p_query: query.value.trim(),
      p_genre: genre.value,
      p_tag: tag.value,
      p_sort: sort.value,
      p_page: next,
      p_short: short.checked,
    });
    if (request !== version) return;
    list.querySelector('[data-feed-error]')?.remove();
    rows.forEach((row) => {
      if (!list.querySelector(`[data-submission-id="${row.id}"]`)) list.append(submissionCard(row));
    });
    page = next;
    more.hidden = rows.length < 20;
    if (!list.childElementCount) {
      const filtered = Boolean(query.value || genre.value || tag.value || short.checked);
      const empty = emptySubmissions(
        filtered ? '换个角度，也许就遇见了。' : '第一篇文字，等你落笔。',
        filtered
          ? '试试其他文体或关键词，也可以清除筛选，随意翻一翻。'
          : '把一首诗、一段往事，或一个故事留在这里。',
      );
      empty.append(link('写一篇文章 ↗', '/write/', 'button'));
      list.append(empty);
    }
    state.textContent = rows.length
      ? `已展开 ${list.querySelectorAll('.submission-card').length} 篇作品`
      : '暂时没有更多作品';
  } catch (error) {
    if (request !== version) return;
    state.textContent = (error as Error).message;
    const retry = el('button', '重新加载');
    retry.dataset.feedError = '';
    retry.addEventListener('click', () => {
      retry.remove();
      void load(append);
    });
    list.append(retry);
    more.hidden = true;
  } finally {
    if (request === version) {
      busy = false;
      more.disabled = false;
      list.setAttribute('aria-busy', 'false');
    }
  }
}
form.addEventListener('submit', (event) => {
  event.preventDefault();
  void load();
});
for (const input of [genre, tag, sort, short]) input.addEventListener('change', () => void load());
reset.addEventListener('click', () => {
  form.reset();
  void load();
});
more.addEventListener('click', () => void load(true));
window.addEventListener('popstate', () => {
  readUrl();
  void load();
});
const random = document.querySelector<HTMLButtonElement>('[data-submission-random]')!;
random.addEventListener('click', async () => {
  random.disabled = true;
  try {
    const rows = await rpc<Submission[]>('submission_feed', {
      p_sort: 'random',
      p_genre: genre.value,
      p_tag: tag.value,
      p_query: query.value.trim(),
      p_short: short.checked,
    });
    if (rows[0]) location.href = submissionUrl(rows[0].id);
    else state.textContent = '这个范围还没有来稿，试试其他筛选。';
  } catch (error) {
    state.textContent = (error as Error).message;
  } finally {
    random.disabled = false;
  }
});
readUrl();
void load();

document.querySelectorAll<HTMLButtonElement>('[data-feed-tab]').forEach((button) =>
  button.addEventListener('click', () => {
    sort.value = button.dataset.feedTab!;
    void load();
  }),
);
async function highlights() {
  const target = document.querySelector<HTMLElement>('[data-submission-highlights]')!;
  try {
    const data = await rpc<{ popular: Submission[]; topics: { tag: string; works: number }[] }>(
      'submission_highlights',
    );
    target.replaceChildren();
    data.popular.slice(0, 3).forEach((item, index) => {
      const row = el('article', '', 'submission-hot-item');
      const content = el('div');
      const identity = el('div', '', 'author-identity');
      identity.append(link(item.display_name, '/u/' + encodeURIComponent(item.username) + '/'));
      if (item.level) identity.append(levelBadge(item.level));
      if (item.author_verified) identity.append(authorBadge());
      const title = el('h3');
      title.append(link(item.title, submissionUrl(item.id)));
      content.append(
        identity,
        title,
        el('p', item.summary, 'submission-hot-excerpt'),
        el(
          'span',
          item.like_count +
            ' 点赞 · ' +
            (item.bookmark_count ?? 0) +
            ' 收藏 · ' +
            item.comment_count +
            ' 讨论',
          'muted small',
        ),
      );
      row.append(el('span', String(index + 1).padStart(2, '0'), 'submission-hot-rank'), content);
      target.append(row);
    });
    if (!data.popular.length)
      target.append(
        emptySubmissions(
          '好文字的下一站，是这里。',
          '还没有公开作品。写下第一篇，让故事开始流动。',
        ),
      );
    const topics = document.querySelector<HTMLElement>('[data-submission-topics]')!;
    for (const item of data.topics)
      topics.append(
        link(
          '#' + item.tag + ' · ' + item.works,
          '/submissions/?tag=' + encodeURIComponent(item.tag) + '#submission-feed-title',
        ),
      );
    topics.hidden = !data.topics.length;
  } catch {
    target.replaceChildren(el('p', '推荐暂时没有加载出来，下面仍可浏览与搜索作品。', 'muted'));
    const retry = el('button', '重新加载推荐', 'quiet-button');
    retry.addEventListener('click', () => {
      retry.disabled = true;
      void highlights();
    });
    target.append(retry);
  }
}
void highlights();
