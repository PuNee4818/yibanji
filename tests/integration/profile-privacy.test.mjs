import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixtures, client } from './fixtures.mjs';
test('public profile reveals social graph and coarse badge but no exact progress or growth history', async () => {
  const f = await fixtures();
  const [a, b] = f.clients;
  const [u, v] = f.users;
  const anon = client();
  try {
    assert.equal((await a.rpc('daily_checkin')).error, null);
    assert.equal((await a.rpc('set_follow', { p_user_id: v.id, p_following: true })).error, null);
    for (const reader of [anon, b]) {
      const profile = await reader.rpc('profile_community', { p_user: u.id });
      assert.equal(profile.error, null);
      assert.equal(profile.data.progress, null);
      assert.deepEqual(profile.data.badges, []);
      assert.ok(
        (await reader.from('user_progress').select('exp,updated_at').eq('user_id', u.id)).error,
      );
      assert.deepEqual(
        (await reader.from('user_achievements').select('*').eq('user_id', u.id)).data,
        [],
      );
      assert.equal(
        (await reader.from('user_progress').select('level').eq('user_id', u.id).single()).data
          .level,
        1,
      );
      const relations = await reader
        .from('user_follows')
        .select('person:profiles!user_follows_following_id_fkey(id,username)')
        .eq('follower_id', u.id);
      assert.equal(relations.error, null);
      assert.equal(relations.data[0].person.id, v.id);
    }
    const own = (await a.rpc('profile_community', { p_user: u.id })).data;
    assert.equal(own.progress.exp, 5);
    assert.ok(own.badges.length > 0);
    assert.equal((await a.rpc('growth_summary')).data.progress.exp, 5);
    assert.ok((await a.from('user_achievements').select('*').eq('user_id', u.id)).data.length > 0);
    console.log(
      'Verified owner-only progress and history, public coarse badge, and readable social lists.',
    );
  } finally {
    f.cleanup();
  }
});
