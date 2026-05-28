/**
 * tests/trash/trash.spec.ts
 *
 * Sprint 2 — UC: Manage Trash
 *
 * Validates the /trash page: listing trashed items, restoring, permanent
 * deletion, emptying, and access control.
 *
 * Note on test isolation:
 *  - Restore and delete tests are skipped if the trash is already empty so
 *    they never fail due to seeding state.  Add a pre-seeded trashed item to
 *    the test database to make them unconditional.
 *
 * Tags:
 *  @smoke — subset run on every browser in CI
 */
import { test, expect } from '../../fixtures/index';

test.describe('Manage Trash', () => {

  // ── UC-TRASH-01: Page renders without error ───────────────────────────────
  test('trash page renders for an authenticated user @smoke', async ({
    trashPage,
  }) => {
    await test.step('Verify trash page URL', async () => {
      expect(trashPage.page.url()).toContain('/trash');
    });
    await test.step('Verify items or empty state are present', async () => {
      const hasItems    = (await trashPage.itemCount()) > 0;
      const hasEmptyMsg = await trashPage.emptyStateMsg.isVisible().catch(() => false);
      expect(hasItems || hasEmptyMsg).toBeTruthy();
    });
    await trashPage.page.screenshot({ path: 'test-results/screenshots/uc-trash-01-page-renders.png', fullPage: true });
  });

  // ── UC-TRASH-02: Empty state renders the correct message ──────────────────
  test('empty trash state shows the correct message @smoke', async ({
    trashPage,
  }) => {
    await test.step('Check trash item count', async () => {
      const count = await trashPage.itemCount();
      if (count > 0) {
        test.skip(true, 'Trash is not empty — skipping empty-state test');
        return;
      }
    });
    await test.step('Verify empty state message is visible', async () => {
      await expect(trashPage.emptyStateMsg).toBeVisible({ timeout: 8_000 });
    });
    await trashPage.page.screenshot({ path: 'test-results/screenshots/uc-trash-02-empty-state.png', fullPage: true });
  });

  // ── UC-TRASH-03: Trash items show restore and delete-forever buttons ───────
  test('each trash item renders restore and delete-forever buttons', async ({
    trashPage,
  }) => {
    await test.step('Check trash has items', async () => {
      const count = await trashPage.itemCount();
      if (count === 0) {
        test.skip(true, 'No items in trash — skipping button visibility test');
        return;
      }
    });
    await test.step('Verify restore and delete-forever buttons are visible', async () => {
      await expect(trashPage.firstRestoreBtn).toBeVisible({ timeout: 5_000 });
      await expect(trashPage.firstDeleteForeverBtn).toBeVisible({ timeout: 5_000 });
    });
    await trashPage.page.screenshot({ path: 'test-results/screenshots/uc-trash-03-item-buttons.png', fullPage: true });
  });

  // ── UC-TRASH-04: Restore removes the item from the trash list ─────────────
  test('restore button removes the item from the trash list', async ({
    trashPage,
  }) => {
    let countBefore = 0;
    await test.step('Record initial trash count', async () => {
      countBefore = await trashPage.itemCount();
      if (countBefore === 0) {
        test.skip(true, 'No items in trash — skipping restore test');
        return;
      }
    });
    await test.step('Click restore on the first item', async () => {
      await trashPage.restoreFirst();
    });
    await test.step('Verify item count decreased by one', async () => {
      expect(await trashPage.itemCount()).toBe(countBefore - 1);
    });
    await trashPage.page.screenshot({ path: 'test-results/screenshots/uc-trash-04-item-restored.png', fullPage: true });
  });

  // ── UC-TRASH-05: Delete forever shows confirmation modal ──────────────────
  test('clicking delete forever opens a confirmation modal @smoke', async ({
    trashPage,
  }) => {
    await test.step('Check trash has items', async () => {
      const count = await trashPage.itemCount();
      if (count === 0) {
        test.skip(true, 'No items in trash — skipping confirmation modal test');
        return;
      }
    });
    await test.step('Click delete forever on the first item', async () => {
      await trashPage.firstDeleteForeverBtn.click();
    });
    await test.step('Verify confirmation modal appears', async () => {
      await expect(trashPage.confirmModal).toBeVisible({ timeout: 5_000 });
    });
    await trashPage.page.screenshot({ path: 'test-results/screenshots/uc-trash-05-confirm-modal.png', fullPage: true });
    await test.step('Cancel to avoid deleting item', async () => {
      await trashPage.confirmCancelBtn.click();
      await expect(trashPage.confirmModal).not.toBeVisible({ timeout: 5_000 });
    });
  });

  // ── UC-TRASH-06: Cancel on confirmation modal does not delete the item ─────
  test('cancelling the delete confirmation keeps the item in trash', async ({
    trashPage,
  }) => {
    let countBefore = 0;
    await test.step('Record initial trash count', async () => {
      countBefore = await trashPage.itemCount();
      if (countBefore === 0) {
        test.skip(true, 'No items in trash — skipping cancel test');
        return;
      }
    });
    await test.step('Open delete confirmation and cancel', async () => {
      await trashPage.firstDeleteForeverBtn.click();
      await expect(trashPage.confirmModal).toBeVisible({ timeout: 5_000 });
      await trashPage.confirmCancelBtn.click();
    });
    await test.step('Verify item count is unchanged', async () => {
      expect(await trashPage.itemCount()).toBe(countBefore);
    });
    await trashPage.page.screenshot({ path: 'test-results/screenshots/uc-trash-06-cancel-no-delete.png', fullPage: true });
  });

  // ── UC-TRASH-07: Empty Trash button is visible when items exist ───────────
  test('empty-trash button is visible when trash contains items', async ({
    trashPage,
  }) => {
    await test.step('Check trash has items', async () => {
      const count = await trashPage.itemCount();
      if (count === 0) {
        test.skip(true, 'No items in trash — skipping empty-trash button test');
        return;
      }
    });
    await test.step('Verify empty trash button is visible', async () => {
      await expect(trashPage.emptyTrashBtn).toBeVisible({ timeout: 5_000 });
    });
    await trashPage.page.screenshot({ path: 'test-results/screenshots/uc-trash-07-empty-trash-btn.png', fullPage: true });
  });

  // ── UC-TRASH-08: Empty Trash shows confirmation modal ─────────────────────
  test('empty trash button opens a confirmation modal', async ({
    trashPage,
  }) => {
    await test.step('Check trash has items', async () => {
      const count = await trashPage.itemCount();
      if (count === 0) {
        test.skip(true, 'No items in trash — skipping empty-trash modal test');
        return;
      }
    });
    await test.step('Click empty trash and verify confirmation modal', async () => {
      await trashPage.emptyTrashBtn.click();
      await expect(trashPage.confirmModal).toBeVisible({ timeout: 5_000 });
    });
    await trashPage.page.screenshot({ path: 'test-results/screenshots/uc-trash-08-empty-confirm-modal.png', fullPage: true });
    await test.step('Cancel to avoid emptying trash', async () => {
      await trashPage.confirmCancelBtn.click();
    });
  });

  // ── UC-TRASH-09: Unauthenticated access shows GuestGate ───────────────────
  test('unauthenticated access to /trash shows GuestGate @smoke', async ({
    page,
  }) => {
    await test.step('Navigate to /trash as guest', async () => {
      await page.goto('/trash');
      await page.waitForLoadState('domcontentloaded');
    });
    await test.step('Verify GuestGate sign-in link is visible', async () => {
      const signInLink = page.getByRole('link', { name: /sign in/i });
      await expect(signInLink).toBeVisible({ timeout: 8_000 });
    });
    await page.screenshot({ path: 'test-results/screenshots/uc-trash-09-guest-gate.png', fullPage: true });
  });
});
