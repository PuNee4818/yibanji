import { supabase, getCurrentUser, rpc } from '../lib/supabase';
import { readStorage, writeStorage } from '../lib/storage';
import { announce } from './site';
import { el, link } from './submission-ui';
const reader = document.querySelector<HTMLElement>('[data-submission-reader]');
if (reader) {
  const id = reader.dataset.submissionReader!,
    author = reader.dataset.submissionAuthor!;
  const user = await getCurrentUser();
  const login = () => {
    location.href = '/auth/?next=' + encodeURIComponent(location.pathname + location.search);
  };
  document.querySelector<HTMLElement>('[data-submission-edit]')!.hidden = user?.id !== author;
  const follow = document.querySelector<HTMLButtonElement>('[data-submission-follow]')!;
  follow.hidden = user?.id === author;
  if (user) {
    const results = await Promise.all([
      supabase
        .from('submission_likes')
        .select('submission_id')
        .eq('submission_id', id)
        .eq('user_id', user.id),
      supabase
        .from('submission_bookmarks')
        .select('submission_id')
        .eq('submission_id', id)
        .eq('user_id', user.id),
      supabase
        .from('user_follows')
        .select('following_id')
        .eq('follower_id', user.id)
        .eq('following_id', author),
    ]);
    for (const [index, kind] of ['like', 'bookmark'].entries()) {
      const button = document.querySelector<HTMLButtonElement>(`[data-submission-mark="${kind}"]`)!;
      if (results[index]!.error) {
        button.disabled = true;
        announce('互动状态暂时无法读取，请刷新后重试。');
      } else if (results[index]!.data?.length) {
        button.setAttribute('aria-pressed', 'true');
        if (kind === 'bookmark') button.textContent = '已收藏';
      }
    }
    for (const [index, kind] of ['like', 'bookmark'].entries()) {
      if (!results[index]!.error)
        document.querySelector<HTMLButtonElement>(`[data-submission-mark="${kind}"]`)!.disabled =
          false;
    }
    follow.disabled = Boolean(results[2]!.error);
    if (results[2]!.data?.length) {
      follow.textContent = '已关注作者';
      follow.setAttribute('aria-pressed', 'true');
    }
    if (results[2]!.error) follow.disabled = true;
  }
  if (!user) {
    document
      .querySelectorAll<HTMLButtonElement>('[data-submission-mark]')
      .forEach((button) => (button.disabled = false));
    follow.disabled = false;
  }
  document.querySelectorAll<HTMLButtonElement>('[data-submission-mark]').forEach((button) =>
    button.addEventListener('click', async () => {
      if (!user) {
        login();
        return;
      }
      button.disabled = true;
      const value = button.getAttribute('aria-pressed') !== 'true',
        kind = button.dataset.submissionMark!;
      try {
        await rpc('set_submission_mark', { p_id: id, p_kind: kind, p_value: value });
        button.setAttribute('aria-pressed', String(value));
        if (kind === 'bookmark') button.textContent = value ? '已收藏' : '收藏';
        else {
          const count = document.querySelector('[data-submission-like-count]')!;
          count.textContent = String(Math.max(0, Number(count.textContent) + (value ? 1 : -1)));
        }
      } catch (error) {
        announce((error as Error).message);
      } finally {
        button.disabled = false;
      }
    }),
  );
  follow.addEventListener('click', async () => {
    if (!user) {
      login();
      return;
    }
    follow.disabled = true;
    try {
      const value = follow.getAttribute('aria-pressed') !== 'true';
      await rpc('set_follow', { p_user_id: author, p_following: value });
      follow.setAttribute('aria-pressed', String(value));
      follow.textContent = value ? '已关注作者' : '关注作者';
    } catch (error) {
      announce((error as Error).message);
    } finally {
      follow.disabled = false;
    }
  });
  const commentForm = document.querySelector<HTMLFormElement>('.submission-comment-form')!;
  const content = document.querySelector<HTMLTextAreaElement>('#submission-comment')!;
  const commentState = document.querySelector<HTMLElement>('[data-submission-comment-status]')!;
  const list = document.querySelector<HTMLElement>('[data-submission-comments]')!;
  const more = document.querySelector<HTMLButtonElement>('[data-submission-comments-more]')!;
  const commentKey = 'yb_submission_comment_' + (user?.id || 'guest') + '_' + id;
  content.value = readStorage(commentKey) || readStorage('yb_submission_comment_guest_' + id) || '';
  content.addEventListener('input', () => writeStorage(commentKey, content.value));
  let page = 0,
    version = 0,
    commentId = crypto.randomUUID(),
    sentContent = '';
  async function comments(append = false) {
    const request = ++version,
      next = append ? page + 1 : 0;
    more.disabled = true;
    const { data, error } = await supabase
      .from('submission_comment_items')
      .select('*')
      .eq('submission_id', id)
      .order('created_at', { ascending: false })
      .order('id')
      .range(next * 20, next * 20 + 19);
    if (request !== version) return;
    more.disabled = false;
    if (error) {
      commentState.textContent = '回声暂时无法读取。';
      more.hidden = false;
      more.textContent = '重试读取回声';
      return;
    }
    if (!append) list.replaceChildren();
    page = next;
    for (const row of data) {
      if (list.querySelector(`[data-comment-id="${row.id}"]`)) continue;
      const node = el('article', '', 'submission-comment');
      node.dataset.commentId = row.id;
      node.append(
        link(row.display_name, '/u/' + row.username + '/'),
        el('span', ' · ' + new Date(row.created_at).toLocaleDateString('zh-CN'), 'muted small'),
        el('p', row.content),
      );
      if (user?.id === row.user_id) {
        const remove = el('button', '删除这条回声', 'quiet-button');
        remove.addEventListener('click', async () => {
          if (!window.confirm('删除这条回声？')) return;
          remove.disabled = true;
          try {
            await rpc('delete_submission_comment', { p_id: row.id });
            await comments();
          } catch (error) {
            commentState.textContent = (error as Error).message;
          } finally {
            remove.disabled = false;
          }
        });
        node.append(remove);
      }
      list.append(node);
    }
    if (!data.length && !append) list.append(el('p', '还没有回声，留下第一句读后感吧。', 'muted'));
    more.hidden = data.length < 20;
    more.textContent = '更多回声';
  }
  more.addEventListener('click', () => void comments(more.textContent === '更多回声'));
  commentForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!user) {
      writeStorage(commentKey, content.value);
      login();
      return;
    }
    const submit = commentForm.querySelector<HTMLButtonElement>('button')!;
    submit.disabled = true;
    const text = content.value.trim();
    if (text !== sentContent) {
      commentId = crypto.randomUUID();
      sentContent = text;
    }
    try {
      await rpc('save_submission_comment', { p_id: commentId, p_submission: id, p_content: text });
      if (content.value.trim() === text) content.value = '';
      writeStorage(commentKey, content.value);
      writeStorage('yb_submission_comment_guest_' + id, '');
      commentState.textContent = '回声已送达。';
      await comments();
    } catch (error) {
      commentState.textContent = (error as Error).message;
    } finally {
      submit.disabled = false;
    }
  });
  commentForm.querySelector<HTMLButtonElement>('button')!.disabled = false;
  void comments();
  const body = document.querySelector<HTMLElement>('.submission-reader-body')!;
  const bar = document.querySelector<HTMLElement>('[data-submission-progress]')!;
  const progressKey = 'yb_submission_progress_' + (user?.id || 'guest') + '_' + id;
  let position = 0,
    moved = false,
    lastSent = -1;
  const progress = () => {
    const top = body.getBoundingClientRect().top + scrollY;
    position = Math.max(
      0,
      Math.min(
        1,
        (scrollY - top + innerHeight * 0.35) / Math.max(1, body.offsetHeight - innerHeight * 0.5),
      ),
    );
    bar.style.width = position * 100 + '%';
  };
  const initialScroll = scrollY;
  window.addEventListener(
    'scroll',
    () => {
      if (Math.abs(scrollY - initialScroll) > 20) moved = true;
      progress();
    },
    { passive: true },
  );
  async function saveProgress(force = false) {
    if ((!moved && !force) || Math.abs(position - lastSent) < 0.01) return;
    writeStorage(progressKey, String(position));
    if (user) {
      try {
        await rpc('save_submission_progress', { p_id: id, p_position: position });
        lastSent = position;
      } catch {
        /* Local reading position remains available. */
      }
    }
  }
  let saved = Number(readStorage(progressKey)) || 0;
  if (user) {
    const { data } = await supabase
      .from('submission_progress')
      .select('position')
      .eq('submission_id', id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (data) saved = Number(data.position);
  }
  if (new URLSearchParams(location.search).has('resume') && saved > 0 && !moved) {
    scrollTo({
      top:
        body.getBoundingClientRect().top +
        scrollY +
        saved * Math.max(1, body.offsetHeight - innerHeight * 0.5) -
        innerHeight * 0.35,
      behavior: 'instant',
    });
  }
  progress();
  const firstRead = setTimeout(() => void saveProgress(true), 3000);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) void saveProgress();
  });
  const interval = setInterval(() => void saveProgress(), 12000);
  window.addEventListener('pagehide', () => {
    clearTimeout(firstRead);
    clearInterval(interval);
    if (moved) writeStorage(progressKey, String(position));
  });
}
