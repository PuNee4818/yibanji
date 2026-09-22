import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { fixtures } from '../integration/fixtures.mjs';
test.use({ actionTimeout: 15000 });
test('profile owns editing and growth, visitor preview and social lists behave like public profiles', async ({
  page,
  browser,
}, info) => {
  test.setTimeout(150000);
  const f = await fixtures();
  const [u, v] = f.users;
  const [a, b] = f.clients;
  const own = 'reader_' + u!.id.replaceAll('-', ''),
    other = 'reader_' + v!.id.replaceAll('-', '');
  const live = expect.configure({ timeout: 20000 });
  try {
    expect((await a!.rpc('set_follow', { p_user_id: v!.id, p_following: true })).error).toBeNull();
    expect((await b!.rpc('set_follow', { p_user_id: u!.id, p_following: true })).error).toBeNull();
    await page.goto('/auth/?next=/me/');
    await page.getByLabel('邮箱', { exact: true }).fill(u!.email);
    await page.getByLabel('密码', { exact: true }).fill(u!.password);
    await page.getByRole('button', { name: '继续', exact: true }).click();
    await live(page).toHaveURL(new RegExp('/u/' + own + '/'));
    await live(page.locator('[data-profile-edit]')).toBeVisible();
    await page.locator('[data-profile-relations="following"]').click();
    await live(page.locator('[data-relations-list] a')).toHaveAttribute(
      'href',
      '/u/' + other + '/',
    );
    await page.locator('[data-relations-tab="followers"]').click();
    await live(page.locator('[data-relations-list] a')).toHaveAttribute(
      'href',
      '/u/' + other + '/',
    );
    await page.getByRole('button', { name: '关闭关注与粉丝' }).click();
    await page.locator('.profile-growth-panel summary').click();
    await live(page.locator('#profile-growth')).toContainText('墨迹');
    await page.locator('[data-level-preview="6"]').click();
    await expect(page.locator('[data-level-example]')).toContainText('长伴');
    await page.locator('[data-profile-preview]').click();
    await expect(page.locator('[data-profile-private]')).toBeHidden();
    await expect(page.locator('[data-profile-edit]')).toBeHidden();
    await expect(page.locator('[data-follow-user]')).toBeDisabled();
    await page.reload();
    await live(page.locator('[data-profile-preview-notice]')).toBeVisible();
    await expect(page.locator('[data-profile-private]')).toBeHidden();
    await page.locator('[data-profile-preview-exit]').click();
    await page.locator('[data-profile-edit]').click();
    await page.getByLabel('显示名称', { exact: true }).fill('纸边的书友');
    await page.getByLabel('个人简介', { exact: true }).fill('喜欢诗，也喜欢长长的故事。');
    await page.getByLabel('主页用户名', { exact: true }).fill('book_' + u!.id.replaceAll('-', ''));
    await page.getByRole('button', { name: '保存个人资料' }).click();
    await live(page).toHaveURL(new RegExp('/u/book_' + u!.id.replaceAll('-', '') + '/'));
    await live(page.locator('[data-profile-display-name]')).toHaveText('纸边的书友');
    await page.screenshot({
      path: info.outputPath('own-profile.png'),
      fullPage: true,
      animations: 'disabled',
    });
    await page.goto('/me/settings/');
    await expect(page.locator('#profile-form')).toHaveCount(0);
    await expect(page.getByLabel('外观')).toBeVisible();
    await page.goto('/u/' + other + '/');
    await live(page.locator('[data-follow-user]')).toBeEnabled();
    await expect(page.locator('[data-profile-owner]')).toBeHidden();
    await expect(page.locator('[data-profile-private]')).toBeHidden();
    await expect(page.locator('[data-follower-count]')).toHaveText('1');
    await page.locator('[data-follow-user]').click();
    await live(page.locator('[data-follower-count]')).toHaveText('0');
    await page.locator('[data-profile-relations="followers"]').click();
    await live(page.locator('[data-relations-list]')).toContainText('还没有');
    await page.getByRole('button', { name: '关闭关注与粉丝' }).click();
    for (const theme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      expect(
        (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
          .violations,
      ).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({
        path: info.outputPath('public-profile-' + theme + '.png'),
        fullPage: true,
        animations: 'disabled',
      });
    }
    const guest = await browser.newContext();
    try {
      const p = await guest.newPage();
      const requests: string[] = [];
      p.on('request', (r) => {
        if (r.url().includes('/rpc/profile_community')) requests.push(r.url());
      });
      await p.goto('/u/' + other + '/');
      await expect(p.locator('[data-profile-private]')).toBeHidden();
      await expect(p.locator('[data-profile-edit]')).toBeHidden();
      await expect(p.locator('[data-follow-user]')).toBeEnabled();
      expect(requests).toEqual([]);
    } finally {
      await guest.close();
    }
  } finally {
    await page.goto('about:blank').catch(() => {});
    f.cleanup();
  }
});
test('brand assets work and all publishing surfaces use the unified name', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveAttribute(
    'href',
    '/favicon.svg',
  );
  for (const file of [
    '/favicon.svg',
    '/favicon.ico',
    '/apple-touch-icon.png',
    '/icon-192.png',
    '/icon-512.png',
    '/site.webmanifest',
  ])
    expect((await page.request.get(file)).ok()).toBe(true);
  await expect(page.locator('body')).not.toContainText('第二版');
  await page.goto('/articles/preface2/');
  await expect(page.locator('.article-head h1')).toHaveText('开卷序');
  await expect(page.locator('body')).not.toContainText('第二版');
  await page.setViewportSize({ width: 320, height: 760 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
