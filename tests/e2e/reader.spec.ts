import { test, expect } from '@playwright/test';

test('original reader opens home, article and novel without script errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#main')).toContainText('一班集');
  await page.goto('/#/read/a01');
  await expect(page.locator('#main')).toContainText('文墨愈简，情意越厚。');
  await page.goto('/#/read/tianhuaban/1');
  await expect(page.locator('#main')).toContainText('第三关节');
  expect(errors).toEqual([]);
});

test('search, old bookmarks and reading history survive the migration', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('yb_favs', '["a01","a01","unknown"]'));
  await page.goto('/me/bookmarks/');
  await expect(page.locator('[data-bookmark-item]:visible')).toHaveCount(1);
  await page.getByRole('link', { name: '序言', exact: false }).click();
  await expect(page.getByRole('button', { name: '已收藏', exact: true })).toBeVisible();
  await page.goto('/me/history/');
  await expect(page.locator('[data-history-item="a01"]')).toBeVisible();
  await page.goto('/search/');
  await page.getByLabel('搜索文集').fill('第三关节');
  await page.getByRole('button', { name: '搜索', exact: true }).click();
  await expect(page.locator('#search-results')).toContainText('天花板');
});
