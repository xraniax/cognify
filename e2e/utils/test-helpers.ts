/**
 * test-helpers.ts
 *
 * Miscellaneous helper functions shared across test files.
 */
import { Page } from '@playwright/test';

/**
 * Inject a JWT token into localStorage and reload the page.
 * Useful when you have a token from the API but need the app to pick it up.
 */
export async function injectAuthToken(page: Page, token: string): Promise<void> {
  await page.evaluate((t) => localStorage.setItem('token', t), token);
  await page.reload();
}

/**
 * Clear auth state from localStorage — simulates a manual logout
 * without clicking the UI button.
 */
export async function clearAuthToken(page: Page): Promise<void> {
  await page.evaluate(() => localStorage.removeItem('token'));
}

/**
 * Wait for the network to be idle (no pending requests for 500 ms).
 * Useful after form submissions that trigger API calls.
 */
export async function waitForNetworkIdle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
}

/**
 * Generate a unique display name for test data.
 */
export function uniqueName(prefix = 'Test User'): string {
  return `${prefix} ${Date.now()}`;
}

/**
 * Scroll an element into view before interacting — avoids "element outside
 * viewport" failures on smaller viewports.
 */
export async function scrollIntoView(page: Page, selector: string): Promise<void> {
  await page.locator(selector).scrollIntoViewIfNeeded();
}
