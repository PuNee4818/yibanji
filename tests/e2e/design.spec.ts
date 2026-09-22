import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('appearance follows system, persists choices, and supports keyboard menus', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: '切换到日间模式' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  const menu = page.locator('.user-menu summary');
  await menu.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('navigation', { name: '个人菜单' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('navigation', { name: '个人菜单' })).toBeHidden();
  await expect(menu).toBeFocused();
  await page.goto('/me/settings/');
  await page.getByLabel('外观').selectOption('system');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('reader has one action bar, a real PDF download, and accessible focus mode', async ({
  page,
}) => {
  await page.goto('/articles/a01/');
  await expect(page.getByRole('button', { name: '收藏', exact: true })).toHaveCount(1);
  await expect(page.locator('[data-pdf-download]')).toHaveAttribute('href', '/pdf/a01.pdf');
  const pdf = await page.request.get('/pdf/a01.pdf');
  expect(pdf.ok()).toBeTruthy();
  expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-');
  await expect(page.locator('[class*="seal"]')).toHaveCount(0);
  await page.getByRole('button', { name: '沉浸阅读', exact: true }).click();
  await expect(page.locator('.site-header')).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.locator('.site-header')).toBeVisible();
  await expect(page.getByRole('button', { name: '沉浸阅读', exact: true })).toBeFocused();
  await page.locator('.reader-options summary').click();
  await page.getByLabel('正文字号').selectOption('24');
  await expect(page.locator('.prose')).toHaveCSS('font-size', '24px');
});

test('key pages meet automated WCAG AA checks in both themes and do not overflow', async ({
  page,
}, testInfo) => {
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    for (const path of [
      '/',
      '/catalog/',
      '/articles/a01/',
      '/articles/tianhuaban/1/',
      '/search/',
      '/me/settings/',
      '/community/',
      '/me/rewards/',
      '/notifications/',
      '/admin/moderation/',
    ]) {
      await page.goto(path);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(results.violations, `${theme} ${path}`).toEqual([]);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `${theme} ${path}`,
      ).toBeTruthy();
      if (path === '/' || path === '/articles/a01/') {
        await page.screenshot({
          path: testInfo.outputPath(`${theme}-${path === '/' ? 'home' : 'reader'}.png`),
          fullPage: true,
        });
      }
    }
  }
});
