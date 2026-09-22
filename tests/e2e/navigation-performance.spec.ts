import { test, expect } from '@playwright/test';
import { fixtures } from '../integration/fixtures.mjs';

test('signed-in navigation never paints guest prompts and only loads hidden account panels on demand', async ({
  page,
  context,
}) => {
  test.setTimeout(120000);
  const f = await fixtures(1);
  try {
    const {
      data: { session },
    } = await f.clients[0]!.auth.getSession();
    const issuer = JSON.parse(
      Buffer.from(session!.access_token.split('.')[1]!, 'base64url').toString(),
    ).iss;
    const key = `sb-${new URL(issuer).hostname.split('.')[0]}-auth-token`;
    await context.addInitScript(
      ({ key, session }) => {
        if (!sessionStorage.getItem('test-session-seeded')) {
          localStorage.setItem(key, JSON.stringify(session));
          sessionStorage.setItem(
            'yb_header_identity_v1',
            JSON.stringify({
              id: '00000000-0000-4000-8000-000000000000',
              username: 'another_account',
              display_name: '另一个账号',
              level: 6,
              at: Date.now(),
            }),
          );
          sessionStorage.setItem('test-session-seeded', '1');
        }
        const state = window as Window & { guestFrames?: number };
        state.guestFrames = 0;
        const sample = () => {
          if (
            Array.from(document.querySelectorAll('main [data-guest-only]')).some(
              (el) => el.getBoundingClientRect().height > 0,
            )
          )
            state.guestFrames!++;
          if (performance.now() < 6000) requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      },
      { key, session },
    );
    // A cold/slow JS download must not paint the anonymous state in the meantime.
    await page.route('**/_astro/*.js', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 350));
      await route.continue();
    });
    const calls: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/rest/v1/')) calls.push(new URL(request.url()).pathname);
    });
    await page.goto('/community/');
    await expect(page.locator('html')).toHaveAttribute('data-auth-state', 'authenticated');
    await expect(page.locator('.compose-entry')).toBeVisible();
    await expect(page.locator('.menu-caption .level-badge')).toBeAttached({ timeout: 30000 });
    await expect(page.locator('[data-my-profile]')).toHaveAttribute(
      'href',
      '/u/reader_' + f.users[0]!.id.replaceAll('-', '') + '/',
    );
    expect(
      await page.evaluate(() => (window as Window & { guestFrames?: number }).guestFrames),
    ).toBe(0);
    expect(calls.some((url) => /growth_summary|account_capabilities/.test(url))).toBe(false);

    calls.length = 0;
    await page.goto('/me/rewards/');
    await expect(page.locator('#reward-summary')).toContainText('墨迹', { timeout: 30000 });
    expect(
      await page.evaluate(() => (window as Window & { guestFrames?: number }).guestFrames),
    ).toBe(0);
    expect(calls.filter((url) => url.endsWith('/growth_summary'))).toHaveLength(1);
    expect(calls.filter((url) => url.endsWith('/user_progress'))).toHaveLength(0);
    expect(calls.filter((url) => url.endsWith('/account_capabilities'))).toHaveLength(0);

    await page.locator('.user-menu summary').click();
    await expect
      .poll(() => calls.filter((url) => url.endsWith('/account_capabilities')).length)
      .toBe(1);
    await page.locator('[data-signout]').click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('html')).toHaveAttribute('data-auth-state', 'guest');
    expect(await page.evaluate(() => sessionStorage.getItem('yb_header_identity_v1'))).toBeNull();
    await page.goBack();
    await expect(page).toHaveURL(/\/me\/rewards\//);
    await expect(page.locator('html')).toHaveAttribute('data-auth-state', 'guest');
    await expect(page.locator('#reward-center')).toBeHidden();
    await page.goto('/community/');
    await expect(page.locator('.guest-compose')).toBeVisible();
    await expect(page.locator('.compose-entry')).toBeHidden();
  } finally {
    f.cleanup();
  }
});

test('a guest remains pending until scripts resolve identity and prefetch skips dynamic/private URLs', async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route('**/_astro/*.js', async (route) => {
    await gate;
    await route.continue();
  });
  try {
    await page.goto('/community/', { waitUntil: 'commit' });
    await expect(page.locator('.guest-compose')).toBeAttached();
    await expect(page.locator('html')).toHaveAttribute('data-auth-state', 'pending');
    await expect(page.locator('.guest-compose')).toBeHidden();
  } finally {
    release();
  }
  await expect(page.locator('.guest-compose')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-auth-state', 'guest');
  const warmed: string[] = [];
  page.on('request', (request) => {
    if (!request.isNavigationRequest()) warmed.push(new URL(request.url()).pathname);
  });
  await page.locator('.site-header a[href="/submissions/"]').focus();
  await expect.poll(() => warmed.includes('/submissions/')).toBe(true);
  for (const href of [
    '/u/wjx_xix/',
    '/submissions/00000000-0000-4000-8000-000000000000/',
    '/write/?draft=private',
  ]) {
    await page.evaluate((href) => {
      const a = document.createElement('a');
      a.href = href;
      a.textContent = '预加载边界检查';
      document.body.append(a);
      a.focus();
      a.remove();
    }, href);
  }
  expect(warmed.includes('/write/')).toBe(false);
  expect(warmed.some((path) => path.startsWith('/u/') || /^\/submissions\/.+/.test(path))).toBe(
    false,
  );
});
