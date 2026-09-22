import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { randomUUID } from 'node:crypto';
import { fixtures } from '../integration/fixtures.mjs';

test.use({ reducedMotion: 'reduce', actionTimeout: 15000 });
test('catalog signatures link to verified author profiles and preserve unregistered author pages', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto('/authors/' + encodeURIComponent('王俊舾') + '/');
  await expect(page).toHaveURL(/\/u\/wjx_xix\/\?stream=works/);
  await expect(page.locator('.profile-name .author-badge')).toHaveText('认证作者');
  await expect(page.locator('.profile-name .level-badge')).toBeVisible();
  await expect(page.locator('.profile-catalog-works')).toContainText('收录于一班集');
  await page.locator('.profile-catalog-works .article-list li > a').first().click();
  await expect(page.locator('.article-head [data-catalog-author] a')).toHaveAttribute(
    'href',
    /\/u\/wjx_xix/,
    { timeout: 30000 },
  );
  await expect(page.locator('.article-head .author-badge')).toBeVisible();
  await page.goto('/authors/' + encodeURIComponent('孟祥霖') + '/');
  await expect(page.locator('h1')).toHaveText('孟祥霖');
  await expect(page.locator('.article-list li').first()).toBeVisible();
});

test('submission shares focus, typography, guest library and discovery with catalog reader', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const f = await fixtures(1),
    api = f.clients[0]!;
  const id = randomUUID();
  try {
    const body =
      '第一章 归途\n\n' +
      '清晨的列车驶过河岸，窗外的城市刚刚苏醒。\n一封未寄出的信，安静地留在桌上。\n\n'.repeat(10) +
      '第二章：回声\n他说，故事才刚刚开始。';
    const saved = await api.rpc('save_submission_draft', {
      p_id: id,
      p_revision: 0,
      p_key: randomUUID(),
      p_title: '雨停之后的来信 ' + id.slice(0, 6),
      p_body: body,
      p_genre: 'novel',
      p_tags: ['校园', '记忆'],
      p_summary: '把未说完的话，留在一封可以重逢的信里。',
      p_indent: true,
    });
    expect(saved.error).toBeNull();
    expect((await api.rpc('publish_submission', { p_id: id, p_revision: 1 })).error).toBeNull();
    await page.goto('/submissions/' + id + '/');
    await expect(page.locator('.reader-layout')).toBeVisible();
    await expect(page.locator('.writing-fiction h2')).toHaveCount(2);
    await expect(page.locator('.opening-paragraph')).toHaveCount(2);
    await expect(page.locator('.reader-actions [data-article-bookmark]')).toBeVisible();
    await page.locator('[data-article-bookmark]').click();
    await expect(page.locator('[data-article-bookmark]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('[data-focus-reading]').click();
    await expect(page.locator('.site-header')).toBeHidden();
    await expect(page.locator('.submission-related')).toBeHidden();
    await page.locator('[data-focus-settings]').click();
    await page.locator('.reader-options [data-preference="dropcap"]').selectOption('off');
    await expect(page.locator('html')).toHaveAttribute('data-dropcap', 'off');
    await page.locator('.exit-focus').click();
    await expect(page.locator('.site-header')).toBeVisible();
    await page
      .locator('.reader-options details')
      .evaluate((node: HTMLDetailsElement) => (node.open = false));
    await page.screenshot({
      path: `tmp/ux-review/unified-reader-${info.project.name}.png`,
      fullPage: true,
    });
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
    ).toEqual([]);
    await page.goto('/me/bookmarks/');
    await expect(page.locator('[data-submission-library-list]')).toContainText('雨停之后的来信', {
      timeout: 30000,
    });
    await page.goto('/');
    await expect(page.locator('[data-continue-reading]')).toContainText('雨停之后的来信', {
      timeout: 30000,
    });
    await page.goto('/submissions/?q=' + encodeURIComponent(id.slice(0, 6)));
    await expect(page.locator('[data-submission-list]')).toContainText('雨停之后的来信', {
      timeout: 30000,
    });
    await expect(page.locator('[data-submission-highlights]')).not.toContainText('正在翻开推荐', {
      timeout: 30000,
    });
    await page.locator('[data-feed-tab="popular"]').click();
    await expect(page).toHaveURL(/sort=popular/);
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
    }
    await page.setViewportSize({ width: info.project.name === 'mobile' ? 390 : 1280, height: 900 });
    await page.screenshot({
      path: `tmp/ux-review/submission-discovery-${info.project.name}.png`,
      fullPage: true,
    });
    await page.locator('#theme-toggle').click();
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
    ).toEqual([]);
  } finally {
    f.cleanup();
  }
});
