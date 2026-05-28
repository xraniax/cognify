/**
 * tests/auth/login.spec.ts
 *
 * Tests the /login page for all defined Sign-In use cases.
 *
 * Tags:
 *  @smoke — subset run on every browser in CI
 */
import { test, expect } from '../../fixtures/index';
import { USERS } from '../../test-data/users';

test.describe('Login page', () => {

  // ── UC-LOGIN-01: Successful login ─────────────────────────────────────────
  test('valid credentials redirect to the dashboard @smoke', async ({ loginPage, page }) => {
    await test.step('Submit valid credentials', async () => {
      await loginPage.login(USERS.regular.email, USERS.regular.password);
      await loginPage.expectRedirectAway();
    });
    await test.step('Verify redirect away from /login', async () => {
      expect(page.url()).not.toContain('/login');
    });
    await page.screenshot({ path: 'test-results/screenshots/uc-login-01-success.png', fullPage: true });
  });

  // ── UC-LOGIN-02: Wrong password ───────────────────────────────────────────
  test('wrong password shows a server-side error banner @smoke', async ({ loginPage }) => {
    await test.step('Submit wrong password', async () => {
      await loginPage.login(
        USERS.invalid.wrongPassword.email,
        USERS.invalid.wrongPassword.password,
      );
    });
    await test.step('Verify error banner is shown', async () => {
      await loginPage.expectGlobalError();
    });
    await loginPage.page.screenshot({ path: 'test-results/screenshots/uc-login-02-wrong-password.png', fullPage: true });
  });

  // ── UC-LOGIN-03: Non-existent email ───────────────────────────────────────
  test('unknown email shows a server-side error banner', async ({ loginPage }) => {
    await test.step('Submit unknown email', async () => {
      await loginPage.login(
        USERS.invalid.nonExistentEmail.email,
        USERS.invalid.nonExistentEmail.password,
      );
    });
    await test.step('Verify error banner', async () => {
      await loginPage.expectGlobalError();
    });
    await loginPage.page.screenshot({ path: 'test-results/screenshots/uc-login-03-unknown-email.png', fullPage: true });
  });

  // ── UC-LOGIN-04: Empty form submission ────────────────────────────────────
  test('empty form submission stays on /login', async ({ loginPage, page }) => {
    await test.step('Submit empty form', async () => {
      await loginPage.submit();
    });
    await test.step('Verify still on /login', async () => {
      expect(page.url()).toContain('/login');
    });
    await page.screenshot({ path: 'test-results/screenshots/uc-login-04-empty-form.png', fullPage: true });
  });

  // ── UC-LOGIN-05: Malformed email shows inline field error ─────────────────
  test('malformed email triggers inline field validation', async ({ loginPage }) => {
    await test.step('Fill malformed email and submit', async () => {
      await loginPage.fillEmail('not-an-email');
      await loginPage.fillPassword('anything');
      await loginPage.submit();
    });
    await test.step('Verify field error is visible', async () => {
      await loginPage.expectFieldError();
    });
    await loginPage.page.screenshot({ path: 'test-results/screenshots/uc-login-05-malformed-email.png', fullPage: true });
  });

  // ── UC-LOGIN-06: Register link navigates correctly ────────────────────────
  test('register link navigates to /register', async ({ loginPage, page }) => {
    await test.step('Click the register link', async () => {
      await expect(loginPage.registerLink).toBeVisible();
      await loginPage.registerLink.click();
      await page.waitForURL((url) => url.pathname.includes('/register'));
    });
    await test.step('Verify navigation to /register', async () => {
      expect(page.url()).toContain('/register');
    });
    await page.screenshot({ path: 'test-results/screenshots/uc-login-06-register-link.png', fullPage: true });
  });

  // ── UC-LOGIN-07: Forgot password link is visible ──────────────────────────
  test('forgot-password link is present', async ({ loginPage }) => {
    await test.step('Verify forgot-password link is visible', async () => {
      await expect(loginPage.forgotLink).toBeVisible();
    });
    await loginPage.page.screenshot({ path: 'test-results/screenshots/uc-login-07-forgot-link.png', fullPage: true });
  });

  // ── UC-LOGIN-08: Page structure ───────────────────────────────────────────
  test('login form has all required fields @smoke', async ({ loginPage }) => {
    await test.step('Verify all form elements are present', async () => {
      await expect(loginPage.emailInput).toBeVisible();
      await expect(loginPage.passwordInput).toBeVisible();
      await expect(loginPage.submitButton).toBeVisible();
      await expect(loginPage.submitButton).toBeEnabled();
    });
    await loginPage.page.screenshot({ path: 'test-results/screenshots/uc-login-08-form-structure.png', fullPage: true });
  });
});
