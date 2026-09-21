import { book, sections, articleUrl } from '../lib/book';
import { genreOf } from '../lib/presentation';
export function GET() {
  return new Response(
    JSON.stringify(
      book.articles.map((a) => {
        const headings = sections(a);
        const units = a.chapters
          ? a.chapters.flatMap((c) => [
              { text: c.title, href: articleUrl(a, c.index), label: '第 ' + c.index + ' 章' },
              ...c.body.map((text, i) => ({
                text,
                href: articleUrl(a, c.index) + '#paragraph-' + (i + 1),
                label: '第 ' + c.index + ' 章 · ' + c.title,
              })),
            ])
          : a.body.map((text, i) => {
              const section = headings.findIndex((h) => h.bodyIndex === i);
              return {
                text,
                href:
                  articleUrl(a) +
                  (section >= 0 ? '#section-' + (section + 1) : '#paragraph-' + (i + 1)),
                label: section >= 0 ? '小节' : '正文',
              };
            });
        for (const note of a.notes ?? [])
          units.push({ text: note, href: articleUrl(a) + '#article-notes', label: '注释' });
        return {
          id: a.id,
          title: a.title,
          author: a.author,
          category: a.category,
          genre: genreOf(a),
          text: units.map((u) => u.text).join('\n'),
          units,
        };
      }),
    ),
    { headers: { 'Content-Type': 'application/json; charset=utf-8' } },
  );
}
