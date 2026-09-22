import { readStorage, parseBookmarks } from '../lib/storage';
import { getCurrentUser, rpc, supabase } from '../lib/supabase';
import { readingUrl } from '../lib/reading';
interface Entry {
  id: string;
  title: string;
  author: string;
  category: string;
  genre: string;
  excerpt: string;
  chapters: number;
}
const response = await fetch('/article-index.json').catch(() => null);
if (response?.ok) {
  const entries = (await response.json()) as Entry[];
  const find = (id: string) => entries.find((a) => a.id === id);
  const resume = document.querySelector<HTMLElement>('[data-continue-reading]');
  let resumeRequest = 0,
    bookmarksRequest = 0;
  async function showResume(value: { id: string; chapter?: number } | null) {
    const request = ++resumeRequest;
    if (value && !find(value.id) && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value.id)) {
      const { data } = await supabase
        .from('submission_public')
        .select('id,title,display_name,genre,summary')
        .eq('id', value.id)
        .maybeSingle();
      if (data)
        entries.push({
          id: data.id,
          title: data.title,
          author: data.display_name,
          category: '自由投稿',
          genre: data.genre,
          excerpt: data.summary,
          chapters: 0,
        });
    }
    if (request !== resumeRequest) return;
    const a = value && find(value.id);
    if (!a || !resume) return;
    const chapter = Math.max(1, Math.min(a.chapters || 1, Number(value?.chapter) || 1));
    resume.replaceChildren();
    const caption = document.createElement('span');
    caption.className = 'eyebrow';
    caption.textContent = '上次读到';
    const title = document.createElement('strong');
    title.textContent = a.title + (a.chapters ? ' · 第 ' + chapter + ' 章' : '');
    const link = document.createElement('a');
    link.href = readingUrl(a.id) + (a.chapters ? chapter + '/' : '') + '?resume=1';
    link.textContent = '接着读 →';
    resume.append(caption, title, link);
    resume.hidden = false;
  }
  try {
    void showResume(JSON.parse(readStorage('yb_last') ?? 'null')).catch(() => {});
  } catch {
    /* No valid history yet. */
  }
  async function showBookmarks(ids: string[], account = false) {
    const request = ++bookmarksRequest;
    const missing = ids
      .filter((id) => !find(id) && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id))
      .slice(0, 100);
    if (missing.length) {
      const { data } = await supabase
        .from('submission_public')
        .select('id,title,display_name,genre,summary')
        .in('id', missing);
      for (const item of data ?? [])
        if (!find(item.id))
          entries.push({
            id: item.id,
            title: item.title,
            author: item.display_name,
            category: '自由投稿',
            genre: item.genre,
            excerpt: item.summary,
            chapters: 0,
          });
    }
    if (request !== bookmarksRequest) return;
    const section = document.querySelector<HTMLElement>('[data-home-bookmarks]')!;
    const list = section.querySelector('[data-home-bookmark-list]')!;
    const valid = ids.filter((id) => find(id));
    section.querySelector('[data-home-bookmark-count]')!.textContent =
      '（' + valid.length + ' 篇 · ' + (account ? '账号' : '本机') + '）';
    list.replaceChildren();
    for (const id of valid.slice(0, 4)) {
      const a = find(id);
      if (a) {
        const link = document.createElement('a');
        link.href = readingUrl(id);
        link.textContent = '↗ ' + a.title;
        list.append(link);
      }
    }
    section.hidden = !list.childElementCount;
  }
  void showBookmarks(parseBookmarks(readStorage('yb_favs'))).catch(() => {});
  void getCurrentUser()
    .then(async (user) => {
      if (!user) return;
      const [bookmarks, history] = await Promise.all([
        supabase
          .from('bookmarks')
          .select('article_id')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('reading_progress')
          .select('article_id,chapter,updated_at')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(1),
      ]);
      if (!bookmarks.error)
        await showBookmarks(
          bookmarks.data.map((x) => x.article_id),
          true,
        );
      const row = history.data?.[0];
      let local = 0;
      try {
        local = JSON.parse(readStorage('yb_last') ?? 'null')?.ts ?? 0;
      } catch {
        /* Invalid local history. */
      }
      if (row && Date.parse(row.updated_at) > local)
        await showResume({ id: row.article_id, chapter: row.chapter });
    })
    .catch(() => {});
  const caption = document.querySelector('[data-hot-caption]')!;
  void rpc<{ hot: { id: string; discussions: number }[] }>('community_highlights')
    .then((data) => {
      const works = data.hot
        .map((row) => ({ entry: find(row.id), discussions: row.discussions }))
        .filter((x) => x.entry)
        .slice(0, 3);
      if (!works.length) {
        caption.textContent = '本周还没有热文，先从这几篇读起。';
        return;
      }
      caption.textContent = '本周热文 · 根据阅读与讨论更新';
      const list = document.querySelector('[data-hot-works]')!;
      list.replaceChildren();
      const genres: Record<string, string> = {
        poetry: '诗歌',
        essay: '散文',
        story: '短篇小说',
        novel: '长篇小说',
      };
      works.forEach(({ entry: a, discussions }, i) => {
        if (!a) return;
        const link = document.createElement('a');
        link.className = 'hot-work';
        link.href = readingUrl(a.id);
        for (const [tag, cls, text] of [
          ['span', 'work-index', '0' + (i + 1)],
          ['span', 'eyebrow', genres[a.genre] + ' / ' + a.category],
          ['h3', '', a.title],
          ['p', '', a.author],
          ['span', 'work-excerpt', a.excerpt.slice(0, 60) + '…'],
          ['span', 'text-link', discussions + ' 条讨论 · 开始阅读 ↗'],
        ] as [string, string, string][]) {
          const el = document.createElement(tag);
          el.className = cls;
          el.textContent = text;
          link.append(el);
        }
        list.append(link);
      });
    })
    .catch(() => {
      caption.textContent = '热文暂未更新，先从这几篇读起。';
    });
}
