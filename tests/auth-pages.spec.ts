import { expect, test } from '@playwright/test';

const widths = [320, 390, 768, 1024, 1440];

test('login page renders the Georgian split-panel design', async ({ page }) => {
  await page.goto('/login');

  await expect(page.getByRole('heading', { name: 'შესვლა' })).toBeVisible();
  await expect(page.getByText('გახდი ახალგაზრდა ლიდერი')).toBeVisible();
  await expect(page.getByLabel('ელფოსტა')).toBeVisible();
  await expect(page.getByLabel('პაროლი')).toBeVisible();
  await expect(page.getByRole('link', { name: 'დაგავიწყდათ პაროლი?' })).toBeVisible();
});

test('registration page collects participant name and account details', async ({ page }) => {
  await page.goto('/register');

  await expect(page.getByRole('heading', { name: 'ანგარიშის შექმნა' })).toBeVisible();
  await expect(page.getByLabel('სახელი')).toBeVisible();
  await expect(page.getByLabel('გვარი')).toBeVisible();
  await expect(page.getByLabel('ელფოსტა')).toBeVisible();
  await expect(page.getByLabel('პაროლი', { exact: true })).toBeVisible();
  await expect(page.getByLabel('გაიმეორეთ პაროლი', { exact: true })).toBeVisible();
});

test('authentication pages do not overflow supported viewport widths', async ({ page }) => {
  for (const route of ['/login', '/register']) {
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(route);

      const documentWidth = await page.locator('body').evaluate((body) => body.scrollWidth);
      expect(documentWidth, route + ' overflows at ' + width + 'px').toBeLessThanOrEqual(width);
    }
  }
});

test('protected pages stay unavailable until Supabase is configured', async ({ page }) => {
  await page.goto('/dashboard');

  await expect(
    page.getByText('სისტემა ჯერ არ არის დაკავშირებული Supabase პროექტთან.'),
  ).toBeVisible();
});
