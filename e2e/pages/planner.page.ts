/**
 * pages/planner.page.ts  — Page Object for /planner
 *
 * PlannerDashboard.tsx renders a sub-nav with five tabs:
 *   Overview | Goals | Kanban | Calendar | Habits
 *
 * The Overview tab hosts:
 *  - PlannerHero    (stats / hero section)
 *  - AIPlannerChat  (AI study plan assistant with chat input)
 *  - AIRecommendations
 *
 * The AI chat allows users to generate a study plan by describing their needs
 * in natural language.
 */
import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class PlannerPage extends BasePage {
  readonly path = '/planner';

  // ── Layout ───────────────────────────────────────────────────────────────
  readonly pageHeading: Locator;

  // ── Sub-nav tabs ─────────────────────────────────────────────────────────
  readonly tabOverview:  Locator;
  readonly tabGoals:     Locator;
  readonly tabKanban:    Locator;
  readonly tabCalendar:  Locator;
  readonly tabHabits:    Locator;

  // ── Quick Add button (Plus icon in the header) ────────────────────────────
  readonly quickAddButton: Locator;

  // ── AI Planner Chat (Overview tab) ───────────────────────────────────────
  // The initial assistant message is always present
  readonly chatAssistantMsg: Locator;
  readonly chatInput:        Locator;
  readonly chatSendButton:   Locator;

  constructor(page: Page) {
    super(page);

    this.pageHeading = page.getByRole('heading', { name: /planner/i }).first();

    // Scope tab locators to <main> to avoid collision with the Navbar "Goals" button
    const main = page.getByRole('main');
    this.tabOverview  = main.getByRole('button', { name: /overview/i });
    this.tabGoals     = main.getByRole('button', { name: /^goals$/i });
    this.tabKanban    = main.getByRole('button', { name: /kanban/i });
    this.tabCalendar  = main.getByRole('button', { name: /calendar/i });
    this.tabHabits    = main.getByRole('button', { name: /habits/i });

    // Quick Add: a button with a Plus icon in the top-right of the header
    this.quickAddButton = page.locator('button').filter({
      has: page.locator('[data-lucide="plus"], .lucide-plus'),
    }).first();

    // AI chat: the greeting message from the assistant is always pre-rendered
    this.chatAssistantMsg = page.getByText(/planning assistant|organizing your study/i).first();

    // Chat input: scoped by placeholder to avoid matching other text inputs
    this.chatInput = page.locator('input[placeholder*="Type your request"]');

    // Send button: icon-only submit button inside the chat form (no text accessible name)
    this.chatSendButton = page.getByRole('complementary').locator('button[type="submit"]');
  }

  async open(): Promise<this> {
    await this.goto(this.path);
    await this.waitForPageReady();
    return this;
  }

  /** Navigate to a specific sub-tab. */
  async goToTab(tab: 'overview' | 'goals' | 'tasks' | 'calendar' | 'habits'): Promise<void> {
    const btn = {
      overview:  this.tabOverview,
      goals:     this.tabGoals,
      tasks:     this.tabKanban,
      calendar:  this.tabCalendar,
      habits:    this.tabHabits,
    }[tab];
    await btn.click();
    await this.page.waitForTimeout(300);
  }

  /** Send a message in the AI Planner Chat. */
  async sendChatMessage(message: string): Promise<void> {
    await this.chatInput.fill(message);
    await this.chatSendButton.click();
  }
}
