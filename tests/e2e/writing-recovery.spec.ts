import { test, expect } from '@playwright/test';
import { fixtures } from '../integration/fixtures.mjs';
import { randomUUID } from 'node:crypto';
test.use({ actionTimeout: 15000, reducedMotion: 'reduce' });
test('guest writing survives login, offline saving and a conflicting cloud revision', async ({
  page,
  context,
}) => {
  test.setTimeout(180000);
  const f = await fixtures(1);
  const [u] = f.users;
  const [api] = f.clients;
  const live = expect.configure({ timeout: 30000 });
  try {
    await page.goto('/write/');
    await live(page.locator('#writing-title')).toBeEnabled();
    await page.locator('#writing-title').fill('未寄出的信');
    await page.locator('#writing-body').fill('登录之前写下的第一段，不应该丢失。');
    const id = new URL(page.url()).searchParams.get('draft')!;
    await page.locator('[data-writing-publish]').click();
    await live(page).toHaveURL(/\/auth\//);
    await page.getByLabel('邮箱', { exact: true }).fill(u!.email);
    await page.getByLabel('密码', { exact: true }).fill(u!.password);
    await page.getByRole('button', { name: '继续', exact: true }).click();
    await live(page.locator('#writing-body')).toHaveValue('登录之前写下的第一段，不应该丢失。');
    await live(page.locator('[data-writing-state]')).toContainText('已保存到云端');
    await context.setOffline(true);
    await page.locator('#writing-body').fill('断网以后，还可以接着写。');
    await page.locator('[data-writing-save]').click();
    await live(page.locator('[data-writing-state]')).toContainText('已保存到本机');
    await context.setOffline(false);
    await page.locator('[data-writing-save]').click();
    await live(page.locator('[data-writing-state]')).toContainText('已保存到云端');
    await page.reload();
    await live(page.locator('#writing-body')).toHaveValue('断网以后，还可以接着写。');
    const remote = (await api!.from('submission_drafts').select('*').eq('id', id).single()).data;
    expect(
      (
        await api!.rpc('save_submission_draft', {
          p_id: id,
          p_revision: remote.revision,
          p_key: randomUUID(),
          p_title: remote.title,
          p_body: '另一台设备上的文字。',
          p_genre: remote.genre,
          p_tags: remote.tags,
          p_summary: remote.summary,
          p_indent: remote.indent,
        })
      ).error,
    ).toBeNull();
    await page.locator('#writing-body').fill('这台设备上的文字，也要保留下来。');
    await page.locator('[data-writing-save]').click();
    await live(page.locator('[data-writing-conflict]')).toBeVisible();
    await expect(page.locator('#writing-body')).toHaveValue('这台设备上的文字，也要保留下来。');
    await page.locator('[data-writing-copy]').click();
    await live(page.locator('[data-writing-state]')).toContainText('已保存到云端');
    const copyId = new URL(page.url()).searchParams.get('draft')!;
    expect(copyId).not.toBe(id);
    expect(
      (await api!.from('submission_drafts').select('body').eq('id', id).single()).data?.body,
    ).toBe('另一台设备上的文字。');
    expect(
      (await api!.from('submission_drafts').select('body').eq('id', copyId).single()).data?.body,
    ).toBe('这台设备上的文字，也要保留下来。');
  } finally {
    await context.setOffline(false);
    f.cleanup();
  }
});
