import { test, expect, Locator } from '@playwright/test';

/**
 * Golden-path E2E smoke test (issue #44).
 *
 * Exercises: register/login (backend auth, PR #59 flow) -> draw & save a
 * land boundary -> create a crop -> log an activity -> add an expense ->
 * generate a season report -> export it as CSV.
 *
 * The backend persists lands/crops/activities/expenses (ApiStorageService is
 * "online-only", see app.config.ts), so this test needs a real backend +
 * database reachable at the frontend's `/api` proxy target. See
 * .github/workflows/ci.yml's `e2e` job for how CI provisions that; for local
 * runs, start the backend (with reference data seeded) before `npm run e2e`.
 */

function uniquePhone(projectName: string): string {
  // Must normalize to exactly 10 digits (myfarm_api normalize_phone).
  const suffix = `${Date.now()}`.slice(-8);
  const projectDigit = projectName.toLowerCase().includes('mobile') ? '2' : '1';
  return `9${projectDigit}${suffix}`;
}

/** Types into a `lib-combobox` and picks the first suggestion — whichever
 * fires: an existing seeded item, or the "+ Add" option that creates one. */
async function fillCombobox(scope: Locator, text: string): Promise<void> {
  const input = scope.locator('input[role="combobox"]');
  await input.click();
  await input.fill(text);
  await scope.locator('.combobox-dropdown .combobox-item').first().click();
}

