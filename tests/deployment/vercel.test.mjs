import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

test('Vercel serves the rebuilt homepage and community static routes', () => {
  const root = '.vercel/output/static';
  for (const route of [
    'index.html',
    'catalog/index.html',
    'community/index.html',
    'auth/index.html',
    'me/rewards/index.html',
    'articles/a01/index.html',
    'articles/tianhuaban/20/index.html',
  ]) {
    assert.ok(existsSync(join(root, route)), 'Missing static page: ' + route);
  }
  const home = readFileSync(join(root, 'index.html'), 'utf8');
  assert.ok(home.includes('href="/community/'));
  assert.ok(home.includes('href="/auth/'));
  assert.doesNotMatch(home, /(?:src|href)="(?:\.\/)?assets\//);
  assert.ok(!existsSync(join(root, 'assets')), 'Legacy SPA assets must not be deployed');
  for (const path of readdirSync(root, { recursive: true })) {
    assert.ok(!/(?:^|[\\/])\.env(?:[.\\/]|$)/.test(path), 'Environment file in public output');
  }
});

test('Vercel has deployable Node functions for profiles and post details', () => {
  const config = JSON.parse(readFileSync('.vercel/output/config.json', 'utf8'));
  assert.equal(config.version, 3);
  for (const path of ['/u/example/', '/community/posts/00000000-0000-4000-8000-000000000000/']) {
    const route = config.routes.find((r) => r.dest === '_render' && new RegExp(r.src).test(path));
    assert.ok(route, 'Missing dynamic route: ' + path);
  }
  const root = '.vercel/output/functions/_render.func';
  const fn = JSON.parse(readFileSync(join(root, '.vc-config.json'), 'utf8'));
  assert.equal(fn.runtime, 'nodejs24.x');
  assert.ok(existsSync(join(root, fn.handler)), 'Missing function handler');
});

test('Vercel includes real PDFs and the licensed reading font', () => {
  const root = '.vercel/output/static';
  const pdfs = readdirSync(join(root, 'pdf')).filter((name) => name.endsWith('.pdf'));
  assert.equal(pdfs.length, 74);
  for (const name of pdfs) {
    const data = readFileSync(join(root, 'pdf', name));
    assert.equal(data.subarray(0, 5).toString(), '%PDF-');
    assert.ok(data.length > 1000, name + ' is incomplete');
  }
  assert.ok(existsSync(join(root, 'fonts/ReadingSerif.woff2')));
  assert.ok(existsSync(join(root, 'fonts/OFL.txt')));
});
