import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { fixtures } from '../integration/fixtures.mjs';
test.use({ actionTimeout: 15000, reducedMotion: 'reduce' });
test('independent submissions and comfortable guest writing retain poetry, drafts and previews', async ({
  page,
}, info) => {
  test.setTimeout(90000);
  await page.goto('/submissions/');
  await expect(
    page
      .getByRole('navigation', { name: '主导航' })
      .getByRole('link', { name: '投稿', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('#submission-filters [name=genre] option')).toHaveCount(17);
  await page.evaluate(() => {
    (document.activeElement as HTMLElement)?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: `tmp/ux-review/submissions-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('link', { name: '写一篇文章 ↗', exact: true }).first().click();
  await expect(page.locator('#writing-title')).toBeEnabled();
  await page.getByLabel('文章标题', { exact: true }).fill('把晚风装进信里');
  const poem =
    '风从晚自习的窗口经过\n\n  吹动一页没有寄出的信\n\n\n你写在最后的那句话\n还留在这里。';
  await page.getByLabel('文章正文', { exact: true }).fill(poem);
  await page
    .locator('.writing-sidebar details')
    .evaluate((el: HTMLDetailsElement) => (el.open = true));
  await page.locator('#writing-form [name=genre]').selectOption('poetry');
  await page.locator('[data-writing-tag="校园"]').click();
  await page.locator('[data-writing-tag="记忆"]').click();
  const url = page.url();
  await page.reload();
  await expect(page.getByLabel('文章正文', { exact: true })).toHaveValue(poem);
  await expect(page.locator('[name=tags]')).toHaveValue('校园，记忆');
  await page.locator('[data-writing-preview]').click();
  await expect(page.locator('.writing-poetry')).toHaveText(poem, { useInnerText: false });
  expect(await page.locator('.writing-poetry').evaluate((el) => el.textContent)).toBe(poem);
  await page.locator('[data-writing-preview]').click();
  await page.locator('[data-writing-focus]').click();
  await expect(page.locator('.site-header')).toBeHidden();
  await page.locator('[data-writing-focus]').click();
  await expect(page.locator('.site-header')).toBeVisible();
  for (const width of [page.viewportSize()!.width, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
  }
  await page.setViewportSize({ width: info.project.name === 'mobile' ? 390 : 1280, height: 900 });
  await page.screenshot({ path: `tmp/ux-review/writing-${info.project.name}.png`, fullPage: true });
  const a11y = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(a11y.violations).toEqual([]);
  await page.locator('#theme-toggle').click();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
  ).toEqual([]);
  await page.screenshot({
    path: `tmp/ux-review/writing-dark-${info.project.name}.png`,
    fullPage: true,
  });
  await page.goto('/me/writing/');
  await expect(page.getByRole('link', { name: '把晚风装进信里' })).toBeVisible();
  await page.getByRole('link', { name: '继续写作 →' }).click();
  await expect(page).toHaveURL(url);
});
test('cloud writing publishes immediately, keeps edits private and connects profile, search and withdrawal', async ({
  page,
  browser,
}, info) => {
  test.setTimeout(240000);
  const f = await fixtures(1);
  const [u] = f.users;
  const [api] = f.clients;
  const live = expect.configure({ timeout: 30000 });
  try {
    await page.goto('/auth/?next=/write/');
    await page.getByLabel('邮箱', { exact: true }).fill(u!.email);
    await page.getByLabel('密码', { exact: true }).fill(u!.password);
    await page.getByRole('button', { name: '继续', exact: true }).click();
    await live(page.locator('#writing-title')).toBeEnabled();
    const title = '雨停之后 ' + u!.id.slice(0, 8);
    await page.getByLabel('文章标题', { exact: true }).fill(title);
    await page
      .getByLabel('文章正文', { exact: true })
      .fill(
        '雨停之后，我们走过旧日的操场。\n\n那些未说完的话，终于在纸上重逢。\n\n## 另一页\n这是新的开始。',
      );
    await page.locator('[data-writing-save]').click();
    await live(page.locator('[data-writing-state]')).toContainText('已保存到云端');
    const draftId = new URL(page.url()).searchParams.get('draft')!;
    await page.locator('[data-writing-publish]').click();
    await live(page.locator('[data-writing-publish-dialog]')).toBeVisible();
    await page.locator('[data-writing-confirm]').click();
    await live(page).toHaveURL(new RegExp('/submissions/' + draftId + '/'));
    await live(page.locator('.article-head h1')).toHaveText(title);
    await live(page.locator('[data-submission-edit]')).toBeVisible();
    await page.locator('[data-article-bookmark]').click();
    await live(page.locator('[data-article-bookmark]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('[data-comment-form] textarea').fill('这里的文字，让我想起那年的夏天。');
    await page.locator('[data-comment-form] button').first().click();
    await live(page.locator('[data-comments-list]')).toContainText('那年的夏天');
    await page.screenshot({
      path: `tmp/ux-review/submission-reader-${info.project.name}.png`,
      fullPage: true,
    });
    const visitor = await browser.newContext();
    const other = await visitor.newPage();
    await other.goto('/submissions/' + draftId + '/');
    await live(other.locator('h1')).toHaveText(title);
    await page.locator('[data-submission-edit]').click();
    await live(page.locator('#writing-title')).toBeEnabled();
    await page.getByLabel('文章标题', { exact: true }).fill('私人修改稿');
    await page.locator('[data-writing-save]').click();
    await live(page.locator('[data-writing-state]')).toContainText('已保存到云端');
    await other.reload();
    await live(other.locator('h1')).toHaveText(title);
    await page.goto('/u/reader_' + u!.id.replaceAll('-', '') + '/?stream=works');
    await live(page.locator('[data-profile-activity]')).toContainText(title);
    await page.goto('/search/?source=submissions&q=' + encodeURIComponent(title));
    await live(page.locator('#search-results')).toContainText(title);
    await page.goto('/me/bookmarks/');
    await live(page.locator('[data-submission-library-list]')).toContainText(title);
    await page.goto('/submissions/?q=' + encodeURIComponent(title));
    await live(page.locator('[data-submission-list]')).toContainText(title);
    expect(
      (await api!.rpc('manage_submission', { p_id: draftId, p_action: 'withdraw' })).error,
    ).toBeNull();
    const response = await other.reload();
    expect(response!.status()).toBe(404);
    await expect(other.getByRole('heading', { name: '这篇文字暂时不可阅读' })).toBeVisible();
    await visitor.close();
  } finally {
    f.cleanup();
  }
});