test.describe('Golden path', () => {
  test('register, draw a land, plant a crop, log an activity, track an expense, export a report', async ({
    page,
  }, testInfo) => {
    const phone = uniquePhone(testInfo.project.name);
    const pin = '1234';
    const farmerName = `E2E Farmer ${testInfo.project.name}`;
    const farmName = `E2E Field ${Date.now()}`;
    const today = new Date().toISOString().slice(0, 10);

    await test.step('register a new farmer (phone not on file -> create profile)', async () => {
      // The phone step never calls the backend — it just moves to the PIN
      // step. The 404-vs-login check happens on PIN submit
      // (session-auth.service.ts's createSession), which is what flips this
      // to the 'register' step for an unrecognized phone.
      await page.goto('/login');
      await page.locator('#phoneInput').fill(phone);
      await page.getByRole('button', { name: 'Continue' }).click();

      await expect(page.locator('#pinInput')).toBeVisible();
      await page.locator('#pinInput').fill(pin);
      await page.getByRole('button', { name: 'Access Account' }).click();

      await expect(page.locator('#nameInput')).toBeVisible();
      await page.locator('#nameInput').fill(farmerName);
      await page.locator('#registerPinInput').fill(pin);
      await page.locator('#confirmRegisterPinInput').fill(pin);
      await page.getByRole('button', { name: 'Create Profile & Enter' }).click();

      await expect(page).toHaveURL(/\/map$/);
    });

    await test.step('log out and back in with the same PIN', async () => {
      // Prove the login leg of the golden path too, not just registration.
      await page.evaluate(() => localStorage.clear());
      await page.goto('/login');
      await page.locator('#phoneInput').fill(phone);
      await page.getByRole('button', { name: 'Continue' }).click();

      await expect(page.locator('#pinInput')).toBeVisible();
      await page.locator('#pinInput').fill(pin);
      await page.getByRole('button', { name: 'Access Account' }).click();

      await expect(page).toHaveURL(/\/map$/);
    });

    await test.step('draw and save a land boundary on the map', async () => {
      const mapContainer = page.locator('.leaflet-container');
      await expect(mapContainer).toBeVisible();

      // A brand-new farmer has no saved location, so the map opens fully
      // zoomed out (whole-India view, map.ts's zoom 5). A polygon drawn at
      // that zoom spans thousands of km² and overflows the backend's
      // NUMERIC(10,2) land-area column — zoom in first so the boundary comes
      // out farm-sized.
      const zoomInButton = page.locator('.leaflet-control-zoom-in');
      for (let i = 0; i < 16; i++) {
        await zoomInButton.click();
        await page.waitForTimeout(150);
      }

      const panel = page.locator('.map-my-farm');
      await panel.getByRole('button', { name: 'Map my farm', exact: true }).click();

      const box = await mapContainer.boundingBox();
      if (!box) throw new Error('Map container has no bounding box');

      // Two overlays float on top of the map itself and must be avoided: the
      // "Map my farm" panel (map.scss's .map-page__farm-draw) bottom-center,
      // wide enough to span the container's horizontal center once drawing
      // starts; and the "My Saved Farms" list (saved-farms.component.scss's
      // .map-page__saved-farms) top-left, ~14rem wide. The top-right corner
      // is clear of both on any viewport size.
      const vertices = [
        { x: box.width * 0.7, y: box.height * 0.12 },
        { x: box.width * 0.92, y: box.height * 0.12 },
        { x: box.width * 0.81, y: box.height * 0.28 },
      ];
      for (const vertex of vertices) {
        await mapContainer.click({ position: vertex });
        // Give Leaflet's redraw time to settle, and keep clicks far enough
        // apart that the browser doesn't coalesce a vertex pair into a
        // dblclick (which also triggers Leaflet's default zoom-on-dblclick).
        await page.waitForTimeout(300);
      }
      // Click back on the first vertex to close (and finish) the polygon.
      await mapContainer.click({ position: vertices[0] });

      await panel.getByPlaceholder('Enter farm name...').fill(farmName);
      // The "Land saved" toast fires optimistically the instant Save is
      // clicked (map-my-farm.component.ts's save()), before the backend
      // POST /api/v1/lands it triggers even goes out — asserting on it (or
      // on the farm name reappearing) doesn't prove persistence, and a next
      // step navigating away too soon can abort that request mid-flight.
      // Wait for the actual response so the land genuinely exists before we
      // move on to a page that depends on it.
      const [landResponse] = await Promise.all([
        page.waitForResponse(
          (res) => res.request().method() === 'POST' && res.url().includes('/api/v1/lands'),
        ),
        panel.getByRole('button', { name: 'Save', exact: true }).click(),
      ]);
      expect(landResponse.ok()).toBeTruthy();
    });

    await test.step('plant a crop on the saved land', async () => {
      await page.goto('/crops/add');

      await fillCombobox(page.locator('#name'), 'Vegetables');
      // Only one saved land exists, so the field auto-selects; wait for it.
      await expect(page.locator('#fieldId')).not.toHaveValue('');
      await page.locator('#sowingDate').fill(today);

      await page.getByRole('button', { name: 'Create Profile' }).click();
      await expect(page).toHaveURL(/\/crops$/);
    });

    await test.step('log a farm activity for the crop', async () => {
      await page.goto('/activities/create');

      await fillCombobox(page.locator('#type'), 'Sowing');
      // Only one crop and one land exist, so both auto-select via the form's
      // reactive effect (create-activity.component.ts) — nothing to pick.

      await page.getByRole('button', { name: 'Record Activity' }).click();
      await expect(page).toHaveURL(/\/activities\/\d+$/);
    });

    await test.step('track an expense against the activity', async () => {
      // Desktop and mobile each render their own "Add Expense" trigger, only
      // one visible at a time via Bootstrap's d-none/d-md-* utilities
      // (activity-detail.component.html) — the mobile one is an icon-only
      // FAB, so target both structurally rather than by accessible name.
      await page.locator('button.fab:visible, button:visible:has-text("Add Expense")').click();

      const categorySelect = page.locator('select[formcontrolname="category"]');
      await expect(categorySelect).not.toHaveValue('');
      await page.locator('input[formcontrolname="amount"]').fill('500');

      await page.getByRole('button', { name: 'Add Expense Item' }).click();
      await expect(page.getByText('₹500').first()).toBeVisible();
    });

    await test.step('generate the season report and export it as CSV', async () => {
      await page.goto('/reports');

      await page.getByRole('button', { name: 'Generate Report' }).click();
      await expect(page.getByText('Total Season Expenses')).toBeVisible();

      const exportButton = page.getByRole('button', { name: 'Export CSV' });
      await expect(exportButton).toBeVisible();

      const [download] = await Promise.all([page.waitForEvent('download'), exportButton.click()]);
      expect(download.suggestedFilename()).toMatch(/^Kharif-\d{4}-report\.csv$/);
    });
  });
});
