import {test,expect} from '@playwright/test';
import {fixtures} from '../integration/fixtures.mjs';

test('real login, profile edit, public profile and logout',async({page})=>{
  test.setTimeout(90000);
  const fixture=await fixtures(1); const user=fixture.users[0]!;
  try {
    await page.goto('/auth/');
    await page.getByLabel('邮箱',{exact:true}).fill(user.email);
    await page.getByLabel('密码',{exact:true}).fill(user.password);
    await page.getByRole('button',{name:'继续',exact:true}).click();
    await expect(page).toHaveURL(/\/me\/settings\//,{timeout:15000});
    await expect(page.locator('#profile-form')).toBeVisible();
    await page.getByLabel('显示名称',{exact:true}).fill('真实联调书友');
    await page.getByLabel('个人简介',{exact:true}).fill('阅读，也交流。');
    await page.getByRole('button',{name:'保存个人资料'}).click();
    await expect(page.getByRole('status')).toHaveText('个人资料已更新。');
    await page.goto(`/u/reader_${user.id.replaceAll('-','')}/`);
    await expect(page.getByRole('heading',{name:'真实联调书友',exact:true})).toBeVisible();
    await expect(page.locator('#main')).not.toContainText(user.email);
    await page.locator('.user-menu summary').click();
    await page.getByRole('button',{name:'退出登录'}).click();
    await expect(page).toHaveURL(/\/$/);
  } finally {fixture.cleanup();}
});
