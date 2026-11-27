import { expect, test } from '@playwright/test';

test('registration steps fail closed until Supabase is configured', async ({ page }) => {
  await page.goto('/registration');

  await expect(
    page.getByText('სისტემა ჯერ არ არის დაკავშირებული Supabase პროექტთან.'),
  ).toBeVisible();
});

test('unified registration keeps every stage on one URL', async ({ page }) => {
  await page.goto('/registration');
  await expect(page).toHaveURL(/\/registration$/);
  await expect(page.locator('a[href^="/registration/"]')).toHaveCount(0);
});

test('guardian consent links do not show success without a configured verifier', async ({
  page,
}) => {
  await page.goto('/guardian-verification#token=' + 'x'.repeat(40));

  await expect(
    page.getByRole('heading', { name: 'მშობლის / მეურვის დადასტურება და თანხმობა' }),
  ).toBeVisible();
  await expect(page.getByRole('alert')).toContainText(
    'ბმული არასწორია ან ვადაგასულია.',
  );
  await expect(page.getByText(/დადასტურებულია/)).toHaveCount(0);
});

test('guardian verification screen fits narrow mobile viewports', async ({ page }) => {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/guardian-verification#token=' + 'x'.repeat(40));

    const documentWidth = await page.locator('body').evaluate((body) => body.scrollWidth);
    expect(documentWidth, 'guardian page overflows at ' + width + 'px').toBeLessThanOrEqual(width);
  }
});
