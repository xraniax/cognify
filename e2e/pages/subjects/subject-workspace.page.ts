/**
 * pages/subjects/subject-workspace.page.ts  — Page Object for /subjects/:id
 *
 * SubjectDetail.jsx renders a three-panel workspace:
 *  - Left  : FilePanel (collapsed/expanded, lists uploads)
 *  - Center: WorkspaceTabs (Flashcards, Quiz, Summary, etc.)
 *  - Right : ChatPanel (AI assistant)
 *
 * Because the URL contains a dynamic subject ID, this page object does NOT
 * have a static `path`.  Use `openFromDashboard()` to navigate there via the
 * dashboard subject card, or construct the URL manually if you have the ID.
 */
import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from '../base.page';

export class SubjectWorkspacePage extends BasePage {

  // ── Header ───────────────────────────────────────────────────────────────
  // Subject name appears as a heading or strong text in the top bar
  readonly subjectHeading: Locator;
  // Back link to /dashboard
  readonly backLink:       Locator;

  // ── File panel ───────────────────────────────────────────────────────────
  // The toggle button for the file panel uses the PanelLeft icon
  readonly filePanelToggle: Locator;

  // ── Upload ───────────────────────────────────────────────────────────────
  // Upload button (Upload icon) in the top toolbar
  readonly uploadButton: Locator;
  // The upload modal overlay
  readonly uploadModal:  Locator;
  // File input inside the modal
  readonly fileInput:    Locator;
  // Submit/Upload button inside the modal
  readonly uploadSubmitBtn: Locator;
  // Close/Cancel button inside the modal
  readonly uploadCancelBtn: Locator;

  // ── Workspace tabs ───────────────────────────────────────────────────────
  // The tab bar rendered by WorkspaceTabs
  readonly tabList: Locator;

  // ── Chat panel ───────────────────────────────────────────────────────────
  readonly chatPanelToggle: Locator;

  constructor(page: Page) {
    super(page);

    this.subjectHeading = page.locator('h1, h2').first();
    this.backLink = page.locator('a[href="/dashboard"], a[href*="dashboard"]').first();

    // Panel toggle buttons use lucide icons — match by aria-label or svg class
    this.filePanelToggle  = page.locator('button').filter({
      has: page.locator('[data-lucide="panel-left"], .lucide-panel-left'),
    }).first();
    this.chatPanelToggle  = page.locator('button').filter({
      has: page.locator('[data-lucide="panel-right"], .lucide-panel-right'),
    }).first();

    // Upload button: the Upload icon in the toolbar
    this.uploadButton = page.locator('button').filter({
      has: page.locator('[data-lucide="upload"], .lucide-upload'),
    }).first();

    // Upload modal is a fixed overlay (UploadModal component)
    this.uploadModal     = page.locator('.fixed.inset-0, [role="dialog"]').last();
    this.fileInput       = page.locator('input[type="file"]');
    this.uploadSubmitBtn = page.getByRole('button', { name: /upload|submit/i }).last();
    this.uploadCancelBtn = page.getByRole('button', { name: /cancel|close/i }).last();

    // Tab list rendered by WorkspaceTabs
    this.tabList = page.locator('[role="tablist"]');
  }

  /**
   * Navigate to the workspace by clicking the first subject card on /dashboard.
   * Returns this page object once the workspace URL is confirmed.
   */
  async openFromDashboard(): Promise<this> {
    await this.goto('/dashboard');
    await this.waitForPageReady();
    const firstCard = this.page.locator('a[href*="/subjects/"]').first();
    await expect(firstCard).toBeVisible({ timeout: 15_000 });
    await firstCard.click();
    await this.page.waitForURL(/\/subjects\//, { timeout: 15_000 });
    await this.waitForPageReady();
    return this;
  }

  /** Open the upload modal. */
  async openUploadModal(): Promise<void> {
    await this.uploadButton.click();
    await expect(this.uploadModal).toBeVisible({ timeout: 6_000 });
  }

  /** Close the upload modal via Cancel. */
  async closeUploadModal(): Promise<void> {
    await this.uploadCancelBtn.click();
    await expect(this.uploadModal).not.toBeVisible({ timeout: 5_000 });
  }

  /** Returns whether the workspace URL matches /subjects/:id */
  isWorkspaceUrl(): boolean {
    return /\/subjects\//.test(this.page.url());
  }
}
