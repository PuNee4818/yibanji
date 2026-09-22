import { levelBadge } from '../lib/growth';
import { rpc } from '../lib/supabase';
import { announce } from './site';
import { discussionUrl, type Discussion } from '../lib/discussion';
let catalog: Promise<{ id: string; title: string; author: string }[]> | undefined;
export function discussionCard(
  item: Discussion,
  userId: string | undefined,
  refresh: () => Promise<void>,
  reply?: (item: Discussion) => void,
  detailed = false,
): HTMLElement {
  const card = document.createElement('article');
  card.className = 'discussion-card';
  card.id = 'comment-' + item.id;
  const meta = document.createElement('div');
  meta.className = 'discussion-meta';
  const author = document.createElement('a');
  author.className = 'discussion-author';
  author.href = '/u/' + encodeURIComponent(item.username) + '/';
  const avatar = document.createElement('span');
  avatar.className = 'discussion-avatar';
  avatar.textContent = Array.from(item.display_name)[0] ?? '读';
  avatar.setAttribute('aria-hidden', 'true');
  author.append(avatar, document.createTextNode(item.display_name));
  const time = document.createElement('time');
  time.dateTime = item.created_at;
  time.title = new Date(item.created_at).toLocaleString('zh-CN');
  const age = Math.max(0, Date.now() - Date.parse(item.created_at));
  time.textContent =
    age < 60000
      ? '刚刚'
      : age < 3600000
        ? Math.floor(age / 60000) + ' 分钟前'
        : age < 86400000
          ? Math.floor(age / 3600000) + ' 小时前'
          : new Date(item.created_at).toLocaleDateString('zh-CN');
  const byline = document.createElement('div');
  byline.className = 'discussion-byline';
  byline.append(author, levelBadge(item.level ?? 1));
  meta.append(byline, time);
  card.append(meta);
  const kind = document.createElement('p');
  kind.className = 'discussion-kind';
  kind.textContent =
    item.kind === 'post'
      ? (item.topic || '闲谈') + ' · 帖子'
      : item.kind === 'article'
        ? '读后感 · 文章评论'
        : '帖子评论';
  card.append(kind);
  if (item.kind === 'post' && !detailed) {
    const heading = document.createElement('h2');
    heading.className = 'post-title';
    const titleLink = document.createElement('a');
    titleLink.href = discussionUrl(item);
    titleLink.textContent = item.title || item.content.slice(0, 36);
    heading.append(titleLink);
    card.append(heading);
  }
  const body = document.createElement('p');
  body.className = 'discussion-content';
  body.textContent = item.content;
  card.append(body);
  if (item.content.length > 320 && !detailed) {
    body.classList.add('is-collapsed');
    const expand = document.createElement('button');
    expand.className = 'quiet-button';
    expand.textContent = '展开全文';
    expand.setAttribute('aria-expanded', 'false');
    expand.addEventListener('click', () => {
      const collapsed = body.classList.toggle('is-collapsed');
      expand.textContent = collapsed ? '展开全文' : '收起';
      expand.setAttribute('aria-expanded', String(!collapsed));
    });
    if (item.kind !== 'post') card.append(expand);
  }
  if (item.target && item.kind !== 'post_comment') {
    catalog ??= fetch('/article-index.json').then((r) => {
      if (!r.ok) throw new Error('Catalog unavailable');
      return r.json();
    });
    void catalog
      .then((rows) => {
        const article = rows.find((a) => a.id === item.target);
        if (!article) return;
        const quote = document.createElement('a');
        quote.className = 'quoted-article';
        quote.href = '/articles/' + article.id + '/';
        quote.textContent = article.title;
        const small = document.createElement('small');
        small.textContent =
          article.author + ' · ' + (item.kind === 'post' ? '引用的作品' : '正在讨论');
        quote.append(small);
        body.after(quote);
      })
      .catch(() => {});
  }
  const actions = document.createElement('div');
  actions.className = 'discussion-actions';
  const menu = document.createElement('details');
  menu.className = 'discussion-overflow';
  const summary = document.createElement('summary');
  summary.textContent = '···';
  summary.setAttribute('aria-label', '更多讨论操作');
  const menuItems = document.createElement('div');
  menu.append(summary, menuItems);
  const login = () => {
    location.href =
      '/auth/?next=' + encodeURIComponent(location.pathname + location.search + location.hash);
  };
  const button = (label: string, handler: () => Promise<void> | void, secondary = false) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('click', async () => {
      b.disabled = true;
      try {
        await handler();
      } catch (error) {
        announce((error as Error).message);
      } finally {
        b.disabled = false;
      }
    });
    (secondary ? menuItems : actions).append(b);
    return b;
  };
  if (item.status === 'visible') {
    const like = button('赞 ' + item.like_count, async () => {
      if (!userId) {
        login();
        return;
      }
      const selected = !item.liked;
      await rpc('set_discussion_like', { p_kind: item.kind, p_id: item.id, p_active: selected });
      item.liked = selected;
      item.like_count = Number(item.like_count) + (selected ? 1 : -1);
      like.textContent = '赞 ' + item.like_count;
      like.setAttribute('aria-pressed', String(selected));
    });
    like.setAttribute('aria-pressed', String(item.liked));
    if (reply)
      button('回复 ' + item.reply_count, () => {
        if (!userId) {
          login();
          return;
        }
        reply(item);
      });
    if (userId === item.user_id) {
      button(
        '编辑',
        () => {
          menu.open = false;
          if (item.kind === 'post') {
            location.href = '/community/new/?edit=' + encodeURIComponent(item.id);
            return;
          }
          if (card.querySelector('form')) return;
          const form = document.createElement('form');
          form.className = 'form-stack';
          const label = document.createElement('label');
          label.textContent = '编辑内容';
          const area = document.createElement('textarea');
          area.value = item.content;
          area.maxLength = 2000;
          area.required = true;
          label.append(area);
          form.append(label);
          const save = document.createElement('button');
          save.textContent = '保存修改';
          const cancel = document.createElement('button');
          cancel.type = 'button';
          cancel.textContent = '取消';
          cancel.addEventListener('click', () => form.remove());
          form.append(save, cancel);
          card.append(form);
          area.focus();
          form.addEventListener('submit', async (event) => {
            event.preventDefault();
            save.disabled = true;
            try {
              await rpc('save_discussion', {
                p_kind: item.kind,
                p_target: item.target,
                p_content: area.value,
                p_id: item.id,
              });
              await refresh();
            } catch (error) {
              announce((error as Error).message);
            } finally {
              save.disabled = false;
            }
          });
        },
        true,
      );
      button(
        '删除',
        async () => {
          await rpc('delete_discussion', { p_kind: item.kind, p_id: item.id });
          await refresh();
          document.dispatchEvent(new Event('discussion-mutated'));
        },
        true,
      );
    }
    button(
      '举报',
      () => {
        menu.open = false;
        document.dispatchEvent(
          new CustomEvent('report-content', {
            detail: {
              kind:
                item.kind === 'article'
                  ? 'comment'
                  : item.kind === 'post'
                    ? 'community_post'
                    : 'community_post_comment',
              id: item.id,
            },
          }),
        );
      },
      true,
    );
  }
  const link = document.createElement('a');
  link.href = discussionUrl(item);
  link.textContent = item.kind === 'post' ? '评论 ' + item.reply_count + ' →' : '查看原文评论 →';
  actions.append(menu);
  if (!detailed) actions.append(link);
  card.append(actions);
  return card;
}
