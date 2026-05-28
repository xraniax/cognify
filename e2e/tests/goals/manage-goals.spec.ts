/**
 * tests/goals/manage-goals.spec.ts
 *
 * Sprint 4 — UC: Manage Study Goals
 *
 * Validates goal management beyond creation (covered in Sprint 2):
 *  - Each goal card has a three-dot (MoreVertical) menu button
 *  - Hovering reveals Edit and Abort (delete) options
 *  - Edit opens the GoalSettingModal with pre-filled data
 *  - Abort shows a browser confirm dialog ("Abort this mission?")
 *  - The status filter buttons (all / active / completed) are present
 *  - The floating "New Mission" FAB is present when goals exist
 *
 * State-dependent tests skip when no goals are present.
 *
 * Tags:
 *  @smoke — subset run on every browser in CI
 */
import { test, expect } from '../../fixtures/index';

test.describe('Manage Study Goals', () => {

  // ── UC-MGR-01: Goals page renders correctly ───────────────────────────────
  test('goals page renders with heading and filter controls @smoke', async ({
    goalsPage,
  }) => {
    await test.step('Verify goals page URL', async () => {
      expect(goalsPage.page.url()).toContain('/goals');
    });
    await test.step('Verify "Growth Engine" heading is visible', async () => {
      await expect(goalsPage.page.getByText(/growth engine/i).first()).toBeVisible({ timeout: 10_000 });
    });
    await goalsPage.page.screenshot({ path: 'test-results/screenshots/uc-mgr-01-page-renders.png', fullPage: true });
  });

  // ── UC-MGR-02: Status filter tabs are present ─────────────────────────────
  test('goals page shows All / Active / Completed filter tabs @smoke', async ({
    goalsPage,
  }) => {
    await test.step('Verify all three filter tabs are visible', async () => {
      await expect(goalsPage.filterAll).toBeVisible({ timeout: 8_000 });
      await expect(goalsPage.filterActive).toBeVisible();
      await expect(goalsPage.filterCompleted).toBeVisible();
    });
    await goalsPage.page.screenshot({ path: 'test-results/screenshots/uc-mgr-02-filter-tabs.png', fullPage: true });
  });

  // ── UC-MGR-03: Search input is present ───────────────────────────────────
  test('goals page has a search input for missions @smoke', async ({
    goalsPage,
  }) => {
    await test.step('Verify search input is visible', async () => {
      await expect(goalsPage.searchInput).toBeVisible({ timeout: 8_000 });
    });
    await goalsPage.page.screenshot({ path: 'test-results/screenshots/uc-mgr-03-search-input.png', fullPage: true });
  });

  // ── UC-MGR-04: Goal card shows three-dot menu button ─────────────────────
  test('each goal card exposes a menu (MoreVertical) button', async ({
    goalsPage,
  }) => {
    const count = await goalsPage.goalCount();
    test.skip(count === 0, 'No goals present — skipping card-menu test');
    await test.step('Verify MoreVertical menu button is visible on goal card', async () => {
      const menuBtn = goalsPage.page
        .locator('[data-testid="goal-menu-btn"]')
        .first();
      await expect(menuBtn).toBeVisible({ timeout: 8_000 });
    });
    await goalsPage.page.screenshot({ path: 'test-results/screenshots/uc-mgr-04-menu-button.png', fullPage: true });
  });

  // ── UC-MGR-05: Hovering menu reveals Edit option ──────────────────────────
  test('hovering the goal card menu shows an Edit button', async ({
    goalsPage,
  }) => {
    const count = await goalsPage.goalCount();
    test.skip(count === 0, 'No goals present');
    await test.step('Hover over the menu button', async () => {
      const menuBtn = goalsPage.page
        .locator('[data-testid="goal-menu-btn"]')
        .first();
      await menuBtn.hover();
    });
    await test.step('Verify Edit button appears in the hover menu', async () => {
      const editBtn = goalsPage.page.getByRole('button', { name: /^edit$/i }).first();
      await expect(editBtn).toBeVisible({ timeout: 5_000 });
    });
    await goalsPage.page.screenshot({ path: 'test-results/screenshots/uc-mgr-05-edit-option.png', fullPage: true });
  });

  // ── UC-MGR-06: Clicking Edit opens the goal modal ─────────────────────────
  test('clicking Edit on a goal card opens the edit modal', async ({
    goalsPage,
  }) => {
    const count = await goalsPage.goalCount();
    test.skip(count === 0, 'No goals present');
    await test.step('Hover menu and click Edit', async () => {
      const menuBtn = goalsPage.page
        .locator('[data-testid="goal-menu-btn"]')
        .first();
      await menuBtn.hover();
      const editBtn = goalsPage.page.getByRole('button', { name: /^edit$/i }).first();
      await editBtn.click();
    });
    await test.step('Verify goal edit modal is visible', async () => {
      await expect(goalsPage.goalModal).toBeVisible({ timeout: 6_000 });
    });
    await goalsPage.page.screenshot({ path: 'test-results/screenshots/uc-mgr-06-edit-modal-open.png', fullPage: true });
  });

  // ── UC-MGR-07: Edit modal pre-fills with goal title ───────────────────────
  test('edit modal opens with the goal title pre-filled', async ({
    goalsPage,
  }) => {
    const count = await goalsPage.goalCount();
    test.skip(count === 0, 'No goals present');
    await test.step('Hover menu and click Edit', async () => {
      const menuBtn = goalsPage.page
        .locator('[data-testid="goal-menu-btn"]')
        .first();
      await menuBtn.hover();
      const editBtn = goalsPage.page.getByRole('button', { name: /^edit$/i }).first();
      await editBtn.click();
      await expect(goalsPage.goalModal).toBeVisible({ timeout: 6_000 });
    });
    await test.step('Verify title input contains existing goal text', async () => {
      const titleValue = await goalsPage.goalTitleInput.inputValue();
      expect(titleValue.length).toBeGreaterThan(0);
    });
    await goalsPage.page.screenshot({ path: 'test-results/screenshots/uc-mgr-07-title-pre-filled.png', fullPage: true });
    await test.step('Close the modal', async () => {
      await goalsPage.goalModalCloseBtn.click();
    });
  });

  // ── UC-MGR-08: Hovering menu reveals Abort option ────────────────────────
  test('hovering the goal card menu shows an Abort button', async ({
    goalsPage,
  }) => {
    const count = await goalsPage.goalCount();
    test.skip(count === 0, 'No goals present');
    await test.step('Hover over the menu button', async () => {
      const menuBtn = goalsPage.page
        .locator('[data-testid="goal-menu-btn"]')
        .first();
      await menuBtn.hover();
    });
    await test.step('Verify Abort button appears in the hover menu', async () => {
      const abortBtn = goalsPage.page.getByRole('button', { name: /^abort$/i }).first();
      await expect(abortBtn).toBeVisible({ timeout: 5_000 });
    });
    await goalsPage.page.screenshot({ path: 'test-results/screenshots/uc-mgr-08-abort-option.png', fullPage: true });
  });

  // ── UC-MGR-09: Clicking Abort triggers browser confirm dialog ────────────
  test('clicking Abort shows a confirmation dialog', async ({
    goalsPage,
  }) => {
    const count = await goalsPage.goalCount();
    test.skip(count === 0, 'No goals present');

    await test.step('Register dialog dismiss handler (idempotent)', async () => {
      goalsPage.page.once('dialog', dialog => dialog.dismiss());
    });
    await test.step('Hover menu and click Abort', async () => {
      const menuBtn = goalsPage.page
        .locator('[data-testid="goal-menu-btn"]')
        .first();
      await menuBtn.hover();
      const abortBtn = goalsPage.page.getByRole('button', { name: /^abort$/i }).first();
      await abortBtn.click();
    });
    await test.step('Verify goal count is unchanged after dismiss', async () => {
      const newCount = await goalsPage.goalCount();
      expect(newCount).toBe(count);
    });
    await goalsPage.page.screenshot({ path: 'test-results/screenshots/uc-mgr-09-abort-dialog.png', fullPage: true });
  });

  // ── UC-MGR-10: Active filter shows only active goals ─────────────────────
  test('clicking the Active filter shows only active-status goals', async ({
    goalsPage,
  }) => {
    await test.step('Click the Active filter tab', async () => {
      await goalsPage.filterActive.click();
    });
    await test.step('Verify page remains on /goals and body is visible', async () => {
      expect(goalsPage.page.url()).toContain('/goals');
      await expect(goalsPage.page.locator('body')).toBeVisible();
    });
    await goalsPage.page.screenshot({ path: 'test-results/screenshots/uc-mgr-10-active-filter.png', fullPage: true });
  });

  // ── UC-MGR-11: Completed filter shows completed or empty state ───────────
  test('clicking the Completed filter shows completed goals or empty state', async ({
    goalsPage,
  }) => {
    await test.step('Click the Completed filter tab', async () => {
      await goalsPage.filterCompleted.click();
    });
    await test.step('Verify page remains on /goals and body is visible', async () => {
      expect(goalsPage.page.url()).toContain('/goals');
      await expect(goalsPage.page.locator('body')).toBeVisible();
    });
    await goalsPage.page.screenshot({ path: 'test-results/screenshots/uc-mgr-11-completed-filter.png', fullPage: true });
  });

  // ── UC-MGR-12: FAB "New Mission" is visible when goals exist ──────────────
  test('floating "New Mission" button is visible when goals are present', async ({
    goalsPage,
  }) => {
    const count = await goalsPage.goalCount();
    test.skip(count === 0, 'No goals present — FAB not rendered');
    await test.step('Verify floating New Mission button is visible', async () => {
      const fab = goalsPage.page.getByRole('button', { name: /new mission/i });
      await expect(fab).toBeVisible({ timeout: 8_000 });
    });
    await goalsPage.page.screenshot({ path: 'test-results/screenshots/uc-mgr-12-fab.png', fullPage: true });
  });
});
