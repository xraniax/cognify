/**
 * base.page.ts
 *
 * All Page Objects inherit from this class.
 * It centralises navigation, generic wait helpers, and the toast assertion
 * so subclasses stay focused on their own page's elements.
 */
import { Page, Locator, expect } from '@playwright/test';

export abstract class BasePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // ── Navigation ──────────────────────────────────────────────────────────

  async goto(path = '/'): Promise<void> {
    await this.page.goto(path);
    await this.waitForPageReady();
  }

  async waitForPageReady(): Promise<void> {
    // Wait for the DOM to settle — avoids races on animated route transitions
    await this.page.waitForLoadState('domcontentloaded');
  }

  // ── URL helpers ─────────────────────────────────────────────────────────

  currentPath(): string {
    return new URL(this.page.url()).pathname;
  }

  async waitForPath(path: string, timeout = 15_000): Promise<void> {
    await this.page.waitForURL((url) => url.pathname === path || url.pathname.startsWith(path), {
      timeout,
    });
  }

  // ── Toast / notification helpers ────────────────────────────────────────

  // react-hot-toast renders outside the React tree; use a broad selector
  toast(): Locator {
    return this.page.locator('[data-radix-toast-viewport], [data-hot-toast]').first();
  }

  async expectToast(text: string | RegExp): Promise<void> {
    await expect(this.page.locator('body')).toContainText(text, { timeout: 8_000 });
  }

  // ── Screenshot helper for report quality ────────────────────────────────

  async takeNamedScreenshot(name: string): Promise<void> {
    await this.page.screenshot({
      path: `test-results/screenshots/${name}.png`,
      fullPage: true,
    });
  }
}
