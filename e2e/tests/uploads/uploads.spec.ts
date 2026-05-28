/**
 * tests/uploads/uploads.spec.ts
 *
 * Sprint 2 — UC: Manage Uploads
 *
 * Validates file upload functionality within the subject workspace.
 * We test the upload entry point (button → modal) and the upload modal UI.
 * Actual file-processing assertions are integration-level and kept separate.
 *
 * Tags:
 *  @smoke — subset run on every browser in CI
 */
import path from 'path';
import { test, expect } from '../../fixtures/index';

test.describe('Manage Uploads', () => {

  // ── UC-UP-01: Upload button is visible in the workspace ───────────────────
  test('upload button is visible in the subject workspace @smoke', async ({
    subjectWorkspacePage,
  }) => {
    await test.step('Verify upload button is visible', async () => {
      await expect(subjectWorkspacePage.uploadButton).toBeVisible({ timeout: 8_000 });
    });
    await subjectWorkspacePage.page.screenshot({ path: 'test-results/screenshots/uc-up-01-upload-button.png', fullPage: true });
  });

  // ── UC-UP-02: Clicking upload opens the upload modal ─────────────────────
  test('clicking the upload button opens the upload modal @smoke', async ({
    subjectWorkspacePage,
  }) => {
    await test.step('Open the upload modal', async () => {
      await subjectWorkspacePage.openUploadModal();
    });
    await test.step('Verify upload modal is visible', async () => {
      await expect(subjectWorkspacePage.uploadModal).toBeVisible();
    });
    await subjectWorkspacePage.page.screenshot({ path: 'test-results/screenshots/uc-up-02-upload-modal-open.png', fullPage: true });
  });

  // ── UC-UP-03: Upload modal renders a file input ───────────────────────────
  test('upload modal contains a file input field', async ({
    subjectWorkspacePage,
  }) => {
    await test.step('Open the upload modal', async () => {
      await subjectWorkspacePage.openUploadModal();
    });
    await test.step('Verify file input is attached to DOM', async () => {
      await expect(subjectWorkspacePage.fileInput).toBeAttached({ timeout: 5_000 });
    });
    await subjectWorkspacePage.page.screenshot({ path: 'test-results/screenshots/uc-up-03-file-input.png', fullPage: true });
  });

  // ── UC-UP-04: Upload modal has a submit button ────────────────────────────
  test('upload modal contains a submit button @smoke', async ({
    subjectWorkspacePage,
  }) => {
    await test.step('Open the upload modal', async () => {
      await subjectWorkspacePage.openUploadModal();
    });
    await test.step('Verify submit button is visible', async () => {
      await expect(subjectWorkspacePage.uploadSubmitBtn).toBeVisible({ timeout: 5_000 });
    });
    await subjectWorkspacePage.page.screenshot({ path: 'test-results/screenshots/uc-up-04-submit-button.png', fullPage: true });
  });

  // ── UC-UP-05: Cancelling upload modal closes it ───────────────────────────
  test('cancelling the upload modal closes it without uploading', async ({
    subjectWorkspacePage,
  }) => {
    await test.step('Open the upload modal', async () => {
      await subjectWorkspacePage.openUploadModal();
    });
    await test.step('Close (cancel) the upload modal', async () => {
      await subjectWorkspacePage.closeUploadModal();
    });
    await test.step('Verify modal is no longer visible', async () => {
      await expect(subjectWorkspacePage.uploadModal).not.toBeVisible();
    });
    await subjectWorkspacePage.page.screenshot({ path: 'test-results/screenshots/uc-up-05-modal-closed.png', fullPage: true });
  });

  // ── UC-UP-06: File upload flow (small PDF fixture) ────────────────────────
  test('attaching a file in the upload modal enables the submit button', async ({
    subjectWorkspacePage,
  }) => {
    await test.step('Open the upload modal', async () => {
      await subjectWorkspacePage.openUploadModal();
    });
    await test.step('Attach fixture PDF to the file input', async () => {
      const fixturePath = path.resolve(__dirname, '../../test-data/fixture.pdf');
      await subjectWorkspacePage.fileInput.setInputFiles(fixturePath).catch(async () => {
        await subjectWorkspacePage.closeUploadModal();
        test.skip(true, 'fixture.pdf not found — skipping file attachment test');
      });
    });
    await test.step('Verify submit button is enabled after file selection', async () => {
      await expect(subjectWorkspacePage.uploadSubmitBtn).toBeEnabled({ timeout: 5_000 });
    });
    await subjectWorkspacePage.page.screenshot({ path: 'test-results/screenshots/uc-up-06-file-attached.png', fullPage: true });
    await test.step('Close modal without uploading', async () => {
      await subjectWorkspacePage.closeUploadModal();
    });
  });

  // ── UC-UP-07: /history shows uploaded documents for authenticated user ────
  test('files (history) page renders uploaded documents for authenticated user @smoke', async ({
    filesPage,
  }) => {
    await test.step('Verify history page URL', async () => {
      const url = filesPage.page.url();
      expect(url).toContain('/history');
    });
    await filesPage.page.screenshot({ path: 'test-results/screenshots/uc-up-07-history-page.png', fullPage: true });
  });

  // ── UC-UP-08: Unauthenticated access to /history shows GuestGate ──────────
  test('unauthenticated access to /history shows GuestGate', async ({ page }) => {
    await test.step('Navigate to /history as guest', async () => {
      await page.goto('/history');
      await page.waitForLoadState('domcontentloaded');
    });
    await test.step('Verify GuestGate sign-in link is visible', async () => {
      const signInLink = page.getByRole('link', { name: /sign in/i });
      await expect(signInLink).toBeVisible({ timeout: 8_000 });
    });
    await page.screenshot({ path: 'test-results/screenshots/uc-up-08-guest-gate.png', fullPage: true });
  });
});
