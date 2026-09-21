import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { Article } from '../../src/lib/book';
const raw = JSON.parse(readFileSync('src/generated/book.json', 'utf8')) as { articles: Article[] };

test('every generated article and chapter preserves every original paragraph', async ({ page, request }) => {
  await page.goto('/');
  for (const article of raw.articles as Article[]) {
    const entries = article.chapters?.map(chapter => ({
      path: `/articles/${article.id}/${chapter.index}/`, body: chapter.body,
    })) ?? [{ path: `/articles/${article.id}/`, body: article.body }];
    for (const entry of entries) {
      const response = await request.get(entry.path);
      expect(response.ok(), entry.path).toBeTruthy();
      const rendered = await page.evaluate(html => {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        return {
          body: Array.from(doc.querySelectorAll('.prose > p, .prose > h2')).map(p => p.textContent),
          notes: Array.from(doc.querySelectorAll('.notes > p')).map(p => p.textContent),
          colophon: doc.querySelector('.colophon')?.textContent ?? '',
        };
      }, await response.text());
      expect(rendered.body, entry.path).toEqual(entry.body);
      expect(rendered.notes, entry.path).toEqual(article.notes ?? []);
      if (article.colophon?.signature) expect(rendered.colophon).toContain(article.colophon.signature);
      if (article.colophon?.date) expect(rendered.colophon).toContain(article.colophon.date);
    }
  }
});

test('reading works with JavaScript disabled', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`${baseURL}/articles/a01/`);
  await expect(page.locator('.prose')).toContainText('时光荏苒，我们永在。');
  await context.close();
});
