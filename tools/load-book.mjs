import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

export const root = fileURLToPath(new URL('../', import.meta.url));
export function loadBook() {
  const window = {};
  const context = vm.createContext({ window });
  const run = (file) => vm.runInContext(readFileSync(resolve(root, file), 'utf8'), context, { filename: file, timeout: 1000 });
  run('tools/content-registry.cjs');
  run('data/book-meta.js');
  run('data/content-manifest.js');
  for (const file of window.YB_CONTENT_MANIFEST.files) run(file);
  return JSON.parse(JSON.stringify(window.YB_CONTENT.finalize(window.YB_BOOK_META)));
}
