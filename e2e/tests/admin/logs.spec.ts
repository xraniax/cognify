/**
 * tests/admin/logs.spec.ts
 *
 * Sprint 4 — UC: View Logs
 *
 * Validates the Admin Monitoring page (/admin/logs) — AdminLogs.jsx.
 *
 * Page structure:
 *  - Heading: "System Monitoring" (h1 with gradient span)
 *  - 4 system-stat cards: API Latency | CPU Cluster | Memory Load | Audit Events
 *  - 3 tabs: Audit Logs | User Behavior | Security
 *  - Audit tab: filter <select> + search input
 *  - Refresh button in header
 *
 * Tags:
 *  @smoke — subset run on every browser in CI
 */
import { test, expect } from '../../fixtures/index';

test.describe('View Logs (Admin Monitoring)', () => {

  // ── UC-LOG-01: Logs page is accessible for admin ──────────────────────────
  test('admin can access the monitoring page @smoke', async ({
    adminLogsPage,
  }) => {
    await test.step('Verify monitoring page URL', async () => {
      expect(adminLogsPage.page.url()).toContain('/admin/logs');
    });
    await adminLogsPage.page.screenshot({ path: 'test-results/screenshots/uc-log-01-accessible.png', fullPage: true });
  });

  // ── UC-LOG-02: "System Monitoring" heading is rendered ────────────────────
  test('System Monitoring heading is displayed @smoke', async ({
    adminLogsPage,
  }) => {
    await test.step('Verify "System Monitoring" heading is visible', async () => {
      await expect(adminLogsPage.pageHeading).toBeVisible({ timeout: 10_000 });
    });
    await adminLogsPage.page.screenshot({ path: 'test-results/screenshots/uc-log-02-heading.png', fullPage: true });
  });

  // ── UC-LOG-03: Refresh button is present ─────────────────────────────────
  test('Refresh button is present on the monitoring page @smoke', async ({
    adminLogsPage,
  }) => {
    await test.step('Verify Refresh button is visible', async () => {
      await expect(adminLogsPage.refreshButton).toBeVisible({ timeout: 8_000 });
    });
    await adminLogsPage.page.screenshot({ path: 'test-results/screenshots/uc-log-03-refresh-button.png', fullPage: true });
  });

  // ── UC-LOG-04: Three tab buttons are rendered ─────────────────────────────
  test('Audit Logs, User Behavior, and Security tabs are all visible @smoke', async ({
    adminLogsPage,
  }) => {
    await test.step('Verify all three monitoring tabs are visible', async () => {
      await expect(adminLogsPage.tabAudit).toBeVisible({ timeout: 8_000 });
      await expect(adminLogsPage.tabBehavior).toBeVisible();
      await expect(adminLogsPage.tabSecurity).toBeVisible();
    });
    await adminLogsPage.page.screenshot({ path: 'test-results/screenshots/uc-log-04-tab-buttons.png', fullPage: true });
  });

  // ── UC-LOG-05: Audit Logs tab is active by default ───────────────────────
  test('Audit Logs tab is the default active tab', async ({
    adminLogsPage,
  }) => {
    await test.step('Verify search input and filter select are visible (Audit tab default)', async () => {
      await expect(adminLogsPage.searchInput).toBeVisible({ timeout: 8_000 });
      await expect(adminLogsPage.filterSelect).toBeVisible();
    });
    await adminLogsPage.page.screenshot({ path: 'test-results/screenshots/uc-log-05-audit-default.png', fullPage: true });
  });

  // ── UC-LOG-06: Filter select has the expected options ────────────────────
  test('audit filter select contains All Events, Informational, Warnings, Critical', async ({
    adminLogsPage,
  }) => {
    await test.step('Verify filter select is visible', async () => {
      await expect(adminLogsPage.filterSelect).toBeVisible({ timeout: 8_000 });
    });
    await test.step('Verify all four filter options are present', async () => {
      const options = await adminLogsPage.filterSelect.locator('option').allTextContents();
      expect(options.some(o => /all events/i.test(o))).toBe(true);
      expect(options.some(o => /informational/i.test(o))).toBe(true);
      expect(options.some(o => /warnings/i.test(o))).toBe(true);
      expect(options.some(o => /critical/i.test(o))).toBe(true);
    });
    await adminLogsPage.page.screenshot({ path: 'test-results/screenshots/uc-log-06-filter-options.png', fullPage: true });
  });

  // ── UC-LOG-07: Search input has the expected placeholder ─────────────────
  test('search input placeholder is "Search by action, user…"', async ({
    adminLogsPage,
  }) => {
    await test.step('Verify search input is visible', async () => {
      await expect(adminLogsPage.searchInput).toBeVisible({ timeout: 8_000 });
    });
    await test.step('Verify search placeholder text', async () => {
      const placeholder = await adminLogsPage.searchInput.getAttribute('placeholder');
      expect(placeholder).toMatch(/search by action, user/i);
    });
    await adminLogsPage.page.screenshot({ path: 'test-results/screenshots/uc-log-07-search-placeholder.png', fullPage: true });
  });

  // ── UC-LOG-08: Clicking User Behavior tab renders content ────────────────
  test('clicking the User Behavior tab renders the engagement view', async ({
    adminLogsPage,
  }) => {
    await test.step('Click the User Behavior tab', async () => {
      await adminLogsPage.tabBehavior.click();
    });
    await test.step('Verify Engagement Pulse section is visible', async () => {
      const engagementLabel = adminLogsPage.page.getByText(/engagement pulse/i).first();
      await expect(engagementLabel).toBeVisible({ timeout: 8_000 });
    });
    await adminLogsPage.page.screenshot({ path: 'test-results/screenshots/uc-log-08-behavior-tab.png', fullPage: true });
  });

  // ── UC-LOG-09: Clicking Security tab renders content ─────────────────────
  test('clicking the Security tab renders the threat view', async ({
    adminLogsPage,
  }) => {
    await test.step('Click the Security tab', async () => {
      await adminLogsPage.tabSecurity.click();
    });
    await test.step('Verify Threat Hotspots section is visible', async () => {
      const threatLabel = adminLogsPage.page.getByText(/threat hotspots/i).first();
      await expect(threatLabel).toBeVisible({ timeout: 8_000 });
    });
    await adminLogsPage.page.screenshot({ path: 'test-results/screenshots/uc-log-09-security-tab.png', fullPage: true });
  });

  // ── UC-LOG-10: Clicking Refresh triggers a data reload ───────────────────
  test('clicking Refresh does not crash the monitoring page', async ({
    adminLogsPage,
  }) => {
    await test.step('Click the Refresh button', async () => {
      await adminLogsPage.refreshButton.click();
    });
    await test.step('Verify heading is still visible after refresh', async () => {
      await expect(adminLogsPage.pageHeading).toBeVisible({ timeout: 15_000 });
    });
    await adminLogsPage.page.screenshot({ path: 'test-results/screenshots/uc-log-10-after-refresh.png', fullPage: true });
  });

  // ── UC-LOG-11: Regular user cannot access admin logs ────────────────────
  test('regular user is redirected away from /admin/logs @smoke', async ({
    userPage,
  }) => {
    await test.step('Regular user navigates to /admin/logs', async () => {
      await userPage.goto('/admin/logs');
      await userPage.waitForURL(
        (url) => url.pathname.includes('/login') || url.pathname.includes('/dashboard'),
        { timeout: 10_000 },
      );
    });
    await test.step('Verify URL does not contain /admin/logs', async () => {
      expect(userPage.url()).not.toContain('/admin/logs');
    });
    await userPage.screenshot({ path: 'test-results/screenshots/uc-log-11-user-redirected.png', fullPage: true });
  });
});
