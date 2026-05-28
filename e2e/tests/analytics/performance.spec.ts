/**
 * tests/analytics/performance.spec.ts
 *
 * Sprint 4 — UC: View Performance
 *
 * Validates the Subject Analytics page (/analytics/subjects/:subjectId).
 * The page shows three dimension cards (Understanding, Retention, Mastery),
 * a concept mastery table with five filter tabs, meta-stat cards, a progress
 * chart (when data exists), and a Refresh button.
 *
 * NOTE: The analytics fixture derives the subjectId from the first subject
 * on the dashboard. All tests skip when no subjects are present in the
 * test environment.
 *
 * Tags:
 *  @smoke — subset run on every browser in CI
 */
import { test, expect } from '../../fixtures/index';

test.describe('View Performance (Subject Analytics)', () => {

  // ── UC-PERF-01: Analytics page is accessible ─────────────────────────────
  test('analytics subject page is accessible for an authenticated user @smoke', async ({
    analyticsSubjectPage,
  }) => {
    test.skip(!analyticsSubjectPage.isOnAnalyticsPage(), 'No subjects available in test env');
    await test.step('Verify analytics page URL', async () => {
      expect(analyticsSubjectPage.page.url()).toContain('/analytics/subjects/');
    });
    await analyticsSubjectPage.page.screenshot({ path: 'test-results/screenshots/uc-perf-01-accessible.png', fullPage: true });
  });

  // ── UC-PERF-02: Back button to overview is present ────────────────────────
  test('back button navigates to the analytics overview @smoke', async ({
    analyticsSubjectPage,
  }) => {
    test.skip(!analyticsSubjectPage.isOnAnalyticsPage(), 'No subjects available in test env');
    await test.step('Verify back button is visible', async () => {
      await expect(analyticsSubjectPage.backButton).toBeVisible({ timeout: 8_000 });
    });
    await analyticsSubjectPage.page.screenshot({ path: 'test-results/screenshots/uc-perf-02-back-button.png', fullPage: true });
  });

  // ── UC-PERF-03: Refresh button is present ────────────────────────────────
  test('refresh button is rendered on the analytics page @smoke', async ({
    analyticsSubjectPage,
  }) => {
    test.skip(!analyticsSubjectPage.isOnAnalyticsPage(), 'No subjects available in test env');
    await test.step('Verify refresh button is visible', async () => {
      await expect(analyticsSubjectPage.refreshButton).toBeVisible({ timeout: 8_000 });
    });
    await analyticsSubjectPage.page.screenshot({ path: 'test-results/screenshots/uc-perf-03-refresh-button.png', fullPage: true });
  });

  // ── UC-PERF-04: Understanding dimension card is visible ───────────────────
  test('Understanding dimension card is displayed', async ({
    analyticsSubjectPage,
  }) => {
    test.skip(!analyticsSubjectPage.isOnAnalyticsPage(), 'No subjects available in test env');
    await test.step('Verify Understanding dimension card is visible', async () => {
      await expect(analyticsSubjectPage.cardUnderstanding).toBeVisible({ timeout: 12_000 });
    });
    await analyticsSubjectPage.page.screenshot({ path: 'test-results/screenshots/uc-perf-04-understanding-card.png', fullPage: true });
  });

  // ── UC-PERF-05: Retention dimension card is visible ───────────────────────
  test('Retention dimension card is displayed', async ({
    analyticsSubjectPage,
  }) => {
    test.skip(!analyticsSubjectPage.isOnAnalyticsPage(), 'No subjects available in test env');
    await test.step('Verify Retention dimension card is visible', async () => {
      await expect(analyticsSubjectPage.cardRetention).toBeVisible({ timeout: 12_000 });
    });
    await analyticsSubjectPage.page.screenshot({ path: 'test-results/screenshots/uc-perf-05-retention-card.png', fullPage: true });
  });

  // ── UC-PERF-06: Mastery dimension card is visible ─────────────────────────
  test('Mastery dimension card is displayed', async ({
    analyticsSubjectPage,
  }) => {
    test.skip(!analyticsSubjectPage.isOnAnalyticsPage(), 'No subjects available in test env');
    await test.step('Verify Mastery dimension card is visible', async () => {
      await expect(analyticsSubjectPage.cardMastery).toBeVisible({ timeout: 12_000 });
    });
    await analyticsSubjectPage.page.screenshot({ path: 'test-results/screenshots/uc-perf-06-mastery-card.png', fullPage: true });
  });

  // ── UC-PERF-07: Concept mastery section is present ────────────────────────
  test('Concept Mastery section is displayed @smoke', async ({
    analyticsSubjectPage,
  }) => {
    test.skip(!analyticsSubjectPage.isOnAnalyticsPage(), 'No subjects available in test env');
    await test.step('Verify Concept Mastery section label is visible', async () => {
      await expect(analyticsSubjectPage.conceptMasteryLabel).toBeVisible({ timeout: 12_000 });
    });
    await analyticsSubjectPage.page.screenshot({ path: 'test-results/screenshots/uc-perf-07-concept-mastery.png', fullPage: true });
  });

  // ── UC-PERF-08: Concept filter tabs are all present ───────────────────────
  test('concept mastery table shows all five filter tabs', async ({
    analyticsSubjectPage,
  }) => {
    test.skip(!analyticsSubjectPage.isOnAnalyticsPage(), 'No subjects available in test env');
    await test.step('Verify concept mastery section and all five filter tabs', async () => {
      await expect(analyticsSubjectPage.conceptMasteryLabel).toBeVisible({ timeout: 12_000 });
      await expect(analyticsSubjectPage.conceptFilterAll).toBeVisible();
      await expect(analyticsSubjectPage.conceptFilterCritical).toBeVisible();
      await expect(analyticsSubjectPage.conceptFilterWeak).toBeVisible();
      await expect(analyticsSubjectPage.conceptFilterDeveloping).toBeVisible();
      await expect(analyticsSubjectPage.conceptFilterMastered).toBeVisible();
    });
    await analyticsSubjectPage.page.screenshot({ path: 'test-results/screenshots/uc-perf-08-filter-tabs.png', fullPage: true });
  });

  // ── UC-PERF-09: Clicking a filter tab does not crash the page ─────────────
  test('clicking the Critical concept filter does not crash the page', async ({
    analyticsSubjectPage,
  }) => {
    test.skip(!analyticsSubjectPage.isOnAnalyticsPage(), 'No subjects available in test env');
    await test.step('Wait for concept mastery section', async () => {
      await expect(analyticsSubjectPage.conceptMasteryLabel).toBeVisible({ timeout: 12_000 });
    });
    await test.step('Click the Critical filter tab', async () => {
      await analyticsSubjectPage.conceptFilterCritical.click();
    });
    await test.step('Verify page remains on analytics URL and body is visible', async () => {
      expect(analyticsSubjectPage.page.url()).toContain('/analytics/subjects/');
      await expect(analyticsSubjectPage.page.locator('body')).toBeVisible();
    });
    await analyticsSubjectPage.page.screenshot({ path: 'test-results/screenshots/uc-perf-09-filter-click.png', fullPage: true });
  });

  // ── UC-PERF-10: Unauthenticated access to /analytics/subjects/:id ─────────
  test('unauthenticated access to analytics page shows sign-in gate @smoke', async ({
    page,
  }) => {
    await test.step('Navigate to analytics page as guest', async () => {
      await page.goto('/analytics/subjects/nonexistent-id');
      await page.waitForLoadState('domcontentloaded');
    });
    await test.step('Verify sign-in gate or login redirect', async () => {
      const signInLink = page.getByRole('link', { name: /sign in/i });
      const loginUrl   = page.url().includes('/login');
      const hasGate    = await signInLink.isVisible({ timeout: 8_000 }).catch(() => false);
      expect(loginUrl || hasGate).toBe(true);
    });
    await page.screenshot({ path: 'test-results/screenshots/uc-perf-10-guest-gate.png', fullPage: true });
  });
});
