import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { loadBook, root } from './load-book.mjs';
import { resolve } from 'node:path';

export function snapshot(book) {
  return Object.fromEntries(book.articles.map(article => [article.id,
    createHash('sha256').update(JSON.stringify(article)).digest('hex')
  ]));
}
const baseline = JSON.parse(readFileSync(resolve(root, 'tests/fixtures/content-baseline.json'), 'utf8'));
assert.deepEqual(snapshot(loadBook()), baseline, 'Original article metadata, paragraphs, notes or chapters changed');
console.log(`Content integrity: all ${Object.keys(baseline).length} works match original SHA-256 baseline.`);
