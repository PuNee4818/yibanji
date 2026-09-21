import { cpSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { root } from './load-book.mjs';

const html = readFileSync(resolve(root, 'index.html'), 'utf8');
for (const [, asset] of html.matchAll(/(?:src|href)="((?:assets|content|data)\/[^"#]+)"/g)) {
  if (!existsSync(resolve(root, asset))) throw new Error(`Missing build asset: ${asset}`);
}
mkdirSync(resolve(root, 'dist'), { recursive: true });
for (const entry of ['index.html', 'assets', 'content', 'data']) {
  cpSync(resolve(root, entry), resolve(root, 'dist', entry), { recursive: true });
}
console.log('Legacy distribution built from explicit public asset allowlist.');
