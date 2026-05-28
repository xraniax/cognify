/**
 * tests/admin/admin-panel.spec.ts
 *
 * Tests the admin panel: access control, sidebar navigation, and CRUD visibility.
 *
 * Key facts about AdminLayout:
 *  - Sidebar nav items are <button onClick={navigate}> — NOT <Link> components
 *  - Nav labels: Dashboard | Users | Files | Monitoring | System Rules
 *  - Use `adminUsersPage.page` (not the default `page` fixture) for all URL
 *    assertions because the adminUsersPage fixture owns its own browser context.
 */
import { test, expect } from '../../fixtures/index';

test.describe('Admin panel', () => {

  // ── UC-ADMIN-01: Admin can access the admin panel ─────────────────────────
  test('admin user reaches /admin/users without redirect @smoke', async ({
    adminUsersPage,
  }) => {
    await test.step('Verify URL contains /admin', async () => {
      expect(adminUsersPage.page.url()).toContain('/admin');
    });
    await test.step('Verify logout button is visible', async () => {
      await expect(adminUsersPage.logoutButton).toBeVisible();
    });
    await adminUsersPage.page.screenshot({ path: 'test-results/screenshots/uc-admin-01-access.png', fullPage: true });
  });

  // ── UC-ADMIN-02: Admin sidebar navigation is visible ─────────────────────
  test('admin sidebar renders all navigation buttons @smoke', async ({
    adminUsersPage,
  }) => {
    await test.step('Verify all sidebar nav buttons', async () => {
      await expect(adminUsersPage.navUsers).toBeVisible();
      await expect(adminUsersPage.navFiles).toBeVisible();
      await expect(adminUsersPage.navLogs).toBeVisible();
      await expect(adminUsersPage.navSettings).toBeVisible();
    });
    await adminUsersPage.page.screenshot({ path: 'test-results/screenshots/uc-admin-02-sidebar.png', fullPage: true });
  });

  // ── UC-ADMIN-03: Regular user cannot access admin routes ─────────────────
  test('regular user is redirected away from /admin', async ({
    userPage,
  }) => {
    await test.step('Regular user navigates to /admin', async () => {
      await userPage.goto('/admin');
      await userPage.waitForURL(
        (url) => url.pathname.includes('/login') || url.pathname.includes('/dashboard'),
        { timeout: 10_000 },
      );
    });
    await test.step('Verify redirect away from /admin', async () => {
      expect(userPage.url()).not.toMatch(/\/admin\//);
    });
    await userPage.screenshot({ path: 'test-results/screenshots/uc-admin-03-user-blocked.png', fullPage: true });
  });

  // ── UC-ADMIN-04: Unauthenticated user cannot access admin routes ──────────
  test('unauthenticated visitor is redirected from /admin to /login @smoke', async ({
    page,
  }) => {
    await test.step('Navigate to /admin/users as guest', async () => {
      await page.goto('/admin/users');
      await page.waitForURL((url) => url.pathname.includes('/login'), { timeout: 10_000 });
    });
    await test.step('Verify redirect to /login', async () => {
      expect(page.url()).toContain('/login');
    });
    await page.screenshot({ path: 'test-results/screenshots/uc-admin-04-guest-blocked.png', fullPage: true });
  });

  // ── UC-ADMIN-05: Admin navigates to Files page ─────────────────────────────
  test('clicking Files button navigates to /admin/files', async ({
    adminUsersPage,
  }) => {
    await test.step('Click the Files nav button', async () => {
      await adminUsersPage.navFiles.click();
      await adminUsersPage.page.waitForURL(
        (url) => url.pathname.includes('/admin/files'),
        { timeout: 10_000 },
      );
    });
    await test.step('Verify navigation to /admin/files', async () => {
      expect(adminUsersPage.page.url()).toContain('/admin/files');
    });
    await adminUsersPage.page.screenshot({ path: 'test-results/screenshots/uc-admin-05-files-nav.png', fullPage: true });
  });

  // ── UC-ADMIN-06: Admin navigates to Monitoring (Logs) page ────────────────
  test('clicking Monitoring button navigates to /admin/logs', async ({
    adminUsersPage,
  }) => {
    await test.step('Click the Monitoring nav button', async () => {
      await adminUsersPage.navLogs.click();
      await adminUsersPage.page.waitForURL(
        (url) => url.pathname.includes('/admin/logs'),
        { timeout: 10_000 },
      );
    });
    await test.step('Verify navigation to /admin/logs', async () => {
      expect(adminUsersPage.page.url()).toContain('/admin/logs');
    });
    await adminUsersPage.page.screenshot({ path: 'test-results/screenshots/uc-admin-06-logs-nav.png', fullPage: true });
  });

  // ── UC-ADMIN-07: Admin panel logout works ─────────────────────────────────
  test('admin can logout from the admin panel @smoke', async ({
    adminUsersPage,
  }) => {
    await test.step('Click logout in admin panel', async () => {
      await adminUsersPage.logout();
    });
    await test.step('Verify redirect to /login', async () => {
      expect(adminUsersPage.page.url()).toContain('/login');
    });
    await adminUsersPage.page.screenshot({ path: 'test-results/screenshots/uc-admin-07-logout.png', fullPage: true });
  });
});
