/**
 * pages/goals.page.ts  — Page Object for /goals
 *
 * Goals.jsx renders a mission/goals list with:
 *  - Stats section (total goals, completed, active session)
 *  - A "+ Add" button that opens GoalSettingModal
 *  - Filter tabs (all / active / completed)
 *  - Search input
 *  - Per-goal cards with start/edit/delete actions
 */
import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class GoalsPage extends BasePage {
  readonly path = '/goals';

  // ── Page structure ───────────────────────────────────────────────────────
  readonly pageHeading: Locator;
  readonly statsSection: Locator;

  // ── Toolbar ──────────────────────────────────────────────────────────────
  readonly addButton:   Locator;
  readonly searchInput: Locator;

  // ── Filter tabs ──────────────────────────────────────────────────────────
  readonly filterAll:       Locator;
  readonly filterActive:    Locator;
  readonly filterCompleted: Locator;

  // ── Goal creation modal ──────────────────────────────────────────────────
  readonly goalModal:           Locator;
  readonly goalTitleInput:      Locator;
  readonly goalSaveBtn:         Locator;
  readonly goalModalCloseBtn:   Locator;

  // ── Goal list ────────────────────────────────────────────────────────────
  // Each goal card has an edit (Edit2 icon) and delete (Trash2 icon) button
  readonly firstGoalEditBtn:   Locator;
  readonly firstGoalDeleteBtn: Locator;
  readonly firstGoalStartBtn:  Locator;

  constructor(page: Page) {
    super(page);

    this.pageHeading  = page.getByRole('heading').filter({ hasText: /goals|missions/i }).first();
    this.statsSection = page.locator('text=/total|completed|active/i').first();

    // "Launch Mission" when no goals exist (empty state); "New Mission" FAB when goals exist
    this.addButton   = page.getByRole('button', { name: /launch mission|new mission/i }).first();
    this.searchInput = page.locator('input[placeholder*="search" i], input[placeholder*="mission" i]').first();

    this.filterAll       = page.getByRole('button', { name: /^all$/i });
    this.filterActive    = page.getByRole('button', { name: /^active$/i });
    this.filterCompleted = page.getByRole('button', { name: /^completed$/i });

    // GoalSettingModal renders as a fixed overlay with two steps
    this.goalModal         = page.locator('.fixed.inset-0, [role="dialog"]').last();
    // Title input only appears on step 2 of the modal (placeholder is the example text)
    this.goalTitleInput    = page.locator('input[placeholder*="Master Calculus" i]');
    this.goalSaveBtn       = page.getByRole('button', { name: /save|create goal/i }).last();
    this.goalModalCloseBtn = page.getByRole('button', { name: /close|cancel/i }).last();

    this.firstGoalEditBtn   = page.getByRole('button', { name: /edit/i }).first();
    this.firstGoalDeleteBtn = page.locator('button').filter({ has: page.locator('svg.lucide-trash-2, svg[data-lucide="trash-2"]') }).first();
    this.firstGoalStartBtn  = page.getByRole('button', { name: /start mission/i }).first();
  }

  async open(): Promise<this> {
    await this.goto(this.path);
    await this.waitForPageReady();
    return this;
  }

  /** Open the goal creation modal and advance to the custom form (step 2). */
  async clickAdd(): Promise<void> {
    await this.addButton.click();
    await expect(this.goalModal).toBeVisible({ timeout: 5_000 });
    // Step 1 shows preset templates; advance to the form so title input is visible
    await this.page.getByRole('button', { name: /create custom goal/i }).click();
    await expect(this.goalTitleInput).toBeVisible({ timeout: 5_000 });
  }

  /** Fill the goal title and save (clickAdd already advances to step 2). */
  async createGoal(title: string): Promise<void> {
    await this.clickAdd();
    await this.goalTitleInput.fill(title);
    await this.goalSaveBtn.click();
    await expect(this.goalModal).not.toBeVisible({ timeout: 8_000 });
  }

  /** Count visible goal cards — each card has exactly one "Progress" label. */
  async goalCount(): Promise<number> {
    return this.page.getByText('Progress', { exact: true }).count();
  }
}
