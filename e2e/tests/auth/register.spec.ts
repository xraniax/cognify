/**
 * tests/auth/register.spec.ts
 *
 * Tests the /register page for all Sign-Up use cases.
 */
import { test, expect } from '../../fixtures/index';
import { USERS, REGISTRATION } from '../../test-data/users';
import { uniqueEmail } from '../../utils/api-client';

test.describe('Registration page', () => {

  // ── UC-REG-01: Successful registration ───────────────────────────────────
  test('valid data registers and redirects away from /register @smoke', async ({
    registerPage, page,
  }) => {
    const email = uniqueEmail('reg');
    await test.step('Fill registration form with valid data', async () => {
      await registerPage.register('New Student', email, REGISTRATION.validPassword);
    });
    await test.step('Verify redirect after registration', async () => {
      await registerPage.expectRedirectAway();
      expect(page.url()).not.toContain('/register');
    });
    await page.screenshot({ path: 'test-results/screenshots/uc-reg-01-success.png', fullPage: true });
  });

  // ── UC-REG-02: Duplicate email ────────────────────────────────────────────
  test('already-registered email shows a server error @smoke', async ({ registerPage }) => {
    await test.step('Submit with already-registered email', async () => {
      await registerPage.register('Duplicate User', USERS.regular.email, REGISTRATION.validPassword);
    });
    await test.step('Verify server error banner', async () => {
      await registerPage.expectGlobalError();
    });
    await registerPage.page.screenshot({ path: 'test-results/screenshots/uc-reg-02-duplicate-email.png', fullPage: true });
  });

  // ── UC-REG-03: Weak / short password ─────────────────────────────────────
  test('password shorter than 8 chars shows a field error', async ({ registerPage }) => {
    const email = uniqueEmail('weakpass');
    await test.step('Submit with a weak password', async () => {
      await registerPage.register('Weak Pass', email, REGISTRATION.weakPassword);
    });
    await test.step('Verify password field error', async () => {
      await registerPage.expectFieldError('password');
    });
    await registerPage.page.screenshot({ path: 'test-results/screenshots/uc-reg-03-weak-password.png', fullPage: true });
  });

  // ── UC-REG-04: Empty name ─────────────────────────────────────────────────
  test('missing name shows a field error', async ({ registerPage }) => {
    const email = uniqueEmail('noname');
    await test.step('Submit form without a name', async () => {
      await registerPage.fillEmail(email);
      await registerPage.fillPassword(REGISTRATION.validPassword);
      await registerPage.submit();
    });
    await test.step('Verify name field error', async () => {
      await registerPage.expectFieldError('name');
    });
    await registerPage.page.screenshot({ path: 'test-results/screenshots/uc-reg-04-missing-name.png', fullPage: true });
  });

  // ── UC-REG-05: Malformed email ────────────────────────────────────────────
  test('invalid email format shows a field error', async ({ registerPage }) => {
    await test.step('Submit with invalid email format', async () => {
      await registerPage.fillName('Someone');
      await registerPage.fillEmail('not-valid-email');
      await registerPage.fillPassword(REGISTRATION.validPassword);
      await registerPage.submit();
    });
    await test.step('Verify email field error', async () => {
      await registerPage.expectFieldError('email');
    });
    await registerPage.page.screenshot({ path: 'test-results/screenshots/uc-reg-05-invalid-email.png', fullPage: true });
  });

  // ── UC-REG-06: Sign-in link navigates back ────────────────────────────────
  test('sign-in link navigates to /login', async ({ registerPage, page }) => {
    await test.step('Click the sign-in link', async () => {
      await expect(registerPage.loginLink).toBeVisible();
      await registerPage.loginLink.click();
      await page.waitForURL((url) => url.pathname.includes('/login'));
    });
    await test.step('Verify navigation to /login', async () => {
      expect(page.url()).toContain('/login');
    });
    await page.screenshot({ path: 'test-results/screenshots/uc-reg-06-signin-link.png', fullPage: true });
  });

  // ── UC-REG-07: Form structure ─────────────────────────────────────────────
  test('register form renders all required fields @smoke', async ({ registerPage }) => {
    await test.step('Verify all form fields are present', async () => {
      await expect(registerPage.nameInput).toBeVisible();
      await expect(registerPage.emailInput).toBeVisible();
      await expect(registerPage.passwordInput).toBeVisible();
      await expect(registerPage.submitButton).toBeEnabled();
    });
    await registerPage.page.screenshot({ path: 'test-results/screenshots/uc-reg-07-form-structure.png', fullPage: true });
  });
});
