import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  writingBlocks,
  inlineWriting,
  isVerse,
  countWords,
  submissionGenres,
  formattedWriting,
  writingStyle,
} from '../../src/lib/submissions.ts';
test('literary writing preserves verse lines, punctuation and unsafe markup as text', () => {
  const poem = '风从窗边经过\n\n  留下了一行空白\n\n\n还有下一行。';
  assert.equal(
    writingBlocks(poem, true)
      .map((b) => b.text)
      .join(''),
    poem,
  );
  assert.ok(isVerse('classical'));
  assert.ok(isVerse('ci'));
  assert.ok(!isVerse('essay'));
  const input = '<script>alert(1)</script> **一句话**';
  assert.equal(inlineWriting(input)[0].text, '<script>alert(1)</script> ');
  assert.equal(inlineWriting(input)[1].strong, true);
  assert.equal(countWords('你好，世界。\n'), 6);
  assert.ok(Object.keys(submissionGenres).length >= 16);
});

test('automatic typography distinguishes poetry, fiction and prose without changing verse whitespace', () => {
  const poem = '风起\n\n  纸上有微光\n\n\n我仍在等你';
  for (const genre of ['poetry', 'classical', 'ci']) {
    assert.equal(
      formattedWriting(poem, genre)
        .map((b) => b.text)
        .join(''),
      poem,
    );
    assert.equal(
      formattedWriting(poem, genre).some((b) => b.opening),
      false,
    );
    assert.equal(writingStyle(genre).className.includes('writing-indent'), false);
  }
  const prose = formattedWriting(
    '　　清晨，列车经过城市。\n雨落在站台上。\n\n\n有人轻轻挥手。',
    'essay',
  );
  assert.equal(prose.length, 3);
  assert.equal(prose[0].text, '清晨，列车经过城市。');
  assert.deepEqual(
    prose.map((b) => b.opening),
    [true, false, false],
  );
  const novel = formattedWriting('第一章 归途\n他打开了门。\n\n第二章：雨声\n灯还亮着。', 'novel');
  assert.deepEqual(
    novel.map((b) => b.kind),
    ['heading', 'paragraph', 'heading', 'paragraph'],
  );
  assert.equal(novel.filter((b) => b.opening).length, 2);
  assert.equal(formattedWriting('第一个人走了进来。', 'novel')[0].kind, 'paragraph');
  assert.equal(writingStyle('script').className.includes('writing-indent'), false);
  assert.equal(writingStyle('letter').dropcap, false);
});
test('paragraph and heading blocks use one consistent preview and reader format', () => {
  const rows = writingBlocks('第一段。\n\n第二段。\n\n## 第一次相遇\n故事。\n> 留言\n---\n结尾。');
  assert.equal(rows[0].text, '第一段。');
  assert.equal(rows[1].text, '第二段。');
  assert.equal(rows.filter((b) => b.kind === 'heading')[0].text, '第一次相遇');
  assert.equal(rows.filter((b) => b.kind === 'quote')[0].text, '留言');
  assert.equal(rows.filter((b) => b.kind === 'break').length, 1);
});
