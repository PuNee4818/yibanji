import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBookmarks } from '../../src/lib/storage.ts';
import { searchArticles } from '../../src/lib/search.ts';

test('legacy bookmarks reject malformed values without losing valid article ids', () => {
  assert.deepEqual(parseBookmarks('["a01","a01",4,"<script>","tianhuaban"]'), ['a01', 'tianhuaban']);
  assert.deepEqual(parseBookmarks('{bad'), []);
  assert.deepEqual(parseBookmarks('{"a01":true}'), []);
});

test('search matches all terms literally and never treats input as a regular expression', () => {
  const articles = [{ id: 'a01', title: '序言', author: '孟祥霖', text: '文墨愈简 [一班]' }];
  assert.equal(searchArticles(articles, '序言 文墨').length, 1);
  assert.equal(searchArticles(articles, '[').length, 1);
  assert.equal(searchArticles(articles, '不存在').length, 0);
  assert.equal(searchArticles(articles, '  ').length, 0);
});
