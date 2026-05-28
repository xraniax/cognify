/**
 * pages/trash.page.ts  — Page Object for /trash
 *
 * The Trash page (Trash.jsx) shows deleted materials with expiry info.
 * Key interactions:
 *  - Restore an item → item disappears from the list
 *  - Delete forever  → ConfirmModal appears, then item disappears
 *  - Empty trash     → ConfirmModal appears, then list is cleared
 */
import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class TrashPage extends BasePage {
  readonly path = '/trash';

  // ── Page-level elements ──────────────────────────────────────────────────
  readonly pageHeading:   Locator;
  readonly emptyStateMsg: Locator;
  readonly emptyTrashBtn: Locator;

  // ── Per-item elements (first item) ───────────────────────────────────────
  // Restore: <button>Restore</button>
  readonly firstRestoreBtn:     Locator;
  // Delete forever: <button title="Delete forever">
  readonly firstDeleteForeverBtn: Locator;

  // ── Confirmation modal ───────────────────────────────────────────────────
  readonly confirmModal:      Locator;
  readonly confirmModalTitle: Locator;
  readonly confirmOkBtn:      Locator;
  readonly confirmCancelBtn:  Locator;

  constructor(page: Page) {
    super(page);

    this.pageHeading   = page.getByRole('heading', { name: /trash/i }).first();
    this.emptyStateMsg = page.getByText(/trash is empty/i);
    this.emptyTrashBtn = page.getByRole('button', { name: /empty trash/i });

    this.firstRestoreBtn      = page.getByRole('button', { name: /restore/i }).first();
    this.firstDeleteForeverBtn = page.locator('button[title="Delete forever"]').first();

    // ConfirmModal renders as a fixed overlay with a heading and two buttons
    this.confirmModal      = page.locator('.fixed.inset-0').last();
    this.confirmModalTitle = page.locator('h3').filter({ hasText: /delete|empty/i }).first();
    this.confirmOkBtn      = page.getByRole('button', { name: /delete forever|empty trash/i });
    this.confirmCancelBtn  = page.getByRole('button', { name: /^cancel$/i });
  }

  async open(): Promise<this> {
    await this.goto(this.path);
    await this.waitForPageReady();
    return this;
  }

  /** Returns the number of trash items currently rendered. */
  async itemCount(): Promise<number> {
    return this.page.locator('button[title="Delete forever"]').count();
  }

  /** Restore the first item in the list and wait for it to disappear. */
  async restoreFirst(): Promise<void> {
    const countBefore = await this.itemCount();
    await this.firstRestoreBtn.click();
    await expect(this.page.locator('button[title="Delete forever"]')).toHaveCount(
      Math.max(0, countBefore - 1),
      { timeout: 10_000 },
    );
  }

  /** Click Delete Forever on the first item, confirm in modal. */
  async deleteForeverFirst(): Promise<void> {
    const countBefore = await this.itemCount();
    await this.firstDeleteForeverBtn.click();
    await expect(this.confirmModal).toBeVisible({ timeout: 5_000 });
    await this.confirmOkBtn.click();
    await expect(this.page.locator('button[title="Delete forever"]')).toHaveCount(
      Math.max(0, countBefore - 1),
      { timeout: 10_000 },
    );
  }

  /** Click Empty Trash, confirm in modal. */
  async emptyTrash(): Promise<void> {
    await this.emptyTrashBtn.click();
    await expect(this.confirmModal).toBeVisible({ timeout: 5_000 });
    await this.confirmOkBtn.click();
    await expect(this.emptyStateMsg).toBeVisible({ timeout: 10_000 });
  }
}
