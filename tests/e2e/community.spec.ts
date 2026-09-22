import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { randomUUID } from 'node:crypto';
import { fixtures } from '../integration/fixtures.mjs';

test('real reading-to-community loop: likes, migration, comments, multi/repeat eggs, posts, follow and notifications', async ({
  page,
}, testInfo) => {
  test.setTimeout(210000);
  const live = expect.configure({ timeout: 20000 });
  const f = await fixtures();
  const [u, v] = f.users;
  const [a, b] = f.clients;
  try {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/auth/?next=/articles/a03/');
    await page.getByLabel('邮箱', { exact: true }).fill(u!.email);
    await page.getByLabel('密码', { exact: true }).fill(u!.password);
    await page.getByRole('button', { name: '继续', exact: true }).click();
    await expect(page).toHaveURL(/\/articles\/a03\/$/, { timeout: 40000 });
    await live(page.locator('[data-article-stats]')).toContainText('次阅读');
    await page.locator('.user-menu summary').click();
    await page.locator('[data-open-checkin]').click();
    await live(page.locator('#checkin-submit')).toBeEnabled();
    await page.locator('#checkin-submit').click();
    await live(page.locator('#checkin-result')).toContainText('1 枚臭鸡蛋');
    await expect(page.locator('.menu-caption .level-badge')).toHaveCount(1);
    await page.getByRole('button', { name: '关闭签到面板' }).click();
    await page.locator('[data-like]').click();
    await live(page.locator('[data-like]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('[data-article-bookmark]').click();
    await live(page.locator('[data-article-bookmark]')).toHaveAttribute('aria-pressed', 'true');
    const words = `读到这里，记忆里那些课间与放学的时光又鲜活起来了。${testInfo.project.name} <img src=x onerror="window.__unsafe=1">`;
    await page.getByLabel('留下你的感想').fill(words);
    await page.getByRole('button', { name: '发表讨论', exact: true }).click();
    await live(page.locator('[data-comments-list]')).toContainText(words);
    const c = (
      await a!.from('comments').select('id').eq('user_id', u!.id).eq('article_id', 'a03').single()
    ).data!;
    await expect(page.locator(`#comment-${c.id} img`)).toHaveCount(0);
    expect(await page.evaluate(() => Reflect.get(window, '__unsafe'))).toBeUndefined();
    await page.locator('[data-egg-open]').click();
    await live(page.locator('[data-egg-wallet]')).toContainText('3 枚臭鸡蛋');
    await page.getByLabel('投掷数量').fill('2');
    await page.getByRole('button', { name: '按数量投掷' }).click();
    await live(page.locator('[data-egg-result]')).toContainText('剩余 1 枚');
    await page.getByRole('button', { name: '扔 1 枚', exact: true }).click();
    await live(page.locator('[data-egg-result]')).toContainText('剩余 0 枚');
    await page.getByRole('button', { name: '关闭投掷面板' }).click();
    await expect(page.locator('[data-like]')).toHaveAttribute('aria-pressed', 'true');
    await page.evaluate(() => localStorage.setItem('yb_favs', '["a01","a03"]'));
    await page.goto('/me/bookmarks/');
    await live(page.locator('#import-bookmarks')).toBeVisible();
    await page.locator('#import-bookmarks').click();
    await live(page.locator('[data-bookmark-item="a01"]')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('yb_favs'))).toBe('["a01","a03"]');
    await page.goto('/me/history/');
    await live(page.locator('[data-history-item="a03"]')).toBeVisible();
    await page.goto(`/u/reader_${v!.id.replaceAll('-', '')}/`);
    await page.locator('[data-level-preview="5"]').click();
    await expect(page.locator('[data-level-example]')).toContainText('藏卷');
    await page.locator('[data-follow-user]').click();
    await live(page.locator('[data-follow-user]')).toHaveAttribute('aria-pressed', 'true');
    await page.goto('/community/?tab=latest');
    const postWords = `在社区里继续这段阅读，文字让彼此慢慢相识。${testInfo.project.name}`;
    await page.getByRole('link', { name: '发布帖子', exact: true }).first().click();
    await page
      .getByLabel('帖子标题', { exact: true })
      .fill('一段阅读的回声 ' + testInfo.project.name);
    await page.locator('#post-form textarea').fill(postWords);
    await page.getByRole('combobox', { name: '话题', exact: true }).selectOption('随笔');
    await page.reload();
    await live(page.locator('#post-form textarea')).toHaveValue(postWords);
    await expect(page.getByRole('combobox', { name: '话题', exact: true })).toHaveValue('随笔');
    await page.locator('[data-post-preview]').click();
    await expect(page.locator('[data-post-draft-preview]')).toContainText(postWords);
    await page.screenshot({
      path: testInfo.outputPath('post-editor.png'),
      fullPage: true,
      animations: 'disabled',
    });
    await page.locator('[data-post-submit]').click();
    await live(page.locator('[data-post-body]')).toContainText(postWords);
    const p = (await a!.from('community_posts').select('id').eq('user_id', u!.id).single()).data!;

    await expect(page.locator('[data-post-body] .level-badge')).toBeVisible();
    await page.locator('[data-post-body]').getByLabel('更多讨论操作').click();
    await page
      .locator('[data-post-body]')
      .getByRole('button', { name: '编辑', exact: true })
      .click();
    await live(page.getByLabel('帖子标题', { exact: true })).toHaveValue(
      '一段阅读的回声 ' + testInfo.project.name,
    );
    await page
      .getByLabel('帖子标题', { exact: true })
      .fill('编辑后的阅读回声 ' + testInfo.project.name);
    await page.locator('[data-post-submit]').click();
    await live(page.locator('[data-post-title]')).toHaveText(
      '编辑后的阅读回声 ' + testInfo.project.name,
    );
    await live(page.locator('[data-post-body] .level-badge')).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath('post-detail.png'),
      fullPage: true,
      animations: 'disabled',
    });
    await page.goto('/community/?tab=latest');
    await live(page.locator('[data-feed]')).toContainText('编辑后的阅读回声');
    await expect(page.locator('[data-feed] #comment-' + c.id)).toHaveCount(0);
    await page.goto('/community/comments/?tab=latest');
    await live(page.locator('[data-feed] #comment-' + c.id)).toBeVisible();
    await expect(page.locator('[data-feed] #comment-' + p.id)).toHaveCount(0);
    await expect(page.locator('[data-feed] #comment-' + c.id + ' .level-badge')).toBeVisible();

    await page.goto(
      '/search/?source=community&q=' +
        encodeURIComponent('编辑后的阅读回声 ' + testInfo.project.name),
    );
    await live(
      page.locator('#search-results a[href="/community/posts/' + p.id + '/"]'),
    ).toBeVisible();
    await page.goto('/search/?source=people&q=reader_' + v!.id.replaceAll('-', ''));
    await live(
      page.locator('#search-results a[href="/u/reader_' + v!.id.replaceAll('-', '') + '/"]'),
    ).toBeVisible();
    const response = await b!.rpc('save_discussion', {
      p_kind: 'article',
      p_target: 'a03',
      p_parent: c.id,
      p_content: '我也读到了同样的感受，来回复这条真实讨论。',
      p_key: randomUUID(),
    });
    expect(response.error).toBeNull();
    expect(
      (await b!.rpc('set_discussion_like', { p_kind: 'article', p_id: c.id, p_active: true }))
        .error,
    ).toBeNull();
    expect(
      (
        await b!.rpc('save_discussion', {
          p_kind: 'post_comment',
          p_target: p.id,
          p_content: '来新动态下面继续聊，核验动态评论的真实链路。',
          p_key: randomUUID(),
        })
      ).error,
    ).toBeNull();
    await page.goto('/notifications/');
    await live(page.locator('#notification-list')).toContainText('在讨论中回复了你');
    const replyLink = page.locator(`#notification-list a[href*="${response.data}"]`);
    await replyLink.click();
    await live(page).toHaveURL(new RegExp(`#comment-${response.data}$`));
    await live(page.locator(`#comment-${response.data}`)).toContainText('同样的感受');
    await page.goto(`/community/posts/${p.id}/`);
    await live(page.locator('[data-comments-list]')).toContainText('动态评论的真实链路');
    const commentCard = page.locator('.discussion-card').filter({ hasText: '动态评论的真实链路' });
    await commentCard.getByLabel('更多讨论操作').click();
    await commentCard.getByRole('button', { name: '举报', exact: true }).click();
    await page.getByLabel('举报原因').fill('测试举报流程，内容本身不构成违规。');
    await page.getByRole('button', { name: '提交举报' }).click();
    await live(page.locator('#report-dialog')).not.toBeVisible();
    await page.goto('/me/rewards/');
    await live(page.locator('#reward-summary')).toContainText('0 枚臭鸡蛋');
    await live(page.locator('#ledger-list')).toContainText('投掷臭鸡蛋');
    await live(page.locator('#achievement-wall')).toContainText('破壳一刻');
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath('community-rewards.png'),
      fullPage: true,
      animations: 'disabled',
    });
    expect(errors).toEqual([]);
  } finally {
    await page.goto('about:blank').catch(() => {});
    f.cleanup();
  }
});
