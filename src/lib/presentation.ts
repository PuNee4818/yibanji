import type { Article } from './book';

export type Genre = 'poetry' | 'essay' | 'story' | 'novel';
export const genreNames: Record<Genre, string> = {
  poetry: '诗歌',
  essay: '散文',
  story: '短篇小说',
  novel: '长篇小说',
};
export function genreOf(article: Pick<Article, 'id' | 'kind' | 'category'>): Genre {
  if (article.kind === 'novel') return 'novel';
  if (article.kind === 'verse') return 'poetry';
  return ['志异', '迷梦', '天外', '剪刀'].includes(article.category) ||
    ['a22', 'a23', 'x_pusa', 'x_wogui', 'x_gouyade'].includes(article.id)
    ? 'story'
    : 'essay';
}
// Presentation metadata never mutates the original text.
export function hasPreface(article: Pick<Article, 'title' | 'kind' | 'body'>) {
  return (
    /并序$/.test(article.title.trim()) ||
    (article.kind === 'verse' && /^(自评|题记|附记|按)[:：]/.test(article.body[0]?.trim() ?? ''))
  );
}
export function readingMinutes(chars: number) {
  return Math.max(1, Math.ceil(chars / 450));
}

export function sectionHeadings(
  article: Pick<Article, 'id' | 'body'>,
  hints: Record<string, string[]>,
) {
  const result = article.body.flatMap((text, bodyIndex) => {
    const trimmed = text.trim();
    return hints[article.id]?.includes(trimmed) ||
      (trimmed.length <= 28 && /^[一二三四五六七八九十百]+(?:[、.．]|\s{1,3})/.test(trimmed))
      ? [{ text, bodyIndex }]
      : [];
  });
  return result.length >= 2 ? result : [];
}
