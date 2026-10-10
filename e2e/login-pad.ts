import { Page } from '@playwright/test';

/** Tap digits on the sign-in number pad, then press Next. */
export async function padEnter(page: Page, digits: string): Promise<void> {
  for (const digit of digits) {
    await page.getByTestId(`key-${digit}`).click();
  }
  await page.getByTestId('key-ok').click();
}

/** Register a brand-new farmer through every sign-in step and wait for the map. */
export async function registerThroughPad(
  page: Page,
  phone: string,
  pin: string,
  fullName: string,
): Promise<void> {
  await page.goto('/login');
  await padEnter(page, phone);
  // The server only says the number is new once a PIN is submitted.
  await padEnter(page, pin);
  await page.locator('#nameField').fill(fullName);
  await page.getByRole('button', { name: 'Next' }).click();
  await padEnter(page, pin);
  await padEnter(page, pin);
}

/** Sign an existing farmer in through the number and PIN steps. */
export async function signInThroughPad(page: Page, phone: string, pin: string): Promise<void> {
  await page.goto('/login');
  await padEnter(page, phone);
  await padEnter(page, pin);
}
