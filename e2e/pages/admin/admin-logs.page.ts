/**
 * pages/admin/admin-logs.page.ts
 *
 * Page object for the Admin Monitoring / Logs page (/admin/logs).
 *
 * AdminLogs.jsx structure:
 *  - Heading: "System Monitoring"
 *  - 4 system-stat cards (API Latency, CPU Cluster, Memory Load, Audit Events)
 *  - 3 tabs: Audit Logs | User Behavior | Security
 *  - Audit tab: filter <select> (All Events / Informational / Warnings / Critical)
 *              + search input (placeholder "Search by action, user…")
 *  - Refresh button in header
 */
import { Page, Locator } from '@playwright/test';
import { BasePage } from '../base.page';

export class AdminLogsPage extends BasePage {
  readonly pageHeading:  Locator;
  readonly refreshButton: Locator;
  readonly searchInput:  Locator;
  readonly filterSelect: Locator;
  readonly tabAudit:     Locator;
  readonly tabBehavior:  Locator;
  readonly tabSecurity:  Locator;

  constructor(page: Page) {
    super(page);
    // h1 contains "System" + <span>Monitoring</span>
    this.pageHeading   = page.getByRole('heading', { name: /system monitoring/i });
    this.refreshButton = page.getByRole('button', { name: /refresh/i });
    this.searchInput   = page.getByPlaceholder(/search by action, user/i);
    this.filterSelect  = page.locator('select').first();
    this.tabAudit      = page.getByRole('button', { name: /audit logs/i });
    this.tabBehavior   = page.getByRole('button', { name: /user behavior/i });
    this.tabSecurity   = page.getByRole('button', { name: /^security$/i });
  }

  async open(): Promise<void> {
    await this.page.goto('/admin/logs');
    await this.waitForPageReady();
  }
}
