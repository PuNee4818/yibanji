import { test, expect } from '@playwright/test';

test('slow discussion data never blocks local continue-reading or bookmarks on home', async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.addInitScript(() => {
    localStorage.setItem(
      'yb_last',
      JSON.stringify({ id: 'tianhuaban', chapter: 7, ts: Date.now() + 10000 }),
    );
    localStorage.setItem('yb_favs', '["a01"]');
  });
  await page.route('**/rest/v1/rpc/community_topics', async (route) => {
    await gate;
    await route.fulfill({ json: [] });
  });
  try {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-continue-reading] a')).toHaveAttribute(
      'href',
      '/articles/tianhuaban/7/?resume=1',
    );
    await expect(page.locator('[data-home-bookmark-list]')).toContainText('序言');
    await expect(page.locator('[data-recent-discussions]')).toContainText('正在加载讨论');
  } finally {
    release();
  }
  await expect(page.locator('[data-recent-discussions]')).toContainText('还没有新的讨论');
});

test('guest navigation still works without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(baseURL + '/community/');
    await expect(page.locator('.guest-compose')).toBeVisible();
    await expect(page.locator('.compose-entry')).toBeHidden();
    await page.locator('.user-menu summary').click();
    await expect(page.locator('[data-auth-pending]')).toBeHidden();
    await expect(page.getByRole('link', { name: '登录 / 注册' })).toBeVisible();
  } finally {
    await context.close();
  }
});
