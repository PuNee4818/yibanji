"""Verify generated PDFs against the original corpus; optionally render QA samples.

Requires PyMuPDF (pip install pymupdf). Run npm run pdf first.
"""
import argparse
import json
import re
from pathlib import Path
import fitz

root = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser()
parser.add_argument('--render', action='store_true')
args = parser.parse_args()
book = json.loads((root / 'src/generated/book.json').read_text(encoding='utf-8'))
output = root / 'tmp/ux-review/pdf'
output.mkdir(parents=True, exist_ok=True)
normalize = lambda value: re.sub(r'\s+', '', value)
report = {'files': 0, 'pages': 0, 'blank_pages': [], 'missing_text': [], 'unembedded_fonts': []}
for article in book['articles']:
    for chapter in [None, *article.get('chapters', [])]:
        name = article['id'] + ('-' + str(chapter['index']) if chapter else '')
        pdf = fitz.open(root / 'public/pdf' / (name + '.pdf'))
        report['files'] += 1
        report['pages'] += len(pdf)
        pages = []
        for index, page in enumerate(pdf):
            text = page.get_text(clip=fitz.Rect(0, 55, page.rect.width, page.rect.height - 60))
            if not text.strip():
                report['blank_pages'].append([name, index + 1])
            pages.append(text)
        content = normalize(''.join(pages))
        expected = chapter['body'] if chapter else [
            *article.get('body', []),
            *(p for c in article.get('chapters', []) for p in c['body']),
        ]
        expected = [*expected, *article.get('notes', [])]
        expected.extend(article.get('colophon', {}).values())
        for index, value in enumerate(expected):
            if normalize(value) not in content:
                report['missing_text'].append([name, index])
        for xref in {font[0] for page in pdf for font in page.get_fonts()}:
            if not pdf.extract_font(xref)[3]:
                report['unembedded_fonts'].append([name, xref])
        if args.render and name in ('a01', 'a03', 'a04', 'a10', 'a25', 'tianhuaban', 'tianhuaban-1'):
            samples = {0, len(pdf) - 1}
            if len(pdf) > 10:
                samples.add(len(pdf) // 2)
            for index in sorted(samples):
                pdf[index].get_pixmap(matrix=fitz.Matrix(1.2, 1.2)).save(output / (name + '-' + str(index + 1) + '.png'))
        pdf.close()
(output / 'verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(report, ensure_ascii=False))
if any(report[key] for key in ('blank_pages', 'missing_text', 'unembedded_fonts')):
    raise SystemExit(1)
