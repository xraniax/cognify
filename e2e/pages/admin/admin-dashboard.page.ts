/**
 * pages/admin/admin-dashboard.page.ts
 *
 * Page object for the Admin Dashboard page (/admin).
 *
 * Covers:
 *  - AdminDashboard.jsx — heading "Admin Dashboard", KPI cards, ActivityStream
 *  - AdminLayout notification bell — System Alerts dropdown in the header
 *
 * Notification bell: a button containing a Bell SVG (no accessible name).
 * The dropdown shows "System Alerts" header, notification items or
 * "System Nominal" empty state, and a "View all in Monitoring" footer link.
 */
import { Page, Locator } from '@playwright/test';
import { BasePage } from '../base.page';

export class AdminDashboardPage extends BasePage {
  /** Main page heading */
  readonly pageHeading:             Locator;
  /** Notification bell button in the AdminLayout header */
  readonly notificationBell:        Locator;
  /** "System Alerts" heading inside the notification dropdown */
  readonly notificationDropdownHeader: Locator;
  /** "View all in Monitoring" button at the bottom of the dropdown */
  readonly viewAllInMonitoringBtn:  Locator;
  /** "Student activity stream" label above the ActivityStream component */
  readonly activityStreamLabel:     Locator;

  constructor(page: Page) {
    super(page);
    this.pageHeading               = page.getByRole('heading', { name: /admin dashboard/i });
    // Bell icon button — no accessible name; target via SVG class
    this.notificationBell          = page.locator('button').filter({
      has: page.locator('svg.lucide-bell'),
    });
    this.notificationDropdownHeader = page.getByText(/system alerts/i).first();
    this.viewAllInMonitoringBtn    = page.getByRole('button', { name: /view full audit stream/i });
    this.activityStreamLabel       = page.getByText(/student activity stream/i).first();
  }

  async open(): Promise<void> {
    await this.page.goto('/admin');
    await this.waitForPageReady();
  }

  /** Opens the notification dropdown by clicking the bell button. */
  async openNotifications(): Promise<void> {
    await this.notificationBell.click();
  }
}
