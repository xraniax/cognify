/**
 * pages/files.page.ts  — Page Object for /history  ("View Files")
 *
 * History.jsx renders all uploaded materials grouped by date.
 * Key elements:
 *  - Search input (filters by title or subject name)
 *  - Grid / List view toggle buttons
 *  - Material cards (each is an <a> link to the subject workspace)
 *  - Delete button (Trash2 icon) per card — asks for window.confirm
 */
import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class FilesPage extends BasePage {
  readonly path = '/history';

  // ── Toolbar ──────────────────────────────────────────────────────────────
  readonly searchInput:  Locator;
  readonly gridViewBtn:  Locator;
  readonly listViewBtn:  Locator;

  // ── Content ──────────────────────────────────────────────────────────────
  // Material cards are <a> elements that link into /subjects/:id
  readonly materialLinks:    Locator;
  readonly emptyStateMsg:    Locator;

  // ── Per-item delete ──────────────────────────────────────────────────────
  readonly firstDeleteBtn: Locator;

  constructor(page: Page) {
    super(page);

    this.searchInput = page.locator('input[placeholder]').first();

    // View-toggle: two icon buttons in the toolbar — LayoutGrid then List
    this.gridViewBtn = page.locator('button').filter({ has: page.locator('[data-lucide="layout-grid"], .lucide-layout-grid') }).first();
    this.listViewBtn = page.locator('button').filter({ has: page.locator('[data-lucide="list"], .lucide-list') }).first();

    this.materialLinks  = page.locator('a[href*="/subjects/"]');
    this.emptyStateMsg  = page.getByText(/no (files|materials|documents|uploads)/i);

    // Delete buttons use Trash2 icon
    this.firstDeleteBtn = page.locator('button').filter({
      has: page.locator('[data-lucide="trash-2"], .lucide-trash-2'),
    }).first();
  }

  async open(): Promise<this> {
    await this.goto(this.path);
    await this.waitForPageReady();
    return this;
  }

  /** Returns the count of material card links rendered on the page. */
  async materialCount(): Promise<number> {
    return this.materialLinks.count();
  }

  /** Type into the search box. */
  async search(query: string): Promise<void> {
    await this.searchInput.fill(query);
    // Small wait for the filter to apply (client-side, no network)
    await this.page.waitForTimeout(300);
  }

  /** Clear the search box. */
  async clearSearch(): Promise<void> {
    await this.searchInput.clear();
    await this.page.waitForTimeout(300);
  }
}
