import raw from '../generated/book.json';

export interface Chapter { index: number; number: number; title: string; body: string[] }
export interface Article {
  id: string; title: string; subtitle?: string; author: string; category: string;
  kind: 'prose' | 'verse' | 'novel'; body: string[]; notes?: string[];
  chapters?: Chapter[]; order: number; chars: number;
  colophon?: { signature?: string; date?: string };
}
export interface Category { id: string; name: string; articles: string[] }
interface Book {
  title: string; edition: string; dedication: string[];
  articles: Article[]; categories: Category[]; sectionHints: Record<string, string[]>;
}
export const book: Book = raw as Book;
export const articleById = new Map(book.articles.map(article => [article.id, article]));
export const articleUrl = (article: Pick<Article, 'id'>, chapter?: number) =>
  `/articles/${article.id}/${chapter ? `${chapter}/` : ''}`;
export function sections(article: Article) {
  const result = article.body.flatMap((text, bodyIndex) => {
    const trimmed = text.trim();
    return book.sectionHints[article.id]?.includes(trimmed) ||
      (trimmed.length <= 28 && /^[一二三四五六七八九十百]+(?:[、.．]|\s{1,3})/.test(trimmed))
      ? [{ text, bodyIndex }] : [];
  });
  return result.length >= 2 ? result : [];
}
