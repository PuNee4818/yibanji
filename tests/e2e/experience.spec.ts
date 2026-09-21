import { test, expect } from '@playwright/test';

test('home gives all three prefaces, real reading return, and respects reduced motion', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('.preface-link')).toHaveCount(3);
  await expect(page.locator('.ink-garden')).toBeVisible();
  await page.evaluate(() => {
    localStorage.setItem(
      'yb_last',
      JSON.stringify({ id: 'tianhuaban', chapter: 7, ts: Date.now() + 10000 }),
    );
    localStorage.setItem('yb_favs', '["a01"]');
  });
  await page.reload();
  await expect(page.locator('[data-continue-reading] a')).toHaveAttribute(
    'href',
    '/articles/tianhuaban/7/?resume=1',
  );
  await expect(page.locator('[data-home-bookmark-list]')).toContainText('序言');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.art-pages')).toHaveCSS('animation-name', 'none');
});
test('live search shows excerpts, previews, chapter targets and isolates unavailable sources', async ({
  page,
}) => {
  await page.goto('/search/');
  await page.locator('#query').fill('第三关节');
  await expect(page.locator('#search-results')).toContainText('天花板');
  await expect(page.locator('#search-results .search-result > a')).toHaveAttribute(
    'href',
    '/articles/tianhuaban/1/',
  );
  await page.locator('#search-results button').first().click();
  await expect(page.locator('main [data-search-preview]')).toBeVisible();
  await page.locator('main [data-preview-close]').click();
  await expect(page.locator('main [data-search-preview]')).toBeHidden();
  await page.locator('#query').fill('故园');
  await expect(page.locator('#search-results .search-result')).toHaveCount(8);
  await page.route('**/rest/v1/**', (route) => route.abort());
  await page.locator('main [data-search-source]').selectOption('all');
  await expect(page.locator('#search-results')).toContainText('管中赋');
  await expect(page.locator('#search-state')).toContainText('暂时不可用', { timeout: 15000 });
});
test('global quick search returns focus and keyboard selects a result', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-search-open]').click();
  await expect(page.locator('#search-dialog')).toBeVisible();
  await page.locator('#quick-query').fill('飞鸟');
  await expect(page.locator('#quick-results')).toContainText('飞鸟行并序');
  await page.locator('#quick-query').press('ArrowDown');
  await expect(page.locator('#quick-results .search-result > a').first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#search-dialog')).toBeHidden();
  await expect(page.locator('[data-search-open]')).toBeFocused();
});
test('poetry distinguishes preface, reader exports PDF and legacy settings migrate', async ({
  page,
}) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('yb_font', '4');
    localStorage.setItem('yb_line', 'loose');
    localStorage.setItem('yb_width', 'narrow');
  });
  await page.goto('/articles/a10/');
  await expect(page.locator('.work-preface')).toHaveCount(1);
  await expect(page.locator('.opening-paragraph')).toHaveCount(0);
  await expect(page.locator('.prose')).toHaveCSS('font-size', '23px');
  await page.goto('/articles/a01/');
  await expect(page.locator('.colophon')).toContainText('孟祥霖');
  await expect(page.locator('.opening-paragraph')).toHaveCount(1);
  const response = await page.request.get('/pdf/tianhuaban-1.pdf');
  expect(response.status()).toBe(200);
  expect((await response.body()).subarray(0, 5).toString()).toBe('%PDF-');
});
test('genre filters and legacy volume links retain their destinations', async ({ page }) => {
  await page.goto('/#/section/故园');
  await expect(page).toHaveURL(/catalog\/#/);
  await expect(page.locator('[data-volume="故园"]')).toBeInViewport();
  await page.locator('[data-genre-filter="novel"]').click();
  await expect(page.locator('.catalog-grid li:visible')).toHaveCount(1);
  await expect(page.locator('.catalog-grid li:visible')).toContainText('天花板');
  await page.goto('/#/read/a03/resume');
  await expect(page).toHaveURL(/articles\/a03\/\?resume=1/);
});
test('community visitors have a clear action and feed navigation works with history', async ({
  page,
}) => {
  await page.goto('/community/');
  await expect(page.locator('.guest-compose')).toContainText('登录参与');
  await page.locator('[data-feed-tab="latest"]').click();
  await expect(page).toHaveURL(/tab=latest/);
  await expect(page.locator('[data-feed-tab="latest"]')).toHaveAttribute('aria-current', 'page');
  await page.locator('[data-feed-tab="following"]').click();
  await expect(page.locator('[data-feed]')).toContainText('登录并发现书友');
  await page.goBack();
  await expect(page.locator('[data-feed-tab="latest"]')).toHaveAttribute('aria-current', 'page');
});

test('comment pagination preserves earlier discussion after a failed next page and retries without duplicates', async ({
  page,
}) => {
  let failNext = true;
  const row = (index: number) => ({
    id: 'fixture-' + index,
    kind: 'article',
    target: 'a03',
    parent_id: null,
    user_id: 'fixture-user',
    username: 'reader_fixture',
    display_name: '测试书友',
    content: '用于核验分页的讨论 ' + index,
    status: 'visible',
    created_at: '2026-09-21T00:00:00Z',
    like_count: 0,
    reply_count: 0,
    liked: false,
  });
  await page.route('**/rest/v1/rpc/discussion_thread', async (route) => {
    const args = route.request().postDataJSON();
    if (args.p_page === 1 && failNext) {
      failNext = false;
      await route.fulfill({ status: 500, json: { message: 'test network failure' } });
      return;
    }
    await route.fulfill({
      json: args.p_page === 0 ? Array.from({ length: 100 }, (_, i) => row(i)) : [row(100)],
    });
  });
  await page.goto('/articles/a03/');
  await expect(page.locator('[data-comments-list] .discussion-card')).toHaveCount(100);
  await page.locator('[data-more-comments]').click();
  await expect(page.getByRole('button', { name: '重新加载讨论', exact: true })).toBeVisible();
  await expect(page.locator('[data-comments-list] .discussion-card')).toHaveCount(100);
  await page.getByRole('button', { name: '重新加载讨论', exact: true }).click();
  await expect(page.locator('[data-comments-list] .discussion-card')).toHaveCount(101);
  await expect(page.locator('[data-more-comments]')).toBeHidden();
});
