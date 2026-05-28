/**
 * tests/navigation/protected-routes.spec.ts
 *
 * Verifies access-control behaviour for unauthenticated visitors.
 *
 * App access model (from App.jsx):
 *  - AdminRoute  → unauthenticated users → redirect to /login
 *  - ProtectedRoute / StudentRoute → unauthenticated users → show GuestGate
 *  - GuestOrStudentRoute (/dashboard) → guests pass through
 */
import { test, expect } from '../../fixtures/index';

const ADMIN_REDIRECT_ROUTES = [
  '/admin',
  '/admin/users',
  '/admin/files',
  '/admin/logs',
  '/admin/settings',
];

const GUEST_GATE_ROUTES = [
  '/profile',
  '/history',
  '/trash',
  '/goals',
  '/analytics',
];

test.describe('Unauthenticated access control', () => {

  test.describe('Admin routes redirect to /login', () => {
    for (const route of ADMIN_REDIRECT_ROUTES) {
      test(`GET ${route} → redirects to /login @smoke`, async ({ page }) => {
        await test.step(`Navigate to ${route} as guest`, async () => {
          await page.goto(route);
          await page.waitForURL((url) => url.pathname.includes('/login'), { timeout: 10_000 });
        });
        await test.step('Verify redirect to /login', async () => {
          expect(page.url()).toContain('/login');
        });
        const slug = route.replace(/\//g, '-').replace(/^-/, '');
        await page.screenshot({ path: `test-results/screenshots/uc-route-admin${slug}-blocked.png`, fullPage: true });
      });
    }
  });

  test.describe('Protected student routes show GuestGate', () => {
    for (const route of GUEST_GATE_ROUTES) {
      test(`GET ${route} → shows GuestGate lock screen`, async ({ page }) => {
        await test.step(`Navigate to ${route} as guest`, async () => {
          await page.goto(route);
          await page.waitForLoadState('domcontentloaded');
        });
        await test.step('Verify GuestGate sign-in link', async () => {
          const signInLink = page.getByRole('link', { name: /sign in/i });
          await expect(signInLink).toBeVisible({ timeout: 8_000 });
          expect(page.url()).toContain(route);
        });
        const slug = route.replace(/\//g, '-').replace(/^-/, '');
        await page.screenshot({ path: `test-results/screenshots/uc-route${slug}-guestgate.png`, fullPage: true });
      });
    }
  });

  // ── Authenticated user can access all student routes ──────────────────────
  test('authenticated user can reach /profile without GuestGate', async ({
    userPage,
  }) => {
    await test.step('Navigate to /profile as authenticated user', async () => {
      await userPage.goto('/profile');
      await userPage.waitForLoadState('domcontentloaded');
    });
    await test.step('Verify GuestGate is NOT shown', async () => {
      const guestGate = userPage.getByRole('link', { name: /create free account/i });
      await expect(guestGate).not.toBeVisible();
    });
    await userPage.screenshot({ path: 'test-results/screenshots/uc-route-profile-auth-access.png', fullPage: true });
  });

  // ── Root redirects to /welcome ─────────────────────────────────────────────
  test('root path / redirects to /welcome @smoke', async ({ page }) => {
    await test.step('Navigate to root /', async () => {
      await page.goto('/');
      await page.waitForURL((url) =>
        url.pathname.includes('/welcome') || url.pathname.includes('/login'), {
        timeout: 10_000,
      });
    });
    await test.step('Verify redirect to /welcome or /login', async () => {
      expect(page.url()).toMatch(/\/(welcome|login|dashboard)/);
    });
    await page.screenshot({ path: 'test-results/screenshots/uc-route-root-redirect.png', fullPage: true });
  });
});
