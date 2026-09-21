export interface SearchArticle { id: string; title: string; author: string; text: string }
export function searchArticles(articles: SearchArticle[], query: string): SearchArticle[] {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return articles.filter(article => {
    const haystack = `${article.title}\n${article.author}\n${article.text}`.toLocaleLowerCase();
    return words.every(word => haystack.includes(word));
  });
}
