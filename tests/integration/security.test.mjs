import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fixtures, client } from './fixtures.mjs';
import { sql, quote } from '../../tools/db.mjs';
test('actual schema enforces RLS, restricted grants, safe functions, valid indexes and installed triggers', () => {
  const tables = sql(
    "select n.nspname schema,c.relname name,c.relrowsecurity rls,has_table_privilege('anon',c.oid,'INSERT,UPDATE,DELETE') anon_write,has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE') user_write from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','app_private') and c.relkind='r'",
  );
  assert.ok(tables.length >= 30);
  for (const t of tables) {
    assert.equal(t.rls, true, `${t.schema}.${t.name} RLS`);
    assert.equal(t.anon_write, false, t.name);
    assert.equal(t.user_write, false, t.name);
  }
  const fns = sql(
    "select n.nspname schema,p.proname name,p.prosecdef definer,p.proconfig config,has_function_privilege('anon',p.oid,'EXECUTE') anon_exec,has_function_privilege('authenticated',p.oid,'EXECUTE') user_exec from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','app_private')",
  );
  for (const f of fns) {
    if (f.definer)
      assert.ok(
        f.config?.some((s) => s === 'search_path=""'),
        `${f.name} search_path`,
      );
    if (f.schema === 'app_private') {
      assert.equal(f.anon_exec, false, f.name);
      assert.equal(f.user_exec, false, f.name);
    }
  }
  const allowed = new Set([
    'article_context',
    'track_view',
    'discussion_thread',
    'community_feed',
    'community_topics',
    'community_highlights',
    'profile_community',
  ]);
  for (const f of fns.filter((f) => f.schema === 'public' && f.anon_exec))
    assert.ok(allowed.has(f.name), `Unexpected anon RPC ${f.name}`);
  const indexes = sql(
    "select c.relname name,i.indisvalid valid,i.indisready ready from pg_index i join pg_class c on c.oid=i.indexrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','app_private')",
  );
  assert.ok(indexes.length > 45);
  assert.ok(indexes.every((i) => i.valid && i.ready));
  const triggers = sql('select tgname name from pg_trigger where not tgisinternal');
  for (const name of [
    'on_auth_user_created',
    'on_profile_growth',
    'comments_count',
    'follow_notification',
    'achievement_notification',
    'post_like_notification',
  ])
    assert.ok(
      triggers.some((t) => t.name === name),
      name,
    );
  console.log(
    `Audited ${tables.length} tables, ${fns.length} functions, ${indexes.length} valid indexes and required Auth/economy/notification triggers.`,
  );
});
test('hidden content cannot be mutated, nested reply targets receive notifications, read sessions cannot multiply and spam is limited', async () => {
  const f = await fixtures();
  const [a, b] = f.clients;
  const [ua, ub] = f.users;
  const article = `test_${randomUUID().replaceAll('-', '')}`;
  const save = (c, p) => c.rpc('save_discussion', { p_key: randomUUID(), ...p });
  try {
    sql(
      `insert into public.articles(id,title,author,category) values(${quote(article)},'安全联调','测试','测试');insert into public.article_stats(article_id) values(${quote(article)});`,
    );
    const root = await save(a, {
      p_kind: 'article',
      p_target: article,
      p_content: '这是一条真实的根评论，用于验证回复目标。',
    });
    assert.equal(root.error, null);
    const child = await save(b, {
      p_kind: 'article',
      p_target: article,
      p_parent: root.data,
      p_content: '在根评论之下的回复，也应当收到新的回复通知。',
    });
    assert.equal(child.error, null);
    const nested = await save(a, {
      p_kind: 'article',
      p_target: article,
      p_parent: child.data,
      p_content: '回复第二位书友，应通知第二位而不是自己。',
    });
    assert.equal(nested.error, null);
    assert.ok(
      (await b.from('notifications').select('*').eq('kind', 'reply')).data.some((n) =>
        n.href.endsWith(nested.data),
      ),
    );
    const original = (await a.rpc('begin_read', { p_article: article })).data;
    const current = (await a.rpc('begin_read', { p_article: article })).data;
    assert.notEqual(original, current);
    assert.ok(
      (
        await a.rpc('sync_reading', {
          p_session: original,
          p_depth: 1,
          p_chapter: 1,
          p_position: 1,
        })
      ).error,
    );
    assert.equal(
      (await a.rpc('sync_reading', { p_session: current, p_depth: 1, p_chapter: 1, p_position: 1 }))
        .data,
      false,
    );
    const post = await save(a, {
      p_kind: 'post',
      p_target: null,
      p_content: '用来验证隐藏动态不会留下可写子评论入口。',
    });
    assert.equal(post.error, null);
    const pc = await save(b, {
      p_kind: 'post_comment',
      p_target: post.data,
      p_content: '父动态隐藏后，这条评论不应该还能被点赞编辑。',
    });
    assert.equal(pc.error, null);
    sql(
      `update public.community_posts set status='hidden' where id=${quote(post.data)};update public.articles set active=false where id=${quote(article)}`,
    );
    assert.ok(
      (
        await a.rpc('set_discussion_like', {
          p_kind: 'post_comment',
          p_id: pc.data,
          p_active: true,
        })
      ).error,
    );
    assert.ok(
      (
        await save(b, {
          p_kind: 'post_comment',
          p_target: post.data,
          p_id: pc.data,
          p_content: '隐藏父动态不允许继续修改这条评论。',
        })
      ).error,
    );
    assert.ok(
      (await b.rpc('set_discussion_like', { p_kind: 'article', p_id: root.data, p_active: true }))
        .error,
    );
    assert.ok(
      !(await client().rpc('community_feed', { p_tab: 'latest' })).data.some(
        (row) => row.target === article,
      ),
    );
    assert.equal(
      (await client().from('comments').select('*').eq('article_id', article)).data.length,
      0,
    );
    assert.ok(
      (
        await a
          .from('notifications')
          .insert({
            user_id: ub.id,
            kind: 'system',
            title: 'forged',
            href: '/',
            target_key: 'forged',
          })
      ).error,
    );
    assert.ok(
      (
        await a
          .from('egg_throws')
          .insert({
            user_id: ua.id,
            article_id: article,
            quantity: 1,
            idempotency_key: randomUUID(),
          })
      ).error,
    );
    assert.ok((await a.rpc('select_achievement', { p_achievement: 'streak100' })).error);
    const seeded = sql(
      `insert into app_private.rate_windows(user_id,scope,window_start,count) values(${quote(ua.id)},'discussion_write',date_trunc('minute',clock_timestamp()),10) on conflict(user_id,scope) do update set count=10,window_start=excluded.window_start returning window_start`,
    )[0];
    const limited = await save(a, {
      p_kind: 'post',
      p_target: null,
      p_content: '达到分钟限额后，即使内容不同也不允许刷屏。',
    });
    if (limited.error) assert.match(limited.error.message, /RATE_LIMITED/);
    else {
      const currentWindow = sql(
        `select window_start,count from app_private.rate_windows where user_id=${quote(ua.id)} and scope='discussion_write'`,
      )[0];
      assert.ok(
        new Date(currentWindow.window_start) > new Date(seeded.window_start),
        'A request over quota may succeed only after the server minute changes',
      );
      assert.equal(currentWindow.count, 1);
    }
    const me = (await a.rpc('profile_community', { p_user: ua.id })).data;
    for (const privateKey of ['wallet', 'reading_progress', 'bookmarks', 'email', 'checkins'])
      assert.ok(!(privateKey in me));
    console.log(
      'Verified nested reply recipient, hidden parent write denial, inactive article isolation, one active reading session, private payloads, forged writes and rate limits.',
    );
  } finally {
    f.cleanup();
    sql(`delete from public.articles where id=${quote(article)}`);
  }
});
