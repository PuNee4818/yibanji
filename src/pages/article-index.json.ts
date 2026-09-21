import { book } from '../lib/book';
import { genreOf } from '../lib/presentation';
export function GET() {
  return new Response(
    JSON.stringify(
      book.articles.map((a) => ({
        id: a.id,
        title: a.title,
        author: a.author,
        category: a.category,
        genre: genreOf(a),
        excerpt: (a.body[0] ?? a.chapters?.[0]?.body[0] ?? '').slice(0, 100),
        chapters: a.chapters?.length ?? 0,
      })),
    ),
    { headers: { 'Content-Type': 'application/json; charset=utf-8' } },
  );
}
