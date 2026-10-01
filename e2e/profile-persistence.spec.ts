import { test, expect } from '@playwright/test';

/**
 * Profile settings survive a reload (#327): crops chosen in the profile dialog
 * are written to the backend and read back after the app restarts.
 * Needs the same backend + seeded reference data as the golden path.
 */
test('primary crops saved in the profile are still there after a reload', async ({
  page,
}, testInfo) => {
  const digit = testInfo.project.name.toLowerCase().includes('mobile') ? '4' : '3';
  const phone = `9${digit}${`${Date.now()}`.slice(-8)}`;
  const pin = '1234';

  await page.goto('/login');
  await page.locator('#phoneInput').fill(phone);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.locator('#pinInput').fill(pin);
  await page.getByRole('button', { name: 'Access Account' }).click();
  await page.locator('#nameInput').fill('Profile Persist');
  await page.locator('#registerPinInput').fill(pin);
  await page.locator('#confirmRegisterPinInput').fill(pin);
  await page.getByRole('button', { name: 'Create Profile & Enter' }).click();
  await expect(page).toHaveURL(/\/map$/);

  await page.goto('/profile');
  await page.locator('button:has(.bi-pencil-square)').nth(3).click();
  await page.getByRole('button', { name: 'Wheat' }).click();
  await page.getByRole('button', { name: 'Rice' }).click();
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(page.getByText('Profile updated.')).toBeVisible();

  await page.reload();
  await expect(page.getByText('Wheat')).toBeVisible();
  await expect(page.getByText('Rice')).toBeVisible();
});
