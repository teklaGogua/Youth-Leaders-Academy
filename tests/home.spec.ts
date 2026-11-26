import { expect, test } from '@playwright/test';

test('homepage loads with public navigation', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /შენი შესაძლებლობები/ })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'მთავარი ნავიგაცია' })).toBeVisible();
});

test('FAQ route renders expandable questions', async ({ page }) => {
  await page.goto('/faq');
  await expect(page.getByRole('heading', { name: 'ხშირად დასმული კითხვები' })).toBeVisible();
  const question = page.getByRole('button', { name: /რა არის ახალგაზრდა ლიდერთა აკადემია/ });
  await expect(question).toHaveAttribute('aria-expanded', 'true');
});

test('unknown route shows not found page', async ({ page }) => {
  await page.goto('/does-not-exist');
  await expect(page.getByRole('heading', { name: 'გვერდი ვერ მოიძებნა' })).toBeVisible();
});
