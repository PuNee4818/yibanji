import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  writingBlocks,
  inlineWriting,
  isVerse,
  countWords,
  submissionGenres,
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
test('paragraph and heading blocks use one consistent preview and reader format', () => {
  const rows = writingBlocks('第一段。\n\n第二段。\n\n## 第一次相遇\n故事。\n> 留言\n---\n结尾。');
  assert.equal(rows[0].text, '第一段。');
  assert.equal(rows[1].text, '第二段。');
  assert.equal(rows.filter((b) => b.kind === 'heading')[0].text, '第一次相遇');
  assert.equal(rows.filter((b) => b.kind === 'quote')[0].text, '留言');
  assert.equal(rows.filter((b) => b.kind === 'break').length, 1);
});
