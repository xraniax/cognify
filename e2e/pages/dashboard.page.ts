/**
 * dashboard.page.ts  — Page Object for /dashboard (MainLayout)
 *
 * MainLayout renders a sidebar with nav links and a logout button.
 * We model that shared chrome here so every authenticated-page test
 * can reuse navigation and logout helpers.
 */
import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class DashboardPage extends BasePage {
  readonly path = '/dashboard';

  // ── Sidebar nav links ─────────────────────────────────────────────────────
  readonly navDashboard: Locator;
  readonly navGoals:     Locator;
  readonly navAnalytics: Locator;
  readonly navTrash:     Locator;

  // ── Header / sidebar actions ──────────────────────────────────────────────
  readonly profileLink:  Locator;
  readonly logoutButton: Locator;

  // ── Dashboard content ─────────────────────────────────────────────────────
  readonly searchInput:  Locator;

  constructor(page: Page) {
    super(page);

    // Sidebar navigation — match by href to avoid brittle text matching
    this.navDashboard = page.getByRole('link', { name: /dashboard/i }).first();
    this.navGoals     = page.getByRole('link', { name: /goals/i }).first();
    this.navAnalytics = page.getByRole('link', { name: /analytics/i }).first();
    this.navTrash     = page.getByRole('link', { name: /trash/i }).first();

    // Profile avatar link in the sidebar header
    this.profileLink  = page.locator('a[href="/profile"]').first();

    // Logout button has a stable data-testid
    this.logoutButton = page.locator('[data-testid="logout-btn"]');

    // Subject search input
    this.searchInput  = page.locator('input[placeholder]').first();
  }

  async open(): Promise<this> {
    await this.goto(this.path);
    await this.waitForAuthenticated();
    return this;
  }

  /** Verify we're on the dashboard and the sidebar is visible. */
  async waitForAuthenticated(): Promise<void> {
    await expect(this.logoutButton).toBeVisible({ timeout: 15_000 });
  }

  async logout(): Promise<void> {
    await this.logoutButton.click();
    await this.page.waitForURL((url) => url.pathname.includes('/login'), {
      timeout: 10_000,
    });
  }

  async goToProfile(): Promise<void> {
    await this.profileLink.click();
    await this.waitForPath('/profile');
  }

  async goToAnalytics(): Promise<void> {
    await this.navAnalytics.click();
    await this.waitForPath('/analytics');
  }
}
