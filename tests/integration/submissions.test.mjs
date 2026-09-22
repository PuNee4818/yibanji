import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fixtures, client } from './fixtures.mjs';
test('submissions: private drafts, independent publication, conflicts, search, interactions and withdrawal', async () => {
  const f = await fixtures();
  const [a, b] = f.clients;
  const anonymous = client();
  const id = randomUUID();
  const payload = {
    p_id: id,
    p_revision: 0,
    p_key: randomUUID(),
    p_title: '夏天的旧信 ' + id.slice(0, 8),
    p_body: '窗外的风\n\n  带来了故乡的消息。\n\n## 第二页\n一次重逢。',
    p_genre: 'poetry',
    p_tags: ['故乡', '记忆'],
    p_summary: '',
    p_indent: false,
  };
  try {
    assert.ok((await anonymous.rpc('save_submission_draft', payload)).error);
    const first = await a.rpc('save_submission_draft', payload);
    assert.equal(first.error, null);
    assert.equal(first.data.revision, 1);
    assert.equal((await a.rpc('save_submission_draft', payload)).data.revision, 1);
    assert.ok(
      (await a.rpc('save_submission_draft', { ...payload, p_title: '重复请求不能更换内容' })).error,
    );
    assert.deepEqual((await b.from('submission_drafts').select('*').eq('id', id)).data, []);
    assert.deepEqual((await anonymous.from('submission_public').select('*').eq('id', id)).data, []);
    assert.ok((await b.rpc('publish_submission', { p_id: id, p_revision: 1 })).error);
    assert.ok(
      (await b.rpc('save_submission_draft', { ...payload, p_revision: 1, p_key: randomUUID() }))
        .error,
    );
    assert.equal((await a.rpc('publish_submission', { p_id: id, p_revision: 1 })).error, null);
    assert.equal((await a.rpc('publish_submission', { p_id: id, p_revision: 1 })).error, null);
    let publicRow = (await anonymous.from('submission_public').select('*').eq('id', id).single())
      .data;
    assert.equal(publicRow.body, payload.p_body);
    assert.equal(publicRow.title, payload.p_title);
    const edit = {
      ...payload,
      p_revision: 1,
      p_key: randomUUID(),
      p_title: '尚未公开的改稿 ' + id,
      p_body: '这句话仅存在于私人草稿。',
    };
    const update = await a.rpc('save_submission_draft', edit);
    assert.equal(update.error, null);
    assert.equal(update.data.revision, 2);
    assert.match(
      (await a.rpc('save_submission_draft', { ...edit, p_key: randomUUID() })).error.message,
      /DRAFT_CONFLICT/,
    );
    publicRow = (await anonymous.from('submission_public').select('*').eq('id', id).single()).data;
    assert.equal(publicRow.title, payload.p_title);
    const search = await anonymous.rpc('submission_feed', {
      p_query: payload.p_title,
      p_genre: 'poetry',
      p_tag: '故乡',
    });
    assert.equal(search.error, null);
    assert.ok(search.data.some((r) => r.id === id));
    assert.ok(!search.data[0].body);
    assert.deepEqual(
      (await anonymous.rpc('submission_feed', { p_query: '尚未公开的改稿 ' + id })).data,
      [],
    );
    assert.ok((await anonymous.rpc('submission_feed', { p_sort: 'bookmarks' })).error);
    assert.equal(
      (await b.rpc('set_submission_mark', { p_id: id, p_kind: 'like', p_value: true })).error,
      null,
    );
    assert.equal(
      (await b.rpc('set_submission_mark', { p_id: id, p_kind: 'bookmark', p_value: true })).error,
      null,
    );
    assert.equal(
      (await b.rpc('save_submission_progress', { p_id: id, p_position: 0.4 })).error,
      null,
    );
    assert.deepEqual(
      (await a.from('submission_bookmarks').select('*').eq('submission_id', id)).data,
      [],
    );
    assert.deepEqual(
      (await a.from('submission_progress').select('*').eq('submission_id', id)).data,
      [],
    );
    assert.ok(
      (await b.rpc('submission_feed', { p_sort: 'bookmarks' })).data.some((r) => r.id === id),
    );
    const comment = {
      p_id: randomUUID(),
      p_submission: id,
      p_content: '读到了熟悉的故乡，谢谢你的文字。',
    };
    assert.equal((await b.rpc('save_submission_comment', comment)).error, null);
    assert.equal((await b.rpc('save_submission_comment', comment)).error, null);
    assert.equal(
      (await anonymous.from('submission_public').select('*').eq('id', id).single()).data
        .comment_count,
      1,
    );
    assert.ok((await a.rpc('delete_submission_comment', { p_id: comment.p_id })).error);
    assert.ok((await b.rpc('manage_submission', { p_id: id, p_action: 'withdraw' })).error);
    assert.equal(
      (await a.rpc('manage_submission', { p_id: id, p_action: 'withdraw' })).error,
      null,
    );
    assert.deepEqual((await anonymous.from('submission_public').select('*').eq('id', id)).data, []);
    assert.deepEqual((await b.rpc('submission_feed', { p_sort: 'bookmarks' })).data, []);
    assert.deepEqual(
      (await anonymous.from('submission_comment_items').select('*').eq('submission_id', id)).data,
      [],
    );
    assert.ok((await b.rpc('save_submission_comment', { ...comment, p_id: randomUUID() })).error);
    assert.ok((await a.rpc('publish_submission', { p_id: id, p_revision: 1 })).error);
    assert.equal((await a.rpc('publish_submission', { p_id: id, p_revision: 2 })).error, null);
    assert.equal(
      (await anonymous.from('submission_public').select('*').eq('id', id).single()).data.body,
      edit.p_body,
    );
    const classical = await a.rpc('save_submission_draft', {
      ...payload,
      p_revision: 2,
      p_key: randomUUID(),
      p_genre: 'classical',
    });
    assert.equal(classical.error, null);
    assert.equal((await a.rpc('publish_submission', { p_id: id, p_revision: 3 })).error, null);
    assert.deepEqual(
      (await anonymous.rpc('submission_feed', { p_query: payload.p_title, p_genre: 'poetry' }))
        .data,
      [],
    );
    assert.ok(
      (
        await anonymous.rpc('submission_feed', { p_query: payload.p_title, p_genre: 'classical' })
      ).data.some((row) => row.id === id),
    );
    assert.equal((await a.rpc('manage_submission', { p_id: id, p_action: 'delete' })).error, null);
    assert.deepEqual((await a.from('submission_drafts').select('*').eq('id', id)).data, []);
  } finally {
    f.cleanup();
  }
});
