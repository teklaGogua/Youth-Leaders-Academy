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
  const academyEmblems = page.getByRole('img', {
    name: 'ახალგაზრდა ლიდერთა აკადემიის ემბლემა',
  });

  await expect(academyEmblems).toHaveCount(2);

  const loadedImages = await academyEmblems.evaluateAll((images) =>
    images.every(
      (image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0,
    ),
  );

  expect(loadedImages).toBe(true);
  const registrationLink = page
    .getByRole('navigation', { name: 'მთავარი ნავიგაცია' })
    .getByRole('link', { name: 'რეგისტრაცია', exact: true });
  await expect(registrationLink).toBeVisible();
  await expect(registrationLink).toHaveAttribute('href', '/registration');
  await expect(
    page.getByRole('navigation', { name: 'მთავარი ნავიგაცია' }).getByRole('link', {
      name: 'შესვლა',
      exact: true,
    }),
  ).toHaveAttribute('href', '/login');
});

test('Noto Sans Georgian is loaded for the application', async ({ page }) => {
  await page.goto('/');

  const body = page.locator('body');

  await expect
    .poll(() => body.evaluate((element) => getComputedStyle(element).fontFamily))
    .toContain('Noto Sans Georgian Variable');

  const fontState = await body.evaluate(async () => {
    await document.fonts.load('400 16px "Noto Sans Georgian Variable"', 'ქართული ტექსტი');
    await document.fonts.ready;

    return {
      loadedFaces: Array.from(document.fonts).filter(
        (face) => face.family.includes('Noto Sans Georgian Variable') && face.status === 'loaded',
      ).length,
      weights: [400, 500, 600, 700].map((weight) =>
        document.fonts.check(`${weight} 16px "Noto Sans Georgian Variable"`),
      ),
    };
  });

  expect(fontState.loadedFaces).toBeGreaterThan(0);
  expect(fontState.weights).toEqual([true, true, true, true]);
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

test('homepage has no horizontal overflow at the approved viewport widths', async ({
  page,
}, testInfo) => {
  for (const width of viewportWidths) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');

    const layout = await page.locator('body').evaluate((body) => {
      const overflowingElements = Array.from(body.querySelectorAll('*'))
        .map((element) => {
          const bounds = element.getBoundingClientRect();

          return {
            tag: element.tagName,
            className: element.getAttribute('class'),
            right: Math.round(bounds.right),
            width: Math.round(bounds.width),
          };
        })
        .filter((element) => element.right > window.innerWidth + 1)
        .slice(0, 8);

      return {
        documentWidth: body.scrollWidth,
        overflowingElements,
      };
    });

    expect(
      layout.documentWidth,
      `horizontal overflow at ${width}px: ${JSON.stringify(layout.overflowingElements)}`,
    ).toBeLessThanOrEqual(width);

    if ([320, 390, 1440].includes(width)) {
      const screenshotPath = testInfo.outputPath(`homepage-${width}.png`);
      await mkdir(dirname(screenshotPath), { recursive: true });
      await page.screenshot({ path: screenshotPath, fullPage: true });
    }

    if (width <= 1100) {
      const menuButton = page.getByRole('button', { name: 'ნავიგაციის მენიუს გახსნა' });
      await expect(menuButton).toBeVisible();
      await menuButton.click();
      await expect(
        page.getByRole('navigation', { name: 'მთავარი ნავიგაცია' }).getByRole('link', {
          name: 'კონკურსი',
        }),
      ).toBeVisible();
    } else {
      await expect(
        page.getByRole('navigation', { name: 'მთავარი ნავიგაცია' }).getByRole('link', {
          name: 'კონკურსი',
        }),
      ).toBeVisible();
    }
  }
});

test('competition page renders a desktop reference screenshot', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/competition');

  const screenshotPath = testInfo.outputPath('competition-1440.png');
  await mkdir(dirname(screenshotPath), { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: true });
});

test('unknown route shows not found page', async ({ page }) => {
  await page.goto('/does-not-exist');

  await expect(page.getByRole('heading', { name: 'გვერდი ვერ მოიძებნა' })).toBeVisible();
});
