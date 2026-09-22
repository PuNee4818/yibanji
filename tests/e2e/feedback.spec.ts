import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('PDF preview renders, changes editions and pages, downloads titled file and restores focus', async ({
  page,
}, testInfo) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/articles/tianhuaban/1/');
  await page.locator('[data-pdf-open]').click();
  const dialog = page.locator('#pdf-dialog');
  await expect(dialog).toBeVisible();
  await expect(page.locator('[data-pdf-canvas]')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('[data-pdf-status]')).toContainText('第 1 页');
  const filename = await page.locator('[data-pdf-download]').getAttribute('download');
  expect(filename).toContain('天花板');
  const downloaded = page.waitForEvent('download');
  await page.locator('[data-pdf-download]').click();
  expect((await downloaded).suggestedFilename()).toBe(filename);
  await page.locator('[data-pdf-next]').click();
  await expect(page.locator('[data-pdf-status]')).toContainText('第 2 页');
  await page.locator('[data-pdf-edition]').selectOption('/pdf/tianhuaban.pdf');
  await expect(page.locator('[data-pdf-download]')).toHaveAttribute('download', '天花板.pdf');
  await expect(page.locator('[data-pdf-status]')).toContainText('第 1 页', { timeout: 20000 });
  await page.getByLabel('缩放').selectOption('1.25');
  await expect(page.locator('[data-pdf-stage]')).toHaveAttribute('aria-busy', 'false');
  await page.getByLabel('缩放').selectOption('fit');
  await expect(page.locator('[data-pdf-stage]')).toHaveAttribute('aria-busy', 'false');
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('pdf-preview.png') });
  await page.getByRole('button', { name: '关闭 PDF 预览' }).click();
  await expect(page.locator('[data-pdf-open]')).toBeFocused();
  await page.locator('[data-pdf-open]').click();
  await expect(page.locator('[data-pdf-canvas]')).toBeVisible({ timeout: 15000 });
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  expect(errors).toEqual([]);
});

test('PDF loading failure is recoverable and the reader remains usable', async ({ page }) => {
  await page.goto('/articles/a03/');
  await page.route('**/pdf/a03.pdf', (route) => route.abort());
  await page.locator('[data-pdf-open]').click();
  await expect(page.locator('[data-pdf-retry]')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('[data-pdf-download]')).toHaveAttribute('download', '管中赋.pdf');
  await page.unroute('**/pdf/a03.pdf');
  await page.locator('[data-pdf-retry]').click();
  await expect(page.locator('[data-pdf-canvas]')).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: '关闭 PDF 预览' }).click();
  await page.getByRole('button', { name: '沉浸阅读', exact: true }).click();
  await expect(page.locator('body')).toHaveClass(/focus-reading/);
});

test('level previews and separate community streams have consistent accessible controls', async ({
  page,
}, testInfo) => {
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.goto('/me/rewards/');
    await page.locator('[data-level-preview="6"]').click();
    await expect(page.locator('[data-level-example]')).toContainText('长伴');
    await expect(page.locator('[data-level-preview="6"]')).toHaveAttribute('aria-pressed', 'true');
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath('levels-' + theme + '.png'),
      fullPage: true,
    });
    await page.goto('/community/');
    await expect(page.locator('[data-community-stream]')).toHaveAttribute(
      'data-community-stream',
      'posts',
    );
    await page.locator('[data-feed-topic]').selectOption('随笔');
    await expect(page).toHaveURL(/topic=/);
    await page.locator('.community-streams a').nth(1).click();
    await expect(page.locator('[data-community-stream]')).toHaveAttribute(
      'data-community-stream',
      'comments',
    );
    await expect(page.locator('[data-feed-topic]')).toHaveCount(0);
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    await page.goto('/community/new/');
    await expect(page.getByRole('link', { name: '登录并发帖' })).toBeVisible();
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
  }
});

test('hero settles without a reset and static navigation warms HTML without reader side effects', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const views: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/rpc/track_view')) views.push(r.url());
  });
  await page.goto('/');
  await page.waitForFunction(() =>
    document
      .querySelector('.art-leaf')!
      .getAnimations()
      .every((a) => a.playState === 'finished'),
  );
  const bounds = await page.locator('.art-leaf').evaluate((el) => {
    const before = el.getBoundingClientRect();
    (el as SVGElement).style.animation = 'none';
    const after = el.getBoundingClientRect();
    return Math.abs(before.x - after.x) + Math.abs(before.y - after.y);
  });
  expect(bounds).toBeLessThan(0.1);
  const catalog = page.locator('.hero-copy a[href="/catalog/"]');
  await catalog.focus();
  await expect(page.locator('link[rel="prefetch"][href$="/catalog/"]')).toHaveCount(1);
  expect(views).toEqual([]);
  await catalog.click();
  await expect(page).toHaveURL(/\/catalog\/$/);
  await page.goBack();
  await expect(page.locator('.hero-copy')).toBeVisible();
  await page.setViewportSize({ width: 320, height: 760 });
  await page.goto('/articles/a16/');
  expect(
    await page.locator('.article-actions').evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await expect(
    page.locator('.article-actions button,[data-pdf-open],.article-actions > a'),
  ).toHaveCount(7);
});
