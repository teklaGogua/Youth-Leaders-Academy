import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const viewportWidths = [320, 390, 768, 1024, 1440];

test('homepage loads with the approved public navigation and branding', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: 'ახალგაზრდა ლიდერთა აკადემიის კონკურსი' }),
  ).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'მთავარი ნავიგაცია' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'ახალგაზრდა ლიდერთა აკადემიის ემბლემა' })).toHaveCount(2);
  await expect(page.getByRole('link', { name: 'კონკურსზე რეგისტრაცია' })).toBeVisible();
});

test('FAQ route renders expandable questions', async ({ page }) => {
  await page.goto('/faq');

  await expect(page.getByRole('heading', { name: 'ხშირად დასმული კითხვები' })).toBeVisible();

  const question = page.getByText('რა არის ახალგაზრდა ლიდერთა აკადემია?');
  await expect(question).toBeVisible();
});

test('competition details contain the designed information sections', async ({ page }) => {
  await page.goto('/competition');

  await expect(page.getByRole('heading', { name: 'ახალგაზრდა ლიდერთა კონკურსი' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'კონკურსის ეტაპები' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'რა ინფორმაცია დაგჭირდებათ' })).toBeVisible();
  await expect(page.getByText('დასაზუსტებელია').first()).toBeVisible();
});

test('homepage has no horizontal overflow at the approved viewport widths', async ({ page }, testInfo) => {
  for (const width of viewportWidths) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');

    const documentWidth = await page.locator('body').evaluate((body) => body.scrollWidth);
    expect(documentWidth, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(width);

    if (width <= 820) {
      const menuButton = page.getByRole('button', { name: 'ნავიგაციის მენიუს გახსნა' });
      await expect(menuButton).toBeVisible();
      await menuButton.click();
      await expect(page.getByRole('link', { name: 'კონკურსი' })).toBeVisible();
    } else {
      await expect(page.getByRole('link', { name: 'კონკურსი' })).toBeVisible();
    }

    if ([320, 390, 1440].includes(width)) {
      const screenshotPath = testInfo.outputPath(`homepage-${width}.png`);
      await mkdir(dirname(screenshotPath), { recursive: true });
      await page.screenshot({ path: screenshotPath, fullPage: true });
    }
  }
});

test('unknown route shows not found page', async ({ page }) => {
  await page.goto('/does-not-exist');

  await expect(page.getByRole('heading', { name: 'გვერდი ვერ მოიძებნა' })).toBeVisible();
});
