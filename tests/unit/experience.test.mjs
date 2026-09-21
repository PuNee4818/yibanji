import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchHits } from '../../src/lib/search.ts';
import { legacyDestination } from '../../src/lib/navigation.ts';
import { migratePreferences } from '../../src/lib/preferences.ts';
import { genreOf, hasPreface, sectionHeadings } from '../../src/lib/presentation.ts';

test('legacy section and resume routes preserve user intent', () => {
  assert.equal(legacyDestination('#/read/tianhuaban/7/resume'), '/articles/tianhuaban/7/?resume=1');
  assert.equal(
    legacyDestination('#/read/a25/section/2/resume'),
    '/articles/a25/?resume=1#section-2',
  );
  assert.equal(
    legacyDestination('#/section/故园'),
    '/catalog/?volume=' + encodeURIComponent('故园'),
  );
  assert.equal(legacyDestination('#/read/%E0%A4%A'), null);
});
test('old preferences migrate without overwriting newer choices', () => {
  const values = {
    yb_font: '4',
    yb_line: 'loose',
    yb_width: 'narrow',
    yb_paper: 'xuan',
    yb_dropcap: 'off',
  };
  let result = migratePreferences((key) => values[key] ?? null);
  assert.equal(result.size, '23');
  assert.equal(result.line, '2.16');
  assert.equal(result.width, '650');
  assert.equal(result.dropcap, 'off');
  values.yb_size = '21';
  result = migratePreferences((key) => values[key] ?? null);
  assert.equal(result.size, '21');
});
test('search ranks titles before body mentions and resolves exact chapter hits', () => {
  const items = [
    { id: 'a', title: '别的作品', author: '甲', category: '故园', text: '冬夜' },
    { id: 'b', title: '冬夜', author: '乙', category: '天外', text: '远方' },
    {
      id: 'n',
      title: '小说',
      author: '丙',
      category: '天外',
      text: '第三关节',
      units: [{ text: '第三关节', href: '/articles/n/3/', label: '第三章' }],
    },
  ];
  assert.equal(searchHits(items, '冬夜')[0].article.id, 'b');
  assert.equal(searchHits(items, '故园')[0].article.id, 'a');
  assert.equal(searchHits(items, '第三关节')[0].href, '/articles/n/3/');
  assert.deepEqual(searchHits(items, '['), []);
});
test('poetry prefaces and genre metadata do not alter original paragraphs', () => {
  const article = {
    id: 'a10',
    title: '飞鸟行并序',
    kind: 'verse',
    category: '诗笺',
    body: ['序文', '诗句'],
  };
  assert.equal(genreOf(article), 'poetry');
  assert.equal(hasPreface(article), true);
  assert.deepEqual(article.body, ['序文', '诗句']);
  assert.deepEqual(
    sectionHeadings({ id: 's', body: ['一、开头', '内容', '二、后来'] }, {}).map(
      (h) => h.bodyIndex,
    ),
    [0, 2],
  );
});
