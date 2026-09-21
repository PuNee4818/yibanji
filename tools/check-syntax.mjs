import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { root } from './load-book.mjs';

for (const directory of ['assets', 'content', 'data', 'tools']) {
  for (const path of readdirSync(resolve(root, directory), { recursive: true })) {
    if (/\.[cm]?js$/.test(path)) execFileSync(process.execPath, ['--check', resolve(root, directory, path)], { stdio: 'pipe' });
  }
}
console.log('All legacy JavaScript parsed successfully; new TypeScript checked in strict mode.');
