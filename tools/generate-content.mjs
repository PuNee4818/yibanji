import { mkdirSync, writeFileSync } from 'node:fs';
import { loadBook } from './load-book.mjs';

mkdirSync('src/generated', { recursive: true });
writeFileSync('src/generated/book.json', JSON.stringify(loadBook()));
console.log('Generated typed content input from original sources.');
