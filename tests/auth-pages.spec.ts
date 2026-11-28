import { expect, test } from '@playwright/test';

const widths = [320, 390, 768, 1024, 1440];

test('login page renders the Georgian split-panel design', async ({ page }) => {
  await page.goto('/login');

  await expect(page.getByRole('heading', { name: 'შესვლა' })).toBeVisible();
  await expect(page.getByText('გახდი ახალგაზრდა ლიდერი')).toBeVisible();
  await expect(page.getByLabel('ელფოსტა')).toBeVisible();
  await expect(page.getByLabel('პაროლი', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'დაგავიწყდათ პაროლი?' })).toBeVisible();
  await expect(
    page.getByText(/სესიის ან მომხმარებლის პროფილის შემოწმება ვერ მოხერხდა/),
  ).toHaveCount(0);
});

test('registration page collects participant name and account details', async ({ page }) => {
  await page.goto('/registration');

  await expect(page.getByRole('heading', { name: 'ანგარიშის შექმნა' })).toBeVisible();
  await expect(page.getByLabel('სახელი')).toBeVisible();
  await expect(page.getByLabel('გვარი')).toBeVisible();
  await expect(page.getByLabel('ელფოსტა')).toBeVisible();
  await expect(page.getByLabel('პაროლი', { exact: true })).toBeVisible();
  await expect(page.getByLabel('გაიმეორეთ პაროლი', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'პროფილის აღდგენა საჭიროა' })).toHaveCount(0);
});

test('public navigation offers separate login and registration destinations', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'შესვლა', exact: true })).toHaveAttribute(
    'href',
    '/login',
  );
  await expect(page.getByRole('link', { name: 'რეგისტრაცია', exact: true })).toHaveAttribute(
    'href',
    '/registration',
  );
});

test('legacy register entry redirects to the unified registration page', async ({ page }) => {
  await page.goto('/register');
  await expect(page).toHaveURL(/\/registration$/);
  await expect(page.getByRole('heading', { name: 'ანგარიშის შექმნა' })).toBeVisible();
});

test('authentication pages do not overflow supported viewport widths', async ({ page }) => {
  for (const route of ['/login', '/registration']) {
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

test('signed-out navigation remains available from the mobile menu', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const menuButton = page.getByRole('button', { name: 'ნავიგაციის მენიუს გახსნა' });
  await menuButton.click();
  const navigation = page.getByRole('navigation', { name: 'მთავარი ნავიგაცია' });

  await expect(navigation.getByRole('link', { name: 'შესვლა', exact: true })).toHaveAttribute(
    'href',
    '/login',
  );
  await expect(
    navigation.getByRole('link', { name: 'რეგისტრაცია', exact: true }),
  ).toHaveAttribute('href', '/registration');
});
