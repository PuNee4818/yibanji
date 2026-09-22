import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
const svg = readFileSync('public/favicon.svg', 'utf8');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const images = new Map();
  for (const size of [16, 32, 48, 180, 192, 512]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      '<style>body{margin:0}svg{display:block;width:100vw;height:100vh}</style>' + svg,
    );
    const png = await page.screenshot({ omitBackground: true });
    images.set(size, png);
    if (size === 180) writeFileSync('public/apple-touch-icon.png', png);
    if (size === 192 || size === 512) writeFileSync('public/icon-' + size + '.png', png);
  }
  const sizes = [16, 32, 48],
    header = Buffer.alloc(6 + 16 * sizes.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  sizes.forEach((size, index) => {
    const start = 6 + 16 * index,
      image = images.get(size);
    header[start] = size;
    header[start + 1] = size;
    header.writeUInt16LE(1, start + 4);
    header.writeUInt16LE(32, start + 6);
    header.writeUInt32LE(image.length, start + 8);
    header.writeUInt32LE(offset, start + 12);
    offset += image.length;
  });
  writeFileSync(
    'public/favicon.ico',
    Buffer.concat([header, ...sizes.map((size) => images.get(size))]),
  );
  console.log('Exported favicon ICO, Apple icon, and 192/512 PNGs from the original SVG.');
} finally {
  await browser.close();
}
