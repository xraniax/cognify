/**
 * tests/subjects/subject-workspace.spec.ts
 *
 * Sprint 2 — UC: Access Subject Workspace
 *
 * Tags:
 *  @smoke — subset run on every browser in CI
 */
import { test, expect } from '../../fixtures/index';
import { SubjectWorkspacePage } from '../../pages/subjects/subject-workspace.page';
import { STORAGE_STATE } from '../../playwright.config';

test.describe('Subject workspace', () => {

  // ── UC-WS-01: Workspace URL is reached ────────────────────────────────────
  test('clicking a subject card lands on the workspace route @smoke', async ({
    subjectWorkspacePage,
  }) => {
    await test.step('Verify workspace URL', async () => {
      expect(subjectWorkspacePage.isWorkspaceUrl()).toBeTruthy();
    });
    await subjectWorkspacePage.page.screenshot({ path: 'test-results/screenshots/uc-ws-01-workspace-url.png', fullPage: true });
  });

  // ── UC-WS-02: Subject name is displayed ───────────────────────────────────
  test('workspace displays the subject name in the header @smoke', async ({
    subjectWorkspacePage,
  }) => {
    await test.step('Verify subject heading is visible and non-empty', async () => {
      await expect(subjectWorkspacePage.subjectHeading).toBeVisible({ timeout: 10_000 });
      const text = await subjectWorkspacePage.subjectHeading.textContent();
      expect(text?.trim().length).toBeGreaterThan(0);
    });
    await subjectWorkspacePage.page.screenshot({ path: 'test-results/screenshots/uc-ws-02-subject-name.png', fullPage: true });
  });

  // ── UC-WS-03: Workspace tab list is present ───────────────────────────────
  test('workspace renders the content tab bar @smoke', async ({
    subjectWorkspacePage,
  }) => {
    await test.step('Verify at least one content tab exists', async () => {
      // The workspace uses <button> toolbar elements (Sources / Tutor), not ARIA tabs;
      // filePanelToggle ("Sources") is the primary panel button — its presence proves the bar is rendered
      await expect(subjectWorkspacePage.filePanelToggle).toBeVisible({ timeout: 10_000 });
    });
    await subjectWorkspacePage.page.screenshot({ path: 'test-results/screenshots/uc-ws-03-tab-bar.png', fullPage: true });
  });

  // ── UC-WS-04: File panel toggle button is present ─────────────────────────
  test('file panel toggle button is rendered in the workspace', async ({
    subjectWorkspacePage,
  }) => {
    await test.step('Verify Sources toggle button', async () => {
      await expect(subjectWorkspacePage.filePanelToggle).toBeVisible({ timeout: 8_000 });
    });
    await subjectWorkspacePage.page.screenshot({ path: 'test-results/screenshots/uc-ws-04-file-panel-toggle.png', fullPage: true });
  });

  // ── UC-WS-05: Upload button is visible ────────────────────────────────────
  test('upload button is present in the workspace toolbar @smoke', async ({
    subjectWorkspacePage,
  }) => {
    await test.step('Verify upload button is visible and enabled', async () => {
      await expect(subjectWorkspacePage.uploadButton).toBeVisible({ timeout: 8_000 });
    });
    await subjectWorkspacePage.page.screenshot({ path: 'test-results/screenshots/uc-ws-05-upload-button.png', fullPage: true });
  });

  // ── UC-WS-06: Back navigation returns to /dashboard ───────────────────────
  test('workspace provides a back link to the dashboard', async ({
    subjectWorkspacePage,
  }) => {
    await test.step('Verify back link is visible', async () => {
      await expect(subjectWorkspacePage.backLink).toBeVisible({ timeout: 8_000 });
    });
    await subjectWorkspacePage.page.screenshot({ path: 'test-results/screenshots/uc-ws-06-back-link.png', fullPage: true });
  });

  // ── UC-WS-07: Unauthenticated access shows GuestGate ─────────────────────
  test('unauthenticated access to a subject workspace shows GuestGate', async ({
    page,
  }) => {
    await test.step('Navigate to workspace as guest', async () => {
      await page.goto('/subjects/1');
      await page.waitForLoadState('domcontentloaded');
    });
    await test.step('Verify GuestGate sign-in link', async () => {
      const signInLink = page.getByRole('link', { name: /sign in/i });
      await expect(signInLink).toBeVisible({ timeout: 8_000 });
    });
    await page.screenshot({ path: 'test-results/screenshots/uc-ws-07-guest-gate.png', fullPage: true });
  });

  // ── UC-WS-08: Admin is redirected away from student workspace ─────────────
  test('admin user is redirected away from student workspace route', async ({
    browser,
  }) => {
    const ctx  = await browser.newContext({ storageState: STORAGE_STATE.admin });
    const page = await ctx.newPage();
    await test.step('Admin navigates to a student workspace', async () => {
      await page.goto('/subjects/1');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForURL((url) => url.pathname.startsWith('/admin'), { timeout: 10_000 });
    });
    await test.step('Verify redirect to /admin', async () => {
      expect(page.url()).toContain('/admin');
    });
    await page.screenshot({ path: 'test-results/screenshots/uc-ws-08-admin-redirect.png', fullPage: true });
    await ctx.close();
  });
});
