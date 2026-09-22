import { readingUrl } from './reading';
export interface Discussion {
  title?: string | null;
  topic?: string | null;
  level?: number;
  author_verified?: boolean;
  kind: 'article' | 'post' | 'post_comment';
  id: string;
  user_id: string;
  target: string | null;
  parent_id: string | null;
  content: string;
  status: string;
  created_at: string;
  username: string;
  display_name: string;
  featured_achievement: string | null;
  like_count: number;
  reply_count: number;
  liked: boolean;
}
export function discussionUrl(item: Discussion): string {
  return item.kind === 'post'
    ? `/community/posts/${item.id}/`
    : item.kind === 'article'
      ? `${readingUrl(item.target ?? '')}#comment-${item.id}`
      : `/community/posts/${item.target}/#comment-${item.id}`;
}
