/**
 * profile.page.ts  — Page Object for /profile
 */
import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class ProfilePage extends BasePage {
  readonly path = '/profile';

  // ── View mode ─────────────────────────────────────────────────────────────
  readonly userName:     Locator;
  readonly editButton:   Locator;

  // ── Edit mode ─────────────────────────────────────────────────────────────
  // The name input has no id/for association; select by type inside the form
  readonly nameInput:    Locator;
  readonly saveButton:   Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    super(page);

    this.userName     = page.locator('h1').first();
    this.editButton   = page.getByRole('button', { name: /edit profile/i });

    // Edit form: the name text input is the first non-disabled text input
    this.nameInput    = page.locator('form input[type="text"]').first();
    this.saveButton   = page.getByRole('button', { name: /save changes/i });
    // Cancel is a regular type="button" with text "Cancel"
    this.cancelButton = page.getByRole('button', { name: /^cancel$/i });
  }

  async open(): Promise<this> {
    await this.goto(this.path);
    await expect(this.editButton).toBeVisible({ timeout: 15_000 });
    return this;
  }

  async startEditing(): Promise<void> {
    await this.editButton.click();
    await expect(this.nameInput).toBeVisible({ timeout: 5_000 });
  }

  async updateName(newName: string): Promise<void> {
    await this.nameInput.clear();
    await this.nameInput.fill(newName);
  }

  async saveChanges(): Promise<void> {
    await this.saveButton.click();
    // Edit form closes — Edit Profile button reappears
    await expect(this.editButton).toBeVisible({ timeout: 8_000 });
  }

  async cancelEditing(): Promise<void> {
    await this.cancelButton.click();
    // Edit form closes — Edit Profile button reappears
    await expect(this.editButton).toBeVisible({ timeout: 5_000 });
  }
}
