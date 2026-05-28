/**
 * tests/admin/platform-activity.spec.ts
 *
 * Sprint 4 — UC: View Platform Activity
 *
 * Validates the Admin Dashboard page (/admin) — AdminDashboard.jsx.
 * The page shows:
 *  - "Admin Dashboard" heading
 *  - KPI cards (total users, materials generated, AI interactions, etc.)
 *  - A live ActivityStream section ("Student activity stream" label)
 *  - Various charts (material type distribution, difficulty breakdown)
 *
 * Tags:
 *  @smoke — subset run on every browser in CI
 */
import { test, expect } from '../../fixtures/index';

test.describe('View Platform Activity (Admin Dashboard)', () => {

  // ── UC-ACT-01: Admin dashboard page renders ───────────────────────────────
  test('admin dashboard page is accessible and renders @smoke', async ({
    adminDashboardPage,
  }) => {
    await test.step('Verify admin dashboard URL', async () => {
      expect(adminDashboardPage.page.url()).toContain('/admin');
    });
    await adminDashboardPage.page.screenshot({ path: 'test-results/screenshots/uc-act-01-page-renders.png', fullPage: true });
  });

  // ── UC-ACT-02: "Admin Dashboard" heading is visible ──────────────────────
  test('"Admin Dashboard" heading is displayed @smoke', async ({
    adminDashboardPage,
  }) => {
    await test.step('Verify "Admin Dashboard" heading is visible', async () => {
      await expect(adminDashboardPage.pageHeading).toBeVisible({ timeout: 12_000 });
    });
    await adminDashboardPage.page.screenshot({ path: 'test-results/screenshots/uc-act-02-heading.png', fullPage: true });
  });

  // ── UC-ACT-03: Activity stream section label is present ──────────────────
  test('"Student activity stream" label is displayed in the dashboard @smoke', async ({
    adminDashboardPage,
  }) => {
    await test.step('Verify "Student activity stream" label is visible', async () => {
      await expect(adminDashboardPage.activityStreamLabel).toBeVisible({ timeout: 12_000 });
    });
    await adminDashboardPage.page.screenshot({ path: 'test-results/screenshots/uc-act-03-activity-stream-label.png', fullPage: true });
  });

  // ── UC-ACT-04: Activity stream shows events or an empty-state message ─────
  test('activity stream renders events or the "No activity detected" state', async ({
    adminDashboardPage,
  }) => {
    await test.step('Wait for activity stream section to load', async () => {
      await expect(adminDashboardPage.activityStreamLabel).toBeVisible({ timeout: 12_000 });
    });
    await test.step('Verify stream has events or empty-state message', async () => {
      const eventIcon     = adminDashboardPage.page.locator('[class*="rounded-xl"]').first();
      const noActivity    = adminDashboardPage.page.getByText(/no activity detected/i).first();
      const hasEvents     = await eventIcon.isVisible({ timeout: 3_000 }).catch(() => false);
      const hasEmptyState = await noActivity.isVisible({ timeout: 1_000 }).catch(() => false);
      expect(hasEvents || hasEmptyState).toBe(true);
    });
    await adminDashboardPage.page.screenshot({ path: 'test-results/screenshots/uc-act-04-activity-stream.png', fullPage: true });
  });

  // ── UC-ACT-05: Dashboard sidebar navigation is accessible ────────────────
  test('admin sidebar nav buttons are present on the dashboard @smoke', async ({
    adminUsersPage,
  }) => {
    await test.step('Click Dashboard nav button and wait for /admin URL', async () => {
      await adminUsersPage.navDashboard.click();
      await adminUsersPage.page.waitForURL(
        (url) => url.pathname === '/admin',
        { timeout: 8_000 },
      );
    });
    await test.step('Verify URL is exactly /admin', async () => {
      expect(adminUsersPage.page.url()).toMatch(/\/admin$/);
    });
    await adminUsersPage.page.screenshot({ path: 'test-results/screenshots/uc-act-05-sidebar-nav.png', fullPage: true });
  });

  // ── UC-ACT-06: KPI section renders without errors ────────────────────────
  test('KPI cards render on the admin dashboard', async ({
    adminDashboardPage,
  }) => {
    await test.step('Wait for dashboard heading to load', async () => {
      await expect(adminDashboardPage.pageHeading).toBeVisible({ timeout: 12_000 });
    });
    await test.step('Verify at least one KPI stat card is visible', async () => {
      const kpiSection = adminDashboardPage.page.getByText(/total learners|active today|study sessions/i).first();
      await expect(kpiSection).toBeVisible({ timeout: 12_000 });
    });
    await adminDashboardPage.page.screenshot({ path: 'test-results/screenshots/uc-act-06-kpi-cards.png', fullPage: true });
  });

  // ── UC-ACT-07: Regular user cannot access admin dashboard ────────────────
  test('regular user is redirected from the admin dashboard @smoke', async ({
    userPage,
  }) => {
    await test.step('Regular user navigates to /admin', async () => {
      await userPage.goto('/admin');
      await userPage.waitForURL(
        (url) => url.pathname.includes('/login') || url.pathname.includes('/dashboard'),
        { timeout: 10_000 },
      );
    });
    await test.step('Verify URL does not end with /admin', async () => {
      expect(userPage.url()).not.toMatch(/\/admin$/);
    });
    await userPage.screenshot({ path: 'test-results/screenshots/uc-act-07-user-redirected.png', fullPage: true });
  });
});
