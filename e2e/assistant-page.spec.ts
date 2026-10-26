import { test, expect } from '@playwright/test';
import { registerThroughPad } from './login-pad';

// The app defaults to Marathi; these tests find controls by their English labels.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('my_farm_language', 'en'));
});

/**
 * The assistant has its own page (roadmap 4.4, #387): reachable from the
 * sidebar and from the overlay's expand control, with no floating button on it.
 * The sidebar only exists on wide screens; a phone goes through the overlay.
 */
test('the assistant page opens from the overlay and has no floating button', async ({
  page,
}, testInfo) => {
  const digit = testInfo.project.name.toLowerCase().includes('mobile') ? '6' : '5';
  const phone = `9${digit}${`${Date.now()}`.slice(-8)}`;
  const pin = '1234';

  await registerThroughPad(page, phone, pin, 'Assistant Page');
  await expect(page).toHaveURL(/\/map$/, { timeout: 15_000 });

  const fab = page.locator('.chat-fab');
  await expect(fab).toBeVisible();
  await fab.click();
  await expect(page.locator('.chat-bot-overlay')).toBeVisible();

  await page.locator('.chat-panel__expand').click();
  await expect(page).toHaveURL(/\/chat$/);
  await expect(page.locator('.chat-bot-overlay')).toHaveCount(0);
  await expect(fab).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'My farm assistant' })).toBeVisible();
  await expect(page.locator('#chatPanelInput')).toBeVisible();

  if (!testInfo.project.name.toLowerCase().includes('mobile')) {
    await page.goto('/crops');
    await page.getByRole('link', { name: 'Assistant' }).click();
    await expect(page).toHaveURL(/\/chat$/);
    await expect(page.getByRole('link', { name: 'Assistant' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  }
});
