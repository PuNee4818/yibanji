import PDFDocument from 'pdfkit';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { loadBook } from './load-book.mjs';
import { genreOf, genreNames, hasPreface, sectionHeadings } from '../src/lib/presentation.ts';

const book = loadBook();
const directory = path.resolve('public/pdf');
const font = path.resolve('tools/fonts/NotoSerifCJKsc-Regular.otf');
fs.mkdirSync(directory, { recursive: true });
const fingerprint = crypto
  .createHash('sha256')
  .update(JSON.stringify(book))
  .update(fs.readFileSync(import.meta.filename))
  .update(fs.readFileSync('src/lib/presentation.ts'))
  .update(fs.readFileSync(font))
  .digest('hex');
const files = book.articles.flatMap((a) => [
  a.id + '.pdf',
  ...(a.chapters ?? []).map((c) => a.id + '-' + c.index + '.pdf'),
]);
const stamp = path.join(directory, 'manifest.json');
if (
  fs.existsSync(stamp) &&
  JSON.parse(fs.readFileSync(stamp, 'utf8')).fingerprint === fingerprint &&
  files.every((f) => fs.existsSync(path.join(directory, f)))
) {
  console.log('PDF library is current: ' + files.length + ' files.');
  process.exit(0);
}
const ink = '#282723',
  accent = '#914935',
  muted = '#746c60';
async function create(article, chapter) {
  const file = article.id + (chapter ? '-' + chapter.index : '') + '.pdf';
  const stream = fs.createWriteStream(path.join(directory, file));
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 72, bottom: 66, left: 66, right: 66 },
    bufferPages: true,
    info: {
      Title: chapter ? article.title + ' · ' + chapter.title : article.title,
      Author: article.author,
      Subject: '一班集 · 第二版',
      Creator: '一班集 · 阅读版',
    },
  });
  const done = new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
    doc.on('error', reject);
  });
  doc.pipe(stream);
  doc.registerFont('book', font);
  doc.font('book');
  const left = 66,
    width = doc.page.width - 132,
    bottom = doc.page.height - 70;
  let y = 86;
  const page = () => {
    doc.addPage();
    y = 76;
  };
  const need = (height) => {
    if (y + height > bottom) page();
  };
  function line(text, size = 11.5, color = ink, indent = 0, align = 'left') {
    doc
      .font('book')
      .fontSize(size)
      .fillColor(color)
      .text(text, left + indent, y, { width: width - indent, lineBreak: false, align });
    y += size * 1.95;
  }
  // Unicode code points are kept whole. Closing punctuation cannot start a line.
  function wrap(text, size, available) {
    doc.font('book').fontSize(size);
    const result = [];
    let current = '';
    for (const char of Array.from(text)) {
      if (char === '\n') {
        result.push(current);
        current = '';
        continue;
      }
      if (current && doc.widthOfString(current + char) > available) {
        if (/[，。！？；：、）》」』】…,.!?;:]/.test(char)) {
          current += char;
          result.push(current);
          current = '';
          continue;
        }
        const last = Array.from(current).at(-1);
        if (last && /[（《「『【]/.test(last)) {
          result.push(current.slice(0, -last.length));
          current = last + char;
        } else {
          result.push(current);
          current = char;
        }
      } else current += char;
    }
    if (current) result.push(current);
    return result;
  }
  function paragraph(text, { verse = false, note = false, preface = false } = {}) {
    const size = note ? 9.5 : preface ? 10.5 : 11.5;
    const leading = size * 1.95;
    const lines = wrap(text, size, width - (verse ? 32 : 23));
    need(Math.min(lines.length, 2) * leading + 4);
    for (let i = 0; i < lines.length; i++) {
      if (y + leading > bottom || (lines.length - i === 2 && y + leading * 2 > bottom)) page();
      line(
        lines[i],
        size,
        note || preface ? muted : ink,
        verse ? 16 : i === 0 ? 23 : 0,
        verse ? 'center' : 'left',
      );
    }
    y += verse ? 4 : 10;
  }
  function body(paragraphs, chapterMode = false) {
    const headings = chapterMode ? [] : sectionHeadings(article, book.sectionHints);
    paragraphs.forEach((text, i) => {
      if (headings.some((h) => h.bodyIndex === i)) {
        need(100);
        y += 16;
        line(text, 15, accent);
        y += 12;
      } else
        paragraph(text, {
          verse: article.kind === 'verse' && !(i === 0 && hasPreface(article)),
          preface: !chapterMode && i === 0 && hasPreface(article),
        });
    });
  }
  doc
    .fontSize(10)
    .fillColor(accent)
    .text('一班集  /  第二版  /  ' + article.category, left, y, { width });
  y += 36;
  const title = chapter ? chapter.title : article.title;
  doc.fontSize(27).fillColor(ink).text(title, left, y, { width, lineGap: 5 });
  y = doc.y + 16;
  if (article.subtitle) {
    doc.fontSize(13).fillColor(muted).text(article.subtitle, left, y, { width });
    y = doc.y + 14;
  }
  line(
    article.author +
      '  ·  ' +
      genreNames[genreOf(article)] +
      (chapter ? '  ·  第 ' + chapter.index + ' 章' : ''),
    10,
    muted,
  );
  y += 8;
  doc
    .moveTo(left, y)
    .lineTo(left + width, y)
    .lineWidth(0.65)
    .strokeColor('#bcb2a3')
    .stroke();
  y += 26;
  if (article.chapters && !chapter) {
    line('目录', 15, accent);
    y += 8;
    for (const c of article.chapters) {
      need(28);
      line(String(c.index).padStart(2, '0') + '   ' + c.title, 11.5);
    }
    for (const c of article.chapters) {
      page();
      doc.outline.addItem(c.title);
      line('第 ' + c.index + ' 章', 10, accent);
      y += 14;
      line(c.title, 23);
      y += 22;
      body(c.body, true);
    }
  } else body(chapter?.body ?? article.body, !!chapter);
  if (article.notes?.length) {
    need(90);
    y += 18;
    doc
      .moveTo(left, y)
      .lineTo(left + 46, y)
      .strokeColor(accent)
      .stroke();
    y += 18;
    line('注释', 10, accent);
    for (const note of article.notes) paragraph(note, { note: true });
  }
  if (article.colophon) {
    need(80);
    y += 20;
    for (const text of [article.colophon.signature, article.colophon.date].filter(Boolean))
      line(text, 10, muted, 0, 'right');
  }
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    const margin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc
      .font('book')
      .fontSize(8)
      .fillColor(muted)
      .text('一班集 · ' + article.title, left, 32, { width, lineBreak: false });
    doc
      .moveTo(left, 48)
      .lineTo(left + width, 48)
      .lineWidth(0.3)
      .strokeColor('#d8d0c4')
      .stroke();
    doc
      .fontSize(8)
      .text(String(i + 1).padStart(2, '0') + '  /  ' + range.count, left, doc.page.height - 43, {
        width,
        align: 'center',
        lineBreak: false,
      });
    doc.page.margins.bottom = margin;
  }
  doc.end();
  await done;
}
for (const article of book.articles) {
  await create(article);
  for (const chapter of article.chapters ?? []) await create(article, chapter);
}
fs.writeFileSync(stamp, JSON.stringify({ fingerprint, files }, null, 2));
console.log('Generated ' + files.length + ' publication PDFs with embedded Noto Serif CJK.');
