import { book } from '../lib/book';
export function GET() {
  return new Response(JSON.stringify(book.articles.map(a => ({
    id: a.id, title: a.title, author: a.author,
    text: [...a.body, ...(a.notes ?? []), ...(a.chapters ?? []).flatMap(c => [c.title, ...c.body])].join('\n'),
  }))), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
