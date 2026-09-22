import { createClient } from '@supabase/supabase-js';
const url = import.meta.env.PUBLIC_SUPABASE_URL;
const key = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key || !key.startsWith('sb_publishable_'))
  throw new Error('Supabase public configuration is missing');
export const supabase = createClient(url, key, {
  auth: {
    persistSession: typeof window !== 'undefined',
    autoRefreshToken: typeof window !== 'undefined',
    detectSessionInUrl: typeof window !== 'undefined',
  },
  global: {
    fetch: (input, init) =>
      fetch(input, {
        ...init,
        signal: init?.signal
          ? AbortSignal.any([init.signal, AbortSignal.timeout(30000)])
          : AbortSignal.timeout(30000),
      }),
  },
});
// Local session data controls presentation only. Every read/write is authorized again by Supabase JWT + RLS/RPC.
export async function getCurrentUser() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user ?? null;
}
export function friendlyError(error: { message?: string; code?: string } | null): string {
  const message = error?.message ?? '';
  if (/AUTH_REQUIRED|JWT|session|Invalid login credentials/i.test(message))
    return '登录已失效或邮箱密码不正确，请重新登录。';
  if (/ACCOUNT_RESTRICTED/.test(message)) return '此账号暂时不能参与社区互动。';
  if (/RATE_LIMITED|rate limit/i.test(message)) return '操作有些快，请稍后再试。';
  if (/INSUFFICIENT_EGGS/.test(message)) return '臭鸡蛋不够了，签到和任务可以继续领取。';
  if (/DUPLICATE_CONTENT/.test(message)) return '这段内容已经发布过，可以回到原帖继续交流。';
  if (/INVALID_POST/.test(message)) return '请填写 1–80 字的标题，并选择一个话题。';
  if (/DRAFT_CONFLICT/.test(message)) return '草稿在别处更新了，请保留本机版本后再继续。';
  if (/EMPTY_SUBMISSION/.test(message)) return '请填写文章标题和正文。';
  if (/INVALID_TAGS/.test(message)) return '最多选择 5 个标签，每个标签不超过 16 个字。';
  if (/DRAFT_LIMIT/.test(message)) return '草稿已达到 500 篇，请整理书桌后再创建。';
  if (/NOT_OWNER/.test(message)) return '只能编辑或删除自己发布的内容。';
  if (/CONTENT_NOT_FOUND|POST_NOT_FOUND/.test(message)) return '这条内容已删除或暂时不可见。';
  if (/IDEMPOTENCY_CONFLICT/.test(message)) return '这次操作与之前的请求不一致，请刷新后再试。';
  if (/23505/.test(error?.code ?? '')) return '这个名字已经被使用，请换一个。';
  if (/Email not confirmed/i.test(message)) return '请先通过邮箱确认注册。';
  if (/23514|22023/.test(error?.code ?? '')) return '请检查输入内容和数量是否符合要求。';
  return '暂时无法完成，请检查网络后重试。';
}
export async function rpc<T = unknown>(
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(friendlyError(error));
  return data as T;
}
