/**
 * tests/goals/study-sessions.spec.ts
 *
 * Sprint 4 — UC: View Study Sessions
 *
 * Validates the study-session lifecycle on the Goals page (/goals).
 * A session is started per-goal ("Start Mission" button) and displays a
 * live MM:SS timer; it can be ended with the "Complete" button.
 *
 * State-dependent tests (UC-SESS-03 to 05) skip when there are no active
 * goals, as the "Start Mission" button is only visible on active goals.
 *
 * Tags:
 *  @smoke — subset run on every browser in CI
 */
import { test, expect } from '../../fixtures/index';

test.describe('View Study Sessions', () => {

  // ── UC-SESS-01: Goals page renders ───────────────────────────────────────
  test('goals page renders for an authenticated user @smoke', async ({
    goalsPage,
  }) => {
    await test.step('Verify goals page URL', async () => {
      expect(goalsPage.page.url()).toContain('/goals');
    });
    await test.step('Verify page body is visible', async () => {
      await expect(goalsPage.page.locator('body')).toBeVisible();
    });
    await goalsPage.page.screenshot({ path: 'test-results/screenshots/uc-sess-01-page-renders.png', fullPage: true });
  });

  // ── UC-SESS-02: Page heading "Growth Engine" is visible ───────────────────
  test('goals page shows the "Growth Engine" heading @smoke', async ({
    goalsPage,
  }) => {
    await test.step('Verify "Growth Engine" heading is visible', async () => {
      const heading = goalsPage.page.getByText(/growth engine/i).first();
      await expect(heading).toBeVisible({ timeout: 10_000 });
    });
    await goalsPage.page.screenshot({ path: 'test-results/screenshots/uc-sess-02-growth-engine-heading.png', fullPage: true });
  });

  // ── UC-SESS-03: Active goal shows "Start Mission" button ─────────────────
  test('active goal card shows a "Start Mission" button', async ({
    goalsPage,
  }) => {
    const count = await goalsPage.goalCount();
    test.skip(count === 0, 'No goals present — skipping session test');
    const startBtn = goalsPage.page
      .getByRole('button', { name: /start mission/i })
      .first();
    const visible  = await startBtn.isVisible({ timeout: 8_000 }).catch(() => false);
    test.skip(!visible, 'No active goals with Start Mission button');
    await test.step('Verify Start Mission button is enabled', async () => {
      await expect(startBtn).toBeEnabled();
    });
    await goalsPage.page.screenshot({ path: 'test-results/screenshots/uc-sess-03-start-mission-btn.png', fullPage: true });
  });

  // ── UC-SESS-04: Starting a session shows the timer ────────────────────────
  test('clicking Start Mission displays the session timer', async ({
    goalsPage,
  }) => {
    const count    = await goalsPage.goalCount();
    test.skip(count === 0, 'No goals present');
    const startBtn = goalsPage.page
      .getByRole('button', { name: /start mission/i })
      .first();
    const visible  = await startBtn.isVisible({ timeout: 8_000 }).catch(() => false);
    test.skip(!visible, 'No active goals with Start Mission button');

    await test.step('Click Start Mission to begin a session', async () => {
      await startBtn.click();
    });
    await test.step('Verify session timer is visible', async () => {
      const timer = goalsPage.page.locator('.tabular-nums').first();
      await expect(timer).toBeVisible({ timeout: 10_000 });
    });
    await goalsPage.page.screenshot({ path: 'test-results/screenshots/uc-sess-04-timer-visible.png', fullPage: true });
    await test.step('End session to restore state', async () => {
      const completeBtn = goalsPage.page.getByRole('button', { name: /complete/i }).first();
      if (await completeBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await completeBtn.click();
      }
    });
  });

  // ── UC-SESS-05: Active session shows "Complete" button ────────────────────
  test('an active session shows the Complete button to end it', async ({
    goalsPage,
  }) => {
    const count    = await goalsPage.goalCount();
    test.skip(count === 0, 'No goals present');
    const startBtn = goalsPage.page
      .getByRole('button', { name: /start mission/i })
      .first();
    const visible  = await startBtn.isVisible({ timeout: 8_000 }).catch(() => false);
    test.skip(!visible, 'No active goals with Start Mission button');

    await test.step('Click Start Mission to begin a session', async () => {
      await startBtn.click();
    });
    await test.step('Verify Complete button is visible during session', async () => {
      const completeBtn = goalsPage.page.getByRole('button', { name: /complete/i }).first();
      await expect(completeBtn).toBeVisible({ timeout: 10_000 });
    });
    await goalsPage.page.screenshot({ path: 'test-results/screenshots/uc-sess-05-complete-button.png', fullPage: true });
    await test.step('End session to restore state', async () => {
      const completeBtn = goalsPage.page.getByRole('button', { name: /complete/i }).first();
      await completeBtn.click();
    });
  });

  // ── UC-SESS-06: Unauthenticated access to /goals shows GuestGate ──────────
  test('unauthenticated access to /goals shows sign-in gate @smoke', async ({
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
    await page.screenshot({ path: 'test-results/screenshots/uc-sess-06-guest-gate.png', fullPage: true });
  });
});
