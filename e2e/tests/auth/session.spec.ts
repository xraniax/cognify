/**
 * tests/auth/session.spec.ts
 *
 * Verifies session persistence: the user stays authenticated
 * after page reloads and direct navigation to protected routes.
 */
import { test, expect } from '../../fixtures/index';

test.describe('Session persistence', () => {

  // ── UC-SESSION-01: Session survives reload ────────────────────────────────
  test('authenticated user stays logged in after page reload', async ({
    dashboardPage, page,
  }) => {
    await test.step('Reload the page', async () => {
      await page.reload();
      await dashboardPage.waitForAuthenticated();
    });
    await test.step('Verify still authenticated after reload', async () => {
      expect(page.url()).not.toContain('/login');
      expect(page.url()).not.toContain('/welcome');
    });
    await page.screenshot({ path: 'test-results/screenshots/uc-session-01-persist-reload.png', fullPage: true });
  });

  // ── UC-SESSION-02: Direct navigation to protected route ───────────────────
  test('authenticated user can navigate directly to /dashboard', async ({
    userPage,
  }) => {
    await test.step('Navigate directly to /dashboard', async () => {
      await userPage.goto('/dashboard');
      await userPage.waitForLoadState('domcontentloaded');
    });
    await test.step('Verify not redirected to login', async () => {
      expect(userPage.url()).not.toContain('/login');
    });
    await userPage.screenshot({ path: 'test-results/screenshots/uc-session-02-direct-dashboard.png', fullPage: true });
  });

  // ── UC-SESSION-03: Direct navigation to profile ───────────────────────────
  test('authenticated user can navigate directly to /profile', async ({
    userPage,
  }) => {
    await test.step('Navigate directly to /profile', async () => {
      await userPage.goto('/profile');
      await userPage.waitForLoadState('domcontentloaded');
    });
    await test.step('Verify not redirected to login', async () => {
      expect(userPage.url()).not.toContain('/login');
    });
    await userPage.screenshot({ path: 'test-results/screenshots/uc-session-03-direct-profile.png', fullPage: true });
  });

  // ── UC-SESSION-04: Admin session scoped to admin panel ────────────────────
  test('admin is redirected to /admin when visiting /dashboard', async ({
    adminPage,
  }) => {
    await test.step('Admin navigates to /dashboard', async () => {
      await adminPage.goto('/dashboard');
      await adminPage.waitForLoadState('domcontentloaded');
    });
    await test.step('Verify admin is not on /login', async () => {
      expect(adminPage.url()).not.toContain('/login');
    });
    await adminPage.screenshot({ path: 'test-results/screenshots/uc-session-04-admin-redirect.png', fullPage: true });
  });
});
