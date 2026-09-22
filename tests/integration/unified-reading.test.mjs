import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fixtures, client } from './fixtures.mjs';
import { sql, quote } from '../../tools/db.mjs';

test('one reader: shared state, capped idempotent author rewards, withdrawal privacy and protected verification', async () => {
  const f = await fixtures(3);
  const [author, reader, other] = f.clients;
  const [a, b, c] = f.users;
  const anon = client();
  const ok = async (api, name, args) => {
    const result = await api.rpc(name, args);
    assert.equal(result.error, null, name + ': ' + result.error?.message);
    return result.data;
  };
  const xp = () => sql(`select exp from public.user_progress where user_id=${quote(a.id)}`)[0].exp;
  const original =
    '清晨的列车驶过河岸，雾气沿着玻璃缓缓散开。我们在旧站台相遇，说起这些年走过的路。有人始终记得故乡的花，有人带着一封没有寄出的信。我把故事写在本子里，希望那些安静的瞬间能被另一个人看见。' +
    '窗外的世界正在苏醒，远处传来孩子的笑声。那些未能说完的话，如今终于有了自己的归处。';
  async function publish(body, id = randomUUID(), revision = 0, genre = 'essay') {
    const draft = await ok(author, 'save_submission_draft', {
      p_id: id,
      p_revision: revision,
      p_key: randomUUID(),
      p_title: 'Unified reader test ' + id,
      p_body: body,
      p_genre: genre,
      p_tags: ['测试'],
      p_summary: '',
      p_indent: true,
    });
    await ok(author, 'publish_submission', { p_id: id, p_revision: draft.revision });
    return id;
  }
  async function qualify(api, user, id) {
    const token = await ok(api, 'begin_read', { p_article: id });
    sql(
      `update app_private.reading_sessions set active_seconds=25,last_seen=clock_timestamp()-interval '10 seconds' where id=${quote(token)} and user_id=${quote(user.id)}`,
    );
    await ok(api, 'sync_reading', {
      p_session: token,
      p_depth: 0.8,
      p_chapter: 1,
      p_position: 0.7,
    });
  }
  const mark = (api, id, kind, active = true) =>
    ok(api, 'set_article_state', { p_article: id, p_kind: kind, p_active: active });
  try {
    const id = await publish(original);
    assert.equal(Number(xp()), 100, 'publication and first-work bonus');
    await ok(author, 'publish_submission', { p_id: id, p_revision: 1 });
    await publish(original + '\n新添的结尾。', id, 1);
    assert.equal(Number(xp()), 100, 'edits and replay do not award twice');
    await mark(author, id, 'like');
    await mark(author, id, 'bookmark');
    assert.equal(Number(xp()), 100, 'self-recognition earns nothing');
    await mark(reader, id, 'like');
    await mark(reader, id, 'bookmark');
    await qualify(reader, b, id);
    assert.equal(Number(xp()), 100, 'new accounts may interact without awarding author points');
    sql(
      `update public.profiles set created_at=now()-interval '2 days' where id in(${quote(b.id)},${quote(c.id)})`,
    );
    await qualify(reader, b, id);
    assert.equal(Number(xp()), 120, 'earlier marks award after qualified reading');
    await Promise.all([mark(reader, id, 'like', false), mark(reader, id, 'bookmark', false)]);
    await Promise.all([mark(reader, id, 'like'), mark(reader, id, 'bookmark')]);
    assert.equal(Number(xp()), 120, 'toggle and concurrent requests are idempotent');
    const state = await ok(anon, 'article_context', { p_article: id });
    assert.equal(state.stats.like_count, 2);
    assert.equal(state.stats.bookmark_count, 2);
    assert.ok(
      (await ok(reader, 'submission_feed', { p_sort: 'bookmarks' })).some((row) => row.id === id),
    );
    assert.deepEqual((await author.from('bookmarks').select('*').eq('user_id', b.id)).data, []);
    const ledger = await author
      .from('economy_transactions')
      .select('*')
      .like('reason', 'submission_%');
    assert.equal(ledger.error, null);
    assert.ok(
      !JSON.stringify(ledger.data).includes(b.id),
      'private bookmark identity is not exposed through reward ledger',
    );
    const second = await publish(original + '\n第二个故事发生在冬天。');
    assert.equal(Number(xp()), 180);
    await qualify(reader, b, second);
    await mark(reader, second, 'like');
    await mark(reader, second, 'bookmark');
    assert.equal(Number(xp()), 200);
    const third = await publish(original + '\n第三个故事写给明天。');
    assert.equal(Number(xp()), 200, 'only two publication rewards each day');
    await qualify(reader, b, third);
    await mark(reader, third, 'like');
    await mark(reader, third, 'bookmark');
    assert.equal(Number(xp()), 200, 'same reader contributes at most 40 per author/day');
    await qualify(other, c, third);
    await mark(other, third, 'like');
    await mark(other, third, 'bookmark');
    assert.equal(Number(xp()), 220);
    sql(
      `update app_private.writing_rewards set amount=144 where author_id=${quote(a.id)} and article_id=${quote(id)} and actor_id=${quote(b.id)} and kind='like'`,
    );
    await qualify(other, c, second);
    await mark(other, second, 'like');
    await mark(other, second, 'bookmark');
    assert.equal(Number(xp()), 224, 'last recognition reward is clipped to the daily 200 cap');
    await ok(author, 'manage_submission', { p_id: second, p_action: 'delete' });
    await publish(original + '\n第二个故事发生在冬天。');
    assert.equal(Number(xp()), 224, 'deleted work cannot be republished for fresh rewards');
    const comment = await ok(reader, 'save_discussion', {
      p_kind: 'article',
      p_target: id,
      p_content: '一次真实的读后感，让作者知道这里还有读者。' + id,
      p_key: randomUUID(),
    });
    assert.ok(
      (await ok(anon, 'discussion_thread', { p_kind: 'article', p_target: id })).some(
        (row) => row.id === comment,
      ),
    );
    await ok(author, 'manage_submission', { p_id: id, p_action: 'withdraw' });
    assert.ok((await anon.rpc('article_context', { p_article: id })).error);
    assert.equal(
      (await ok(anon, 'discussion_thread', { p_kind: 'article', p_target: id })).length,
      0,
    );
    assert.deepEqual((await anon.from('comments').select('*').eq('article_id', id)).data, []);
    assert.deepEqual((await anon.from('discussion_items').select('*').eq('target', id)).data, []);
    assert.ok(
      !(await ok(anon, 'submission_feed', { p_sort: 'popular' })).some((row) => row.id === id),
    );
    await ok(author, 'manage_submission', { p_id: id, p_action: 'delete' });
    sql(
      `update app_private.writing_rewards set day=day-1 where author_id=${quote(a.id)} and kind='publish'`,
    );
    await publish(original + '\n新添的结尾。');
    assert.equal(
      Number(xp()),
      224,
      'deleting and republishing an edited snapshot cannot regain rewards on a later day',
    );
    const username = 'reader_' + b.id.replaceAll('-', '');
    const verify = {
      p_username: username,
      p_verified: true,
      p_reason: '测试作者身份验证',
      p_key: randomUUID(),
      p_author: '',
    };
    assert.ok(
      (await reader.rpc('set_author_verification', verify)).error,
      'users cannot verify themselves',
    );
    assert.ok(
      (await reader.from('profiles').update({ author_verified: true }).eq('id', b.id)).error,
    );
    sql(`update app_private.account_states set is_admin=true where user_id=${quote(a.id)}`);
    await ok(author, 'set_author_verification', verify);
    await ok(author, 'set_author_verification', verify);
    assert.equal(
      (await anon.from('profile_summaries').select('author_verified').eq('id', b.id).single()).data
        .author_verified,
      true,
    );
    await ok(author, 'set_author_verification', {
      ...verify,
      p_verified: false,
      p_key: randomUUID(),
    });
    assert.equal(
      (await anon.from('profile_summaries').select('author_verified').eq('id', b.id).single()).data
        .author_verified,
      false,
    );
    const existing = await anon
      .from('catalog_author_profiles')
      .select('*')
      .in('name', ['张贺然', '王俊舾']);
    assert.equal(existing.error, null);
    assert.equal(existing.data.length, 2);
    assert.ok(existing.data.every((row) => row.author_verified && row.username));
  } finally {
    f.cleanup();
  }
});
