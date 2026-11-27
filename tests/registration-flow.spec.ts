import { expect, test } from '@playwright/test';

test('registration steps fail closed until Supabase is configured', async ({ page }) => {
  await page.goto('/registration/1');

  await expect(
    page.getByText('სისტემა ჯერ არ არის დაკავშირებული Supabase პროექტთან.'),
  ).toBeVisible();
});

test('guardian consent links do not show success without a configured verifier', async ({
  page,
}) => {
  await page.goto('/guardian-verification?token=not-a-real-token&purpose=consent');

  await expect(
    page.getByRole('heading', { name: 'მშობლის / მეურვის ელფოსტის დადასტურება' }),
  ).toBeVisible();
  await expect(page.getByRole('alert')).toContainText(
    'დადასტურების ბმული არასწორია ან ვადაგასულია.',
  );
  await expect(page.getByText(/დადასტურებულია/)).toHaveCount(0);
});

test('guardian verification screen fits narrow mobile viewports', async ({ page }) => {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/guardian-verification?token=not-a-real-token&purpose=consent');

    const documentWidth = await page.locator('body').evaluate((body) => body.scrollWidth);
    expect(documentWidth, 'guardian page overflows at ' + width + 'px').toBeLessThanOrEqual(width);
  }
});
