export const submissionGenres: Record<string, string> = {
  essay: '散文',
  reflection: '随笔',
  poetry: '现代诗',
  classical: '古体诗',
  ci: '词',
  story: '短篇小说',
  flash: '微型小说',
  novel: '小说',
  letter: '书信',
  diary: '日记',
  travel: '游记',
  memoir: '回忆录',
  review: '书评',
  commentary: '杂文',
  script: '剧本',
  other: '其他',
};
export const submissionTags = [
  '校园',
  '青春',
  '成长',
  '故乡',
  '亲情',
  '友情',
  '爱情',
  '生活',
  '自然',
  '旅行',
  '城市',
  '乡野',
  '记忆',
  '梦想',
  '阅读',
  '哲思',
  '治愈',
  '幽默',
  '科幻',
  '奇幻',
  '悬疑',
  '历史',
];
export const isVerse = (genre: string) => ['poetry', 'classical', 'ci'].includes(genre);
export const submissionUrl = (id: string) => '/submissions/' + encodeURIComponent(id) + '/';
export const countWords = (body: string) => Array.from(body.replace(/\s|[#*>_]/g, '')).length;
export type WritingBlock = { kind: 'paragraph' | 'heading' | 'quote' | 'break'; text: string };
// A small, text-only writing format. No HTML, images or executable links are accepted.
// Single line breaks and empty verse lines are preserved in the rendered blocks.
export function writingBlocks(body: string, verse = false): WritingBlock[] {
  const result: WritingBlock[] = [];
  let lines: string[] = [];
  const flush = () => {
    if (lines.length) result.push({ kind: 'paragraph', text: lines.join('\n') });
    lines = [];
  };
  for (const line of body.replace(/\r\n?/g, '\n').split('\n')) {
    if (/^##\s+\S/.test(line)) {
      flush();
      result.push({ kind: 'heading', text: line.replace(/^##\s+/, '') });
    } else if (/^>\s?/.test(line)) {
      flush();
      result.push({ kind: 'quote', text: line.replace(/^>\s?/, '') });
    } else if (/^---\s*$/.test(line)) {
      flush();
      result.push({ kind: 'break', text: '' });
    } else if (!verse && !line.trim()) flush();
    else lines.push(line);
  }
  flush();
  return result;
}
export function inlineWriting(text: string): { text: string; strong: boolean }[] {
  return text
    .split(/(\*\*[^*\n]+\*\*)/g)
    .filter(Boolean)
    .map((part) => ({
      text: part.startsWith('**') && part.endsWith('**') ? part.slice(2, -2) : part,
      strong: part.startsWith('**') && part.endsWith('**'),
    }));
}
export function excerpt(body: string, limit = 140) {
  return Array.from(
    body
      .replace(/^##\s+|^>\s?|^---\s*$/gm, '')
      .replace(/\*\*/g, '')
      .trim(),
  )
    .slice(0, limit)
    .join('');
}
export interface Submission {
  id: string;
  user_id: string;
  title: string;
  genre: string;
  tags: string[];
  summary: string;
  body?: string;
  indent?: boolean;
  word_count: number;
  published_at: string;
  updated_at: string;
  display_name: string;
  username: string;
  like_count: number;
  comment_count: number;
}
export interface WritingDraft {
  id: string;
  user_id?: string;
  title: string;
  genre: string;
  tags: string[];
  summary: string;
  body: string;
  indent: boolean;
  revision: number;
  updated_at?: string;
  status?: string;
  published_revision?: number;
  last_key?: string;
}
