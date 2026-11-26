import { expect, test } from '@playwright/test';

test('participant onboarding and dashboard routes do not expose data to signed-out visitors', async ({ page }) => {
  for (const route of ['/onboarding', '/profile/edit', '/dashboard', '/registration/confirmation']) {
    await page.goto(route);
    const pathname = new URL(page.url()).pathname;
    const bodyText = await page.locator('body').innerText();

    expect(bodyText).not.toContain('ნინო ტესტი');
    expect(bodyText).not.toContain('სატესტო სკოლა');

    if (pathname === '/login') {
      await expect(page.getByRole('heading', { name: 'შესვლა' })).toBeVisible();
    } else {
      await expect(page.getByText('სისტემა ჯერ არ არის დაკავშირებული Supabase პროექტთან.')).toBeVisible();
    }
  }
});
