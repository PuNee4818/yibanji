import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadBook } from '../../tools/load-book.mjs';

test('every article and chapter has readable original content', () => {
  const book = loadBook();
  assert.equal(book.articles.length, 54);
  for (const article of book.articles) {
    const paragraphs = article.kind === 'novel' ? article.chapters.flatMap(c => c.body) : article.body;
    assert.ok(paragraphs.length > 0, article.id);
    assert.ok(paragraphs.every(p => typeof p === 'string'), article.id);
  }
});
