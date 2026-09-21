export interface SearchUnit {
  text: string;
  href: string;
  label: string;
}
export interface SearchArticle {
  id: string;
  title: string;
  author: string;
  text: string;
  category?: string;
  genre?: string;
  units?: SearchUnit[];
}
export interface SearchHit {
  article: SearchArticle;
  href: string;
  snippet: string;
  label: string;
  score: number;
}
export function searchHits(articles: SearchArticle[], query: string): SearchHit[] {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return articles
    .flatMap((article) => {
      const haystack = [article.title, article.author, article.category ?? '', article.text]
        .join('\n')
        .toLocaleLowerCase();
      if (!words.every((w) => haystack.includes(w))) return [];
      const score = words.reduce(
        (n, w) =>
          n +
          (article.title.toLocaleLowerCase().includes(w) ? 100 : 0) +
          (article.author.toLocaleLowerCase().includes(w) ? 60 : 0) +
          (article.category?.includes(w) ? 40 : 0),
        0,
      );
      const unit =
        article.units?.find((u) => words.every((w) => u.text.toLocaleLowerCase().includes(w))) ??
        article.units?.find((u) => words.some((w) => u.text.toLocaleLowerCase().includes(w)));
      const text = unit?.text ?? article.text;
      const at = Math.max(
        0,
        ...words
          .map((w) => text.toLocaleLowerCase().indexOf(w))
          .filter((i) => i >= 0)
          .slice(0, 1),
      );
      const start = Math.max(0, at - 35);
      return [
        {
          article,
          score,
          href: unit?.href ?? '/articles/' + article.id + '/',
          label: unit?.label ?? '作品',
          snippet:
            (start ? '…' : '') +
            text.slice(start, start + 155) +
            (text.length > start + 155 ? '…' : ''),
        },
      ];
    })
    .sort((a, b) => b.score - a.score);
}
export function searchArticles(articles: SearchArticle[], query: string): SearchArticle[] {
  return searchHits(articles, query).map((hit) => hit.article);
}
