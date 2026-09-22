import { test, expect } from '@playwright/test';
import { fixtures } from '../integration/fixtures.mjs';

test('real login, profile edit, public profile and logout', async ({ page }) => {
  test.setTimeout(120000);
  const expectLive = expect.configure({ timeout: 15000 });
  const fixture = await fixtures(1);
  const user = fixture.users[0]!;
  try {
    await page.goto('/auth/');
    await page.getByLabel('邮箱', { exact: true }).fill(user.email);
    await page.getByLabel('密码', { exact: true }).fill(user.password);
    await page.getByRole('button', { name: '继续', exact: true }).click();
    await expectLive(page).toHaveURL(/\/u\/reader_[a-f0-9]+\//, { timeout: 30000 });
    await page.locator('[data-profile-edit]').click();
    await expectLive(page.locator('#profile-form')).toBeVisible();
    await page.getByLabel('显示名称', { exact: true }).fill('真实联调书友');
    await page.getByLabel('个人简介', { exact: true }).fill('阅读，也交流。');
    await page.getByRole('button', { name: '保存个人资料' }).click();
    await expectLive(page.locator('#status')).toHaveText('个人资料已更新。');
    await page.locator('.user-menu summary').click();
    await page.locator('[data-open-checkin]').click();
    await expectLive(page.locator('#checkin-dialog')).toBeVisible();
    await page.locator('#checkin-submit').click();
    await expectLive(page.locator('#checkin-result')).toContainText('1 枚臭鸡蛋、5 墨迹');
    await expectLive(page.locator('#checkin-submit')).toBeDisabled();
    await page.getByRole('button', { name: '关闭签到面板' }).click();
    await page.goto('/me/rewards/');
    await expectLive(page.locator('#reward-summary')).toContainText('1 枚臭鸡蛋');
    await expectLive(page.locator('#ledger-list')).toContainText('每日签到');
    const badge = page
      .locator('.task-card')
      .filter({ has: page.getByRole('heading', { name: '初次赴约', exact: true }) });
    await badge.getByRole('button', { name: '展示这枚勋章' }).click();
    await expectLive(badge.getByRole('button', { name: '正在展示 · 取消' })).toBeVisible();
    await page.goto('/notifications/');
    await expectLive(page.locator('#notification-list')).toContainText('初次赴约');
    await page.getByRole('button', { name: '全部标为已读' }).click();
    await expectLive(page.locator('.notification-card[data-unread="true"]')).toHaveCount(0);
    await page.goto(`/u/reader_${user.id.replaceAll('-', '')}/`);
    await expectLive(
      page.getByRole('heading', { name: '真实联调书友', exact: true }),
    ).toBeVisible();
    await expectLive(page.locator('#main')).not.toContainText(user.email);
    await page.locator('.profile-growth-panel summary').click();
    await expectLive(page.locator('.badge-wall')).toContainText('★ 初次赴约');
    await page.locator('.user-menu summary').click();
    await page.getByRole('button', { name: '退出登录' }).click();
    await expectLive(page).toHaveURL(/\/$/);
  } finally {
    fixture.cleanup();
  }
});
