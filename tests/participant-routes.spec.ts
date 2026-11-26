import { expect, test } from '@playwright/test';

test('application and dashboard routes do not expose participant data to signed-out visitors', async ({
  page,
}) => {
  for (const route of ['/apply', '/dashboard', '/application/confirmation']) {
    await page.goto(route);

    await expect
      .poll(() => new URL(page.url()).pathname)
      .toMatch(/^\/(apply|dashboard|application\/confirmation|login)$/);

    const pathname = new URL(page.url()).pathname;
    const bodyText = await page.locator('body').innerText();

    expect(bodyText).not.toContain('განაცხადის ნომერი:');
    expect(bodyText).not.toContain('ჩემი განაცხადები');

    if (pathname === '/login') {
      await expect(page.getByRole('heading', { name: 'შესვლა' })).toBeVisible();
    } else {
      await expect(
        page.getByText('სისტემა ჯერ არ არის დაკავშირებული Supabase პროექტთან.'),
      ).toBeVisible();
    }
  }
});
