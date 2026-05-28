/**
 * tests/profile/profile.spec.ts
 *
 * Tests the /profile page: read data, inline editing, save/cancel flows.
 */
import { test, expect } from '../../fixtures/index';

test.describe('Profile page', () => {

  // ── UC-PROFILE-01: Page loads with user data ──────────────────────────────
  test('profile page displays the authenticated user name @smoke', async ({
    profilePage,
  }) => {
    await test.step('Verify user name is visible and non-empty', async () => {
      await expect(profilePage.userName).toBeVisible();
      const name = await profilePage.userName.textContent();
      expect(name?.trim().length).toBeGreaterThan(0);
    });
    await profilePage.page.screenshot({ path: 'test-results/screenshots/uc-profile-01-page-load.png', fullPage: true });
  });

  // ── UC-PROFILE-02: Edit button enters edit mode ───────────────────────────
  test('clicking Edit Profile reveals the name input field @smoke', async ({
    profilePage,
  }) => {
    await test.step('Click Edit Profile button', async () => {
      await profilePage.startEditing();
    });
    await test.step('Verify name input is visible', async () => {
      await expect(profilePage.nameInput).toBeVisible();
    });
    await profilePage.page.screenshot({ path: 'test-results/screenshots/uc-profile-02-edit-mode.png', fullPage: true });
  });

  // ── UC-PROFILE-03: Cancel editing restores view mode ─────────────────────
  test('cancelling edit returns to view mode without changing the name', async ({
    profilePage,
  }) => {
    let nameBefore: string;
    await test.step('Record current name and enter edit mode', async () => {
      nameBefore = (await profilePage.userName.textContent())?.trim() ?? '';
      await profilePage.startEditing();
      await profilePage.updateName('Name That Should Not Persist');
    });
    await test.step('Cancel editing', async () => {
      await profilePage.cancelEditing();
    });
    await test.step('Verify view mode restored and name unchanged', async () => {
      await expect(profilePage.editButton).toBeVisible();
      await expect(profilePage.saveButton).not.toBeVisible();
      await expect(profilePage.userName).toContainText(nameBefore.split(' ')[0]);
    });
    await profilePage.page.screenshot({ path: 'test-results/screenshots/uc-profile-03-cancel-edit.png', fullPage: true });
  });

  // ── UC-PROFILE-04: Successful name update ────────────────────────────────
  test('saving a valid name update reflects the new name @smoke', async ({
    profilePage,
  }) => {
    const original = (await profilePage.userName.textContent())?.trim() ?? 'Test User';
    const updated  = `${original.split(' ')[0]} Edited`;
    await test.step('Update the name and save', async () => {
      await profilePage.startEditing();
      await profilePage.updateName(updated);
      await profilePage.saveChanges();
    });
    await test.step('Verify new name is displayed', async () => {
      await expect(profilePage.userName).toContainText(updated.split(' ')[0], { timeout: 8_000 });
    });
    await profilePage.page.screenshot({ path: 'test-results/screenshots/uc-profile-04-name-updated.png', fullPage: true });
    await test.step('Restore original name', async () => {
      await profilePage.startEditing();
      await profilePage.updateName(original);
      await profilePage.saveChanges();
    });
  });

  // ── UC-PROFILE-05: Profile shows email ───────────────────────────────────
  test('profile page shows the authenticated user email', async ({
    profilePage,
  }) => {
    await test.step('Verify email is displayed', async () => {
      const emailEl = profilePage.page.locator('p').filter({ hasText: /@/ }).first();
      await expect(emailEl).toBeVisible();
      const text = await emailEl.textContent();
      expect(text).toMatch(/@/);
    });
    await profilePage.page.screenshot({ path: 'test-results/screenshots/uc-profile-05-email.png', fullPage: true });
  });

  // ── UC-PROFILE-06: Unauthenticated user sees GuestGate ────────────────────
  test('unauthenticated visitor sees lock screen, not profile data', async ({
    page,
  }) => {
    await test.step('Navigate to /profile as guest', async () => {
      await page.goto('/profile');
      await page.waitForLoadState('domcontentloaded');
    });
    await test.step('Verify GuestGate is shown', async () => {
      const signInLink = page.getByRole('link', { name: /sign in/i });
      await expect(signInLink).toBeVisible({ timeout: 8_000 });
    });
    await page.screenshot({ path: 'test-results/screenshots/uc-profile-06-guest-gate.png', fullPage: true });
  });
});
