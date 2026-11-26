import { expect, test } from '@playwright/test';

test('participant onboarding and dashboard routes are protected for signed-out visitors', async ({
  page,
}) => {
  for (const route of [
    '/onboarding',
    '/profile/edit',
    '/dashboard',
    '/registration/confirmation',
  ]) {
    await page.goto(route);
    await expect.poll(() => new URL(page.url()).pathname).toBe('/login');
    await expect(page.getByRole('heading', { name: 'შესვლა' })).toBeVisible();
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('პირადი ინფორმაცია ჯერ არ გაქვთ შევსებული');
    expect(bodyText).not.toContain('ნინო ტესტი');
  }
});
