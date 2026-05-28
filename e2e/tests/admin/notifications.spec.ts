/**
 * tests/admin/notifications.spec.ts
 *
 * Sprint 4 — UC: View Notifications
 *
 * Validates the System Alerts notification bell in the AdminLayout header.
 * The bell button opens a dropdown showing:
 *  - "System Alerts" heading
 *  - Active alert count ("N active") or "All clear" when there are none
 *  - Notification items (or "System Nominal" empty state)
 *  - A "View all in Monitoring" footer button that navigates to /admin/logs
 *
 * Tags:
 *  @smoke — subset run on every browser in CI
 */
import { test, expect } from '../../fixtures/index';

test.describe('View Notifications (Admin Alert Centre)', () => {

  // ── UC-NOTIF-01: Admin dashboard loads ───────────────────────────────────
  test('admin dashboard page is accessible @smoke', async ({
    adminDashboardPage,
  }) => {
    await test.step('Verify admin dashboard URL', async () => {
      expect(adminDashboardPage.page.url()).toContain('/admin');
    });
    await adminDashboardPage.page.screenshot({ path: 'test-results/screenshots/uc-notif-01-admin-loads.png', fullPage: true });
  });

  // ── UC-NOTIF-02: Notification bell button is rendered ────────────────────
  test('notification bell button is present in the admin header @smoke', async ({
    adminDashboardPage,
  }) => {
    await test.step('Verify notification bell button is visible', async () => {
      await expect(adminDashboardPage.notificationBell).toBeVisible({ timeout: 8_000 });
    });
    await adminDashboardPage.page.screenshot({ path: 'test-results/screenshots/uc-notif-02-bell-visible.png', fullPage: true });
  });

  // ── UC-NOTIF-03: Clicking the bell opens the dropdown ────────────────────
  test('clicking the notification bell opens the System Alerts dropdown @smoke', async ({
    adminDashboardPage,
  }) => {
    await test.step('Click the notification bell', async () => {
      await adminDashboardPage.openNotifications();
    });
    await test.step('Verify System Alerts dropdown header is visible', async () => {
      await expect(adminDashboardPage.notificationDropdownHeader).toBeVisible({ timeout: 6_000 });
    });
    await adminDashboardPage.page.screenshot({ path: 'test-results/screenshots/uc-notif-03-dropdown-open.png', fullPage: true });
  });

  // ── UC-NOTIF-04: Dropdown shows active count or "All clear" ──────────────
  test('notification dropdown shows alert count or "All clear" status', async ({
    adminDashboardPage,
  }) => {
    await test.step('Open the notification dropdown', async () => {
      await adminDashboardPage.openNotifications();
      await expect(adminDashboardPage.notificationDropdownHeader).toBeVisible({ timeout: 6_000 });
    });
    await test.step('Verify alert count badge or All clear or System Nominal is shown', async () => {
      const allClear      = adminDashboardPage.page.getByText(/all clear/i).first();
      const countBadge    = adminDashboardPage.page.getByText(/\d+ active/i).first();
      const systemNominal = adminDashboardPage.page.getByText(/system nominal/i).first();

      const hasAllClear  = await allClear.isVisible({ timeout: 5_000 }).catch(() => false);
      const hasCount     = await countBadge.isVisible({ timeout: 1_000 }).catch(() => false);
      const hasNominal   = await systemNominal.isVisible({ timeout: 1_000 }).catch(() => false);
      expect(hasAllClear || hasCount || hasNominal).toBe(true);
    });
    await adminDashboardPage.page.screenshot({ path: 'test-results/screenshots/uc-notif-04-alert-status.png', fullPage: true });
  });

  // ── UC-NOTIF-05: "View all in Monitoring" link is in the dropdown ─────────
  test('notification dropdown has a "View all in Monitoring" footer button', async ({
    adminDashboardPage,
  }) => {
    await test.step('Open the notification dropdown', async () => {
      await adminDashboardPage.openNotifications();
      await expect(adminDashboardPage.notificationDropdownHeader).toBeVisible({ timeout: 6_000 });
    });
    await test.step('Verify "View all in Monitoring" button is visible', async () => {
      await expect(adminDashboardPage.viewAllInMonitoringBtn).toBeVisible({ timeout: 5_000 });
    });
    await adminDashboardPage.page.screenshot({ path: 'test-results/screenshots/uc-notif-05-view-all-btn.png', fullPage: true });
  });

  // ── UC-NOTIF-06: "View all in Monitoring" navigates to /admin/logs ────────
  test('clicking "View all in Monitoring" navigates to the logs page', async ({
    adminDashboardPage,
  }) => {
    await test.step('Open the notification dropdown', async () => {
      await adminDashboardPage.openNotifications();
      await expect(adminDashboardPage.notificationDropdownHeader).toBeVisible({ timeout: 6_000 });
    });
    await test.step('Click "View all in Monitoring"', async () => {
      await adminDashboardPage.viewAllInMonitoringBtn.click();
      await adminDashboardPage.page.waitForURL(
        (url) => url.pathname.includes('/admin/logs'),
        { timeout: 10_000 },
      );
    });
    await test.step('Verify URL navigated to /admin/logs', async () => {
      expect(adminDashboardPage.page.url()).toContain('/admin/logs');
    });
    await adminDashboardPage.page.screenshot({ path: 'test-results/screenshots/uc-notif-06-navigate-to-logs.png', fullPage: true });
  });

  // ── UC-NOTIF-07: Unauthenticated access shows no bell ────────────────────
  test('regular user cannot reach the admin notification bell @smoke', async ({
    userPage,
  }) => {
    await test.step('Regular user attempts to access /admin', async () => {
      await userPage.goto('/admin');
      await userPage.waitForURL(
        (url) => url.pathname.includes('/login') || url.pathname.includes('/dashboard'),
        { timeout: 10_000 },
      );
    });
    await test.step('Verify user is redirected away from /admin', async () => {
      expect(userPage.url()).not.toContain('/admin');
    });
    await userPage.screenshot({ path: 'test-results/screenshots/uc-notif-07-user-redirected.png', fullPage: true });
  });
});
