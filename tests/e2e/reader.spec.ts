import { test, expect } from '@playwright/test';

test('original reader opens home, article and novel without script errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#app')).toContainText('一班集');
  await page.goto('/#/read/a01');
  await expect(page.locator('#app')).toContainText('文墨愈简，情意越厚。');
  await page.goto('/#/read/tianhuaban/1');
  await expect(page.locator('#app')).toContainText('第三关节');
  expect(errors).toEqual([]);
});
