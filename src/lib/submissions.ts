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
    else if (!verse) {
      flush();
      lines.push(line.trim());
      flush();
    } else lines.push(line);
  }
  flush();
  return result;
}
export function writingStyle(genre: string, indent = true) {
  const variant = isVerse(genre)
    ? genre
    : ['novel', 'story', 'flash'].includes(genre)
      ? 'fiction'
      : ['letter', 'diary', 'script'].includes(genre)
        ? genre
        : 'essay';
  return {
    variant,
    className:
      'prose writing-prose writing-' +
      variant +
      (indent && !isVerse(genre) && genre !== 'script' ? ' writing-indent' : ''),
    dropcap: variant === 'essay' || variant === 'fiction',
  };
}
export const writingHints: Record<string, string> = {
  essay: '自动分段与首字下沉；首行缩进可自行设置。',
  fiction: '段距较紧凑，首行缩进可选；“第…章 / 节 / 回”独立成行时生成章节目录。',
  poetry: '保留换行、空行与行首空格；诗行左对齐，不使用首字下沉。',
  classical: '诗句居中，保留原有换行与空行。',
  ci: '保留分阕与换行；整阕居中，阕内左对齐。',
  letter: '保留称谓与落款分行，正文采用宽松段距，不使用首字下沉。',
  diary: '自动分段，首行缩进可选，不使用首字下沉。',
  script: '角色与对白逐行排版，不缩进，不使用首字下沉。',
};
export function formattedWriting(body: string, genre: string) {
  const style = writingStyle(genre);
  let opening = true;
  return writingBlocks(body, isVerse(genre)).map((block) => {
    if (
      style.variant === 'fiction' &&
      block.kind === 'paragraph' &&
      block.text.length <= 60 &&
      /^第[零〇一二三四五六七八九十百千万两0-9]+[章回节卷部](?:\s|[：:、·]|$)/u.test(block.text)
    )
      block = { ...block, kind: 'heading' };
    const dropcap = block.kind === 'paragraph' && opening && style.dropcap;
    if (block.kind === 'paragraph') opening = false;
    if (block.kind === 'heading' && style.variant === 'fiction') opening = true;
    return { ...block, opening: dropcap };
  });
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
  author_verified?: boolean;
  level?: number;
  username: string;
  like_count: number;
  comment_count: number;
  bookmark_count?: number;
  view_count?: number;
  heat?: number;
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
