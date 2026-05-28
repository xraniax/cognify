/**
 * tests/auth/logout.spec.ts
 *
 * Verifies logout behaviour: redirect, session clearing, and
 * that admin routes are inaccessible after logout.
 */
import { test, expect } from '../../fixtures/index';

test.describe('Logout flow', () => {

  // ── UC-LOGOUT-01: Logout redirects to /login ──────────────────────────────
  test('clicking logout redirects to /login @smoke', async ({ dashboardPage }) => {
    await test.step('Click logout from dashboard', async () => {
      await dashboardPage.logout();
    });
    await test.step('Verify redirect to /login', async () => {
      expect(dashboardPage.page.url()).toContain('/login');
    });
    await dashboardPage.page.screenshot({ path: 'test-results/screenshots/uc-logout-01-redirect.png', fullPage: true });
  });

  // ── UC-LOGOUT-02: Session is cleared ──────────────────────────────────────
  test('after logout, accessing admin route redirects to /login', async ({
    dashboardPage,
  }) => {
    await test.step('Logout from dashboard', async () => {
      await dashboardPage.logout();
    });
    await test.step('Attempt to access /admin/users after logout', async () => {
      await dashboardPage.page.goto('/admin/users');
      await dashboardPage.page.waitForURL(
        (url) => url.pathname.includes('/login'),
        { timeout: 10_000 },
      );
    });
    await test.step('Verify redirect to /login', async () => {
      expect(dashboardPage.page.url()).toContain('/login');
    });
    await dashboardPage.page.screenshot({ path: 'test-results/screenshots/uc-logout-02-session-cleared.png', fullPage: true });
  });

  // ── UC-LOGOUT-03: Token removed from localStorage ─────────────────────────
  test('localStorage token is removed after logout', async ({ dashboardPage }) => {
    let tokenBefore: string | null;
    await test.step('Verify token exists before logout', async () => {
      tokenBefore = await dashboardPage.page.evaluate(() => localStorage.getItem('token'));
      expect(tokenBefore).not.toBeNull();
    });
    await test.step('Logout from dashboard', async () => {
      await dashboardPage.logout();
    });
    await test.step('Verify token is removed from localStorage', async () => {
      const tokenAfter = await dashboardPage.page.evaluate(() => localStorage.getItem('token'));
      expect(tokenAfter).toBeNull();
    });
    await dashboardPage.page.screenshot({ path: 'test-results/screenshots/uc-logout-03-token-removed.png', fullPage: true });
  });

  // ── UC-LOGOUT-04: Admin panel logout ──────────────────────────────────────
  test('admin can also logout from the admin panel @smoke', async ({
    adminUsersPage,
  }) => {
    await test.step('Logout from admin panel', async () => {
      await adminUsersPage.logout();
    });
    await test.step('Verify redirect to /login', async () => {
      expect(adminUsersPage.page.url()).toContain('/login');
    });
    await adminUsersPage.page.screenshot({ path: 'test-results/screenshots/uc-logout-04-admin-logout.png', fullPage: true });
  });
});
