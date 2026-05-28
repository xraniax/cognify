/**
 * admin-users.page.ts  — Page Object for /admin/users
 *
 * AdminLayout renders sidebar nav as <button onClick={navigate}> elements,
 * NOT <Link> components.  Selectors use getByRole('button') accordingly.
 *
 * Admin sidebar label map:
 *   Dashboard  → /admin
 *   Users      → /admin/users
 *   Files      → /admin/files
 *   Monitoring → /admin/logs
 *   System Rules → /admin/settings
 */
import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from '../base.page';

export class AdminUsersPage extends BasePage {
  readonly path = '/admin/users';

  readonly logoutButton: Locator;

  // ── Sidebar nav buttons (onClick-based navigation) ────────────────────────
  readonly navDashboard:  Locator;
  readonly navUsers:      Locator;
  readonly navFiles:      Locator;
  readonly navLogs:       Locator;      // label: "Monitoring"
  readonly navSettings:   Locator;      // label: "System Rules"

  constructor(page: Page) {
    super(page);

    this.logoutButton  = page.locator('[data-testid="logout-btn"]');

    this.navDashboard  = page.getByRole('button', { name: /^dashboard$/i });
    this.navUsers      = page.getByRole('button', { name: /^users$/i });
    this.navFiles      = page.getByRole('button', { name: /^files$/i });
    this.navLogs       = page.getByRole('button', { name: /^monitoring$/i });
    this.navSettings   = page.getByRole('button', { name: /^system rules$/i });
  }

  async open(): Promise<this> {
    await this.goto(this.path);
    await this.waitForPageLoaded();
    return this;
  }

  async waitForPageLoaded(): Promise<void> {
    await expect(this.logoutButton).toBeVisible({ timeout: 15_000 });
  }

  async logout(): Promise<void> {
    await this.logoutButton.click();
    await this.page.waitForURL((url) => url.pathname.includes('/login'), {
      timeout: 10_000,
    });
  }
}
