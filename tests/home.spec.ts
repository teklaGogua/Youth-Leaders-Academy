import { test, expect } from '@playwright/test';
test('foundation home page loads', async ({ page }) => { await page.goto('/'); await expect(page.getByRole('heading', { name: 'ახალგაზრდა ლიდერთა აკადემია' })).toBeVisible(); });
