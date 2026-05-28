/**
 * tests/files/files.spec.ts
 *
 * Sprint 2 — UC: View Files  (/history)
 *
 * Validates the file history page: page load, search, grid/list toggle,
 * date grouping, navigation to workspace, and access control.
 *
 * Tags:
 *  @smoke — subset run on every browser in CI
 */
import { test, expect } from '../../fixtures/index';

test.describe('View Files (History)', () => {

  // ── UC-FILES-01: Page renders for authenticated user ──────────────────────
  test('files page renders without error for an authenticated user @smoke', async ({
    filesPage,
  }) => {
    await test.step('Verify history page URL', async () => {
      expect(filesPage.page.url()).toContain('/history');
    });
    await test.step('Verify page heading is visible', async () => {
      const heading = filesPage.page.getByRole('heading').first();
      await expect(heading).toBeVisible({ timeout: 10_000 });
    });
    await filesPage.page.screenshot({ path: 'test-results/screenshots/uc-files-01-page-renders.png', fullPage: true });
  });

  // ── UC-FILES-02: Search input is present ─────────────────────────────────
  test('files page has a visible search input @smoke', async ({ filesPage }) => {
    await test.step('Verify search input is visible', async () => {
      await expect(filesPage.searchInput).toBeVisible({ timeout: 8_000 });
    });
    await filesPage.page.screenshot({ path: 'test-results/screenshots/uc-files-02-search-input.png', fullPage: true });
  });

  // ── UC-FILES-03: Search filters the file list ─────────────────────────────
  test('search input filters the displayed file list @smoke', async ({
    filesPage,
  }) => {
    let total = 0;
    await test.step('Check files are present', async () => {
      total = await filesPage.materialCount();
      if (total === 0) {
        test.skip(true, 'No files present — skipping search filter test');
        return;
      }
    });
    await test.step('Enter a no-match search query', async () => {
      await filesPage.search('zzz_no_match_xqz');
    });
    await test.step('Verify filtered result count is zero', async () => {
      const filtered = await filesPage.materialCount();
      expect(filtered).toBe(0);
    });
    await filesPage.page.screenshot({ path: 'test-results/screenshots/uc-files-03-search-filtered.png', fullPage: true });
    await test.step('Clear search and verify files return', async () => {
      await filesPage.clearSearch();
      expect(await filesPage.materialCount()).toBe(total);
    });
  });

  // ── UC-FILES-04: Grid/list view toggle buttons are present ────────────────
  test('files page has grid and list view toggle buttons', async ({
    filesPage,
  }) => {
    await test.step('Verify at least one view toggle button is visible', async () => {
      const gridVisible = await filesPage.gridViewBtn.isVisible().catch(() => false);
      const listVisible = await filesPage.listViewBtn.isVisible().catch(() => false);
      expect(gridVisible || listVisible).toBeTruthy();
    });
    await filesPage.page.screenshot({ path: 'test-results/screenshots/uc-files-04-view-toggle.png', fullPage: true });
  });

  // ── UC-FILES-05: Materials are grouped by date ────────────────────────────
  test('file list is grouped into date sections', async ({ filesPage }) => {
    await test.step('Check files are present', async () => {
      const total = await filesPage.materialCount();
      if (total === 0) {
        test.skip(true, 'No files present — skipping date group test');
        return;
      }
    });
    await test.step('Verify at least one date grouping label is visible', async () => {
      const dateLabels = filesPage.page.getByText(/today|yesterday|\d{4}/i);
      const count = await dateLabels.count();
      expect(count).toBeGreaterThanOrEqual(1);
    });
    await filesPage.page.screenshot({ path: 'test-results/screenshots/uc-files-05-date-groups.png', fullPage: true });
  });

  // ── UC-FILES-06: Clicking a material navigates to the subject workspace ───
  test('clicking a file card navigates to the subject workspace', async ({
    filesPage,
  }) => {
    await test.step('Check files are present', async () => {
      const total = await filesPage.materialCount();
      if (total === 0) {
        test.skip(true, 'No files present — skipping navigation test');
        return;
      }
    });
    await test.step('Click first file card and wait for workspace URL', async () => {
      await filesPage.materialLinks.first().click();
      await filesPage.page.waitForURL(/\/subjects\//, { timeout: 15_000 });
    });
    await test.step('Verify URL matches workspace pattern', async () => {
      expect(filesPage.page.url()).toMatch(/\/subjects\//);
    });
    await filesPage.page.screenshot({ path: 'test-results/screenshots/uc-files-06-workspace-nav.png', fullPage: true });
  });

  // ── UC-FILES-07: File cards show a delete button ──────────────────────────
  test('each file card renders a delete button', async ({ filesPage }) => {
    await test.step('Check files are present', async () => {
      const total = await filesPage.materialCount();
      if (total === 0) {
        test.skip(true, 'No files present — skipping delete button test');
        return;
      }
    });
    await test.step('Verify delete button is visible on the first file card', async () => {
      await expect(filesPage.firstDeleteBtn).toBeVisible({ timeout: 5_000 });
    });
    await filesPage.page.screenshot({ path: 'test-results/screenshots/uc-files-07-delete-button.png', fullPage: true });
  });

  // ── UC-FILES-08: Unauthenticated access shows GuestGate ───────────────────
  test('unauthenticated access to /history shows GuestGate @smoke', async ({
    page,
  }) => {
    await test.step('Navigate to /history as guest', async () => {
      await page.goto('/history');
      await page.waitForLoadState('domcontentloaded');
    });
    await test.step('Verify GuestGate sign-in link is visible', async () => {
      const signInLink = page.getByRole('link', { name: /sign in/i });
      await expect(signInLink).toBeVisible({ timeout: 8_000 });
    });
    await page.screenshot({ path: 'test-results/screenshots/uc-files-08-guest-gate.png', fullPage: true });
  });
});
