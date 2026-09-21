import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBookmarks } from '../../src/lib/storage.ts';
import { searchArticles } from '../../src/lib/search.ts';
import { normalizePreferences, defaults } from '../../src/lib/preferences.ts';
import {safeLocalPath} from '../../src/lib/navigation.ts';

test('login destinations reject protocol-relative, control-character and backslash redirects',()=>{
 for(const input of ['//evil.example','/\n/evil.example','/\\evil.example','https://evil.example',null])assert.equal(safeLocalPath(input,'https://example.com'),'/me/settings/');
 assert.equal(safeLocalPath('/articles/a01/?resume=1#comments','https://example.com'),'/articles/a01/?resume=1#comments');
});

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

test('reading preferences accept valid choices and safely reject injected or corrupt values', () => {
  assert.deepEqual(normalizePreferences({ theme: 'evil', width: 'url(https://bad)', size: '-1' }), defaults);
  assert.equal(normalizePreferences({ theme: 'dark', size: '24' }).size, '24');
  assert.equal(normalizePreferences({ theme: null }).theme, 'system');
});
