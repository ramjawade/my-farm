import { test, expect } from '@playwright/test';
import { registerThroughPad } from './login-pad';

// The app defaults to Marathi; these tests find controls by their English labels.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('my_farm_language', 'en'));
});

/**
 * Profile settings survive a reload (#327): a village and pincode saved from
 * the profile rows are written to the backend and read back after the app
 * restarts. Needs the same backend as the golden path.
 */
test('village and pincode saved in the profile are still there after a reload', async ({
  page,
}, testInfo) => {
  const digit = testInfo.project.name.toLowerCase().includes('mobile') ? '4' : '3';
  const phone = `9${digit}${`${Date.now()}`.slice(-8)}`;
  const pin = '1234';

  await registerThroughPad(page, phone, pin, 'Profile Persist');
  await expect(page).toHaveURL(/\/map$/, { timeout: 15_000 });

  await page.goto('/profile');

  await page.getByRole('button', { name: /Village/ }).click();
  await page.locator('#pf-village').fill('Sinnar');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Village saved.')).toBeVisible();

  await page.getByRole('button', { name: /Pincode/ }).click();
  await page.locator('#pf-pincode').fill('422103');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Pincode saved.')).toBeVisible();

  await page.reload();
  await expect(page.getByText('Sinnar')).toBeVisible();
  await expect(page.getByText('422103')).toBeVisible();
});
