/**
 * login.page.ts
 *
 * Page Object for /login.
 *
 * Selector strategy:
 *  - Inputs   → getByPlaceholder (resilient to class/ID churn)
 *  - Buttons  → getByRole with name (accessible, spec-stable)
 *  - Errors   → semantic CSS classes already used by the app (.bg-red-50)
 */
import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class LoginPage extends BasePage {
  readonly path = '/login';

  // ── Locators ─────────────────────────────────────────────────────────────
  readonly emailInput:    Locator;
  readonly passwordInput: Locator;
  readonly submitButton:  Locator;
  readonly globalError:   Locator;
  readonly fieldErrors:   Locator;
  readonly registerLink:  Locator;
  readonly forgotLink:    Locator;
  readonly googleButton:  Locator;
  readonly githubButton:  Locator;

  constructor(page: Page) {
    super(page);
    this.emailInput    = page.getByPlaceholder('name@example.com');
    this.passwordInput = page.getByPlaceholder('••••••••');
    this.submitButton  = page.getByRole('button', { name: 'Sign In Now' });
    this.globalError   = page.locator('.bg-red-50').first();
    this.fieldErrors   = page.locator('p.text-red-600, p.text-red-500');
    this.registerLink  = page.getByRole('link', { name: /register here/i });
    this.forgotLink    = page.getByRole('link', { name: /recovery options/i });
    this.googleButton  = page.getByRole('button', { name: /google/i });
    this.githubButton  = page.getByRole('button', { name: /github/i });
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  async open(): Promise<this> {
    await this.goto(this.path);
    await expect(this.emailInput).toBeVisible();
    return this;
  }

  async fillEmail(email: string): Promise<this> {
    await this.emailInput.fill(email);
    return this;
  }

  async fillPassword(password: string): Promise<this> {
    await this.passwordInput.fill(password);
    return this;
  }

  async submit(): Promise<this> {
    await this.submitButton.click();
    return this;
  }

  /** High-level login that waits for redirect on success. */
  async login(email: string, password: string): Promise<void> {
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.submit();
  }

  /** Expect a visible global (server-side) error banner. */
  async expectGlobalError(text?: string | RegExp): Promise<void> {
    await expect(this.globalError).toBeVisible({ timeout: 8_000 });
    if (text) await expect(this.globalError).toContainText(text);
  }

  /** Expect at least one inline field-level error message. */
  async expectFieldError(): Promise<void> {
    const visible = this.fieldErrors.first();
    await expect(visible).toBeVisible({ timeout: 5_000 });
  }

  async expectRedirectAway(): Promise<void> {
    await this.page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 15_000,
    });
  }
}
