import {
  submissionGenres,
  submissionUrl,
  isVerse,
  writingBlocks,
  inlineWriting,
  type Submission,
} from '../lib/submissions';
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = '') {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}
export function link(text: string, href: string, className = '') {
  const node = el('a', text, className);
  node.href = href;
  return node;
}
export function submissionCard(item: Submission) {
  const card = el(
    'article',
    '',
    'submission-card' + (isVerse(item.genre) ? ' submission-card-verse' : ''),
  );
  card.dataset.submissionId = item.id;
  const top = el('div', '', 'submission-card-top');
  top.append(
    el('span', submissionGenres[item.genre] || '作品', 'eyebrow'),
    el(
      'span',
      `${item.word_count.toLocaleString()} 字 · 约 ${Math.max(1, Math.ceil(item.word_count / 450))} 分钟`,
      'muted small',
    ),
  );
  const heading = el('h2');
  heading.append(link(item.title, submissionUrl(item.id)));
  const foot = el('div', '', 'submission-card-foot');
  foot.append(
    link(item.display_name, '/u/' + encodeURIComponent(item.username) + '/', 'submission-author'),
    el(
      'span',
      new Date(item.published_at).toLocaleDateString('zh-CN') + ' · ' + item.like_count + ' 喜欢',
      'muted small',
    ),
  );
  card.append(top, heading, el('p', item.summary, 'submission-excerpt'), foot);
  if (item.tags.length) {
    const tags = el('div', '', 'submission-tags');
    for (const tag of item.tags)
      tags.append(link('#' + tag, '/submissions/?tag=' + encodeURIComponent(tag)));
    card.append(tags);
  }
  return card;
}
export function renderWriting(target: HTMLElement, body: string, genre: string, indent: boolean) {
  const prose = el(
    'div',
    '',
    'writing-prose' + (isVerse(genre) ? ' writing-verse' : indent ? ' writing-indent' : ''),
  );
  writingBlocks(body, isVerse(genre)).forEach((block, i) => {
    const node = el(
      block.kind === 'break'
        ? 'hr'
        : block.kind === 'heading'
          ? 'h2'
          : block.kind === 'quote'
            ? 'blockquote'
            : 'p',
    );
    if (block.kind === 'heading') node.id = 'writing-section-' + i;
    for (const part of inlineWriting(block.text))
      node.append(part.strong ? el('strong', part.text) : document.createTextNode(part.text));
    prose.append(node);
  });
  target.replaceChildren(prose);
}
export function emptySubmissions(title: string, message: string) {
  const node = el('div', '', 'submission-empty');
  node.append(el('h3', title), el('p', message));
  return node;
}
