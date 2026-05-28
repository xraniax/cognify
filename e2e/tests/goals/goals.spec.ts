/**
 * tests/goals/goals.spec.ts
 *
 * Sprint 2 — UC: Manage Study Goals
 *
 * Validates the /goals page: rendering, goal creation modal, search,
 * filter tabs, and access control.
 *
 * Tags:
 *  @smoke — subset run on every browser in CI
 */
import { test, expect } from '../../fixtures/index';
import { uniqueGoalTitle } from '../../test-data/subjects';

test.describe('Manage Study Goals', () => {

  // ── UC-GOAL-01: Goals page renders for authenticated user ─────────────────
  test('goals page renders for an authenticated user @smoke', async ({
    goalsPage,
  }) => {
    await test.step('Verify goals page URL', async () => {
      expect(goalsPage.page.url()).toContain('/goals');
    });
    await test.step('Verify add goal button is visible', async () => {
      await expect(goalsPage.addButton).toBeVisible({ timeout: 10_000 });
    });
    await goalsPage.page.screenshot({ path: 'test-results/screenshots/uc-goal-01-page-renders.png', fullPage: true });
  });

  // ── UC-GOAL-02: Stats section is displayed ────────────────────────────────
  test('goals page displays a stats / overview section @smoke', async ({
    goalsPage,
  }) => {
    await test.step('Verify stats/metrics area is visible', async () => {
      const statsArea = goalsPage.page.locator('text=/total|completed|active/i').first();
      await expect(statsArea).toBeVisible({ timeout: 8_000 });
    });
    await goalsPage.page.screenshot({ path: 'test-results/screenshots/uc-goal-02-stats-section.png', fullPage: true });
  });

  // ── UC-GOAL-03: Add button is visible ─────────────────────────────────────
  test('add goal button is visible on the goals page @smoke', async ({
    goalsPage,
  }) => {
    await test.step('Verify add button is visible', async () => {
      await expect(goalsPage.addButton).toBeVisible({ timeout: 8_000 });
    });
    await goalsPage.page.screenshot({ path: 'test-results/screenshots/uc-goal-03-add-button.png', fullPage: true });
  });

  // ── UC-GOAL-04: Clicking add opens the goal creation modal ────────────────
  test('clicking the add button opens the goal creation modal @smoke', async ({
    goalsPage,
  }) => {
    await test.step('Click the add goal button', async () => {
      await goalsPage.clickAdd();
    });
    await test.step('Verify goal creation modal is visible', async () => {
      await expect(goalsPage.goalModal).toBeVisible({ timeout: 6_000 });
    });
    await goalsPage.page.screenshot({ path: 'test-results/screenshots/uc-goal-04-creation-modal.png', fullPage: true });
    await test.step('Close modal to avoid side effects', async () => {
      await goalsPage.goalModalCloseBtn.click();
    });
  });

  // ── UC-GOAL-05: Goal creation modal has a title input ─────────────────────
  test('goal creation modal renders the title input field', async ({
    goalsPage,
  }) => {
    await test.step('Open the goal creation modal', async () => {
      await goalsPage.clickAdd();
    });
    await test.step('Verify title input is visible', async () => {
      await expect(goalsPage.goalTitleInput).toBeVisible({ timeout: 5_000 });
    });
    await goalsPage.page.screenshot({ path: 'test-results/screenshots/uc-goal-05-title-input.png', fullPage: true });
    await test.step('Close modal', async () => {
      await goalsPage.goalModalCloseBtn.click();
    });
  });

  // ── UC-GOAL-06: Goal creation modal has a save button ─────────────────────
  test('goal creation modal renders the save/create button', async ({
    goalsPage,
  }) => {
    await test.step('Open the goal creation modal', async () => {
      await goalsPage.clickAdd();
    });
    await test.step('Verify save button is visible', async () => {
      await expect(goalsPage.goalSaveBtn).toBeVisible({ timeout: 5_000 });
    });
    await goalsPage.page.screenshot({ path: 'test-results/screenshots/uc-goal-06-save-button.png', fullPage: true });
    await test.step('Close modal', async () => {
      await goalsPage.goalModalCloseBtn.click();
    });
  });

  // ── UC-GOAL-07: Creating a goal adds it to the list ───────────────────────
  test('creating a goal adds it to the goal list', async ({
    goalsPage,
  }) => {
    const title = uniqueGoalTitle('Sprint2 Goal');
    let countBefore = 0;
    await test.step('Record initial goal count', async () => {
      countBefore = await goalsPage.goalCount();
    });
    await test.step('Create a new goal with a unique title', async () => {
      await goalsPage.createGoal(title);
    });
    await test.step('Verify new goal card appears in the list', async () => {
      await expect(
        goalsPage.page.getByText(title),
      ).toBeVisible({ timeout: 10_000 });
      expect(await goalsPage.goalCount()).toBeGreaterThan(countBefore);
    });
    await goalsPage.page.screenshot({ path: 'test-results/screenshots/uc-goal-07-goal-created.png', fullPage: true });
    await test.step('Cleanup: delete the transient goal', async () => {
      const newGoalCard = goalsPage.page.locator('div, article').filter({ hasText: title }).last();
      await newGoalCard.hover();
      const deleteBtn = newGoalCard.locator('button').filter({
        has: goalsPage.page.locator('[data-lucide="trash-2"], .lucide-trash-2'),
      }).first();
      if (await deleteBtn.isVisible()) {
        goalsPage.page.on('dialog', (d) => d.accept());
        await deleteBtn.click();
      }
    });
  });

  // ── UC-GOAL-08: Search filters the goal list ──────────────────────────────
  test('search input filters the displayed goal list', async ({
    goalsPage,
  }) => {
    await test.step('Check goals are present', async () => {
      const count = await goalsPage.goalCount();
      if (count === 0) {
        test.skip(true, 'No goals present — skipping search filter test');
        return;
      }
    });
    await test.step('Enter a no-match search query', async () => {
      await goalsPage.searchInput.fill('zzz_no_match_xqz');
      await goalsPage.page.waitForTimeout(400);
    });
    await test.step('Verify filtered results are empty', async () => {
      const filtered = await goalsPage.goalCount();
      expect(filtered).toBe(0);
    });
    await goalsPage.page.screenshot({ path: 'test-results/screenshots/uc-goal-08-search-filtered.png', fullPage: true });
    await test.step('Clear search and restore list', async () => {
      await goalsPage.searchInput.clear();
    });
  });

  // ── UC-GOAL-09: Filter tabs are present ──────────────────────────────────
  test('goals page has filter tabs (all / active / completed)', async ({
    goalsPage,
  }) => {
    await test.step('Verify all three filter tabs are visible', async () => {
      await expect(goalsPage.filterAll).toBeVisible({ timeout: 6_000 });
      await expect(goalsPage.filterActive).toBeVisible({ timeout: 6_000 });
      await expect(goalsPage.filterCompleted).toBeVisible({ timeout: 6_000 });
    });
    await goalsPage.page.screenshot({ path: 'test-results/screenshots/uc-goal-09-filter-tabs.png', fullPage: true });
  });

  // ── UC-GOAL-10: Unauthenticated access shows GuestGate ────────────────────
  test('unauthenticated access to /goals shows GuestGate @smoke', async ({
    page,
  }) => {
    await test.step('Navigate to /goals as guest', async () => {
      await page.goto('/goals');
      await page.waitForLoadState('domcontentloaded');
    });
    await test.step('Verify GuestGate sign-in link is visible', async () => {
      const signInLink = page.getByRole('link', { name: /sign in/i });
      await expect(signInLink).toBeVisible({ timeout: 8_000 });
    });
    await page.screenshot({ path: 'test-results/screenshots/uc-goal-10-guest-gate.png', fullPage: true });
  });
});
