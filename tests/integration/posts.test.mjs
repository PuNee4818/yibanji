import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fixtures, client } from './fixtures.mjs';
import { sql, quote } from '../../tools/db.mjs';
test('separate post/comment streams, titled long posts, levels, idempotency and private references', async () => {
  const f = await fixtures();
  const [a, b] = f.clients;
  const [u] = f.users;
  const article = 'test_' + randomUUID().replaceAll('-', '');
  try {
    sql(
      `insert into public.articles(id,title,author,category) values(${quote(article)},'帖子联调','测试','测试');insert into public.article_stats(article_id) values(${quote(article)});update public.user_progress set exp=400 where user_id=${quote(u.id)}`,
    );
    const payload = {
      p_title: '长篇话题标题',
      p_content: '这是一篇允许分段的长帖子。'.repeat(60),
      p_topic: '随笔',
      p_article: article,
      p_key: randomUUID(),
    };
    const post = await a.rpc('save_post', payload);
    assert.equal(post.error, null);
    assert.equal((await a.rpc('save_post', payload)).data, post.data);
    assert.ok((await a.rpc('save_post', { ...payload, p_title: '另一标题' })).error);
    assert.ok((await a.rpc('save_post', { ...payload, p_content: null })).error);
    assert.ok((await client().rpc('save_post', payload)).error);
    assert.ok((await b.rpc('save_post', { ...payload, p_id: post.data })).error);
    const comment = await b.rpc('save_discussion', {
      p_kind: 'article',
      p_target: article,
      p_content: '文章下的读后感，只应该出现在评论流。',
      p_key: randomUUID(),
    });
    assert.equal(comment.error, null);
    const reply = await b.rpc('save_discussion', {
      p_kind: 'post_comment',
      p_target: post.data,
      p_content: '帖子下的回复，属于帖子自己的评论区。',
      p_key: randomUUID(),
    });
    assert.equal(reply.error, null);
    const posts = await client().rpc('community_topics', { p_stream: 'posts', p_user: u.id });
    assert.equal(posts.error, null);
    assert.ok(posts.data.every((x) => x.kind === 'post'));
    assert.equal(posts.data.find((x) => x.id === post.data).level, 4);
    assert.equal(posts.data.find((x) => x.id === post.data).title, payload.p_title);
    const comments = await client().rpc('community_topics', { p_stream: 'comments' });
    assert.equal(comments.error, null);
    assert.ok(comments.data.every((x) => x.kind === 'article'));
    assert.ok(comments.data.some((x) => x.id === comment.data));
    const filtered = await client().rpc('community_topics', {
      p_stream: 'posts',
      p_topic: '提问',
      p_user: u.id,
    });
    assert.deepEqual(filtered.data, []);
    const changed = await a.rpc('save_post', {
      ...payload,
      p_id: post.data,
      p_title: '编辑后的标题',
      p_topic: '提问',
    });
    assert.equal(changed.error, null);
    const edited = (
      await client()
        .from('discussion_items')
        .select('*')
        .eq('kind', 'post')
        .eq('id', post.data)
        .single()
    ).data;
    assert.equal(edited.title, '编辑后的标题');
    assert.equal(edited.topic, '提问');
    assert.equal(edited.reply_count, 1);
    assert.ok(edited.search_text.includes('编辑后的标题'));
    assert.ok((await client().rpc('community_topics', { p_tab: 'following' })).error);
    assert.ok((await client().rpc('community_topics', { p_page: null })).error);
    sql(`update public.articles set active=false where id=${quote(article)}`);
    assert.deepEqual(
      (await client().from('discussion_items').select('*').eq('id', post.data)).data,
      [],
    );
    assert.deepEqual((await client().rpc('community_topics', { p_user: u.id })).data, []);
    assert.deepEqual(
      (await client().from('community_post_comments').select('id').eq('id', reply.data)).data,
      [],
    );
    sql(`update public.articles set active=true where id=${quote(article)}`);
    assert.equal(
      (await a.rpc('delete_discussion', { p_kind: 'post', p_id: post.data })).error,
      null,
    );
    assert.deepEqual(
      (await client().from('community_posts').select('title').eq('id', post.data)).data,
      [],
    );
    assert.deepEqual(
      (await client().from('discussion_items').select('title,search_text').eq('id', post.data))
        .data,
      [],
    );
    console.log(
      'Verified long titled posts, edits, public levels, independent streams, safe retries, ownership and hidden references.',
    );
  } finally {
    f.cleanup();
    sql(`delete from public.articles where id=${quote(article)}`);
  }
});
