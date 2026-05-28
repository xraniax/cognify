/**
 * register.page.ts  — Page Object for /register
 */
import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class RegisterPage extends BasePage {
  readonly path = '/register';

  readonly nameInput:     Locator;
  readonly emailInput:    Locator;
  readonly passwordInput: Locator;
  readonly submitButton:  Locator;
  readonly globalError:   Locator;
  readonly fieldErrors:   Locator;
  readonly loginLink:     Locator;

  constructor(page: Page) {
    super(page);
    this.nameInput     = page.getByPlaceholder('Enter your name');
    this.emailInput    = page.getByPlaceholder('name@example.com');
    this.passwordInput = page.getByPlaceholder('••••••••');
    this.submitButton  = page.getByRole('button', { name: 'Sign Up' });
    this.globalError   = page.locator('.bg-red-50').first();
    this.fieldErrors   = page.locator('p.text-red-500');
    this.loginLink     = page.getByRole('link', { name: /sign in/i });
  }

  async open(): Promise<this> {
    await this.goto(this.path);
    await expect(this.nameInput).toBeVisible();
    return this;
  }

  async fillName(name: string): Promise<this> {
    await this.nameInput.fill(name);
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

  async register(name: string, email: string, password: string): Promise<void> {
    await this.fillName(name);
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.submit();
  }

  async expectGlobalError(text?: string | RegExp): Promise<void> {
    await expect(this.globalError).toBeVisible({ timeout: 8_000 });
    if (text) await expect(this.globalError).toContainText(text);
  }

  async expectFieldError(fieldName?: string): Promise<void> {
    const errors = this.fieldErrors;
    await expect(errors.first()).toBeVisible({ timeout: 5_000 });
  }

  async expectRedirectAway(): Promise<void> {
    await this.page.waitForURL((url) => !url.pathname.includes('/register'), {
      timeout: 15_000,
    });
  }
}
